import { useState } from 'react'
import { useStore } from '../store/useStore'
import { DB_MAX, DB_MIN, isAnomalous, can, measurementBlockers } from '../lib/rules'
import { Badge, Btn, Card, EmptyState, Field, Input, Select } from './ui'
import { fmtTime, stationName, userName } from '../lib/lookups'

export function MeasureView() {
  const s = useStore((x) => x.state)
  const act = useStore((x) => x.act)
  const actor = s.users.find((u) => u.id === s.currentUserId)
  const canMeasure = can(actor, 'measure.record')
  const [batchId, setBatchId] = useState(s.batches[0]?.id ?? '')
  const [stationId, setStationId] = useState(s.stations.find((x) => x.calibrated)?.id ?? '')
  const [pressureDb, setPressureDb] = useState(52)
  const [thockScore, setThockScore] = useState(78)
  const [clicks, setClicks] = useState(100)
  const [dedupKey, setDedupKey] = useState(`run-${new Date().toISOString().slice(0, 16)}`)
  const [reason, setReason] = useState('复测听感仍有沙音')

  const abnormal = isAnomalous({ pressureDb: Number(pressureDb) })
  const alreadySeen = s.dedup[dedupKey] !== undefined
  const gate = measurementBlockers(s, { batchId, stationId, testerId: actor?.id ?? '' })

  const submit = () =>
    act({
      type: 'measure.record',
      p: { dedupKey, batchId, stationId, pressureDb: Number(pressureDb), thockScore: Number(thockScore), clicks: Number(clicks) },
    })

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-ink-100">测听 / 复测记录</h2>
      <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
        <Card className="h-fit p-4">
          <div className="space-y-3">
            <Field label="批次">
              <Select data-testid="ms-batch" value={batchId} onChange={(e) => setBatchId(e.target.value)}>
                {s.batches.map((b) => <option key={b.id} value={b.id}>{b.code}（{b.stage}）</option>)}
              </Select>
            </Field>
            <Field label="测量机位">
              <Select data-testid="ms-station" value={stationId} onChange={(e) => setStationId(e.target.value)}>
                {s.stations.map((st) => <option key={st.id} value={st.id}>{st.code} {st.name} {st.calibrated ? '' : '（未校准，禁止测量）'}</option>)}
              </Select>
            </Field>
            <Field label={`峰值声压 dB（正常区间 ${DB_MIN}–${DB_MAX}）`}>
              <Input data-testid="ms-db" type="number" value={pressureDb} onChange={(e) => setPressureDb(Number(e.target.value))} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="手感评分 0-100"><Input type="number" value={thockScore} onChange={(e) => setThockScore(Number(e.target.value))} /></Field>
              <Field label="触发次数"><Input type="number" value={clicks} onChange={(e) => setClicks(Number(e.target.value))} /></Field>
            </div>
            <Field label="测量幂等键（同场次重复测量只吸收一次）" hint="离线两页提交相同键，合并时第二次被吸收">
              <Input data-testid="ms-dedup" value={dedupKey} onChange={(e) => setDedupKey(e.target.value)} />
            </Field>

            {gate.blocked ? (
              <div data-testid="ms-gate" className="rounded-lg border border-wine-600/50 bg-wine-600/10 px-3 py-2 text-xs text-wine-400">
                ⛔ {gate.reasons.join('；')}
              </div>
            ) : alreadySeen ? <div className="rounded-lg border border-slateblue-500/50 bg-slateblue-500/10 px-3 py-2 text-xs text-slateblue-400">ℹ 该幂等键已存在，再次提交将被吸收（只保留一次测量）。</div>
            : abnormal ? <div className="rounded-lg border border-wine-600/50 bg-wine-600/10 px-3 py-2 text-xs text-wine-400">⛔ 声压异常：提交后将自动隔离该批次，撤销预约并回退耗材（同一事务）。</div>
            : <div className="rounded-lg border border-moss-600/40 bg-moss-600/10 px-3 py-2 text-xs text-moss-400">✓ 阶段/机位/有效预约均满足，可记录测量。</div>}

            <Btn data-testid="ms-submit" variant="gold" className="w-full justify-center" disabled={!canMeasure || gate.blocked} onClick={submit}>提交测量</Btn>

            <div className="border-t border-ink-700 pt-3">
              <Field label="复测失败原因"><Input value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
              <Btn data-testid="ms-fail-retest" variant="danger" className="mt-2 w-full justify-center" disabled={!canMeasure && !can(actor, 'batch.transition')}
                onClick={() => act({ type: 'retest.fail', id: batchId, reason })}>
                判复测失败 → 隔离批次
              </Btn>
            </div>
          </div>
        </Card>

        <Card className="p-3">
          <div className="mb-2 text-sm font-semibold text-ink-200">测量记录（{s.measurements.length}）</div>
          {s.measurements.length === 0 ? <EmptyState>尚无测量</EmptyState> : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="text-ink-500">
                  <tr><th className="px-2 py-1">时间</th><th className="px-2 py-1">批次</th><th className="px-2 py-1">机位</th><th className="px-2 py-1">测试员</th><th className="px-2 py-1">声压</th><th className="px-2 py-1">手感</th><th className="px-2 py-1">次数</th><th className="px-2 py-1">判定</th><th className="px-2 py-1">幂等键</th></tr>
                </thead>
                <tbody>
                  {[...s.measurements].sort((a, b) => (a.at < b.at ? 1 : -1)).map((m) => (
                    <tr key={m.id} className="border-t border-ink-800">
                      <td className="px-2 py-1.5 text-ink-400">{fmtTime(m.at)}</td>
                      <td className="px-2 py-1.5 text-brass-300">{s.batches.find((b) => b.id === m.batchId)?.code}</td>
                      <td className="px-2 py-1.5 text-ink-300">{stationName(s, m.stationId)}</td>
                      <td className="px-2 py-1.5 text-ink-300">{userName(s, m.testerId)}</td>
                      <td className="px-2 py-1.5 font-mono text-ink-100">{m.pressureDb}</td>
                      <td className="px-2 py-1.5 text-ink-300">{m.thockScore}</td>
                      <td className="px-2 py-1.5 text-ink-300">{m.clicks}</td>
                      <td className="px-2 py-1.5">{m.abnormal ? <Badge tone="red">异常→隔离</Badge> : <Badge tone="green">正常</Badge>}</td>
                      <td className="px-2 py-1.5 font-mono text-[10px] text-ink-500">{m.dedupKey}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
