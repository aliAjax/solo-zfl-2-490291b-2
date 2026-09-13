// 键盘声学实验室 · 领域模型

export type Role = 'admin' | 'scheduler' | 'tester' | 'reviewer'

export type Stage = 'queued' | 'listening' | 'retest' | 'review' | 'released' | 'quarantined'
export type BatchResult = 'pending' | 'pass' | 'fail'

export interface User {
  id: string
  name: string
  role: Role
  title: string
}

export interface Recipe {
  id: string
  code: string
  name: string
  /** 润滑脂配比百分比 */
  ratioPct: number
  viscosity: number
  notes: string
}

export interface SwitchBatch {
  id: string
  code: string
  vendor: string
  count: number
  lubeRecipeId: string | null
  receivedAt: string
}

export interface Prototype {
  id: string
  code: string
  name: string
  switchBatchId: string
  /** 装机人：测试员不能评审/投票给自装样机 */
  assembledBy: string
  builtAt: string
  note: string
}

export interface Station {
  id: string
  code: string
  name: string
  /** 是否在校准有效期内 */
  calibrated: boolean
  calibratedAt: string
  micModel: string
}

export interface Booking {
  id: string
  batchId: string
  stationId: string
  prototypeId: string
  testerId: string
  start: string // ISO
  end: string // ISO
  purpose: string
  createdAt: string
}

export interface Measurement {
  id: string
  /** 幂等键：同场次重复测量只吸收一次 */
  dedupKey: string
  batchId: string
  stationId: string
  testerId: string
  at: string
  /** 峰值声压 dB */
  pressureDb: number
  /** 手感评分 0-100 */
  thockScore: number
  /** 触发次数 */
  clicks: number
  abnormal: boolean
}

export interface Vote {
  testerId: string
  rating: number
  comment: string
  at: string
}

export interface BlindSession {
  id: string
  code: string
  batchId: string
  /** 盲测样本编码（已脱敏，不含装机人信息） */
  sampleCodes: string[]
  /** 评审团成员 */
  panel: string[]
  votes: Vote[]
  createdAt: string
}

export interface Consumption {
  id: string
  batchId: string
  bookingId: string
  item: string
  qty: number
  at: string
}

export interface Notification {
  id: string
  userId: string | null // null = 广播
  message: string
  at: string
  read: boolean
}

export interface AuditEvent {
  id: string
  txId: string
  at: string
  actorId: string
  action: string
  ok: boolean
  detail: string
  rolledBack?: boolean
}

export interface FieldMeta {
  v: number
  by: string
}

export interface ResolvedField {
  key: string
  /** 保留方 */
  winner: string
  /** 落选方 */
  loser: string
  local: unknown
  remote: unknown
  reason: string
}

export interface MergeReport {
  at: string
  withTab: string
  changedScalars: ResolvedField[]
  addedEntities: string[]
  removedTombstones: string[]
  duplicateMeasurements: string[]
  summary: string
}

export interface Batch {
  id: string
  code: string
  switchBatchId: string
  prototypeId: string
  lubeRecipeId: string | null
  stage: Stage
  result: BatchResult
  priority: number
  note: string
  quarantineReason: string
  createdAt: string
  updatedAt: string
}

export interface AppState {
  users: User[]
  currentUserId: string
  online: boolean
  tabId: string

  batches: Batch[]
  prototypes: Prototype[]
  switchBatches: SwitchBatch[]
  recipes: Recipe[]
  stations: Station[]
  bookings: Booking[]
  measurements: Measurement[]
  sessions: BlindSession[]
  consumptions: Consumption[]
  notifications: Notification[]
  audit: AuditEvent[]

  /** 单调逻辑时钟（Lamport 风格），用于逐字段裁决 */
  clock: number
  /** 字段级版本：key = `${entityId}.${field}` */
  fieldMeta: Record<string, FieldMeta>
  /** 实体删除墓碑：id -> clock */
  tombstones: Record<string, number>
  /** 测量幂等标记：dedupKey -> clock，重复测量只吸收一次 */
  dedup: Record<string, number>

  lastMerge: MergeReport | null
}

export const STAGE_LABEL: Record<Stage, string> = {
  queued: '排队',
  listening: '测听',
  retest: '复测',
  review: '评审',
  released: '放行',
  quarantined: '隔离',
}

export const STAGE_ORDER: Stage[] = [
  'queued',
  'listening',
  'retest',
  'review',
  'released',
  'quarantined',
]

export const ROLE_LABEL: Record<Role, string> = {
  admin: '管理员',
  scheduler: '排程员',
  tester: '测试员',
  reviewer: '评审员',
}
