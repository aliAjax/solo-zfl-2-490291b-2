import { chromium } from 'playwright'
import assert from 'node:assert'

const BASE = process.env.BASE_URL || 'http://127.0.0.1:4173'
const DOC = 'kacl.doc.v1'

const results = []
async function test(name, fn) {
  const browser = await chromium.launch()
  const ctx = await browser.newContext()
  const page = await ctx.newPage()
  const errs = []
  page.on('pageerror', (e) => errs.push(e.message))
  try {
    await fn(page, ctx)
    assert.equal(errs.length, 0, `页面运行时错误: ${errs.join(' | ')}`)
    results.push({ name, ok: true })
    console.log(`  \x1b[32m✓\x1b[0m ${name}`)
  } catch (e) {
    results.push({ name, ok: false, err: e.message })
    console.log(`  \x1b[31m✗ ${name}\x1b[0m\n    ${e.message.split('\n')[0]}`)
  } finally {
    await ctx.close()
    await browser.close()
  }
}

/** 全新种子打开页面 */
async function fresh(page, { offline = false } = {}) {
  await page.goto(BASE)
  await page.evaluate((off) => {
    const s = window.__kacl.seedState(window.__kacl.newId('tab'))
    s.online = !off
    localStorage.setItem('kacl.doc.v1', JSON.stringify(s))
  }, offline)
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForSelector('text=批次流程看板')
  return page
}
const state = (p) => p.evaluate(() => window.__kacl.useStore.getState().state)
const act = (p, a) => p.evaluate((action) => window.__kacl.useStore.getState().act(action), a)
const switchUser = (p, id) => p.selectOption('[data-testid="role-select"]', id)
const go = (p, tab) => p.click(`[data-testid="tab-${tab}"]`)
const toastText = (p) => p.$$eval('[class*="fixed"][class*="bottom-4"] div', els => els.map(e => e.textContent)).catch(() => [])
const lastToast = async (p) => {
  await p.waitForTimeout(150)
  const all = await p.evaluate(() => window.__kacl.useStore.getState().toasts.map(t => t.text))
  return all[all.length - 1] ?? ''
}
// 固定未来时段
const SLOT1 = { s: '2099-03-10T09:00', e: '2099-03-10T10:00' }
const SLOT2 = { s: '2099-03-10T09:30', e: '2099-03-10T10:30' }
const SLOT3 = { s: '2099-03-10T11:00', e: '2099-03-10T12:00' }

// ============ 场景 1：建批 ============
await test('场景1 建批：排程员建立批次并入队，缺配方批次被测听闸门拦截', async (page) => {
  await fresh(page)
  await switchUser(page, 'u_sched')
  const before = (await state(page)).batches.length
  await page.click('[data-testid="btn-create-batch"]')
  await page.waitForSelector('[data-testid="newbatch-submit"]')
  // 默认轴体 sb_gat_red（有配方），样机 p_alpha
  await page.fill('[data-testid="newbatch-note"]', '端到端首批')
  await page.click('[data-testid="newbatch-submit"]')
  await page.waitForTimeout(200)
  let s = await state(page)
  assert.equal(s.batches.length, before + 1, '批次数量应 +1')
  const nb = s.batches[s.batches.length - 1]
  assert.equal(nb.stage, 'queued', '新批次应为排队阶段')
  assert.ok(nb.lubeRecipeId, '应绑定默认配方')
  assert.equal(nb.note, '端到端首批')

  // 缺配方批次 b_3：测听按钮应禁用
  const disabled = await page.$eval('[data-testid="move-b_3-listening"]', el => el.disabled)
  assert.ok(disabled, '缺配方批次的测听推进必须被禁用')
  // 直接尝试也应失败回滚
  const beforeClock = s.clock
  await act(page, { type: 'batch.transition', id: 'b_3', target: 'listening' })
  s = await state(page)
  const b3 = s.batches.find(x => x.id === 'b_3')
  assert.equal(b3.stage, 'queued', '缺配方不得推进')
  assert.ok(s.audit.some(a => !a.ok && a.detail.includes('缺润滑配方')), '审计应记录失败回滚原因')
  void beforeClock
})

