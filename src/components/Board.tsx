import { useMemo, useState } from 'react'
import { useStore } from '../store/useStore'
import { STAGE_LABEL, STAGE_ORDER, STAGE_TONE, type Batch, type Stage } from '../types/domain'
import { can, STAGE_GRAPH, transitionBlockers } from '../lib/rules'
import { Badge, Btn, Card, EmptyState, Field, Input, Modal, Select, Textarea } from './ui'
import { fmtTime, protoName, recipeName, switchCode, userName } from '../lib/lookups'

export function Board({ openBatch }: { openBatch: (id: string) => void }) {
  const s = useStore((x) => x.state)
  const act = useStore((x) => x.act)
  const actor = s.users.find((u) => u.id === s.currentUserId)
  const [showCreate, setShowCreate] = useState(false)

  const byStage = useMemo(() => {
    const m: Record<Stage, Batch[]> = { queued: [], listening: [], retest: [], review: [], released: [], quarantined: [] }
    for (const b of [...s.batches].sort((a, b2) => b2.priority - a.priority)) m[b.stage].push(b)
    return m
  }, [s.batches])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-ink-100">批次流程看板</h2>
          <p className="text-sm text-ink-500">排队 → 测听 → 复测 → 评审 → 放行；声压异常 / 复测失败 → 隔离（整单回滚预约与耗材）</p>
        </div>
        <Btn data-testid="btn-create-batch" variant="gold" onClick={() => setShowCreate(true)} disabled={!can(actor, 'batch.create')}>
          ＋ 建立批次
        </Btn>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {STAGE_ORDER.map((stage) => (
          <div key={stage} className="flex flex-col gap-2">
            <div className="flex items-center justify-between px-1">
              <Badge tone={STAGE_TONE[stage]}>{STAGE_LABEL[stage]}</Badge>
              <span className="font-mono text-xs text-ink-500">{byStage[stage].length}</span>
            </div>
            <div className="flex min-h-[120px] flex-col gap-2 rounded-xl bg-ink-950/40 p-2">
              {byStage[stage].length === 0 && <div className="py-6 text-center text-xs text-ink-600">—</div>}
              {byStage[stage].map((b) => {
                const proto = s.prototypes.find((p) => p.id === b.prototypeId)
                const gateTargets = STAGE_GRAPH[b.stage]
                const blockedNow = gateTargets
                  .map((t) => ({ t, blk: transitionBlockers(s, b, t) }))
                  .filter((x) => x.blk.blocked)
                return (
                  <Card key={b.id} data-batch-id={b.id} className="cursor-pointer p-3 hover:border-brass-400/60" >
                    <div data-testid={`batch-card-${b.id}`} onClick={() => openBatch(b.id)}>
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-sm font-semibold text-brass-300">{b.code}</span>
                        {b.result === 'pass' ? <Badge tone="green">通过</Badge> : b.result === 'fail' ? <Badge tone="red">不通过</Badge> : <Badge>待定</Badge>}
                      </div>
                      <div className="mt-1.5 space-y-0.5 text-xs text-ink-400">
                        <div>样机 {protoName(s, b.prototypeId)} · {proto?.name}</div>
                        <div>轴体 {switchCode(s, b.switchBatchId)}</div>
                        <div>配方 <span className={b.lubeRecipeId ? 'text-ink-300' : 'text-wine-400'}>{recipeName(s, b.lubeRecipeId)}</span></div>
                        <div className="flex items-center justify-between">
                          <span>优先级 {b.priority}</span>
                          <span>装机 {userName(s, proto?.assembledBy)}</span>
                        </div>
                      </div>
                      {stage === 'quarantined' && b.quarantineReason && (
                        <div className="mt-2 rounded-md border border-wine-600/40 bg-wine-600/10 px-2 py-1 text-[11px] text-wine-400">{b.quarantineReason}</div>
                      )}
                      {blockedNow.length > 0 && stage !== 'quarantined' && stage !== 'released' && (
                        <div className="mt-2 space-y-0.5 text-[10px] text-ink-500">
                          {blockedNow.slice(0, 2).map((x) => (
                            <div key={x.t} title={x.blk.reasons.join('；')}>⛔ {STAGE_LABEL[x.t]}：{x.blk.reasons[0]}</div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {STAGE_GRAPH[b.stage].map((t) => {
                        const blk = transitionBlockers(s, b, t)
                        const perm = t === 'released' ? can(actor, 'batch.release') : can(actor, 'batch.transition')
                        return (
                          <button
                            key={t}
                            data-testid={`move-${b.id}-${t}`}
                            disabled={blk.blocked || !perm}
                            title={blk.blocked ? blk.reasons.join('；') : !perm ? '当前角色无权限' : `流转到${STAGE_LABEL[t]}`}
                            onClick={() => act({ type: 'batch.transition', id: b.id, target: t })}
                            className={`rounded px-1.5 py-0.5 text-[10px] ${
                              t === 'quarantined'
                                ? 'bg-wine-600/20 text-wine-400 hover:bg-wine-600/40'
                                : t === 'released'
                                  ? 'bg-moss-600/20 text-moss-400 hover:bg-moss-600/40'
                                  : 'bg-ink-800 text-ink-300 hover:bg-ink-700'
                            } disabled:cursor-not-allowed disabled:opacity-30`}
                          >
                            {STAGE_LABEL[t]}
                          </button>
                        )
                      })}
                    </div>
                  </Card>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {showCreate && <CreateBatchModal onClose={() => setShowCreate(false)} />}
    </div>
  )
}

function CreateBatchModal({ onClose }: { onClose: () => void }) {
  const s = useStore((x) => x.state)
  const act = useStore((x) => x.act)
  const [switchBatchId, setSwitchBatchId] = useState(s.switchBatches[0]?.id ?? '')
  const prototypes = s.prototypes.filter((p) => p.switchBatchId === switchBatchId)
  const sb = s.switchBatches.find((x) => x.id === switchBatchId)
  const [prototypeId, setPrototypeId] = useState(prototypes[0]?.id ?? '')
  const [lubeRecipeId, setLubeRecipeId] = useState<string>(sb?.lubeRecipeId ?? '')
  const [priority, setPriority] = useState(5)
  const [note, setNote] = useState('')

  // 切换轴体时重置样机与默认配方
  const onSwitch = (id: string) => {
    setSwitchBatchId(id)
    const ps = s.prototypes.filter((p) => p.switchBatchId === id)
    setPrototypeId(ps[0]?.id ?? '')
    const found = s.switchBatches.find((x) => x.id === id)
    setLubeRecipeId(found?.lubeRecipeId ?? '')
  }

  const submit = () => {
    const ok2 = act({
      type: 'batch.create',
      p: { switchBatchId, prototypeId, lubeRecipeId: lubeRecipeId || null, priority: Number(priority), note },
    })
    if (ok2) onClose()
  }

  return (
    <Modal open onClose={onClose} title="建立批次">
      <div className="space-y-3">
        <Field label="轴体批次">
          <Select data-testid="newbatch-switch" value={switchBatchId} onChange={(e) => onSwitch(e.target.value)}>
            {s.switchBatches.map((sb2) => (
              <option key={sb2.id} value={sb2.id}>{sb2.code} · {sb2.vendor} · {sb2.count}颗</option>
            ))}
          </Select>
        </Field>
        <Field label="样机" hint={prototypes.length === 0 ? '该轴体批次没有对应样机，请先在资源台账创建' : undefined}>
          <Select value={prototypeId} onChange={(e) => setPrototypeId(e.target.value)}>
            {prototypes.map((p) => (
              <option key={p.id} value={p.id}>{p.code} · {p.name}（装机 {userName(s, p.assembledBy)}）</option>
            ))}
          </Select>
        </Field>
        <Field label="润滑配方" hint="留空表示缺配方（将无法推进到测听）">
          <Select value={lubeRecipeId} onChange={(e) => setLubeRecipeId(e.target.value)}>
            <option value="">— 不绑定（缺配方）—</option>
            {s.recipes.map((r) => (
              <option key={r.id} value={r.id}>{r.code} · {r.name}</option>
            ))}
          </Select>
        </Field>
        <Field label={`优先级（${priority}）`}>
          <input data-testid="newbatch-priority" type="range" min={1} max={10} value={priority} onChange={(e) => setPriority(Number(e.target.value))} className="w-full accent-brass-400" />
        </Field>
        <Field label="备注"><Textarea data-testid="newbatch-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="批次说明…" /></Field>
        <div className="flex justify-end gap-2 pt-2">
          <Btn variant="ghost" onClick={onClose}>取消</Btn>
          <Btn data-testid="newbatch-submit" variant="gold" onClick={submit} disabled={!prototypeId}>建立批次</Btn>
        </div>
      </div>
    </Modal>
  )
}

export function BatchDrawer({ batchId, onClose }: { batchId: string | null; onClose: () => void }) {
  const s = useStore((x) => x.state)
  const act = useStore((x) => x.act)
  const actor = s.users.find((u) => u.id === s.currentUserId)
  const b = s.batches.find((x) => x.id === batchId)
  if (!batchId || !b) return null
  const proto = s.prototypes.find((p) => p.id === b.prototypeId)
  const bookings = s.bookings.filter((x) => x.batchId === b.id)
  const measurements = s.measurements.filter((x) => x.batchId === b.id)
  const session = s.sessions.find((x) => x.batchId === b.id)

  return (
    <Modal open onClose={onClose} title={`批次 ${b.code}`} width="max-w-2xl">
      <div className="space-y-4 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={STAGE_TONE[b.stage]}>{STAGE_LABEL[b.stage]}</Badge>
          {b.result === 'pass' ? <Badge tone="green">评审通过</Badge> : b.result === 'fail' ? <Badge tone="red">评审不通过</Badge> : <Badge>结论待定</Badge>}
          <span className="text-xs text-ink-500">建立于 {fmtTime(b.createdAt)}</span>
        </div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-ink-400">
          <div>样机：<span className="text-ink-200">{proto?.code} {proto?.name}</span></div>
          <div>装机人：<span className="text-ink-200">{userName(s, proto?.assembledBy)}</span></div>
          <div>轴体批次：<span className="text-ink-200">{switchCode(s, b.switchBatchId)}</span></div>
          <div>润滑配方：<span className={b.lubeRecipeId ? 'text-ink-200' : 'text-wine-400'}>{recipeName(s, b.lubeRecipeId)}</span></div>
        </div>

        {b.quarantineReason && (
          <div className="rounded-lg border border-wine-600/50 bg-wine-600/10 px-3 py-2 text-wine-400">⛔ {b.quarantineReason}</div>
        )}

        {/* 流转闸门实况 */}
        <Card className="p-3">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-500">流转闸门（前置条件实时校验）</div>
          <div className="flex flex-wrap gap-2">
            {STAGE_GRAPH[b.stage].map((t) => {
              const blk = transitionBlockers(s, b, t)
              const perm = t === 'released' ? can(actor, 'batch.release') : can(actor, 'batch.transition')
              return (
                <div key={t} className={`rounded-lg border px-2.5 py-1.5 text-xs ${blk.blocked ? 'border-wine-600/40 bg-wine-600/5' : 'border-moss-600/40 bg-moss-600/5'}`}>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-ink-200">{STAGE_LABEL[t]}</span>
                    <button
                      disabled={blk.blocked || !perm}
                      className="rounded bg-ink-800 px-2 py-0.5 text-[10px] text-ink-200 hover:bg-ink-700 disabled:opacity-30"
                      onClick={() => act({ type: 'batch.transition', id: b.id, target: t })}
                    >
                      推进
                    </button>
                  </div>
                  {blk.blocked
                    ? blk.reasons.map((r) => <div key={r} className="mt-0.5 text-[10px] text-wine-400">⛔ {r}</div>)
                    : <div className="mt-0.5 text-[10px] text-moss-400">✓ 满足条件{perm ? '' : '（但当前角色无权）'}</div>}
                </div>
              )
            })}
          </div>
        </Card>

        {b.stage === 'review' && can(actor, 'batch.transition') && (
          <Card className="flex items-center gap-2 p-3">
            <span className="text-xs text-ink-400">评审结论：</span>
            <Btn variant="primary" onClick={() => act({ type: 'batch.result', id: b.id, result: 'pass' })}>判定通过</Btn>
            <Btn variant="danger" onClick={() => act({ type: 'batch.result', id: b.id, result: 'fail' })}>判定不通过</Btn>
            {b.result === 'fail' && can(actor, 'batch.transition') && (
              <Btn variant="danger" onClick={() => act({ type: 'retest.fail', id: b.id, reason: `评审判定不通过（${b.note || '见评审记录'}）` })}>按复测失败隔离</Btn>
            )}
          </Card>
        )}

        <div className="grid gap-3 md:grid-cols-2">
          <Card className="p-3">
            <div className="mb-1.5 text-xs font-semibold text-ink-500">机位预约（{bookings.length}）</div>
            {bookings.length === 0 ? <EmptyState>无预约（测听需已校准机位）</EmptyState> : (
              <div className="space-y-1.5">
                {bookings.map((bk) => (
                  <div key={bk.id} className="flex items-center justify-between rounded-md bg-ink-950/50 px-2 py-1 text-xs">
                    <div>
                      <div className="text-ink-200">{bk.start.slice(5, 16)} → {bk.end.slice(5, 16)}</div>
                      <div className="text-ink-500">{userName(s, bk.testerId)} @ {s.stations.find((x) => x.id === bk.stationId)?.name}</div>
                    </div>
                    {can(actor, 'booking.cancel') && (
                      <button className="text-wine-400 hover:underline" onClick={() => act({ type: 'booking.cancel', id: bk.id })}>撤销</button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>
          <Card className="p-3">
            <div className="mb-1.5 text-xs font-semibold text-ink-500">声压测量（{measurements.length}）</div>
            {measurements.length === 0 ? <EmptyState>尚无测量</EmptyState> : (
              <div className="space-y-1.5">
                {measurements.map((m) => (
                  <div key={m.id} className="flex items-center justify-between rounded-md bg-ink-950/50 px-2 py-1 text-xs">
                    <span className="font-mono text-ink-200">{m.pressureDb}dB</span>
                    <span className="text-ink-500">手感 {m.thockScore}</span>
                    {m.abnormal ? <Badge tone="red">异常</Badge> : <Badge tone="green">正常</Badge>}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {session && (
          <Card className="p-3 text-xs">
            <div className="mb-1 font-semibold text-ink-500">盲测场次 {session.code}</div>
            <div className="text-ink-400">
              样本 {session.sampleCodes.join('、')} · 评审团 {session.panel.map((id) => userName(s, id)).join('、')} · 已投票 {session.votes.length}
            </div>
          </Card>
        )}

        <NoteEditor batch={b} />
      </div>
    </Modal>
  )
}

function NoteEditor({ batch }: { batch: Batch }) {
  const act = useStore((x) => x.act)
  const actor = useStore((x) => x.state.users.find((u) => u.id === x.state.currentUserId))
  const [note, setNote] = useState(batch.note)
  const [editing, setEditing] = useState(false)
  if (!can(actor, 'batch.edit')) return <div className="text-xs text-ink-600">备注：{batch.note || '（空）'}</div>
  return (
    <div>
      <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-500">批次备注（用于双页逐字段合并演示）</div>
      {editing ? (
        <div className="flex gap-2">
          <Input value={note} onChange={(e) => setNote(e.target.value)} autoFocus />
          <Btn variant="gold" onClick={() => { act({ type: 'batch.note', id: batch.id, note }); setEditing(false) }}>保存</Btn>
          <Btn variant="ghost" onClick={() => { setNote(batch.note); setEditing(false) }}>取消</Btn>
        </div>
      ) : (
        <button className="text-left text-sm text-ink-300 hover:text-brass-300" onClick={() => setEditing(true)}>
          {batch.note || '（点击编辑）'} ✎
        </button>
      )}
    </div>
  )
}
