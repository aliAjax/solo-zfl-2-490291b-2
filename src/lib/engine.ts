import type {
  AppState,
  AuditEvent,
  Batch,
  BatchResult,
  Booking,
  BlindSession,
  Consumption,
  Measurement,
  Notification,
  Prototype,
  Recipe,
  Stage,
  Station,
  SwitchBatch,
  User,
  Vote,
} from '../types/domain'
import {
  bookingValidationErrors,
  can,
  findBookingConflict,
  isAnomalous,
  isSelfAssembled,
  measurementBlockers,
  transitionBlockers,
} from './rules'

export class ActionError extends Error {}

let seq = 0
const uid = (p: string) => `${p}_${Date.now().toString(36)}${(seq++).toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`
export const newId = uid

const nowIso = () => new Date().toISOString()

// 参与逐字段合并的实体集合（按 id，LWW 标量 + 删除墓碑）
const ENTITY_COLLS = [
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
type EntityColl = (typeof ENTITY_COLLS)[number]

interface Outcome {
  state: AppState
  events: AuditEvent[]
  notice?: string
}

type Ctx = {
  s: AppState
  actor: User
  v: number
  events: AuditEvent[]
  txId: string
  set: (coll: EntityColl, id: string, field: string, val: unknown) => void
  stamp: (coll: EntityColl, ent: { id: string }) => void
  tombstone: (id: string) => void
  seen: (dedupKey: string) => void
}

function makeCtx(s: AppState, actor: User, action: string): Ctx {
  const txId = uid('tx')
  const ctx: Ctx = {
    s,
    actor,
    v: s.clock,
    events: [],
    txId,
    set(coll, id, field, val) {
      const list = s[coll] as unknown as Array<Record<string, unknown>>
      const ent = list.find((e) => e.id === id)
      if (!ent) throw new ActionError(`内部错误：${coll}/${id} 不存在`)
      ent[field] = val
      ctx.v += 1
      s.fieldMeta[`${id}.${field}`] = { v: ctx.v, by: actor.id }
    },
    stamp(coll, ent) {
      for (const [field, val] of Object.entries(ent)) {
        if (field === 'id' || Array.isArray(val) || typeof val === 'object') continue
        ctx.v += 1
        s.fieldMeta[`${ent.id}.${field}`] = { v: ctx.v, by: actor.id }
      }
    },
    tombstone(id) {
      ctx.v += 1
      s.tombstones[id] = ctx.v
    },
    seen(dedupKey) {
      ctx.v += 1
      s.dedup[dedupKey] = ctx.v
    },
  }
  return ctx
}

function audit(ctx: Ctx, action: string, okFlag: boolean, detail: string, rolledBack = false) {
  ctx.events.push({
    id: uid('aud'),
    txId: ctx.txId,
    at: nowIso(),
    actorId: ctx.actor.id,
    action,
    ok: okFlag,
    detail,
    rolledBack,
  })
}

// 校验通过后一次性提交；任何一步抛错都由 dispatch 捕获并整体回滚。
function commit(
  state: AppState,
  actor: User,
  action: string,
  detail: string,
  mutate: (ctx: Ctx) => string | void,
): Outcome {
  const s = structuredClone(state)
  const ctx = makeCtx(s, actor, action)
  try {
    const noticeOut = mutate(ctx)
    const notice = typeof noticeOut === 'string' ? noticeOut : undefined
    s.clock = ctx.v
    // 事务体没有主动记录事件时补一条成功事件
    if (!ctx.events.some((e) => e.txId === ctx.txId)) audit(ctx, action, true, detail)
    s.audit = [...s.audit, ...ctx.events]
    return { state: s, events: ctx.events, notice }
  } catch (err) {
    // 整单回滚：在进入前快照上记录失败，不保留任何业务改动
    const rolled = structuredClone(state)
    const rctx = makeCtx(rolled, actor, action)
    audit(rctx, action, false, `${detail} → 已整单回滚（${(err as Error).message}）`, true)
    rolled.clock = rctx.v
    rolled.audit = [...rolled.audit, ...rctx.events]
    return { state: rolled, events: rctx.events }
  }
}

function requirePerm(actor: User | undefined, action: string) {
  if (!actor) throw new ActionError('未登录')
  if (!can(actor, action)) throw new ActionError(`权限不足：${actor.name}（${actor.role}）不能执行 ${action}`)
}

function notify(s: AppState, userId: string | null, message: string): Notification {
  const n: Notification = { id: uid('ntf'), userId, message, at: nowIso(), read: false }
  s.notifications.push(n)
  return n
}

// ---------- 批次 ----------
function createBatch(state: AppState, actor: User, p: {
  switchBatchId: string; prototypeId: string; lubeRecipeId: string | null; priority: number; note: string
}): Outcome {
  return commit(state, actor, 'batch.create', `创建批次（样机 ${p.prototypeId}）`, (ctx) => {
    requirePerm(actor, 'batch.create')
    const s = ctx.s
    if (!s.switchBatches.some((x) => x.id === p.switchBatchId)) throw new ActionError('轴体批次不存在')
    if (!s.prototypes.some((x) => x.id === p.prototypeId)) throw new ActionError('样机不存在')
    if (p.lubeRecipeId && !s.recipes.some((r) => r.id === p.lubeRecipeId))
      throw new ActionError('润滑配方不存在')
    const batch: Batch = {
      id: uid('bat'),
      code: `B-${String(s.batches.length + 1).padStart(3, '0')}`,
      switchBatchId: p.switchBatchId,
      prototypeId: p.prototypeId,
      lubeRecipeId: p.lubeRecipeId,
      stage: 'queued',
      result: 'pending',
      priority: p.priority,
      note: p.note,
      quarantineReason: '',
      createdAt: nowIso(),
      updatedAt: nowIso(),
    }
    s.batches.push(batch)
    ctx.stamp('batches', batch)
  })
}

function transitionBatch(state: AppState, actor: User, id: string, target: Stage): Outcome {
  const batch = state.batches.find((b) => b.id === id)
  return commit(state, actor, 'batch.transition', `批次 ${batch?.code ?? id} 流转到 ${target}`, (ctx) => {
    requirePerm(actor, 'batch.transition')
    const s = ctx.s
    const b = s.batches.find((x) => x.id === id)
    if (!b) throw new ActionError('批次不存在')
    if (target === 'released') requirePerm(actor, 'batch.release')
    const gate = transitionBlockers(s, b, target)
    if (gate.blocked) throw new ActionError(gate.reasons.join('；'))

    ctx.set('batches', b.id, 'stage', target)
    ctx.set('batches', b.id, 'updatedAt', nowIso())
    if (target === 'quarantined') {
      // 隔离时无需另外改 result
    } else if (target === 'released') {
      ctx.set('batches', b.id, 'result', 'pass')
    } else if (target === 'retest') {
      ctx.set('batches', b.id, 'result', 'pending')
    }
    notify(s, null, `批次 ${b.code} 已流转：${target}`)
  })
}

function setReviewResult(state: AppState, actor: User, id: string, result: BatchResult): Outcome {
  const batch = state.batches.find((b) => b.id === id)
  return commit(state, actor, 'batch.transition', `批次 ${batch?.code ?? id} 评审结论 ${result}`, (ctx) => {
    requirePerm(actor, 'batch.transition')
    const s = ctx.s
    const b = s.batches.find((x) => x.id === id)
    if (!b) throw new ActionError('批次不存在')
    if (b.stage !== 'review') throw new ActionError('只有评审阶段可录入结论')
    ctx.set('batches', b.id, 'result', result)
    ctx.set('batches', b.id, 'updatedAt', nowIso())
  })
}

// 隔离批次：撤销预约 + 回退耗材 + 通知，全部在同一事务
function isolateBatch(s: AppState, ctx: Ctx, b: Batch, reason: string) {
  ctx.set('batches', b.id, 'stage', 'quarantined')
  ctx.set('batches', b.id, 'quarantineReason', reason)
  ctx.set('batches', b.id, 'updatedAt', nowIso())

  const liveBookings = s.bookings.filter((bk) => bk.batchId === b.id)
  for (const bk of liveBookings) {
    // 撤销预约
    s.bookings = s.bookings.filter((x) => x.id !== bk.id)
    ctx.tombstone(bk.id)
    // 回退耗材：删除该预约对应台账
    const used = s.consumptions.filter((c) => c.bookingId === bk.id)
    for (const c of used) {
      s.consumptions = s.consumptions.filter((x) => x.id !== c.id)
      ctx.tombstone(c.id)
    }
  }
  notify(s, null, `⛔ 批次 ${b.code} 已隔离：${reason}（已撤销 ${liveBookings.length} 个预约并回退耗材）`)
  audit(ctx, 'batch.quarantine', true, `批次 ${b.code} 隔离：${reason}`)
}

// ---------- 预约 / 机位 ----------
function createBooking(state: AppState, actor: User, p: Omit<Booking, 'id' | 'createdAt'> & {
  consumable: { item: string; qty: number }
}): Outcome {
  return commit(state, actor, 'booking.create', `预约机位 ${p.stationId} / 样机 ${p.prototypeId}`, (ctx) => {
    requirePerm(actor, 'booking.create')
    const s = ctx.s

    // 1) 日期与引用完整性：任一不合法整体拒绝，零写入
    const invalidReasons = bookingValidationErrors(s, p)
    if (invalidReasons.length) throw new ActionError(invalidReasons.join('；'))

    const station = s.stations.find((x) => x.id === p.stationId)!

    // 2) 资源时段冲突
    const conflict = findBookingConflict(s, p)
    if (conflict) {
      const which =
        conflict.stationId === p.stationId && conflict.prototypeId === p.prototypeId
          ? '机位与样机'
          : conflict.stationId === p.stationId
            ? '机位'
            : '样机'
      throw new ActionError(`${which}时段与预约 ${conflict.id} 重叠`)
    }

    // 3) 耗材单合法性（失败同样整单回滚，预约不落库）
    if (
      !p.consumable ||
      typeof p.consumable.item !== 'string' ||
      p.consumable.item.trim() === '' ||
      !Number.isFinite(p.consumable.qty) ||
      p.consumable.qty <= 0
    ) {
      throw new ActionError('耗材名称为空或数量非法')
    }

    const booking: Booking = {
      id: uid('bk'),
      batchId: p.batchId,
      stationId: p.stationId,
      prototypeId: p.prototypeId,
      testerId: p.testerId,
      start: p.start,
      end: p.end,
      purpose: p.purpose,
      createdAt: nowIso(),
    }
    s.bookings.push(booking)
    ctx.stamp('bookings', booking)

    // 耗材出库
    const consumption: Consumption = {
      id: uid('con'),
      batchId: p.batchId,
      bookingId: booking.id,
      item: p.consumable.item,
      qty: p.consumable.qty,
      at: nowIso(),
    }
    s.consumptions.push(consumption)
    ctx.stamp('consumptions', consumption)

    notify(s, p.testerId, `📅 已预约 ${station.name}（${p.start.slice(5, 16)}），耗材 ${consumption.item}×${consumption.qty}`)
  })
}

function cancelBooking(state: AppState, actor: User, bookingId: string): Outcome {
  const bk = state.bookings.find((x) => x.id === bookingId)
  return commit(state, actor, 'booking.cancel', `撤销预约 ${bookingId}`, (ctx) => {
    requirePerm(actor, 'booking.cancel')
    const s = ctx.s
    const b = s.bookings.find((x) => x.id === bookingId)
    if (!b) throw new ActionError('预约不存在')
    s.bookings = s.bookings.filter((x) => x.id !== b.id)
    ctx.tombstone(b.id)
    const used = s.consumptions.filter((c) => c.bookingId === b.id)
    for (const c of used) {
      s.consumptions = s.consumptions.filter((x) => x.id !== c.id)
      ctx.tombstone(c.id)
    }
    notify(s, b.testerId, `🗑 预约已撤销，耗材 ${used.map((c) => `${c.item}×${c.qty}`).join('、') || '无'} 已回退`)
  })
}

function calibrateStation(state: AppState, actor: User, stationId: string, calibrated: boolean): Outcome {
  const st = state.stations.find((x) => x.id === stationId)
  return commit(state, actor, 'station.calibrate', `机位 ${st?.code ?? stationId} 校准=${calibrated}`, (ctx) => {
    requirePerm(actor, 'station.calibrate')
    const s = ctx.s
    if (!s.stations.some((x) => x.id === stationId)) throw new ActionError('机位不存在')
    ctx.set('stations', stationId, 'calibrated', calibrated)
    ctx.set('stations', stationId, 'calibratedAt', nowIso())
  })
}

// ---------- 测量 ----------
function recordMeasurement(state: AppState, actor: User, p: {
  dedupKey: string; batchId: string; stationId: string; pressureDb: number; thockScore: number; clicks: number
}): Outcome {
  const batch = state.batches.find((b) => b.id === p.batchId)
  return commit(state, actor, 'measure.record', `批次 ${batch?.code ?? p.batchId} 声压 ${p.pressureDb}dB`, (ctx) => {
    requirePerm(actor, 'measure.record')
    const s = ctx.s

    // 前置闸门：阶段（排队等拒绝）、机位校准、匹配的有效预约
    const gate = measurementBlockers(s, { batchId: p.batchId, stationId: p.stationId, testerId: actor.id })
    if (gate.blocked) throw new ActionError(gate.reasons.join('；'))
    const b = s.batches.find((x) => x.id === p.batchId)!

    if (
      !p.dedupKey || typeof p.dedupKey !== 'string' ||
      !Number.isFinite(p.pressureDb) || !Number.isFinite(p.thockScore) ||
      !Number.isFinite(p.clicks) || p.clicks < 0
    ) {
      throw new ActionError('测量数据非法（幂等键/声压/评分/次数）')
    }

    // 幂等：重复测量只吸收一次（前置闸门通过后才吸收）
    if (s.dedup[p.dedupKey] !== undefined) {
      audit(ctx, 'measure.record', true, `重复测量 ${p.dedupKey} 已被吸收，仅保留一次`)
      return '重复测量已忽略（同场次只吸收一次）'
    }

    const m: Measurement = {
      id: uid('msr'),
      dedupKey: p.dedupKey,
      batchId: p.batchId,
      stationId: p.stationId,
      testerId: actor.id,
      at: nowIso(),
      pressureDb: p.pressureDb,
      thockScore: p.thockScore,
      clicks: p.clicks,
      abnormal: isAnomalous({ pressureDb: p.pressureDb }),
    }
    s.measurements.push(m)
    ctx.seen(p.dedupKey)

    if (m.abnormal) {
      const reason =
        p.pressureDb > 66
          ? `声压异常：峰值 ${p.pressureDb}dB 超上限 66dB`
          : `声压异常：峰值 ${p.pressureDb}dB 低于下限 38dB`
      isolateBatch(s, ctx, b, reason)
    } else if (b.stage === 'retest') {
      // 复测合格可回测听
      ctx.set('batches', b.id, 'stage', 'listening')
      ctx.set('batches', b.id, 'updatedAt', nowIso())
    }
  })
}

/** 复测失败：评审/复测阶段判定不通过 → 隔离 */
function failRetest(state: AppState, actor: User, batchId: string, reason: string): Outcome {
  const batch = state.batches.find((b) => b.id === batchId)
  return commit(state, actor, 'batch.quarantine', `批次 ${batch?.code ?? batchId} 复测失败隔离`, (ctx) => {
    requirePerm(actor, 'batch.transition')
    const s = ctx.s
    const b = s.batches.find((x) => x.id === batchId)
    if (!b) throw new ActionError('批次不存在')
    if (!['retest', 'review', 'listening'].includes(b.stage))
      throw new ActionError('当前阶段不能按复测失败隔离')
    isolateBatch(s, ctx, b, `复测失败：${reason}`)
  })
}

// ---------- 盲测 ----------
function createSession(state: AppState, actor: User, p: {
  batchId: string; sampleCodes: string[]; panel: string[]
}): Outcome {
  const batch = state.batches.find((b) => b.id === p.batchId)
  return commit(state, actor, 'session.manage', `创建盲测场次（批次 ${batch?.code ?? p.batchId}）`, (ctx) => {
    requirePerm(actor, 'session.manage')
    const s = ctx.s
    const b = s.batches.find((x) => x.id === p.batchId)
    if (!b) throw new ActionError('批次不存在')
    if (p.sampleCodes.length === 0) throw new ActionError('至少需要一个脱敏盲测样本')
    const proto = s.prototypes.find((x) => x.id === b.prototypeId)
    if (proto && p.panel.includes(proto.assembledBy))
      throw new ActionError('装机人不能进入本批次盲测评审团')
    if (s.sessions.some((x) => x.batchId === p.batchId))
      throw new ActionError('该批次已存在盲测场次')
    const session: BlindSession = {
      id: uid('ses'),
      code: `BL-${String(s.sessions.length + 1).padStart(2, '0')}`,
      batchId: p.batchId,
      sampleCodes: [...new Set(p.sampleCodes)],
      panel: [...new Set(p.panel)],
      votes: [],
      createdAt: nowIso(),
    }
    s.sessions.push(session)
    ctx.stamp('sessions', session)
  })
}

function addPanelist(state: AppState, actor: User, sessionId: string, userId: string): Outcome {
  return commit(state, actor, 'session.manage', `盲测评审团增加成员`, (ctx) => {
    requirePerm(actor, 'session.manage')
    const s = ctx.s
    const session = s.sessions.find((x) => x.id === sessionId)
    if (!session) throw new ActionError('场次不存在')
    const b = s.batches.find((x) => x.id === session.batchId)
    const proto = b && s.prototypes.find((x) => x.id === b.prototypeId)
    if (proto && userId === proto.assembledBy)
      throw new ActionError('利益冲突：装机人不得评审自装样机')
    if (session.panel.includes(userId)) throw new ActionError('该成员已在评审团')
    session.panel = [...session.panel, userId]
    ctx.set('sessions', session.id, 'panel', session.panel)
  })
}

function castVote(state: AppState, actor: User, sessionId: string, rating: number, comment: string): Outcome {
  return commit(state, actor, 'session.vote', `盲测投票 ${rating} 分`, (ctx) => {
    requirePerm(actor, 'session.vote')
    const s = ctx.s
    const session = s.sessions.find((x) => x.id === sessionId)
    if (!session) throw new ActionError('场次不存在')
    const b = s.batches.find((x) => x.id === session.batchId)
    if (b && isSelfAssembled(s, b.prototypeId, actor.id))
      throw new ActionError('不能评估自装样机：检测到你是该样机装机人')
    if (!session.panel.includes(actor.id))
      throw new ActionError('你不在本场评审团，不能投票')
    if (session.votes.some((v) => v.testerId === actor.id))
      throw new ActionError('已投过票，不能重复投票')
    if (rating < 0 || rating > 100) throw new ActionError('评分需在 0-100 之间')
    const vote: Vote = { testerId: actor.id, rating, comment, at: nowIso() }
    session.votes = [...session.votes, vote]
    ctx.set('sessions', session.id, 'votes', session.votes)
  })
}

// ---------- 基础资源 CRUD ----------
function upsertRecipe(state: AppState, actor: User, r: Recipe): Outcome {
  const exists = state.recipes.some((x) => x.id === r.id)
  return commit(state, actor, 'recipe.manage', `${exists ? '更新' : '创建'}配方 ${r.code}`, (ctx) => {
    requirePerm(actor, 'recipe.manage')
    const s = ctx.s
    if (exists) {
      for (const f of ['code', 'name', 'ratioPct', 'viscosity', 'notes'] as const)
        ctx.set('recipes', r.id, f, r[f])
    } else {
      s.recipes.push(r)
      ctx.stamp('recipes', r)
    }
  })
}

function upsertPrototype(state: AppState, actor: User, p: Prototype): Outcome {
  const exists = state.prototypes.some((x) => x.id === p.id)
  return commit(state, actor, 'prototype.manage', `${exists ? '更新' : '创建'}样机 ${p.code}`, (ctx) => {
    requirePerm(actor, 'prototype.manage')
    const s = ctx.s
    if (!s.switchBatches.some((x) => x.id === p.switchBatchId)) throw new ActionError('轴体批次不存在')
    if (exists) {
      for (const f of ['code', 'name', 'switchBatchId', 'assembledBy', 'builtAt', 'note'] as const)
        ctx.set('prototypes', p.id, f, p[f])
    } else {
      s.prototypes.push(p)
      ctx.stamp('prototypes', p)
    }
  })
}

function upsertSwitchBatch(state: AppState, actor: User, sb: SwitchBatch): Outcome {
  const exists = state.switchBatches.some((x) => x.id === sb.id)
  return commit(state, actor, 'switch.manage', `${exists ? '更新' : '创建'}轴体批次 ${sb.code}`, (ctx) => {
    requirePerm(actor, 'switch.manage')
    const s = ctx.s
    if (exists) {
      for (const f of ['code', 'vendor', 'count', 'lubeRecipeId', 'receivedAt'] as const)
        ctx.set('switchBatches', sb.id, f, sb[f])
    } else {
      s.switchBatches.push(sb)
      ctx.stamp('switchBatches', sb)
    }
  })
}

function updateBatchNote(state: AppState, actor: User, id: string, note: string): Outcome {
  return commit(state, actor, 'batch.edit', `编辑批次备注`, (ctx) => {
    requirePerm(actor, 'batch.edit')
    if (!ctx.s.batches.some((b) => b.id === id)) throw new ActionError('批次不存在')
    ctx.set('batches', id, 'note', note)
  })
}

// ---------- 会话 / 用户 ----------
function setCurrentUser(state: AppState, userId: string): Outcome {
  const s = structuredClone(state)
  s.currentUserId = userId
  return { state: s, events: [] }
}
function setOnline(state: AppState, online: boolean): Outcome {
  const s = structuredClone(state)
  s.online = online
  return { state: s, events: [] }
}

export type Action =
  | { type: 'batch.create'; p: Parameters<typeof createBatch>[2] }
  | { type: 'batch.transition'; id: string; target: Stage }
  | { type: 'batch.result'; id: string; result: BatchResult }
  | { type: 'booking.create'; p: Parameters<typeof createBooking>[2] }
  | { type: 'booking.cancel'; id: string }
  | { type: 'station.calibrate'; id: string; calibrated: boolean }
  | { type: 'measure.record'; p: Parameters<typeof recordMeasurement>[2] }
  | { type: 'retest.fail'; id: string; reason: string }
  | { type: 'session.create'; p: Parameters<typeof createSession>[2] }
  | { type: 'session.panel'; id: string; userId: string }
  | { type: 'session.vote'; id: string; rating: number; comment: string }
  | { type: 'recipe.upsert'; ent: Recipe }
  | { type: 'prototype.upsert'; ent: Prototype }
  | { type: 'switch.upsert'; ent: SwitchBatch }
  | { type: 'batch.note'; id: string; note: string }
  | { type: 'user.set'; userId: string }
  | { type: 'online.set'; online: boolean }

export function dispatch(state: AppState, action: Action): Outcome {
  const actor = state.users.find((u) => u.id === state.currentUserId)
  switch (action.type) {
    case 'batch.create': return createBatch(state, actor!, action.p)
    case 'batch.transition': return transitionBatch(state, actor!, action.id, action.target)
    case 'batch.result': return setReviewResult(state, actor!, action.id, action.result)
    case 'booking.create': return createBooking(state, actor!, action.p)
    case 'booking.cancel': return cancelBooking(state, actor!, action.id)
    case 'station.calibrate': return calibrateStation(state, actor!, action.id, action.calibrated)
    case 'measure.record': return recordMeasurement(state, actor!, action.p)
    case 'retest.fail': return failRetest(state, actor!, action.id, action.reason)
    case 'session.create': return createSession(state, actor!, action.p)
    case 'session.panel': return addPanelist(state, actor!, action.id, action.userId)
    case 'session.vote': return castVote(state, actor!, action.id, action.rating, action.comment)
    case 'recipe.upsert': return upsertRecipe(state, actor!, action.ent)
    case 'prototype.upsert': return upsertPrototype(state, actor!, action.ent)
    case 'switch.upsert': return upsertSwitchBatch(state, actor!, action.ent)
    case 'batch.note': return updateBatchNote(state, actor!, action.id, action.note)
    case 'user.set': return setCurrentUser(state, action.userId)
    case 'online.set': return setOnline(state, action.online)
  }
}

export const _internals = { ENTITY_COLLS, uid }
