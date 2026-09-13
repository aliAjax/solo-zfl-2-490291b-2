import type { AppState, MergeReport, ResolvedField, Vote, VoteConflict } from '../types/domain'

function scalarFields(o: Record<string, unknown>): string[] {
  return Object.keys(o).filter(
    (k) => k !== 'id' && (o[k] === null || ['string', 'number', 'boolean'].includes(typeof o[k])),
  )
}

const MERGE_COLLS = [
  'batches',
  'prototypes',
  'switchBatches',
  'recipes',
  'stations',
  'bookings',
  'sessions',
  'consumptions',
  'notifications',
  'users',
] as const

function userName(s: AppState, id: string) {
  return s.users.find((u) => u.id === id)?.name ?? id
}

function maxFieldVersion(fieldMeta: AppState['fieldMeta'], id: string): number {
  let maxV = -1
  for (const [k, m] of Object.entries(fieldMeta)) {
    if (k.startsWith(`${id}.`) && m.v > maxV) maxV = m.v
  }
  return maxV
}

/**
 * 两个离线页面对同一状态的修改逐字段裁决。
 * - 标量字段：按字段逻辑时钟 LWW，平局以用户 id 决胜，逐字段出裁决记录
 * - 数组字段（panel/votes/sampleCodes 等）：按字段时钟整体取新
 * - 集合实体：union，删除以墓碑（带时钟）裁决（删除后若有更高版本写入则复活）
 * - 测量：按 dedupKey 去重，重复测量只吸收一次
 */
