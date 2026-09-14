import { create } from 'zustand'
import type { AppState, User } from '../types/domain'
import { dispatch, type Action } from '../lib/engine'
import { mergeStates } from '../lib/merge'
import { exportJson, parseImport } from '../lib/importExport'
import { freshTabId, seedState } from './seed'

const LS_DOC = 'kacl.doc.v1'
const LS_OUTBOX_PREFIX = 'kacl.outbox.'

export interface Toast {
  id: string
  kind: 'ok' | 'err' | 'info'
  text: string
}

function loadTabId(): string {
  let id = sessionStorage.getItem('kacl.tabId')
  if (!id) {
    id = freshTabId()
    sessionStorage.setItem('kacl.tabId', id)
  }
  return id
}

function loadInitial(tabId: string): AppState {
  try {
    const raw = localStorage.getItem(LS_DOC)
    if (raw) {
      const parsed = JSON.parse(raw) as AppState
      parsed.tabId = tabId
      parsed.online = true
      return parsed
    }
  } catch {
    /* 损坏则重建种子 */
  }
  return seedState(tabId)
}

const writeShared = (s: AppState) => localStorage.setItem(LS_DOC, JSON.stringify(s))
const outboxKey = (tabId: string) => `${LS_OUTBOX_PREFIX}${tabId}`

interface Store {
  state: AppState
  past: AppState[]
  future: AppState[]
  toasts: Toast[]

  actor: () => User | undefined
  act: (a: Action) => boolean
  undo: () => void
  redo: () => void
  switchUser: (id: string) => void
  setOnline: (online: boolean) => void
  refresh: () => void
  syncFromShared: (label: string) => void
  exportData: () => string
  importData: (text: string) => void
  downloadExport: () => void
  pushToast: (t: Omit<Toast, 'id'>) => void
  dismissToast: (id: string) => void
  clearMerge: () => void
}

let toastSeq = 0

