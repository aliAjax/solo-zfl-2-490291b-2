import { useState } from 'react'
import { useStore } from '../store/useStore'
import { can, findBookingConflict } from '../lib/rules'
import { Badge, Btn, Card, EmptyState, Field, Input, Select } from './ui'
import { fmtTime, fromLocalInput, stationName, toLocalInput, userName } from '../lib/lookups'

function defaultSlot(offsetH = 1) {
  const d = new Date()
  d.setMinutes(0, 0, 0)
  d.setHours(d.getHours() + offsetH)
  const e = new Date(d.getTime() + 60 * 60 * 1000)
  return { start: toLocalInput(d.toISOString()), end: toLocalInput(e.toISOString()) }
}

export function BookingView() {
  const s = useStore((x) => x.state)
  const act = useStore((x) => x.act)
  const actor = s.users.find((u) => u.id === s.currentUserId)
  const canBook = can(actor, 'booking.create')
  const slot0 = defaultSlot(1)
  const [batchId, setBatchId] = useState(s.batches[0]?.id ?? '')
  const [stationId, setStationId] = useState(s.stations[0]?.id ?? '')
  const [prototypeId, setPrototypeId] = useState(s.batches[0]?.prototypeId ?? s.prototypes[0]?.id ?? '')
  const [testerId, setTesterId] = useState(s.users.filter((u) => u.role === 'tester')[0]?.id ?? '')
  const [start, setStart] = useState(slot0.start)
  const [end, setEnd] = useState(slot0.end)
  const [purpose, setPurpose] = useState('声学测听')
  const [item, setItem] = useState('吸音棉')
  const [qty, setQty] = useState(2)

  const batch = s.batches.find((b) => b.id === batchId)
  const candidate = {
    batchId, stationId, prototypeId, testerId,
    start: fromLocalInput(start), end: fromLocalInput(end), purpose,
  }
  const conflict = canBook ? findBookingConflict(s, candidate) : null
  const station = s.stations.find((x) => x.id === stationId)

  const submit = () =>
    act({ type: 'booking.create', p: { ...candidate, consumable: { item, qty: Number(qty) } } })

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-ink-100">测试机位预约 / 耗材出库</h2>
      <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
        <Card className="h-fit p-4">
          <div className="space-y-3">
            <Field label="批次">
              <Select data-testid="bk-batch" value={batchId} onChange={(e) => {
                setBatchId(e.target.value)
                const b = s.batches.find((x) => x.id === e.target.value)
                if (b) setPrototypeId(b.prototypeId)
              }}>
                {s.batches.map((b) => <option key={b.id} value={b.id}>{b.code}</option>)}
              </Select>
            </Field>
            <Field label="机位">
              <Select data-testid="bk-station" value={stationId} onChange={(e) => setStationId(e.target.value)}>
                {s.stations.map((st) => <option key={st.id} value={st.id}>{st.code} {st.name} {st.calibrated ? '' : '（校准失效）'}</option>)}
              </Select>
            </Field>
            <Field label="样机">
              <Select data-testid="bk-proto" value={prototypeId} onChange={(e) => setPrototypeId(e.target.value)}>
                {s.prototypes.map((p) => <option key={p.id} value={p.id}>{p.code} {p.name}</option>)}
              </Select>
            </Field>
            <Field label="测试员">
              <Select value={testerId} onChange={(e) => setTesterId(e.target.value)}>
                {s.users.filter((u) => u.role === 'tester').map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </Select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="开始"><Input data-testid="bk-start" type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} /></Field>
              <Field label="结束"><Input data-testid="bk-end" type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} /></Field>
            </div>
            <Field label="用途"><Input value={purpose} onChange={(e) => setPurpose(e.target.value)} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="耗材"><Input data-testid="bk-item" value={item} onChange={(e) => setItem(e.target.value)} /></Field>
              <Field label="数量"><Input data-testid="bk-qty" type="number" value={qty} onChange={(e) => setQty(Number(e.target.value))} /></Field>
            </div>

            {conflict ? (
              <div className="rounded-lg border border-wine-600/50 bg-wine-600/10 px-3 py-2 text-xs text-wine-400">
                ⛔ 资源冲突：与既有预约时段重叠（机位/样机同一资源不可重叠）。提交将被拒绝并整单回滚。
                <div className="mt-1 text-ink-500">冲突预约 {conflict.id.slice(0, 10)} · {stationName(s, conflict.stationId)} · {userName(s, conflict.testerId)}</div>
              </div>
            ) : station && !station.calibrated ? (
              <div className="rounded-lg border border-brass-400/40 bg-brass-400/10 px-3 py-2 text-xs text-brass-300">
                ⚠ 该机位校准失效：可以预约，但批次无法推进到测听。
              </div>
            ) : (
              <div className="rounded-lg border border-moss-600/40 bg-moss-600/10 px-3 py-2 text-xs text-moss-400">✓ 时段无冲突，可预约（将一并出库耗材）</div>
            )}

            <Btn data-testid="bk-submit" variant="gold" className="w-full justify-center" disabled={!canBook || !!conflict} onClick={submit}>
              预约并出库耗材
            </Btn>
            {!canBook && <div className="text-center text-[11px] text-ink-500">仅排程员可预约</div>}
            {batch && <div className="text-center text-[11px] text-ink-500">批次 {batch.code} · 样机装机人 {userName(s, s.prototypes.find((p) => p.id === prototypeId)?.assembledBy)}</div>}
          </div>
        </Card>

        <div className="space-y-4">
          <Card className="p-3">
            <div className="mb-2 text-sm font-semibold text-ink-200">当前预约（{s.bookings.length}）</div>
            {s.bookings.length === 0 ? <EmptyState>暂无预约</EmptyState> : (
              <div className="space-y-1.5">
                {[...s.bookings].sort((a, b) => (a.start < b.start ? -1 : 1)).map((bk) => (
                  <div key={bk.id} className="flex items-center justify-between rounded-lg bg-ink-950/50 px-3 py-2 text-xs">
                    <div>
                      <span className="font-mono text-ink-200">{fmtTime(bk.start)} – {fmtTime(bk.end)}</span>
                      <span className="ml-2 text-brass-300">{s.batches.find((b) => b.id === bk.batchId)?.code}</span>
                      <span className="ml-2 text-ink-500">@ {s.stations.find((x) => x.id === bk.stationId)?.name} · {s.prototypes.find((p) => p.id === bk.prototypeId)?.code} · {userName(s, bk.testerId)}</span>
                    </div>
                    {can(actor, 'booking.cancel') && (
                      <button className="ml-3 shrink-0 text-wine-400 hover:underline" onClick={() => act({ type: 'booking.cancel', id: bk.id })}>撤销（回退耗材）</button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>
          <Card className="p-3">
            <div className="mb-2 text-sm font-semibold text-ink-200">耗材出库台账（{s.consumptions.length}）</div>
            {s.consumptions.length === 0 ? <EmptyState>无出库记录（隔离/撤销预约时会整单回退）</EmptyState> : (
              <div className="grid gap-1.5 md:grid-cols-2">
                {s.consumptions.map((c) => (
                  <div key={c.id} className="flex items-center justify-between rounded-lg bg-ink-950/50 px-3 py-2 text-xs">
                    <span className="text-ink-200">{c.item} <Badge tone="gold">×{c.qty}</Badge></span>
                    <span className="text-ink-500">{s.batches.find((b) => b.id === c.batchId)?.code} · {fmtTime(c.at)}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}