export function mergeStates(
  local: AppState,
  remote: AppState,
): { state: AppState; report: Omit<MergeReport, 'at' | 'withTab'> } {
  const out: AppState = structuredClone(local)
  const changedScalars: ResolvedField[] = []
  const addedEntities: string[] = []
  const removedTombstones: string[] = []
  const duplicateMeasurements: string[] = []
  const voteConflicts: VoteConflict[] = []

  out.clock = Math.max(local.clock, remote.clock)

  // 字段版本：按更高时钟合并（平局用户 id 小者胜）
  for (const [key, meta] of Object.entries(remote.fieldMeta)) {
    const ours = local.fieldMeta[key]
    if (!ours || meta.v > ours.v || (meta.v === ours.v && meta.by < ours.by)) {
      out.fieldMeta[key] = structuredClone(meta)
    }
  }
  for (const [id, tv] of Object.entries(remote.tombstones)) {
    if ((out.tombstones[id] ?? -1) < tv) out.tombstones[id] = tv
  }

  // ---- 集合实体：union 后逐字段裁决 ----
  for (const coll of MERGE_COLLS) {
    const localList = local[coll] as unknown as Array<Record<string, unknown>>
    const remoteList = remote[coll] as unknown as Array<Record<string, unknown>>
    const merged = new Map<string, Record<string, unknown>>()
    for (const e of localList) merged.set(e.id as string, structuredClone(e))

    for (const rEnt of remoteList) {
      const id = rEnt.id as string
      const lEnt = merged.get(id)
      if (!lEnt) {
        merged.set(id, structuredClone(rEnt))
        addedEntities.push(`${coll}:${id}`)
        continue
      }
      for (const key of new Set([...scalarFields(lEnt), ...scalarFields(rEnt)])) {
        const lv = lEnt[key]
        const rv = rEnt[key]
        if (JSON.stringify(lv) === JSON.stringify(rv)) continue
        const lf = local.fieldMeta[`${id}.${key}`]
        const rf = remote.fieldMeta[`${id}.${key}`]
        const lV = lf?.v ?? -1
        const rV = rf?.v ?? -1
        const remoteWins = rV > lV || (rV === lV && (rf?.by ?? '') < (lf?.by ?? ''))
        if (remoteWins) {
          lEnt[key] = rv
          changedScalars.push({
            key: `${id}.${key}`,
            winner: userName(local, rf?.by ?? 'remote'),
            loser: userName(local, lf?.by ?? 'local'),
            local: lv,
            remote: rv,
            reason: `版本 ${rV} ≥ ${lV}`,
          })
        } else {
          changedScalars.push({
            key: `${id}.${key}`,
            winner: userName(local, lf?.by ?? 'local'),
            loser: userName(local, rf?.by ?? 'remote'),
            local: lv,
            remote: rv,
            reason: `版本 ${lV} > ${rV}`,
          })
        }
      }
      for (const key of Object.keys(rEnt)) {
        if (!Array.isArray(rEnt[key])) continue
        // votes/panel/sampleCodes 由盲测场次专用裁决处理（不同测试员的票必须并存）
        if (coll === 'sessions') continue
        const lf = local.fieldMeta[`${id}.${key}`]
        const rf = remote.fieldMeta[`${id}.${key}`]
        if ((rf?.v ?? -1) > (lf?.v ?? -1)) lEnt[key] = structuredClone(rEnt[key])
      }
    }
    ;(out[coll] as unknown) = [...merged.values()]
  }

  // ---- 盲测场次：票按测试员并集；同人分叉投票检测冲突，先投保留、后投拦截 ----
  const voteAt = (v: Vote) => {
    const t = new Date(v.at).getTime()
    return Number.isNaN(t) ? 0 : t
  }
  for (const rSes of remote.sessions) {
    const lSes = out.sessions.find((x) => x.id === rSes.id)
    if (!lSes) continue // 新建场次已在 union 阶段加入；被墓碑删除的场次跳过
    // 评审团 / 样本：按成员并集（不漏掉任一页新增成员或样本）
    lSes.panel = Array.from(new Set([...lSes.panel, ...rSes.panel]))
    lSes.sampleCodes = Array.from(new Set([...lSes.sampleCodes, ...rSes.sampleCodes]))

    const localHasVote = (testerId: string) => lSes.votes.some((v) => v.testerId === testerId)
    for (const rv of rSes.votes) {
      if (!localHasVote(rv.testerId)) {
        // 不同测试员的合法票：双方都保留
        lSes.votes = [...lSes.votes, structuredClone(rv)]
        continue
      }
      const lv = lSes.votes.find((v) => v.testerId === rv.testerId)!
      // 同票（内容一致）幂等吸收；不同票=同人分叉重复投票，拦截后投
      if (lv.rating === rv.rating && lv.comment === rv.comment) continue
      const lvAt = voteAt(lv)
      const rvAt = voteAt(rv)
      if (rvAt >= lvAt) {
        // 远程是后投：保持本地先投，记录冲突
        voteConflicts.push({
          sessionId: rSes.id,
          sessionCode: rSes.code,
          testerId: rv.testerId,
          keptRating: lv.rating,
          droppedRating: rv.rating,
          reason: `同一测试员分叉投票：先投 ${lv.rating} 保留，后投 ${rv.rating} 拦截（不静默覆盖）`,
        })
      } else {
        // 远程更早：以远程先投为准，本地后投计入冲突
        voteConflicts.push({
          sessionId: rSes.id,
          sessionCode: rSes.code,
          testerId: rv.testerId,
          keptRating: rv.rating,
          droppedRating: lv.rating,
          reason: `同一测试员分叉投票：先投 ${rv.rating} 保留，后投 ${lv.rating} 拦截（不静默覆盖）`,
        })
        lSes.votes = lSes.votes.map((v) => (v.testerId === rv.testerId ? structuredClone(rv) : v))
      }
    }
    lSes.votes.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0))
  }

  // ---- 应用墓碑删除 ----
  for (const coll of MERGE_COLLS) {
    const list = out[coll] as unknown as Array<Record<string, unknown>>
    const kept = list.filter((e) => {
      const tv = out.tombstones[e.id as string]
      if (tv === undefined) return true
      if (maxFieldVersion(out.fieldMeta, e.id as string) >= tv) return true
      removedTombstones.push(e.id as string)
      return false
    })
    ;(out[coll] as unknown) = kept
  }

  // ---- 测量：append + dedupKey 去重 ----
  const seenKeys = new Set(out.measurements.map((m) => m.dedupKey))
  const seenIds = new Set(out.measurements.map((m) => m.id))
  for (const rm of remote.measurements) {
    if (seenIds.has(rm.id)) continue
    if (seenKeys.has(rm.dedupKey)) {
      duplicateMeasurements.push(rm.dedupKey)
      continue
    }
    out.measurements.push(structuredClone(rm))
    seenIds.add(rm.id)
    seenKeys.add(rm.dedupKey)
    addedEntities.push(`measurement:${rm.id}`)
  }
  for (const key of Object.keys(remote.dedup)) {
    if ((out.dedup[key] ?? -1) < remote.dedup[key]) out.dedup[key] = remote.dedup[key]
  }

  const auditIds = new Set(out.audit.map((a) => a.id))
  for (const a of remote.audit) if (!auditIds.has(a.id)) out.audit.push(structuredClone(a))
  out.audit.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0))

  const summary =
    `逐字段裁决 ${changedScalars.length} 项；新增实体 ${addedEntities.length}；` +
    `墓碑删除 ${[...new Set(removedTombstones)].length}；重复测量吸收 ${duplicateMeasurements.length} 条；` +
    `盲测重复投票拦截 ${voteConflicts.length} 票`

  return {
    state: out,
    report: {
      changedScalars,
      addedEntities,
      removedTombstones: [...new Set(removedTombstones)],
      duplicateMeasurements,
      voteConflicts,
      summary,
    },
  }
}

export type { MergeReport }