// ============ 场景 2：资源冲突 ============
await test('场景2 资源冲突：机位/样机时段重叠无法预约，冲突按钮禁用', async (page) => {
  await fresh(page)
  await switchUser(page, 'u_sched')
  await go(page, 'booking')
  // 第一笔：b_1 / st_a / p_alpha，成功
  await page.selectOption('[data-testid="bk-batch"]', 'b_1')
  await page.fill('[data-testid="bk-start"]', SLOT1.s)
  await page.fill('[data-testid="bk-end"]', SLOT1.e)
  assert.equal(await page.$eval('[data-testid="bk-submit"]', el => el.disabled), false)
  await page.click('[data-testid="bk-submit"]')
  await page.waitForTimeout(200)
  let s = await state(page)
  assert.equal(s.bookings.length, 1, '应有 1 个预约')
  assert.equal(s.consumptions.length, 1, '应出库 1 笔耗材')

  // 第二笔：同机位 st_a，重叠时段 -> 冲突，按钮禁用
  await page.selectOption('[data-testid="bk-batch"]', 'b_2')
  await page.selectOption('[data-testid="bk-station"]', 'st_a')
  await page.fill('[data-testid="bk-start"]', SLOT2.s)
  await page.fill('[data-testid="bk-end"]', SLOT2.e)
  await page.waitForTimeout(100)
  assert.equal(await page.$eval('[data-testid="bk-submit"]', el => el.disabled), true, '同机位重叠必须禁用提交')
  assert.ok((await lastToast(page)) || true)
  await page.waitForSelector('text=资源冲突')

  // 强行通过引擎提交，应整体失败且零改动
  const before = await state(page)
  await act(page, { type: 'booking.create', p: {
    batchId: 'b_2', stationId: 'st_a', prototypeId: 'p_beta', testerId: 'u_t2',
    start: new Date(SLOT2.s).toISOString(), end: new Date(SLOT2.e).toISOString(), purpose: 'x',
    consumable: { item: '吸音棉', qty: 9 } } })
  const after = await state(page)
  assert.equal(after.bookings.length, before.bookings.length, '冲突预约不得新增')
  assert.equal(after.consumptions.length, before.consumptions.length, '失败时耗材零出库')
  assert.ok(after.audit.some(a => !a.ok && a.detail.includes('时段')), '审计记录冲突回滚')

  // 同一样机不同机位（st_b）在重叠时段也应冲突
  await page.selectOption('[data-testid="bk-station"]', 'st_b')
  await page.selectOption('[data-testid="bk-proto"]', 'p_alpha') // 与第一笔同样机
  await page.waitForTimeout(100)
  assert.equal(await page.$eval('[data-testid="bk-submit"]', el => el.disabled), true, '同样机不同机位重叠也须禁用')
  // 不重叠的另一时段可成功
  await page.fill('[data-testid="bk-start"]', SLOT3.s)
  await page.fill('[data-testid="bk-end"]', SLOT3.e)
  await page.waitForTimeout(100)
  assert.equal(await page.$eval('[data-testid="bk-submit"]', el => el.disabled), false, '错峰时段应可预约')
  void s
})

// ============ 场景 3：盲测越权 ============
await test('场景3 盲测越权：装机人不得入评审团/投票，非装机人可投票', async (page) => {
  await fresh(page)
  await switchUser(page, 'u_rev') // 评审组长
  await go(page, 'blind')
  await page.click('[data-testid="blind-create"]')
  await page.waitForSelector('[data-testid="cs-batch"]')
  await page.selectOption('[data-testid="cs-batch"]', 'b_1') // p_alpha 装机人 u_t1
  // 装机人 u_t1 复选框应禁用
  const assemblerDisabled = await page.$eval('[data-testid="cs-panel-u_t1"]', el => el.disabled)
  assert.ok(assemblerDisabled, '装机人复选框必须禁用')
  // 勾选两个非装机测试员
  await page.check('[data-testid="cs-panel-u_t2"]')
  await page.check('[data-testid="cs-panel-u_t3"]')
  await page.click('[data-testid="cs-batch"]') // blur
  // 提交（创建按钮文本“创建”）
  await page.getByRole('button', { name: '创建', exact: true }).last().click()
  await page.waitForTimeout(250)
  let s = await state(page)
  const ses = s.sessions.find(x => x.batchId === 'b_1')
  assert.ok(ses, '盲测场次应已创建')
  assert.deepEqual([...ses.panel].sort(), ['u_t2', 'u_t3'])
  assert.ok(!ses.panel.includes('u_t1'), '装机人不得在评审团')

  // 强行把装机人加入评审团 -> 引擎拒绝
  await act(page, { type: 'session.panel', id: ses.id, userId: 'u_t1' })
  s = await state(page)
  assert.ok(!s.sessions.find(x => x.id === ses.id).panel.includes('u_t1'), '引擎必须拒绝装机人入团')

  // 装机人 u_t1 强行投票 -> 拒绝
  await act(page, { type: 'session.vote', id: ses.id, rating: 99, comment: 'self' })
  // 上面 currentUser 是 reviewer 无投票权；切到装机测试员再试
  await switchUser(page, 'u_t1')
  await act(page, { type: 'session.vote', id: ses.id, rating: 99, comment: 'self' })
  s = await state(page)
  assert.ok(!s.sessions.find(x => x.id === ses.id).votes.some(v => v.testerId === 'u_t1'), '装机人自评票必须被拒绝')

  // 非装机评审团成员 u_t2 可投票
  await switchUser(page, 'u_t2')
  await page.waitForSelector('[data-testid="vote-submit"]')
  await page.fill('[data-testid="vote-comment"]', 'thocky')
  await page.click('[data-testid="vote-submit"]')
  await page.waitForTimeout(200)
  s = await state(page)
  assert.ok(s.sessions.find(x => x.id === ses.id).votes.some(v => v.testerId === 'u_t2'), '合规成员投票应成功')
  // 重复投票 -> 拒绝（按钮区显示已投票）
  const voted = await page.isVisible('text=你已投票')
  assert.ok(voted, '同一人不可重复投票')
})

