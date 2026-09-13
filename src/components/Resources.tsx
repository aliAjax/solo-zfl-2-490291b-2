import { useState } from 'react'
import { useStore } from '../store/useStore'
import { newId } from '../lib/engine'
import { can } from '../lib/rules'
import type { Prototype, Recipe, Station, SwitchBatch } from '../types/domain'
import { Badge, Btn, Card, EmptyState, Field, Input, Modal, Select } from './ui'
import { fmtTime, userName } from '../lib/lookups'

type Tab = 'switch' | 'recipe' | 'prototype' | 'station'

export function Resources() {
  const [tab, setTab] = useState<Tab>('switch')
  const tabs: [Tab, string][] = [
    ['switch', '轴体批次'],
    ['recipe', '润滑配方'],
    ['prototype', '样机'],
    ['station', '测试机位'],
  ]
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-ink-100">资源台账</h2>
        <div className="flex gap-1">
          {tabs.map(([k, label]) => (
            <button key={k} onClick={() => setTab(k)} className={`rounded-md px-3 py-1 text-sm ${tab === k ? 'bg-brass-400/15 text-brass-300' : 'text-ink-400 hover:bg-ink-800'}`}>{label}</button>
          ))}
        </div>
      </div>
      {tab === 'switch' && <SwitchView />}
      {tab === 'recipe' && <RecipeView />}
      {tab === 'prototype' && <PrototypeView />}
      {tab === 'station' && <StationView />}
    </div>
  )
}

function SwitchView() {
  const s = useStore((x) => x.state)
  const act = useStore((x) => x.act)
  const actor = s.users.find((u) => u.id === s.currentUserId)
  const canEdit = can(actor, 'switch.manage')
  const [open, setOpen] = useState(false)
  return (
    <div className="space-y-3">
      {canEdit && <Btn variant="gold" onClick={() => setOpen(true)}>＋ 新增轴体批次</Btn>}
      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {s.switchBatches.map((sb) => (
          <Card key={sb.id} className="p-3">
            <div className="flex items-center justify-between">
              <span className="font-mono text-sm font-semibold text-brass-300">{sb.code}</span>
              <Badge>{sb.vendor}</Badge>
            </div>
            <div className="mt-1 text-xs text-ink-400">数量 {sb.count} 颗 · 到货 {fmtTime(sb.receivedAt)}</div>
            <div className="mt-1 text-xs">配方：{sb.lubeRecipeId ? <span className="text-moss-400">{s.recipes.find((r) => r.id === sb.lubeRecipeId)?.code}</span> : <span className="text-wine-400">未润滑（缺配方）</span>}</div>
            {canEdit && (
              <div className="mt-2">
                <Select value={sb.lubeRecipeId ?? ''} onChange={(e) => act({ type: 'switch.upsert', ent: { ...sb, lubeRecipeId: e.target.value || null } })} className="py-1 text-xs">
                  <option value="">— 解绑配方 —</option>
                  {s.recipes.map((r) => <option key={r.id} value={r.id}>{r.code} {r.name}</option>)}
                </Select>
              </div>
            )}
          </Card>
        ))}
      </div>
      {open && <SwitchModal onClose={() => setOpen(false)} />}
    </div>
  )
}

function SwitchModal({ onClose }: { onClose: () => void }) {
  const s = useStore((x) => x.state)
  const act = useStore((x) => x.act)
  const [f, setF] = useState({ code: '', vendor: '', count: 1000, lubeRecipeId: '' })
  const submit = () => {
    const ent: SwitchBatch = {
      id: newId('sb'), code: f.code, vendor: f.vendor, count: Number(f.count),
      lubeRecipeId: f.lubeRecipeId || null, receivedAt: new Date().toISOString(),
    }
    if (act({ type: 'switch.upsert', ent })) onClose()
  }
  return (
    <Modal open onClose={onClose} title="新增轴体批次">
      <div className="space-y-3">
        <Field label="批次号"><Input value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} placeholder="如 GAT-RED-0930" /></Field>
        <Field label="厂商"><Input value={f.vendor} onChange={(e) => setF({ ...f, vendor: e.target.value })} /></Field>
        <Field label="数量"><Input type="number" value={f.count} onChange={(e) => setF({ ...f, count: Number(e.target.value) })} /></Field>
        <Field label="润滑配方">
          <Select value={f.lubeRecipeId} onChange={(e) => setF({ ...f, lubeRecipeId: e.target.value })}>
            <option value="">— 未润滑 —</option>
            {s.recipes.map((r) => <option key={r.id} value={r.id}>{r.code} {r.name}</option>)}
          </Select>
        </Field>
        <div className="flex justify-end gap-2"><Btn variant="ghost" onClick={onClose}>取消</Btn><Btn variant="gold" onClick={submit} disabled={!f.code || !f.vendor}>保存</Btn></div>
      </div>
    </Modal>
  )
}

