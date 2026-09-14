import type {
  AppState,
  Batch,
  Booking,
  Measurement,
  Stage,
  User,
} from '../types/domain'

/** 正常峰值声压区间 dB，超出视为声压异常 */
export const DB_MIN = 38
export const DB_MAX = 66

/** 放行所需盲测投票数下限 */
export const MIN_VOTES = 2

/** 允许的阶段流转 */
export const STAGE_GRAPH: Record<Stage, Stage[]> = {
  queued: ['listening', 'quarantined'],
  listening: ['retest', 'review', 'quarantined'],
  retest: ['listening', 'review', 'quarantined'],
  review: ['released', 'retest', 'quarantined'],
  released: ['quarantined'],
  quarantined: ['queued'],
}

export interface BlockResult {
  blocked: boolean
  reasons: string[]
}

export const ok = (): BlockResult => ({ blocked: false, reasons: [] })
export const deny = (...reasons: string[]): BlockResult => ({
  blocked: reasons.length > 0,
  reasons,
})

/** 严格解析日期；非法/无法解析返回 null（避免 NaN 静默通过） */
function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string) {
  return new Date(aStart) < new Date(bEnd) && new Date(bStart) < new Date(aEnd)
}

/**
 * 严格公历解析：只接受 ISO-8601（Z/偏移或本地）或纯日期，
 * 并把结果按“声明时区”回算到年月日，拒绝 2/30、非闰年 2/29、13 月等被 JS 静默滚算的日子。
 */
const ISO_RE =
  /^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,9}))?)?(Z|[+-]\d{2}:?\d{2})?)?$/

export function parseDate(value: unknown): Date | null {
  if (typeof value !== 'string') return null
  const v = value.trim()
  if (v === '') return null
  const m = v.match(ISO_RE)
  if (!m) return null
  const [, y, mo, d, h, mi, , tz] = m
  const date = new Date(v)
  if (Number.isNaN(date.getTime())) return null

  let wall: Date
  if (tz && tz !== 'Z') {
    const t = tz.replace(':', '')
    const sign = t[0] === '-' ? -1 : 1
    const offMin = sign * (Number(t.slice(1, 3)) * 60 + Number(t.slice(3, 5)))
    wall = new Date(date.getTime() + offMin * 60000)
  } else if (h !== undefined && !tz) {
    wall = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  } else {
    wall = date
  }

  const sameDay =
    wall.getUTCFullYear() === Number(y) &&
    wall.getUTCMonth() + 1 === Number(mo) &&
    wall.getUTCDate() === Number(d)
  if (!sameDay) return null
  if (h !== undefined && (wall.getUTCHours() !== Number(h) || wall.getUTCMinutes() !== Number(mi)))
    return null
  return date
}

export interface BookingCandidateLike {
  batchId: string
  prototypeId: string
  stationId: string
  testerId: string
  start: string
  end: string
}

/** 预约时段与引用完整性、装配关系与自装限制：逐条给出原因 */
export function bookingValidationErrors(state: AppState, c: BookingCandidateLike): string[] {
  const reasons: string[] = []
  const start = parseDate(c.start)
  const end = parseDate(c.end)
  if (!start) reasons.push('开始时间不是真实存在的公历时刻（拒绝如 2 月 30 日、非闰年 2 月 29 日）')
  if (!end) reasons.push('结束时间不是真实存在的公历时刻（拒绝如 2 月 30 日、非闰年 2 月 29 日）')
  if (start && end && end <= start) reasons.push('结束时间必须晚于开始时间')

  const batch = state.batches.find((b) => b.id === c.batchId)
  const prototype = state.prototypes.find((p) => p.id === c.prototypeId)
  if (!batch) reasons.push('批次不存在')
  if (!prototype) reasons.push('样机不存在')
  if (!state.stations.some((st) => st.id === c.stationId)) reasons.push('机位不存在')
  const tester = state.users.find((u) => u.id === c.testerId)
  if (!tester || tester.role !== 'tester')
    reasons.push('测试员不存在或不是测试员角色')

  // 批次与样机必须属于同一装配关系（同一轴体批次），不能只查编号存在
  if (batch && prototype) {
    if (batch.prototypeId !== prototype.id) {
      reasons.push(`批次与样机不属于同一装配关系：批次装配的是 ${batch.prototypeId}，而所选样机为 ${prototype.id}`)
    } else if (batch.switchBatchId !== prototype.switchBatchId) {
      reasons.push('批次与样机的轴体批次不一致，装配关系不成立')
    }
  }

  // 测试员不能预约自己装配的样机
  if (prototype && tester && tester.role === 'tester' && prototype.assembledBy === tester.id) {
    reasons.push('测试员不能预约自己装配的样机（利益冲突）')
  }
  return reasons
}

/** 机位或样机时段不能重叠（返回冲突预约）；无效时段不产生匹配（由完整性校验拦截） */
export function findBookingConflict(
  state: AppState,
  candidate: BookingCandidateLike,
  ignoreId?: string,
): Booking | null {
  const start = parseDate(candidate.start)
  const end = parseDate(candidate.end)
  if (!start || !end || end <= start) return null
  for (const b of state.bookings) {
    if (b.id === ignoreId) continue
    if (b.stationId !== candidate.stationId && b.prototypeId !== candidate.prototypeId)
      continue
    if (overlaps(candidate.start, candidate.end, b.start, b.end)) return b
  }
  return null
}