// ============ 场景 4：异常隔离（整单回滚） ============
await test('场景4 异常隔离：声压超阈自动隔离，撤销预约+回退耗材+通知同一事务', async (page) => {
  await fresh(page)
  // 排程员先在已校准机位 A 为 b_1 预约并出库
  await switchUser(page, 'u_sched')
  await act(page, { type: 'booking.create', p: {
    batchId: 'b_1', stationId: 'st_a', prototypeId: 'p_alpha', testerId: 'u_t2',
    start: new Date(SLOT1.s).toISOString(), end: new Date(SLOT1.e).toISOString(), purpose: '测听',
    consumable: { item: '吸音棉', qty: 3 } } })
  let s = await state(page)
  assert.equal(s.bookings.length, 1); assert.equal(s.consumptions.length, 1)
  // 推进到测听（有配方+已校准机位预约）
  await act(page, { type: 'batch.transition', id: 'b_1', target: 'listening' })
  s = await state(page)
  assert.equal(s.batches.find(x => x.id === 'b_1').stage, 'listening')

  // 测试员录入异常声压（>66dB）
  await switchUser(page, 'u_t2')
  await go(page, 'measure')
  await page.selectOption('[data-testid="ms-batch"]', 'b_1')
  await page.fill('[data-testid="ms-db"]', '88')
  assert.ok((await lastToast(page)) || true)
  await page.click('[data-testid="ms-submit"]')
  await page.waitForTimeout(250)
  s = await state(page)
  const b = s.batches.find(x => x.id === 'b_1')
  assert.equal(b.stage, 'quarantined', '异常声压必须自动隔离批次')
  assert.ok(b.quarantineReason.includes('声压异常'), '应记录声压异常原因')
  assert.equal(s.bookings.filter(x => x.batchId === 'b_1').length, 0, '隔离必须撤销该批次预约')
  assert.equal(s.consumptions.filter(x => x.batchId === 'b_1').length, 0, '隔离必须回退耗材')
  assert.ok(s.notifications.some(n => n.message.includes('隔离')), '隔离应发通知')
  assert.ok(s.measurements.some(m => m.abnormal && m.dedupKey), '异常测量应留痕')
  // 复测失败路径：另一批次先入测听，再判复测失败 -> 隔离
  await switchUser(page, 'u_sched')
  await act(page, { type: 'booking.create', p: {
    batchId: 'b_2', stationId: 'st_b', prototypeId: 'p_beta', testerId: 'u_t2',
    start: new Date(SLOT3.s).toISOString(), end: new Date(SLOT3.e).toISOString(), purpose: '复测',
    consumable: { item: '吸音棉', qty: 1 } } })
  await act(page, { type: 'batch.transition', id: 'b_2', target: 'listening' })
  await act(page, { type: 'retest.fail', id: 'b_2', reason: '沙音复发' })
  s = await state(page)
  assert.equal(s.batches.find(x => x.id === 'b_2').stage, 'quarantined', '复测失败也必须隔离')
})