function RecipeView() {
  const s = useStore((x) => x.state)
  const act = useStore((x) => x.act)
  const actor = s.users.find((u) => u.id === s.currentUserId)
  const canEdit = can(actor, 'recipe.manage')
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<Recipe | null>(null)
  return (
    <div className="space-y-3">
      {canEdit && <Btn variant="gold" onClick={() => { setDraft({ id: newId('r'), code: '', name: '', ratioPct: 50, viscosity: 300, notes: '' }); setOpen(true) }}>＋ 新增配方</Btn>}
      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {s.recipes.map((r) => (
          <Card key={r.id} className="p-3">
            <div className="flex items-center justify-between">
              <span className="font-mono text-sm font-semibold text-brass-300">{r.code}</span>
              <Badge tone="gold">{r.viscosity} cSt</Badge>
            </div>
            <div className="mt-1 text-sm text-ink-200">{r.name}</div>
            <div className="mt-1 text-xs text-ink-400">基脂占比 {r.ratioPct}% · {r.notes}</div>
            {canEdit && <button className="mt-2 text-xs text-brass-300 hover:underline" onClick={() => { setDraft({ ...r }); setOpen(true) }}>编辑</button>}
          </Card>
        ))}
      </div>
      {open && draft && (
        <Modal open onClose={() => setOpen(false)} title="润滑配方">
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="配方号"><Input value={draft.code} onChange={(e) => setDraft({ ...draft, code: e.target.value })} /></Field>
              <Field label="名称"><Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></Field>
              <Field label="基脂占比 %"><Input type="number" value={draft.ratioPct} onChange={(e) => setDraft({ ...draft, ratioPct: Number(e.target.value) })} /></Field>
              <Field label="黏度 cSt"><Input type="number" value={draft.viscosity} onChange={(e) => setDraft({ ...draft, viscosity: Number(e.target.value) })} /></Field>
            </div>
            <Field label="备注"><Input value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} /></Field>
            <div className="flex justify-end gap-2"><Btn variant="ghost" onClick={() => setOpen(false)}>取消</Btn>
              <Btn variant="gold" onClick={() => { if (act({ type: 'recipe.upsert', ent: draft })) setOpen(false) }} disabled={!draft.code || !draft.name}>保存</Btn></div>
          </div>
        </Modal>
      )}
    </div>
  )
}

function PrototypeView() {
  const s = useStore((x) => x.state)
  const act = useStore((x) => x.act)
  const actor = s.users.find((u) => u.id === s.currentUserId)
  const canEdit = can(actor, 'prototype.manage')
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<Prototype | null>(null)
  const blank = (): Prototype => ({
    id: newId('p'), code: '', name: '', switchBatchId: s.switchBatches[0]?.id ?? '',
    assembledBy: s.users.filter((u) => u.role === 'tester')[0]?.id ?? '',
    builtAt: new Date().toISOString(), note: '',
  })
  return (
    <div className="space-y-3">
      {canEdit && <Btn variant="gold" onClick={() => { setDraft(blank()); setOpen(true) }}>＋ 新增样机</Btn>}
      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {s.prototypes.map((p) => (
          <Card key={p.id} className="p-3">
            <div className="flex items-center justify-between">
              <span className="font-mono text-sm font-semibold text-brass-300">{p.code}</span>
              <Badge tone="blue">{s.switchBatches.find((x) => x.id === p.switchBatchId)?.code}</Badge>
            </div>
            <div className="mt-1 text-sm text-ink-200">{p.name}</div>
            <div className="mt-1 text-xs text-ink-400">装机人 <span className="text-ink-200">{userName(s, p.assembledBy)}</span> · {p.note}</div>
            {canEdit && <button className="mt-2 text-xs text-brass-300 hover:underline" onClick={() => { setDraft({ ...p }); setOpen(true) }}>编辑 / 改装机人</button>}
          </Card>
        ))}
      </div>
      {open && draft && (
        <Modal open onClose={() => setOpen(false)} title="样机">
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="样机编号"><Input value={draft.code} onChange={(e) => setDraft({ ...draft, code: e.target.value })} /></Field>
              <Field label="名称"><Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></Field>
            </div>
            <Field label="轴体批次">
              <Select value={draft.switchBatchId} onChange={(e) => setDraft({ ...draft, switchBatchId: e.target.value })}>
                {s.switchBatches.map((sb) => <option key={sb.id} value={sb.id}>{sb.code}</option>)}
              </Select>
            </Field>
            <Field label="装机人（测试员不能评审自装样机）">
              <Select value={draft.assembledBy} onChange={(e) => setDraft({ ...draft, assembledBy: e.target.value })}>
                {s.users.filter((u) => u.role === 'tester').map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </Select>
            </Field>
            <Field label="备注"><Input value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} /></Field>
            <div className="flex justify-end gap-2"><Btn variant="ghost" onClick={() => setOpen(false)}>取消</Btn>
              <Btn variant="gold" onClick={() => { if (act({ type: 'prototype.upsert', ent: draft })) setOpen(false) }} disabled={!draft.code || !draft.name}>保存</Btn></div>
          </div>
        </Modal>
      )}
    </div>
  )
}

function StationView() {
  const s = useStore((x) => x.state)
  const act = useStore((x) => x.act)
  const actor = s.users.find((u) => u.id === s.currentUserId)
  const canCal = can(actor, 'station.calibrate')
  if (s.stations.length === 0) return <EmptyState>无机位</EmptyState>
  return (
    <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
      {s.stations.map((st: Station) => (
        <Card key={st.id} className="p-3">
          <div className="flex items-center justify-between">
            <span className="font-mono text-sm font-semibold text-brass-300">{st.code}</span>
            {st.calibrated ? <Badge tone="green">已校准</Badge> : <Badge tone="red">校准失效</Badge>}
          </div>
          <div className="mt-1 text-sm text-ink-200">{st.name}</div>
          <div className="mt-1 text-xs text-ink-400">麦克风 {st.micModel} · 校准于 {fmtTime(st.calibratedAt)}</div>
          {canCal && (
            <div className="mt-2">
              {st.calibrated
                ? <Btn variant="danger" className="text-xs" onClick={() => act({ type: 'station.calibrate', id: st.id, calibrated: false })}>标记校准失效</Btn>
                : <Btn variant="primary" className="text-xs" onClick={() => act({ type: 'station.calibrate', id: st.id, calibrated: true })}>重新校准</Btn>}
            </div>
          )}
        </Card>
      ))}
    </div>
  )
}