export const isAnomalous = (m: Pick<Measurement, 'pressureDb'>) =>
  m.pressureDb < DB_MIN || m.pressureDb > DB_MAX

/** 测试员是否为该样机的装机人（自装样机不得自评） */
export const isSelfAssembled = (state: AppState, protoId: string, testerId: string) =>
  state.prototypes.find((p) => p.id === protoId)?.assembledBy === testerId

/**
 * 测量前置校验：
 * - 批次存在且处于测听/复测阶段（排队等阶段不能记录）
 * - 机位存在且已校准
 * - 必须有“批次 + 机位 + 测试员”匹配的有效预约
 */
export function measurementBlockers(
  state: AppState,
  p: { batchId: string; stationId: string; testerId: string },
): BlockResult {
  const b = state.batches.find((x) => x.id === p.batchId)
  if (!b) return deny('批次不存在')
  const reasons: string[] = []
  if (!['listening', 'retest'].includes(b.stage)) {
    const stageName: Record<string, string> = { queued: '排队', listening: '测听', retest: '复测', review: '评审', released: '放行', quarantined: '隔离' }
    reasons.push(`批次当前为“${stageName[b.stage]}”阶段，仅测听/复测阶段可记录测量`)
  }
  const station = state.stations.find((x) => x.id === p.stationId)
  if (!station) reasons.push('测量机位不存在')
  else if (!station.calibrated) reasons.push('测量机位未校准')
  if (!state.users.some((u) => u.id === p.testerId && u.role === 'tester'))
    reasons.push('测试员不存在或不是测试员角色')
  // 测试员不能测量自己装配的样机（覆盖正常测量与声压异常隔离路径，因为闸门先于异常处理）
  if (isSelfAssembled(state, b.prototypeId, p.testerId))
    reasons.push('测试员不能测量自己装配的样机（利益冲突）')
  const hasBooking = state.bookings.some(
    (bk) => bk.batchId === p.batchId && bk.stationId === p.stationId && bk.testerId === p.testerId,
  )
  if (!hasBooking) reasons.push('没有与该批次/机位/测试员匹配的有效预约，不能记录测量')
  return deny(...reasons)
}

function batchBlindSession(state: AppState, batchId: string) {
  return state.sessions.find((s) => s.batchId === batchId)
}

/** 阶段流转前置闸门：缺配方 / 缺校准 / 缺盲测样本等不能推进 */
export function transitionBlockers(state: AppState, batch: Batch, target: Stage): BlockResult {
  const reasons: string[] = []

  if (!STAGE_GRAPH[batch.stage].includes(target)) {
    reasons.push(`不允许 ${batch.stage} → ${target} 的流转`)
    return deny(...reasons)
  }

  const recipeId = batch.lubeRecipeId ??
    state.switchBatches.find((s) => s.id === batch.switchBatchId)?.lubeRecipeId
  const proto = state.prototypes.find((p) => p.id === batch.prototypeId)
  const calibrated = state.stations.some(
    (st) => st.calibrated && state.bookings.some((b) => b.batchId === batch.id && b.stationId === st.id),
  )

  if (target === 'listening') {
    if (!recipeId || !state.recipes.some((r) => r.id === recipeId))
      reasons.push('缺润滑配方：批次未绑定有效润滑配方')
    if (!calibrated)
      reasons.push('缺校准：该批次没有预约到已校准机位的时段')
  }

  if (target === 'review') {
    const session = batchBlindSession(state, batch.id)
    if (!session) reasons.push('缺盲测样本：尚未创建盲测场次')
    else {
      if (session.sampleCodes.length === 0) reasons.push('缺盲测样本：场次没有脱敏样本')
      if (session.panel.length === 0) reasons.push('缺盲测样本：评审团为空')
      if (proto && session.panel.includes(proto.assembledBy))
        reasons.push('利益冲突：装机人不得进入本场评审团')
    }
  }

  if (target === 'released') {
    if (batch.result !== 'pass') reasons.push('评审结论未通过，不能放行')
    const session = batchBlindSession(state, batch.id)
    if (!session || session.votes.length < MIN_VOTES)
      reasons.push(`盲测投票不足，至少需要 ${MIN_VOTES} 票`)
    if (proto && session?.votes.some((v) => v.testerId === proto.assembledBy))
      reasons.push('检测到装机人自评票，必须剔除')
  }

  if (target === 'quarantined' && !batch.quarantineReason) {
    reasons.push('隔离必须填写原因（声压异常 / 复测失败）')
  }

  return deny(...reasons)
}

/** 当前用户对某动作是否有权限 */
export function can(actor: User | undefined, action: string): boolean {
  if (!actor) return false
  if (actor.role === 'admin') return true
  const MATRIX: Record<string, string[]> = {
    'batch.create': ['scheduler'],
    'batch.edit': ['scheduler'],
    'batch.transition': ['scheduler', 'reviewer'],
    'batch.release': ['reviewer'],
    'booking.create': ['scheduler'],
    'booking.cancel': ['scheduler'],
    'station.calibrate': ['scheduler'],
    'recipe.manage': ['scheduler'],
    'prototype.manage': ['scheduler'],
    'switch.manage': ['scheduler'],
    'measure.record': ['tester'],
    'session.manage': ['reviewer'],
    'session.vote': ['tester'],
    'data.import': [],
    'data.export': ['scheduler', 'reviewer', 'tester'],
  }
  return (MATRIX[action] ?? []).includes(actor.role)
}