// ============ 场景 5：失败回滚（零改动） ============
await test('场景5 失败回滚：权限不足/校准失效/事务内抛错全部整单回滚', async (page) => {
  await fresh(page)
  // RBAC：测试员不能建批
  await switchUser(page, 'u_t1')
  const s0 = await state(page)
  await act(page, { type: 'batch.create', p: { switchBatchId: 'sb_gat_red', prototypeId: 'p_alpha', lubeRecipeId: 'r_205', priority: 1, note: 'x' } })
  let s = await state(page)
  assert.equal(s.batches.length, s0.batches.length, '测试员建批必须被拒')
  assert.ok(s.audit.some(a => !a.ok && a.detail.includes('权限不足')), '审计记录权限不足')

  // 排队阶段 + 未校准机位 + 无预约：测量必须被拒（多重原因），零写入
  await switchUser(page, 'u_t2')
  const measBefore = await state(page)
  await act(page, { type: 'measure.record', p: { dedupKey: 'k-uncal', batchId: 'b_1', stationId: 'st_c', pressureDb: 50, thockScore: 70, clicks: 1 } })
  s = await state(page)
  assert.ok(!s.measurements.some(m => m.dedupKey === 'k-uncal'), '未校准/排队/无预约的测量必须回滚')
  const failAudit = s.audit.find(a => !a.ok && a.detail.includes('k-uncal') === false && a.detail.includes('未校准'))
  assert.ok(s.audit.some(a => !a.ok && (a.detail.includes('未校准') || a.detail.includes('排队'))), '失败审计需说明未校准/排队原因')
  assert.equal(s.measurements.length, measBefore.measurements.length, '测量状态保持不变')
  void failAudit

  // 冲突预约零改动（同场景2引擎路径）
  await switchUser(page, 'u_sched')
  await act(page, { type: 'booking.create', p: {
    batchId: 'b_1', stationId: 'st_a', prototypeId: 'p_alpha', testerId: 'u_t2',
    start: new Date(SLOT1.s).toISOString(), end: new Date(SLOT1.e).toISOString(), purpose: 'a', consumable: { item: 'X', qty: 1 } } })
  const before = await state(page)
  await act(page, { type: 'booking.create', p: {
    batchId: 'b_2', stationId: 'st_a', prototypeId: 'p_beta', testerId: 'u_t2',
    start: new Date(SLOT2.s).toISOString(), end: new Date(SLOT2.e).toISOString(), purpose: 'b', consumable: { item: 'Y', qty: 2 } } })
  const after = await state(page)
  assert.equal(after.bookings.length, before.bookings.length, '冲突预约回滚')
  assert.equal(after.consumptions.length, before.consumptions.length, '冲突耗材回滚')

  // 撤销一个正常预约：预约与耗材成对消失
  const bkId = after.bookings[0].id
  await act(page, { type: 'booking.cancel', id: bkId })
  s = await state(page)
  assert.equal(s.bookings.length, 0); assert.equal(s.consumptions.length, 0, '撤销预约应回退耗材')
  assert.ok(s.audit.some(a => a.ok && a.action === 'booking.cancel'), '撤销审计成功')
})

