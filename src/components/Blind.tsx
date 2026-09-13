import { useState } from 'react'
import { useStore } from '../store/useStore'
import { can, isSelfAssembled } from '../lib/rules'
import { Badge, Btn, Card, EmptyState, Field, Input, Modal, Select } from './ui'
import { batchCode, userName } from '../lib/lookups'

export function BlindView() {
  const s = useStore((x) => x.state)
  const act = useStore((x) => x.act)
  const actor = s.users.find((u) => u.id === s.currentUserId)
  const [open, setOpen] = useState(false)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-ink-100">盲测场次</h2>
          <p className="text-sm text-ink-500">样本脱敏 · 评审团利益冲突拦截 · 测试员不能评估自装样机 · 每人一票</p>
        </div>
        {can(actor, 'session.manage') && <Btn data-testid="blind-create" variant="gold" onClick={() => setOpen(true)}>＋ 创建盲测场次</Btn>}
      </div>

      {s.sessions.length === 0 ? <EmptyState>尚无盲测场次（批次进入评审前必须先建场次并配齐样本与评审团）</EmptyState> : (
        <div className="grid gap-3 lg:grid-cols-2">
          {s.sessions.map((ses) => {
            const batch = s.batches.find((b) => b.id === ses.batchId)
            const proto = s.prototypes.find((p) => p.id === batch?.prototypeId)
            const me = actor
            const inPanel = !!me && ses.panel.includes(me.id)
            const selfAssembled = !!batch && !!me && isSelfAssembled(s, batch.prototypeId, me.id)
            const voted = !!me && ses.votes.some((v) => v.testerId === me.id)
            const avg = ses.votes.length ? Math.round(ses.votes.reduce((a, v) => a + v.rating, 0) / ses.votes.length) : null
            return (
              <Card key={ses.id} data-session-id={ses.id} className="p-4">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm font-semibold text-brass-300">{ses.code}</span>
                  <Badge tone="purple">{batchCode(s, ses.batchId)}</Badge>
                </div>
                <div className="mt-2 text-xs text-ink-400">
                  <div>脱敏样本：{ses.sampleCodes.map((c) => <Badge key={c} className="mr-1">{c}</Badge>)}</div>
                  <div className="mt-2">评审团：{ses.panel.map((id) => (
                    <span key={id} className="mr-2">
                      {userName(s, id)}
                      {proto?.assembledBy === id && <span className="text-wine-400">（装机人，禁止）</span>}
                    </span>
                  ))}</div>
                </div>

                {can(actor, 'session.manage') && <AddPanelist sessionId={ses.id} panel={ses.panel} assembler={proto?.assembledBy} />}

                <div className="mt-3 rounded-lg bg-ink-950/50 p-3">
                  <div className="mb-2 flex items-center justify-between text-xs">
                    <span className="text-ink-400">投票 {ses.votes.length} 张 {avg !== null && <>· 均分 <span className="font-mono text-brass-300">{avg}</span></>}</span>
                  </div>
                  {ses.votes.length === 0 ? <div className="text-xs text-ink-600">暂无投票</div> : (
                    <div className="space-y-1">
                      {ses.votes.map((v) => (
                        <div key={v.testerId} className="flex items-center justify-between text-xs">
                          <span className="text-ink-200">{userName(s, v.testerId)}</span>
                          <span className="font-mono text-ink-300">{v.rating}</span>
                          <span className="text-ink-500">{v.comment}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {me?.role === 'tester' && (
                    <VoteBox
                      selfAssembled={selfAssembled}
                      inPanel={inPanel}
                      voted={voted}
                      onVote={(rating, comment) => act({ type: 'session.vote', id: ses.id, rating, comment })}
                    />
                  )}
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {open && <CreateSessionModal onClose={() => setOpen(false)} />}
    </div>
  )
}

function AddPanelist({ sessionId, panel, assembler }: { sessionId: string; panel: string[]; assembler?: string }) {
  const s = useStore((x) => x.state)
  const act = useStore((x) => x.act)
  const candidates = s.users.filter((u) => u.role === 'tester' && !panel.includes(u.id))
  const [userId, setUserId] = useState(candidates[0]?.id ?? '')
  return (
    <div className="mt-3 flex items-end gap-2">
      <Field label="增补评审团成员">
        <Select value={userId} onChange={(e) => setUserId(e.target.value)} className="py-1 text-xs">
          {candidates.map((u) => <option key={u.id} value={u.id}>{u.name}{assembler === u.id ? '（装机人）' : ''}</option>)}
        </Select>
      </Field>
      <Btn className="text-xs" disabled={!userId || assembler === userId} title={assembler === userId ? '装机人不得评审自装样机' : ''}
        onClick={() => act({ type: 'session.panel', id: sessionId, userId })}>加入</Btn>
    </div>
  )
}

function VoteBox({ selfAssembled, inPanel, voted, onVote }: { selfAssembled: boolean; inPanel: boolean; voted: boolean; onVote: (r: number, c: string) => void }) {
  const [rating, setRating] = useState(80)
  const [comment, setComment] = useState('')
  return (
    <div className="mt-3 border-t border-ink-800 pt-3">
      {selfAssembled ? (
        <div className="rounded-md border border-wine-600/50 bg-wine-600/10 px-2 py-1.5 text-xs text-wine-400">⛔ 你是该样机装机人，禁止参与本场盲测评估（越权操作将被拒绝）。</div>
      ) : !inPanel ? (
        <div className="text-xs text-ink-500">你不在本场评审团，无法投票。</div>
      ) : voted ? (
        <div className="text-xs text-moss-400">✓ 你已投票，感谢参与。</div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <input type="range" min={0} max={100} value={rating} onChange={(e) => setRating(Number(e.target.value))} className="w-full accent-brass-400" />
            <span className="w-10 text-right font-mono text-sm text-brass-300">{rating}</span>
          </div>
          <Input value={comment} onChange={(e) => setComment(e.target.value)} data-testid="vote-comment" placeholder="听感简评（可选）" className="text-xs" />
          <Btn data-testid="vote-submit" variant="primary" className="w-full justify-center text-xs" onClick={() => onVote(Number(rating), comment)}>提交盲测投票</Btn>
        </div>
      )}
    </div>
  )
}

function CreateSessionModal({ onClose }: { onClose: () => void }) {
  const s = useStore((x) => x.state)
  const act = useStore((x) => x.act)
  const eligibleBatches = s.batches.filter((b) => !s.sessions.some((ses) => ses.batchId === b.id))
  const [batchId, setBatchId] = useState(eligibleBatches[0]?.id ?? '')
  const [sampleText, setSampleText] = useState('S-01,S-02,S-03')
  const [panel, setPanel] = useState<string[]>([])

  const batch = s.batches.find((b) => b.id === batchId)
  const proto = s.prototypes.find((p) => p.id === batch?.prototypeId)
  const testers = s.users.filter((u) => u.role === 'tester')
  const toggle = (id: string) => setPanel((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))

  const submit = () =>
    act({
      type: 'session.create',
      p: { batchId, sampleCodes: sampleText.split(/[,，\s]+/).filter(Boolean), panel },
    }) && onClose()

  return (
    <Modal open onClose={onClose} title="创建盲测场次">
      <div className="space-y-3">
        <Field label="批次">
          <Select data-testid="cs-batch" value={batchId} onChange={(e) => setBatchId(e.target.value)}>
            {eligibleBatches.map((b) => <option key={b.id} value={b.id}>{b.code}</option>)}
          </Select>
        </Field>
        <Field label="脱敏样本编码（逗号分隔）"><Input value={sampleText} onChange={(e) => setSampleText(e.target.value)} /></Field>
        <Field label="评审团成员（装机人会被拒绝）">
          <div className="space-y-1">
            {testers.map((u) => {
              const isAssembler = proto?.assembledBy === u.id
              return (
                <label key={u.id} className={`flex items-center gap-2 rounded-md px-2 py-1 text-sm ${isAssembler ? 'bg-wine-600/10 text-wine-400' : 'text-ink-200'}`}>
                  <input data-testid={`cs-panel-${u.id}`} type="checkbox" checked={panel.includes(u.id)} disabled={isAssembler} onChange={() => toggle(u.id)} className="accent-brass-400" />
                  {u.name} {isAssembler && '· 装机人（禁止加入）'}
                </label>
              )
            })}
          </div>
        </Field>
        <div className="flex justify-end gap-2 pt-2"><Btn variant="ghost" onClick={onClose}>取消</Btn><Btn variant="gold" onClick={submit}>创建</Btn></div>
      </div>
    </Modal>
  )
}
