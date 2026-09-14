import type { AppState } from '../types/domain'

export const EXPORT_MAGIC = 'KACL/v1'

export function exportJson(state: AppState): string {
  const payload = { magic: EXPORT_MAGIC, exportedAt: new Date().toISOString(), state }
  return JSON.stringify(payload, null, 2)
}

export interface ImportResult {
  state: AppState
  warnings: string[]
}

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x)
const isStr = (x: unknown): x is string => typeof x === 'string'
const isNum = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x)

// 递归拒绝原型污染键
function guardProtoPath(path: string) {
  const parts = path.split('.')
  if (parts.includes('__proto__') || parts.includes('constructor') || parts.includes('prototype')) {
    throw new Error(`恶意导入：检测到原型污染键 "${path}"，已拦截`)
  }
}

function scanProto(node: unknown, path: string) {
  guardProtoPath(path)
  if (Array.isArray(node)) {
    if (node.length > 20000) throw new Error('导入体量异常（数组过长），已拦截')
    node.slice(0, 20000).forEach((n, i) => scanProto(n, `${path}[${i}]`))
  } else if (isObj(node)) {
    if (Object.keys(node).length > 500) throw new Error(`导入对象字段异常（${path}），已拦截`)
    for (const [k, v] of Object.entries(node)) scanProto(v, path ? `${path}.${k}` : k)
  } else if (node !== null && !['string', 'number', 'boolean'].includes(typeof node)) {
    throw new Error(`非法值类型 @ ${path}: ${typeof node}`)
  }
}

const ARRAYS = [
  'users', 'batches', 'prototypes', 'switchBatches', 'recipes', 'stations',
  'bookings', 'measurements', 'sessions', 'consumptions', 'notifications', 'audit',
] as const

function validateEntityArray(raw: unknown, name: string, warnings: string[]) {
  if (!Array.isArray(raw)) throw new Error(`恶意导入：${name} 必须是数组`)
  const ids = new Set<string>()
  for (let i = 0; i < raw.length; i++) {
    const e = raw[i]
    if (!isObj(e)) throw new Error(`恶意导入：${name}[${i}] 不是对象`)
    if (!isStr(e.id) || !/^[\w:-]{1,64}$/.test(e.id)) throw new Error(`恶意导入：${name}[${i}] 的 id 非法`)
    if (ids.has(e.id)) throw new Error(`恶意导入：${name} 内存在重复 id ${e.id}`)
    ids.add(e.id)
    for (const [k, v] of Object.entries(e)) {
      if (!/^[A-Za-z_][\w]{0,40}$/.test(k)) throw new Error(`恶意导入：${name}[${i}] 字段名 ${k} 非法`)
      if (isStr(v) && v.length > 4000) throw new Error(`恶意导入：${name}[${i}].${k} 字符串过长`)
    }
  }
  if (raw.length > 5000) throw new Error(`恶意导入：${name} 行数异常`)
  warnings.push(`${name}: ${raw.length} 条`)
}

/**
 * 恶意导入拦截：
 * 校验魔数 / 结构 / 类型 / id 与字段名字符集 / 字符串长度 / 体量 / 原型污染。
 * 任何不合规都整体拒绝（不部分应用）。
 */
export function parseImport(text: string, current: AppState): ImportResult {
  const warnings: string[] = []
  if (!text || typeof text !== 'string') throw new Error('导入内容为空')
  if (text.length > 4_000_000) throw new Error('导入文件超过 4MB，拒绝解析')
  if (/<\s*(script|iframe|object|embed)/i.test(text)) throw new Error('恶意导入：检测到可执行标记，已拦截')

  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error('不是合法 JSON，导入中止')
  }
  if (!isObj(data)) throw new Error('恶意导入：顶层必须是对象')
  if (data.magic !== EXPORT_MAGIC) throw new Error(`魔数不匹配（期望 ${EXPORT_MAGIC}），拒绝外来文件`)
  if (!isObj(data.state)) throw new Error('恶意导入：缺少 state 对象')
  const rawState = data.state as Record<string, unknown>

  scanProto(rawState, '')

  for (const arr of ARRAYS) validateEntityArray(rawState[arr], arr, warnings)

  if (!isObj(rawState.fieldMeta)) throw new Error('恶意导入：fieldMeta 必须是对象')
  if (!isObj(rawState.tombstones)) throw new Error('恶意导入：tombstones 必须是对象')
  if (!isObj(rawState.dedup)) throw new Error('恶意导入：dedup 必须是对象')
  for (const [k, mv] of Object.entries(rawState.fieldMeta as Record<string, unknown>)) {
    if (!isObj(mv) || !isNum((mv as Record<string, unknown>).v) || !isStr((mv as Record<string, unknown>).by))
      throw new Error(`恶意导入：fieldMeta.${k} 结构非法`)
  }
  if (!isNum(rawState.clock) || rawState.clock < 0) throw new Error('恶意导入：clock 非法')

  // 引用完整性（软告警，不阻断）：未知 id 引用
  const userIds = new Set((rawState.users as Array<Record<string, unknown>>).map((u) => u.id))
  if (!isStr(rawState.currentUserId) || !userIds.has(rawState.currentUserId))
    throw new Error('恶意导入：currentUserId 不存在于用户表')

  // 以导入状态为准，但保留本页 tabId（避免多页身份串扰）
  const state = rawState as unknown as AppState
  state.tabId = current.tabId
  state.online = current.online
  state.lastMerge = current.lastMerge
  return { state, warnings }
}