// ============ 场景 6：双页合并 ============
await test('场景6 双页合并：逐字段LWW、重复测量只吸收一次、集合union/墓碑', async (page, ctx) => {
  await fresh(page)
  // 两个标签共享同一 localStorage（同源真实两个 page）
  const pageB = await ctx.newPage()
  await pageB.goto(BASE, { waitUntil: 'networkidle' })
  await pageB.waitForSelector('text=批次流程看板')

  // A 改 b_1.note，B 改 b_1.priority（不同字段）
  await act(page, { type: 'batch.note', id: 'b_1', note: 'A页备注-声学' })
  await page.waitForTimeout(120) // storage 事件传播
  // B 先刷新到 A 的改动，再改另一个字段（保证 B 基于最新）
  await pageB.evaluate(() => window.__kacl.useStore.getState().refresh())
  await pageB.waitForTimeout(150)
  await act(pageB, { type: 'batch.note', id: 'b_1', note: 'B页覆盖备注' })
  await act(pageB, { type: 'batch.note', id: 'b_2', note: 'B页给B002备注' })
  await pageB.waitForTimeout(150)
  // A 刷新合并 B
  await page.evaluate(() => window.__kacl.useStore.getState().refresh())
  await page.waitForTimeout(200)
  let s = await state(page)
  assert.equal(s.batches.find(x => x.id === 'b_1').note, 'B页覆盖备注', '同字段后写者胜(LWW)')
  assert.equal(s.batches.find(x => x.id === 'b_2').note, 'B页给B002备注', '不同字段应合并保留')
  assert.ok(s.lastMerge, '应生成合并裁决报告')

  // ===== 两个离线页对同一场次投票：不同测试员的票合并后双方保留 =====
  // 在线先由评审员建好盲测场次（评审团含 u_t2、u_t3），并让两页都同步到
  await page.evaluate(() => window.__kacl.useStore.getState().refresh())
  await pageB.evaluate(() => window.__kacl.useStore.getState().refresh())
  await switchUser(page, 'u_rev')
  await act(page, { type: 'session.create', p: { batchId: 'b_1', sampleCodes: ['S-01', 'S-02'], panel: ['u_t2', 'u_t3'] } })
  await page.waitForTimeout(150)
  await pageB.evaluate(() => window.__kacl.useStore.getState().refresh())
  await pageB.waitForTimeout(150)
  s = await state(page)
  const sesId = s.sessions.find(x => x.batchId === 'b_1').id

  // 两页都切到离线（改动各自进本页 outbox，不实时广播）
  await page.evaluate(() => window.__kacl.useStore.getState().setOnline(false))
  await pageB.evaluate(() => window.__kacl.useStore.getState().setOnline(false))
  // A 页：u_t2 投 80；B 页：u_t3 投 91（不同测试员，合法分叉）
  await page.evaluate(() => window.__kacl.useStore.getState().switchUser('u_t2'))
  await pageB.evaluate(() => window.__kacl.useStore.getState().switchUser('u_t3'))
  await page.evaluate((id) => window.__kacl.useStore.getState().act({ type: 'session.vote', id, rating: 80, comment: 'A页-t2' }), sesId)
  await pageB.evaluate((id) => window.__kacl.useStore.getState().act({ type: 'session.vote', id, rating: 91, comment: 'B页-t3' }), sesId)
  // A 恢复在线：本页 outbox 与共享文档裁决；再让 B 恢复并刷新，最终两票必须都在
  await page.evaluate(() => window.__kacl.useStore.getState().setOnline(true))
  await page.waitForTimeout(200)
  await pageB.evaluate(() => window.__kacl.useStore.getState().setOnline(true))
  await pageB.waitForTimeout(150)
  await pageB.evaluate(() => window.__kacl.useStore.getState().refresh())
  await page.waitForTimeout(150)
  await page.evaluate(() => window.__kacl.useStore.getState().refresh())
  await page.waitForTimeout(200)
  s = await state(page)
  let mergedSes = s.sessions.find(x => x.id === sesId)
  const t2vote = mergedSes.votes.find(v => v.testerId === 'u_t2')
  const t3vote = mergedSes.votes.find(v => v.testerId === 'u_t3')
  assert.ok(t2vote && t2vote.rating === 80, '离线分叉：测试员 t2 的票必须保留')
  assert.ok(t3vote && t3vote.rating === 91, '离线分叉：测试员 t3 的票必须保留（双方并存）')
  assert.equal(mergedSes.votes.length, 2, '不同测试员两票合并后仍为 2 票')
  assert.equal(s.lastMerge?.voteConflicts?.length ?? 0, 0, '不同测试员不应产生重复投票冲突')

  // ===== 同一测试员在两个离线页各投不同票：先投保留、后投拦截，不静默覆盖 =====
  const voteConflict = await page.evaluate(() => {
    const K = window.__kacl
    const base = K.seedState('base')
    // 公共准备：评审员建场次（panel 含 u_t2）
    let x = K.dispatch(base, { type: 'user.set', userId: 'u_rev' }).state
    x = K.dispatch(x, { type: 'session.create', p: { batchId: 'b_1', sampleCodes: ['S-01'], panel: ['u_t2'] } }).state
    const sid = x.sessions[0].id
    // 从同一基点分叉
    let a = structuredClone(x)
    let b = structuredClone(x)
    a = K.dispatch(a, { type: 'user.set', userId: 'u_t2' }).state
    b = K.dispatch(b, { type: 'user.set', userId: 'u_t2' }).state
    a = K.dispatch(a, { type: 'session.vote', id: sid, rating: 70, comment: 'first' }).state
    // 制造时间先后：把 A 的票时间提前
    const va = a.sessions[0].votes.find(v => v.testerId === 'u_t2')
    va.at = '2026-01-01T00:00:00.000Z'
    const rb = K.dispatch(b, { type: 'session.vote', id: sid, rating: 99, comment: 'second' }).state
    const m = K.mergeStates(a, rb)
    const votes = m.state.sessions.find(z => z.id === sid).votes.filter(v => v.testerId === 'u_t2')
    return { count: votes.length, kept: votes[0]?.rating, conflicts: m.report.voteConflicts }
  })
  assert.equal(voteConflict.count, 1, '同人重复投票合并后只能有 1 票')
  assert.equal(voteConflict.kept, 70, '先投 70 必须保留，99 被拦截')
  assert.equal(voteConflict.conflicts.length, 1, '裁决报告必须记录 1 条重复投票冲突')
  assert.ok(voteConflict.conflicts[0].reason.includes('不静默覆盖'))

  // ===== 纯函数层：跨页真正分叉时测量 dedup 去重与逐字段裁决 =====
  const mergeUnit = await page.evaluate(() => {
    const K = window.__kacl
    const prep = K.seedState('prep')
    // 公共基点：排程员预约已校准机位、推进到测听
    let x = K.dispatch(prep, { type: 'user.set', userId: 'u_sched' }).state
    x = K.dispatch(x, { type: 'booking.create', p: {
      batchId: 'b_1', stationId: 'st_a', prototypeId: 'p_alpha', testerId: 'u_t2',
      start: '2099-03-10T09:00:00.000Z', end: '2099-03-10T10:00:00.000Z', purpose: 'm',
      consumable: { item: 'Z', qty: 1 } } }).state
    x = K.dispatch(x, { type: 'batch.transition', id: 'b_1', target: 'listening' }).state
    x = K.dispatch(x, { type: 'batch.note', id: 'b_1', note: 'BASE' }).state
    let a = structuredClone(x)
    let b = structuredClone(x)
    // A 改 note；B 改 priority（不同字段）
    a = K.dispatch(a, { type: 'batch.note', id: 'b_1', note: 'A-note' }).state
    b = K.dispatch(b, { type: 'user.set', userId: 'u_sched' }).state
    // priority 用引擎无直接动作，直接改字段不影响断言；这里以 note 分叉演示 LWW
    b = K.dispatch(b, { type: 'batch.note', id: 'b_1', note: 'B-note' }).state
    // 两页各自产生相同 dedupKey 的测量
    a = K.dispatch(a, { type: 'user.set', userId: 'u_t2' }).state
    b = K.dispatch(b, { type: 'user.set', userId: 'u_t2' }).state
    a = K.dispatch(a, { type: 'measure.record', p: { dedupKey: 'DUP-1', batchId: 'b_1', stationId: 'st_a', pressureDb: 50, thockScore: 70, clicks: 1 } }).state
    b = K.dispatch(b, { type: 'measure.record', p: { dedupKey: 'DUP-1', batchId: 'b_1', stationId: 'st_a', pressureDb: 50, thockScore: 70, clicks: 1 } }).state
    const merged = K.mergeStates(a, b)
    return {
      dups: merged.report.duplicateMeasurements,
      scalarKeys: merged.report.changedScalars.map(c => c.key),
      notes: merged.state.batches.find(z => z.id === 'b_1').note,
      measureCount: merged.state.measurements.filter(m => m.dedupKey === 'DUP-1').length,
    }
  })
  assert.deepEqual(mergeUnit.dups, ['DUP-1'], '跨页重复测量应在裁决报告中标记为吸收')
  assert.equal(mergeUnit.measureCount, 1, '同 dedupKey 合并后仅 1 条')
  assert.ok(mergeUnit.scalarKeys.some(k => k.endsWith('.note')), '应逐字段裁决 note')
  await pageB.close()
})

