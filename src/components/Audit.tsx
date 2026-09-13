import { useState } from 'react'
import { useStore } from '../store/useStore'
import { Badge, Card, EmptyState } from './ui'
import { userName } from '../lib/lookups'

export function AuditView() {
  const s = useStore((x) => x.state)
  const [filter, setFilter] = useState<'all' | 'ok' | 'fail'>('all')
  const events = [...s.audit].reverse().filter((e) => filter === 'all' ? true : filter === 'ok' ? e.ok : !e.ok)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-ink-100">审计日志 / 通知</h2>
        <div className="flex gap-1 text-xs">
          {(['all', 'ok', 'fail'] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)} className={`rounded-md px-2.5 py-1 ${filter === f ? 'bg-brass-400/15 text-brass-300' : 'text-ink-400 hover:bg-ink-800'}`}>
              {f === 'all' ? `全部 ${s.audit.length}` : f === 'ok' ? `成功 ${s.audit.filter((e) => e.ok).length}` : `失败/回滚 ${s.audit.filter((e) => !e.ok).length}`}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <Card className="p-3">
          {events.length === 0 ? <EmptyState>暂无审计事件</EmptyState> : (
            <div className="space-y-1">
              {events.map((e) => (
                <div key={e.id} className={`flex items-start gap-2 rounded-md px-2 py-1.5 text-xs ${e.ok ? '' : 'bg-wine-600/5'}`}>
                  {e.ok ? <Badge tone="green">✓</Badge> : <Badge tone="red">回滚</Badge>}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-ink-300">{e.action}</span>
                      <span className="text-ink-200">{e.detail}</span>
                    </div>
                    <div className="mt-0.5 text-[10px] text-ink-600">
                      {new Date(e.at).toLocaleString()} · {userName(s, e.actorId)} · tx {e.txId.slice(-6)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="h-fit p-3">
          <div className="mb-2 text-sm font-semibold text-ink-200">通知（{s.notifications.length}）</div>
          {s.notifications.length === 0 ? <EmptyState>无通知</EmptyState> : (
            <div className="max-h-[60vh] space-y-1.5 overflow-auto">
              {[...s.notifications].reverse().slice(0, 60).map((n) => (
                <div key={n.id} className="rounded-md bg-ink-950/50 px-2 py-1.5 text-xs text-ink-300">
                  <div>{n.message}</div>
                  <div className="mt-0.5 text-[10px] text-ink-600">{new Date(n.at).toLocaleString()}{n.userId ? ` · @${userName(s, n.userId)}` : ' · 广播'}</div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
