import type { AppState } from '../types/domain'

export const userName = (s: AppState, id?: string | null) =>
  s.users.find((u) => u.id === id)?.name ?? (id ?? '—')
export const recipeName = (s: AppState, id?: string | null) =>
  s.recipes.find((r) => r.id === id)?.code ?? '未绑定'
export const switchCode = (s: AppState, id?: string | null) =>
  s.switchBatches.find((x) => x.id === id)?.code ?? '—'
export const protoName = (s: AppState, id?: string | null) =>
  s.prototypes.find((p) => p.id === id)?.code ?? '—'
export const stationName = (s: AppState, id?: string | null) =>
  s.stations.find((x) => x.id === id)?.code ?? '—'
export const batchCode = (s: AppState, id?: string | null) =>
  s.batches.find((b) => b.id === id)?.code ?? '—'

export function fmtTime(iso?: string) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

/** datetime-local 值 */
export function toLocalInput(iso: string) {
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}
export function fromLocalInput(v: string) {
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? '' : d.toISOString()
}