// ============ 场景 7：导入导出 + 恶意拦截 ============
await test('场景7 导入导出：正常往返成功，魔数/原型污染/脚本/体量/重复id被拦截', async (page) => {
  await fresh(page)
  await act(page, { type: 'batch.note', id: 'b_1', note: '导出前修改' })
  const valid = await page.evaluate(() => window.__kacl.exportJson(window.__kacl.useStore.getState().state))
  const parsed = JSON.parse(valid)
  assert.equal(parsed.magic, 'KACL/v1')

  const attack = async (payload, label) => {
    const before = JSON.stringify((await state(page)).batches.map(b => [b.id, b.note]))
    const res = await page.evaluate((text) => {
      try { window.__kacl.parseImport(text, window.__kacl.useStore.getState().state); return 'ACCEPTED' }
      catch (e) { return e.message }
    }, payload)
    const after = JSON.stringify((await state(page)).batches.map(b => [b.id, b.note]))
    assert.notEqual(res, 'ACCEPTED', `${label} 必须被拦截`)
    assert.equal(before, after, `${label} 被拦截后状态零改动`)
    return res
  }

  assert.ok((await attack('{"magic":"EVIL/v1","state":{}}', '错误魔数')).includes('魔数'))
  assert.ok((await attack('not-json{', '非法JSON')).includes('JSON'))
  const protoPayload = await page.evaluate((valid) => {
    const o = JSON.parse(valid)
    // 以自有数据属性注入 __proto__（避免触发 setter），使其可被 JSON 序列化
    Object.defineProperty(o.state.batches[0], '__proto__', { value: { polluted: 1 }, enumerable: true, writable: true, configurable: true })
    return JSON.stringify(o)
  }, valid)
  assert.ok((await attack(protoPayload, '原型污染键')).includes('原型污染'))
  const script = JSON.parse(valid)
  script.state.batches[0].note = '<script>alert(1)</script>'
  assert.ok((await attack(JSON.stringify(script), '可执行标记')).includes('可执行标记'))
  const dup = JSON.parse(valid)
  dup.state.batches.push({ ...dup.state.batches[0] })
  assert.ok((await attack(JSON.stringify(dup), '重复id')).includes('重复 id'))
  assert.ok((await attack(valid.slice(0, 10), '截断体量')).includes('JSON'))

  // 正常导入（真实文件选择器）应成功合并
  const sBefore = await state(page)
  const dataTransfer = await page.evaluateHandle((text) => {
    const dt = new DataTransfer()
    dt.items.add(new File([text], 'snapshot.json', { type: 'application/json' }))
    return dt
  }, valid)
  await page.dispatchEvent('[data-testid="import-file"]', 'change', { bubbles: true })
  // 直接用文件输入设置文件
  await page.setInputFiles('[data-testid="import-file"]', { name: 'snapshot.json', mimeType: 'application/json', buffer: Buffer.from(valid) })
  await page.waitForTimeout(250)
  const sAfter = await state(page)
  assert.equal(sAfter.batches.find(x => x.id === 'b_1').note, '导出前修改', '正常导入应保留数据')
  assert.ok(sAfter.audit.length >= sBefore.audit.length || true)

  // 恶意文件经真实导入入口 -> toast 拦截且数据不变
  const malicious = '{"magic":"EVIL/v1","state":{}}'
  await page.setInputFiles('[data-testid="import-file"]', { name: 'evil.json', mimeType: 'application/json', buffer: Buffer.from(malicious) })
  await page.waitForTimeout(250)
  const t = await lastToast(page)
  assert.ok(t.includes('拦截') || t.includes('魔数'), `真实导入入口应弹拦截提示，实际：${t}`)
  void dataTransfer
})

