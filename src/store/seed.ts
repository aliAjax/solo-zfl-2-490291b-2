import type { AppState } from '../types/domain'
import { newId } from '../lib/engine'

export function seedState(tabId: string): AppState {
  const users = [
    { id: 'u_admin', name: '林总', role: 'admin', title: '实验室主管' },
    { id: 'u_sched', name: '周排', role: 'scheduler', title: '排程员' },
    { id: 'u_t1', name: '陈听', role: 'tester', title: '声学测试员' },
    { id: 'u_t2', name: '吴测', role: 'tester', title: '手感测试员' },
    { id: 'u_t3', name: '何辨', role: 'tester', title: '盲测测试员' },
    { id: 'u_rev', name: '郑评', role: 'reviewer', title: '评审组长' },
  ] as AppState['users']

  const recipes = [
    { id: 'r_205', code: 'R-205', name: '205# 薄膜润滑', ratioPct: 62, viscosity: 220, notes: '线性轴标准薄膜' },
    { id: 'r_3203', code: 'R-3203', name: '3203 厚润', ratioPct: 48, viscosity: 540, notes: '段落轴厚润' },
    { id: 'r_mix', code: 'R-MIX', name: '205+105 混合', ratioPct: 55, viscosity: 310, notes: '顺滑取向' },
  ] as AppState['recipes']

  const switchBatches = [
    { id: 'sb_gat_red', code: 'GAT-RED-0901', vendor: '佳达隆', count: 5000, lubeRecipeId: 'r_205', receivedAt: '2026-09-01T08:00:00.000Z' },
    { id: 'sb_hp_nova', code: 'HP-NOVA-0912', vendor: '华诺', count: 3200, lubeRecipeId: 'r_3203', receivedAt: '2026-09-05T08:00:00.000Z' },
    { id: 'sb_raw', code: 'RAW-0920', vendor: '代工厂', count: 8000, lubeRecipeId: null, receivedAt: '2026-09-10T08:00:00.000Z' },
  ] as AppState['switchBatches']

  const prototypes = [
    { id: 'p_alpha', code: 'KB-α', name: '阿尔法 65', switchBatchId: 'sb_gat_red', assembledBy: 'u_t1', builtAt: '2026-09-08T02:00:00.000Z', note: '铝定位板' },
    { id: 'p_beta', code: 'KB-β', name: '贝塔 75', switchBatchId: 'sb_hp_nova', assembledBy: 'u_t2', builtAt: '2026-09-09T02:00:00.000Z', note: 'FR4 定位板' },
    { id: 'p_gamma', code: 'KB-γ', name: '伽马 TKL', switchBatchId: 'sb_raw', assembledBy: 'u_t1', builtAt: '2026-09-11T02:00:00.000Z', note: '未润滑来料' },
  ] as AppState['prototypes']

  const stations = [
    { id: 'st_a', code: 'BOOTH-A', name: '半消声舱 A', calibrated: true, calibratedAt: '2026-09-11T00:00:00.000Z', micModel: 'B&K 4190' },
    { id: 'st_b', code: 'BOOTH-B', name: '半消声舱 B', calibrated: true, calibratedAt: '2026-09-11T00:00:00.000Z', micModel: 'B&K 4190' },
    { id: 'st_c', code: 'BENCH-C', name: '手感台 C', calibrated: false, calibratedAt: '2026-08-20T00:00:00.000Z', micModel: 'GRAS 46AE' },
  ] as AppState['stations']

  const batches = [
    {
      id: 'b_1', code: 'B-001', switchBatchId: 'sb_gat_red', prototypeId: 'p_alpha',
      lubeRecipeId: 'r_205', stage: 'queued', result: 'pending', priority: 5, note: '首批量产', quarantineReason: '',
      createdAt: '2026-09-11T03:00:00.000Z', updatedAt: '2026-09-11T03:00:00.000Z',
    },
    {
      id: 'b_2', code: 'B-002', switchBatchId: 'sb_hp_nova', prototypeId: 'p_beta',
      lubeRecipeId: 'r_3203', stage: 'queued', result: 'pending', priority: 8, note: '高优先级客户样', quarantineReason: '',
      createdAt: '2026-09-11T03:10:00.000Z', updatedAt: '2026-09-11T03:10:00.000Z',
    },
    {
      id: 'b_3', code: 'B-003', switchBatchId: 'sb_raw', prototypeId: 'p_gamma',
      lubeRecipeId: null, stage: 'queued', result: 'pending', priority: 3, note: '缺配方，应无法测听', quarantineReason: '',
      createdAt: '2026-09-11T03:20:00.000Z', updatedAt: '2026-09-11T03:20:00.000Z',
    },
  ] as AppState['batches']

  const state: AppState = {
    users,
    currentUserId: 'u_sched',
    online: true,
    tabId,
    batches,
    prototypes,
    switchBatches,
    recipes,
    stations,
    bookings: [],
    measurements: [],
    sessions: [],
    consumptions: [],
    notifications: [],
    audit: [],
    clock: 0,
    fieldMeta: {},
    tombstones: {},
    dedup: {},
    lastMerge: null,
  }

  // 种子字段版本（逐字段合并基线）
  let v = 0
  const seed = (coll: string, ent: { id: string }) => {
    for (const [key, val] of Object.entries(ent)) {
      if (key === 'id' || Array.isArray(val) || typeof val === 'object') continue
      v += 1
      state.fieldMeta[`${ent.id}.${key}`] = { v, by: 'u_admin' }
    }
    void coll
  }
  ;[...recipes, ...switchBatches, ...prototypes, ...stations, ...batches, ...users].forEach((e) => seed('x', e))
  state.clock = v
  return state
}

export const freshTabId = () => newId('tab')