export const useStore = create<Store>((set, get) => {
  const mergeWith = (remote: AppState, withTab: string, announce = true) => {
    const local = get().state
    if (remote === local) return
    const { state: merged, report } = mergeStates(local, remote)
    merged.lastMerge = { ...report, at: new Date().toISOString(), withTab }
    set({ state: merged })
    if (get().state.online) writeShared(merged)
    if (announce)
      get().pushToast({ kind: 'info', text: `已合并 ${withTab} 的改动：${report.summary}` })
  }

  const onStorage = (e: StorageEvent) => {
    if (e.key !== LS_DOC || !e.newValue) return
    const { state } = get()
    if (!state.online) return // 离线：不被他人改动打扰，恢复时再裁决
    try {
      const remote = JSON.parse(e.newValue) as AppState
      // 抑制回显：内容与当前一致则无需再合并
      if (e.newValue === JSON.stringify(state)) return
      mergeWith(remote, remote.tabId && remote.tabId !== state.tabId ? `页面 ${remote.tabId.slice(-4)}` : '共享文档')
    } catch {
      /* ignore corrupt */
    }
  }

  if (typeof window !== 'undefined') window.addEventListener('storage', onStorage)

  const tabId = loadTabId()

  return {
    state: loadInitial(tabId),
    past: [],
    future: [],
    toasts: [],

    actor: () => get().state.users.find((u) => u.id === get().state.currentUserId),

    pushToast: (t) => {
      const id = `t${++toastSeq}`
      set((s) => ({ toasts: [...s.toasts, { ...t, id }] }))
      setTimeout(() => get().dismissToast(id), 6000)
    },
    dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })),

    act: (a) => {
      const before = get().state
      const { state: next, events, notice } = dispatch(before, a)
      const isSession = a.type === 'user.set' || a.type === 'online.set'
      const failed = events.some((e) => !e.ok)

      if (isSession) {
        set({ state: next })
        if (next.online) writeShared(next)
        return true
      }

      if (failed) {
        const ev = events.find((e) => !e.ok)
        // 失败仅追加审计；不改业务数据。落本地/共享以留痕。
        set({ state: next })
        if (next.online) writeShared(next)
        else localStorage.setItem(outboxKey(next.tabId), JSON.stringify(next))
        get().pushToast({ kind: 'err', text: `⛔ ${ev?.detail ?? '操作失败'}（业务数据零改动）` })
        return false
      }

      set({ state: next, past: [...get().past.slice(-49), before], future: [] })
      if (next.online) writeShared(next)
      else localStorage.setItem(outboxKey(next.tabId), JSON.stringify(next))
      if (notice) get().pushToast({ kind: notice.includes('忽略') ? 'info' : 'ok', text: notice })
      return true
    },

    undo: () => {
      const { past, future, state } = get()
      if (past.length === 0) return get().pushToast({ kind: 'info', text: '没有可撤销的操作' })
      const prev = past[past.length - 1]
      set({ state: prev, past: past.slice(0, -1), future: [state, ...future].slice(0, 50) })
      if (prev.online) writeShared(prev)
      else localStorage.setItem(outboxKey(prev.tabId), JSON.stringify(prev))
      get().pushToast({ kind: 'info', text: '↩ 已撤销' })
    },
    redo: () => {
      const { future, past, state } = get()
      if (future.length === 0) return get().pushToast({ kind: 'info', text: '没有可重做的操作' })
      const nxt = future[0]
      set({ state: nxt, future: future.slice(1), past: [...past, state] })
      if (nxt.online) writeShared(nxt)
      else localStorage.setItem(outboxKey(nxt.tabId), JSON.stringify(nxt))
      get().pushToast({ kind: 'info', text: '↪ 已重做' })
    },

    switchUser: (id) => get().act({ type: 'user.set', userId: id }),

    setOnline: (online) => {
      get().act({ type: 'online.set', online })
      if (online) setTimeout(() => get().syncFromShared('离线队列'), 0)
    },

    syncFromShared: (label) => {
      try {
        const queuedRaw = localStorage.getItem(outboxKey(get().state.tabId))
        const sharedRaw = localStorage.getItem(LS_DOC)
        const shared = sharedRaw ? (JSON.parse(sharedRaw) as AppState) : null
        if (queuedRaw) {
          // 本页离线副本先与共享文档裁决
          const queued = JSON.parse(queuedRaw) as AppState
          queued.online = true
          queued.tabId = get().state.tabId
          if (shared) {
            const { state: merged, report } = mergeStates(shared, queued)
            merged.tabId = get().state.tabId
            merged.online = true
            merged.lastMerge = { ...report, at: new Date().toISOString(), withTab: label }
            set({ state: merged })
            writeShared(merged)
          } else {
            set({ state: queued })
            writeShared(queued)
          }
          localStorage.removeItem(outboxKey(get().state.tabId))
          get().pushToast({ kind: 'info', text: `🔗 离线改动已与共享文档裁决合并` })
        } else if (shared) {
          mergeWith(shared, label)
        }
      } catch {
        get().pushToast({ kind: 'err', text: '同步失败：共享文档损坏' })
      }
    },

    refresh: () => get().syncFromShared('手动刷新'),

    exportData: () => {
      const text = exportJson(get().state)
      get().pushToast({ kind: 'ok', text: `已生成导出快照（${(text.length / 1024).toFixed(1)} KB）` })
      return text
    },

    downloadExport: () => {
      const text = exportJson(get().state)
      const blob = new Blob([text], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `kacl-export-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.json`
      a.click()
      URL.revokeObjectURL(url)
      get().pushToast({ kind: 'ok', text: '已导出 JSON 文件' })
    },

    importData: (text) => {
      try {
        const { state: imported } = parseImport(text, get().state)
        const before = get().state
        const { state: merged, report } = mergeStates(before, imported)
        merged.tabId = before.tabId
        merged.online = before.online
        merged.lastMerge = { ...report, at: new Date().toISOString(), withTab: 'import' }
        set({ state: merged, past: [...get().past.slice(-49), before], future: [] })
        if (merged.online) writeShared(merged)
        get().pushToast({ kind: 'ok', text: `✅ 导入通过校验并已合并：${report.summary}` })
      } catch (err) {
        get().pushToast({ kind: 'err', text: `🚫 恶意/非法导入已拦截：${(err as Error).message}` })
      }
    },

    clearMerge: () => {
      const s = get().state
      const next = { ...s, lastMerge: null }
      set({ state: next })
      if (next.online) writeShared(next)
    },
  }
})