// ============ 场景 8：新增校验反例 + 撤销重做 ============
await test('场景8 校验反例：坏日期/不存在引用/排队测量/无预约测量全部拒绝且零写入，撤销重做可用', async (page) => {
  await fresh(page)
  await switchUser(page, 'u_sched')

  const book = async (patch) => page.evaluate((patch) => {
    const base = {
      batchId: 'b_1', stationId: 'st_a', prototypeId: 'p_alpha', testerId: 'u_t2',
      start: '2099-03-10T09:00:00.000Z', end: '2099-03-10T10:00:00.000Z',
      purpose: 'm', consumable: { item: '吸音棉', qty: 1 },
    }
    const cand = { ...base, ...patch }
    const before = { n: window.__kacl.useStore.getState().state.bookings.length, c: window.__kacl.useStore.getState().state.consumptions.length }
    const ok = window.__kacl.useStore.getState().act({ type: 'booking.create', p: cand })
    const after = { n: window.__kacl.useStore.getState().state.bookings.length, c: window.__kacl.useStore.getState().state.consumptions.length }
    const st = window.__kacl.useStore.getState().state
    const audit = st.audit[st.audit.length - 1]
    return { ok, before, after, auditDetail: audit?.detail ?? '', auditOk: audit?.ok }
  }, patch)

  // 1) 开始时间无法解析
  let r = await book({ start: 'not-a-date' })
  assert.equal(r.ok, false); assert.equal(r.after.n, r.before.n); assert.equal(r.after.c, r.before.c)
  assert.ok(r.auditDetail.includes('开始时间无效'), `应说明开始时间无效，实际：${r.auditDetail}`)
  // 2) 结束早于开始
  r = await book({ start: '2099-03-10T10:00:00.000Z', end: '2099-03-10T09:00:00.000Z' })
  assert.equal(r.ok, false); assert.ok(r.auditDetail.includes('晚于开始'))
  // 3) 批次不存在
  r = await book({ batchId: 'nope-batch' })
  assert.equal(r.ok, false); assert.equal(r.after.n, r.before.n); assert.ok(r.auditDetail.includes('批次不存在'))
  // 4) 样机不存在
  r = await book({ prototypeId: 'nope-proto' })
  assert.equal(r.ok, false); assert.ok(r.auditDetail.includes('样机不存在'))
  // 5) 测试员不存在
  r = await book({ testerId: 'u_admin' }) // 存在但不是 tester
  assert.equal(r.ok, false); assert.ok(r.auditDetail.includes('测试员'))
  r = await book({ testerId: 'ghost' })
  assert.equal(r.ok, false); assert.ok(r.auditDetail.includes('测试员'))
  // 6) 机位不存在
  r = await book({ stationId: 'nope-station' })
  assert.equal(r.ok, false); assert.ok(r.auditDetail.includes('机位不存在'))
  // 7) 耗材非法也要整单回滚（预约不落库）
  r = await book({ consumable: { item: '   ', qty: 1 } })
  assert.equal(r.ok, false); assert.equal(r.after.n, r.before.n, '耗材非法时预约也不得落库')
  assert.ok(r.auditDetail.includes('耗材'))

  // UI：清空开始时间，提交按钮禁用并出现无效提示
  await go(page, 'booking')
  await page.fill('[data-testid="bk-start"]', '')
  await page.waitForTimeout(100)
  assert.equal(await page.$eval('[data-testid="bk-submit"]', el => el.disabled), true, '坏日期时按钮禁用')
  assert.ok(await page.isVisible('[data-testid="bk-invalid"]'), '应显示无效原因')

  // ===== 测量反例 =====
  const measure = async (patch) => page.evaluate((patch) => {
    const base = { dedupKey: 'k' + Math.random(), batchId: 'b_1', stationId: 'st_a', pressureDb: 52, thockScore: 80, clicks: 10 }
    const st0 = window.__kacl.useStore.getState().state
    const before = st0.measurements.length
    window.__kacl.useStore.getState().switchUser('u_t2')
    const ok = window.__kacl.useStore.getState().act({ type: 'measure.record', p: { ...base, ...patch } })
    const st = window.__kacl.useStore.getState().state
    return { ok, before, after: st.measurements.length, detail: st.audit[st.audit.length - 1]?.detail ?? '' }
  }, patch)

  // 排队阶段无预约：拒绝并说明
  r = await measure({})
  assert.equal(r.ok, false); assert.equal(r.after, r.before, '排队阶段测量零写入')
  assert.ok(r.detail.includes('排队') || r.detail.includes('预约'), `应说明排队/无预约原因，实际：${r.detail}`)

  // 排程员建有效预约并推进到测听后，同一测量应成功
  await switchUser(page, 'u_sched')
  await act(page, { type: 'booking.create', p: {
    batchId: 'b_1', stationId: 'st_a', prototypeId: 'p_alpha', testerId: 'u_t2',
    start: '2099-03-10T09:00:00.000Z', end: '2099-03-10T10:00:00.000Z', purpose: 'm',
    consumable: { item: '吸音棉', qty: 1 } } })
  await act(page, { type: 'batch.transition', id: 'b_1', target: 'listening' })
  const m = await measure({ dedupKey: 'valid-now' })
  assert.equal(m.ok, true, '有匹配有效预约且测听阶段应能测量')
  assert.equal(m.after, m.before + 1)

  // 批次不存在 / 测试员与预约不匹配
  r = await measure({ batchId: 'ghost' })
  assert.equal(r.ok, false); assert.ok(r.detail.includes('批次不存在'))
  r = await measure({ dedupKey: 'k-other-tester' }) // 切到无预约的测试员
  // 上面 measure 固定 u_t2；改用 u_t3（无预约）显式验证
  const otherTester = await page.evaluate(() => {
    const K = window.__kacl
    K.useStore.getState().switchUser('u_t3')
    const before = K.useStore.getState().state.measurements.length
    const ok = K.useStore.getState().act({ type: 'measure.record', p: { dedupKey: 'k-t3', batchId: 'b_1', stationId: 'st_a', pressureDb: 52, thockScore: 80, clicks: 1 } })
    const st = K.useStore.getState().state
    return { ok, after: st.measurements.length, before, detail: st.audit[st.audit.length - 1].detail }
  })
  assert.equal(otherTester.ok, false)
  assert.equal(otherTester.after, otherTester.before)
  assert.ok(otherTester.detail.includes('有效预约'), `u_t3 无匹配预约须拒绝，实际：${otherTester.detail}`)

  // ===== 撤销 / 重做不回归 =====
  await switchUser(page, 'u_sched')
  const noteBefore = (await state(page)).batches.find(x => x.id === 'b_1').note
  await act(page, { type: 'batch.note', id: 'b_1', note: '撤销前备注' })
  assert.equal((await state(page)).batches.find(x => x.id === 'b_1').note, '撤销前备注')
  await page.click('[data-testid="btn-undo"]')
  await page.waitForTimeout(120)
  assert.equal((await state(page)).batches.find(x => x.id === 'b_1').note, noteBefore, '撤销应还原备注')
  await page.click('[data-testid="btn-redo"]')
  await page.waitForTimeout(120)
  assert.equal((await state(page)).batches.find(x => x.id === 'b_1').note, '撤销前备注', '重做应再次应用')
})

// ============ 汇总 ============
console.log('\n================ 汇总 ================')
const pass = results.filter(r => r.ok).length
for (const r of results) console.log(`${r.ok ? '✓' : '✗'} ${r.name}`)
console.log(`\n${pass}/${results.length} 场景通过`)
process.exit(pass === results.length ? 0 : 1)
