import { useStore } from '../store/useStore'
import { Badge, Btn, Card, EmptyState } from './ui'

export function MergeView() {
  const s = useStore((x) => x.state)
  const clearMerge = useStore((x) => x.clearMerge)
  const refresh = useStore((x) => x.refresh)
  const r = s.lastMerge

  const fieldLabel = (key: string) => {
    const [id, ...rest] = key.split('.')
    const coll = ['batches', 'prototypes', 'switchBatches', 'recipes', 'stations', 'bookings', 'sessions']
      .find((c) => (s as unknown as Record<string, { id: string; code?: string }[]>)[c]?.some((e) => e.id === id))
    const ent = coll ? (s as unknown as Record<string, { id: string; code?: string }[]>)[coll].find((e) => e.id === id) : null
    return `${ent?.code ?? id.slice(0, 8)} · ${rest.join('.')}`
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-ink-100">双页离线合并裁决</h2>
          <p className="text-sm text-ink-500">同场次修改按字段逻辑时钟逐字段 LWW；删除以墓碑裁决；重复测量只吸收一次。在两个浏览器标签各改同一条记录，回到本页点“刷新”即可看到裁决。</p>
        </div>
        <div className="flex gap-2">
          <Btn variant="soft" onClick={refresh}>刷新并裁决</Btn>
          {r && <Btn variant="ghost" onClick={clearMerge}>清除报告</Btn>}
        </div>
      </div>

      {!r ? (
        <EmptyState>尚无合并记录。打开两个标签页（或在其中一页切换到离线再恢复），对同一批次不同字段做修改后触发合并。</EmptyState>
      ) : (
        <div className="space-y-3">
          <Card className="flex flex-wrap items-center gap-3 p-4">
            <Badge tone="blue">来源：{r.withTab}</Badge>
            <span className="text-xs text-ink-500">{new Date(r.at).toLocaleString()}</span>
            <span data-testid="merge-summary" className="text-sm text-ink-200">{r.summary}</span>
          </Card>

          <Card className="p-4">
            <div className="mb-2 text-sm font-semibold text-ink-200">逐字段裁决（{r.changedScalars.length}）</div>
            {r.changedScalars.length === 0 ? <EmptyState>无冲突字段</EmptyState> : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="text-ink-500"><tr><th className="px-2 py-1">字段</th><th className="px-2 py-1">胜方保留</th><th className="px-2 py-1">落选取舍</th><th className="px-2 py-1">依据</th></tr></thead>
                  <tbody>
                    {r.changedScalars.map((c) => (
                      <tr key={c.key} className="border-t border-ink-800">
                        <td className="px-2 py-1.5 font-mono text-ink-300">{fieldLabel(c.key)}</td>
                        <td className="px-2 py-1.5"><Badge tone="green">{c.winner}</Badge> <span className="ml-1 text-ink-100">{String(c.local)}</span></td>
                        <td className="px-2 py-1.5"><Badge tone="red">{c.loser}</Badge> <span className="ml-1 text-ink-500">{String(c.remote)}</span></td>
                        <td className="px-2 py-1.5 text-ink-500">{c.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <div className="grid gap-3 md:grid-cols-3">
            <Card className="p-4">
              <div className="mb-2 text-sm font-semibold text-ink-200">新增实体（{r.addedEntities.length}）</div>
              {r.addedEntities.length === 0 ? <div className="text-xs text-ink-600">无</div> :
                <ul className="max-h-48 space-y-0.5 overflow-auto font-mono text-[11px] text-moss-400">{r.addedEntities.map((x) => <li key={x}>＋ {x}</li>)}</ul>}
            </Card>
            <Card className="p-4">
              <div className="mb-2 text-sm font-semibold text-ink-200">墓碑删除（{r.removedTombstones.length}）</div>
              {r.removedTombstones.length === 0 ? <div className="text-xs text-ink-600">无</div> :
                <ul className="max-h-48 space-y-0.5 overflow-auto font-mono text-[11px] text-wine-400">{r.removedTombstones.map((x) => <li key={x}>✕ {x}</li>)}</ul>}
            </Card>
            <Card className="p-4">
              <div className="mb-2 text-sm font-semibold text-ink-200">重复测量吸收（{r.duplicateMeasurements.length}）</div>
              {r.duplicateMeasurements.length === 0 ? <div className="text-xs text-ink-600">无</div> :
                <ul data-testid="merge-dups" className="max-h-48 space-y-0.5 overflow-auto font-mono text-[11px] text-slateblue-400">{r.duplicateMeasurements.map((x) => <li key={x}>⧉ {x}（只计一次）</li>)}</ul>}
            </Card>
          </div>

          <Card className="p-4">
            <div className="mb-2 text-sm font-semibold text-ink-200">盲测重复投票拦截（{r.voteConflicts.length}）</div>
            {r.voteConflicts.length === 0 ? <div className="text-xs text-ink-600">无（不同测试员的票已全部并存）</div> : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="text-ink-500"><tr><th className="px-2 py-1">场次</th><th className="px-2 py-1">测试员</th><th className="px-2 py-1">保留票</th><th className="px-2 py-1">拦截票</th><th className="px-2 py-1">裁决</th></tr></thead>
                  <tbody>
                    {r.voteConflicts.map((c, i) => (
                      <tr key={`${c.sessionId}-${c.testerId}-${i}`} className="border-t border-ink-800">
                        <td className="px-2 py-1.5 font-mono text-ink-300">{c.sessionCode}</td>
                        <td className="px-2 py-1.5 text-ink-200">{c.testerId}</td>
                        <td className="px-2 py-1.5"><Badge tone="green">{c.keptRating}</Badge></td>
                        <td className="px-2 py-1.5"><Badge tone="red">{c.droppedRating}</Badge></td>
                        <td className="px-2 py-1.5 text-ink-500">{c.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  )
}
