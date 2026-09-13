import { useRef } from 'react'
import { useStore } from '../store/useStore'
import { ROLE_LABEL } from '../types/domain'
import { Btn, Select } from './ui'

export function Header({ tab, onTab }: { tab: string; onTab: (t: string) => void }) {
  const state = useStore((s) => s.state)
  const switchUser = useStore((s) => s.switchUser)
  const setOnline = useStore((s) => s.setOnline)
  const undo = useStore((s) => s.undo)
  const redo = useStore((s) => s.redo)
  const refresh = useStore((s) => s.refresh)
  const downloadExport = useStore((s) => s.downloadExport)
  const exportData = useStore((s) => s.exportData)
  const importData = useStore((s) => s.importData)
  const fileRef = useRef<HTMLInputElement>(null)
  const pastLen = useStore((s) => s.past.length)
  const futureLen = useStore((s) => s.future.length)

  const actor = state.users.find((u) => u.id === state.currentUserId)
  const tabs = [
    ['board', '流程看板'],
    ['resources', '资源台账'],
    ['booking', '预约机位'],
    ['measure', '测听记录'],
    ['blind', '盲测场次'],
    ['merge', '合并裁决'],
    ['audit', '审计日志'],
  ] as const

  const onImportFile = async (f: File) => {
    const text = await f.text()
    importData(text)
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <header className="sticky top-0 z-30 border-b border-ink-700 bg-ink-950/85 backdrop-blur">
      <div className="mx-auto flex max-w-[1500px] flex-wrap items-center gap-x-4 gap-y-2 px-5 py-2.5">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-brass-400 font-mono text-sm font-bold text-ink-950">K</span>
          <div className="leading-tight">
            <div className="text-sm font-semibold text-ink-100">键盘声学实验室</div>
            <div className="font-mono text-[10px] text-ink-500">批次追溯台 · tab {state.tabId.slice(-4)}</div>
          </div>
        </div>

        <nav className="flex flex-wrap items-center gap-1">
          {tabs.map(([key, label]) => (
            <button
              key={key}
              data-testid={`tab-${key}`}
              onClick={() => onTab(key)}
              className={`rounded-md px-2.5 py-1 text-sm transition-colors ${
                tab === key ? 'bg-brass-400/15 text-brass-300' : 'text-ink-400 hover:bg-ink-800 hover:text-ink-200'
              }`}
            >
              {label}
            </button>
          ))}
        </nav>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <button
            data-testid="online-toggle"
            onClick={() => setOnline(!state.online)}
            className={`flex items-center gap-1.5 rounded-lg border px-2 py-1 text-xs ${
              state.online ? 'border-moss-600/50 text-moss-400' : 'border-wine-600/50 text-wine-400'
            }`}
            title="切换在线/离线（离线时改动入本页队列，恢复后裁决合并）"
          >
            <span className={`h-2 w-2 rounded-full ${state.online ? 'bg-moss-400 animate-pulseGlow' : 'bg-wine-500'}`} />
            {state.online ? '在线' : '离线'}
          </button>

          <Select
            data-testid="role-select"
            value={state.currentUserId}
            onChange={(e) => switchUser(e.target.value)}
            className="w-auto py-1 text-xs"
            title="当前身份（权限分离）"
          >
            {state.users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} · {ROLE_LABEL[u.role]}
              </option>
            ))}
          </Select>

          <Btn data-testid="btn-undo" variant="ghost" onClick={undo} disabled={pastLen === 0} title="撤销 (Ctrl+Z)">↩</Btn>
          <Btn data-testid="btn-redo" variant="ghost" onClick={redo} disabled={futureLen === 0} title="重做 (Ctrl+Y)">↪</Btn>
          <Btn data-testid="btn-refresh" variant="soft" onClick={refresh} title="从共享文档重新拉取并合并">刷新</Btn>
          <Btn data-testid="btn-copy" variant="soft" onClick={() => void navigator.clipboard?.writeText(exportData())} title="复制导出 JSON">复制</Btn>
          <Btn data-testid="btn-export" variant="gold" onClick={downloadExport}>导出</Btn>
          <Btn data-testid="btn-import" variant="primary" onClick={() => fileRef.current?.click()}>导入</Btn>
          <input
            ref={fileRef}
            data-testid="import-file"
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && onImportFile(e.target.files[0])}
          />
        </div>
      </div>
      {actor && (
        <div className="mx-auto max-w-[1500px] px-5 pb-1.5 text-[11px] text-ink-500">
          当前身份：<span className="text-ink-300">{actor.name}</span>（{actor.title} · {ROLE_LABEL[actor.role]}）
        </div>
      )}
    </header>
  )
}

export function Toasts() {
  const toasts = useStore((s) => s.toasts)
  const dismiss = useStore((s) => s.dismissToast)
  return (
    <div className="fixed bottom-4 right-4 z-[60] flex w-[380px] max-w-[92vw] flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          onClick={() => dismiss(t.id)}
          className={`cursor-pointer rounded-lg border px-3.5 py-2.5 text-sm shadow-card animate-fadeIn ${
            t.kind === 'ok'
              ? 'border-moss-600/50 bg-moss-600/15 text-moss-400'
              : t.kind === 'err'
                ? 'border-wine-600/60 bg-wine-600/20 text-wine-400'
                : 'border-slateblue-500/50 bg-slateblue-500/15 text-slateblue-400'
          }`}
        >
          {t.text}
        </div>
      ))}
    </div>
  )
}
