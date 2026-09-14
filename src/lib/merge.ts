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

  // ---- 盲测场次：票按测试员并集；同人分叉投票做与合并方向无关的对称裁决 ----
  const voteTime = (v: Vote) => {
    const t = Date.parse(v.at)
    return Number.isNaN(t) ? 0 : t
  }

  const allSessionIds = Array.from(
    new Set([...local.sessions.map((x) => x.id), ...remote.sessions.map((x) => x.id)]),
  )
  for (const sid of allSessionIds) {
    const lSes = local.sessions.find((x) => x.id === sid)
    const rSes = remote.sessions.find((x) => x.id === sid)
    const outSes = out.sessions.find((x) => x.id === sid)
    if (!outSes) continue // 被墓碑删除的场次跳过

    // 评审团 / 样本：成员并集（不漏掉任一页新增）
    outSes.panel = Array.from(new Set([...(lSes?.panel ?? []), ...(rSes?.panel ?? [])]))
    outSes.sampleCodes = Array.from(new Set([...(lSes?.sampleCodes ?? []), ...(rSes?.sampleCodes ?? [])]))

    // 把两页的票按测试员归集（每页同人至多一票），再对称收敛
    const byTester = new Map<string, Vote[]>()
    for (const v of [...(lSes?.votes ?? []), ...(rSes?.votes ?? [])]) {
      const arr = byTester.get(v.testerId) ?? []
      arr.push(structuredClone(v))
      byTester.set(v.testerId, arr)
    }

    const finalVotes: Vote[] = []
    for (const [testerId, rawVotes] of byTester) {
      // 先按内容分组：相同票（同评分同评语）幂等吸收为一张，时间取最早
      const groups = new Map<string, Vote[]>()
      for (const v of rawVotes) {
        const k = `${v.rating}${v.comment}`
        const arr = groups.get(k) ?? []
        arr.push(v)
        groups.set(k, arr)
      }
      const uniqVotes = [...groups.values()].map((same) =>
        same.reduce((earliest, v) => (voteTime(v) < voteTime(earliest) ? v : earliest)),
      )

      if (uniqVotes.length === 1) {
        finalVotes.push(uniqVotes[0])
        continue
      }
      // 不同票：先按时间取最早；同时间用与方向无关的确定性键裁决，只记一次冲突
      uniqVotes.sort((a, b) => {
        const ta = voteTime(a)
        const tb = voteTime(b)
        if (ta !== tb) return ta - tb
        return `${a.rating} ${a.comment}` < `${b.rating} ${b.comment}` ? -1 : 1
      })
      const kept = uniqVotes[0]
      const dropped = uniqVotes[1]
      const tied = voteTime(kept) === voteTime(dropped)
      finalVotes.push(kept)
      voteConflicts.push({
        sessionId: sid,
        sessionCode: outSes.code,
        testerId,
        keptRating: kept.rating,
        droppedRating: dropped.rating,
        reason: tied
          ? `同一测试员在两页于同一投票时间写入不同评分：确定性保留 ${kept.rating}，${dropped.rating} 记为冲突（正反向合并结果一致）`
          : `同一测试员分叉投票：先投 ${kept.rating} 保留，后投 ${dropped.rating} 拦截（不静默覆盖）`,
      })
    }
    finalVotes.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : a.testerId < b.testerId ? -1 : 1))
    outSes.votes = finalVotes
  }
  // 冲突报告顺序也与合并方向无关
  voteConflicts.sort((a, b) =>
    a.sessionId === b.sessionId
      ? a.testerId < b.testerId ? -1 : a.testerId > b.testerId ? 1 : 0
      : a.sessionId < b.sessionId ? -1 : 1,
  )

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
