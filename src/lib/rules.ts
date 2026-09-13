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

function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string) {
  return new Date(aStart) < new Date(bEnd) && new Date(bStart) < new Date(aEnd)
}

/** 机位或样机时段不能重叠（返回冲突预约） */
export function findBookingConflict(
  state: AppState,
  candidate: Omit<Booking, 'id' | 'createdAt'>,
  ignoreId?: string,
): Booking | null {
  if (new Date(candidate.end) <= new Date(candidate.start)) return null
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
