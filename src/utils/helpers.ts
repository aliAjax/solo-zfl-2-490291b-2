import type { KeyboardLog } from '@/types';

export function getRatingColor(rating: number, invert = false): string {
  const r = clamp(rating, 1, 10);
  if (r >= 8) return invert ? '#a65252' : '#6b8e5a';
  if (r >= 6) return '#5a6b8e';
  if (r >= 4) return '#d4944a';
  return invert ? '#6b8e5a' : '#a65252';
}

export function getRatingGradient(rating: number): string {
  const r = clamp(rating, 1, 10);
  const pct = (r / 10) * 100;
  if (r >= 8) return `linear-gradient(90deg, #6b8e5a ${pct * 0.6}%, #8bb078 100%)`;
  if (r >= 6) return `linear-gradient(90deg, #5a6b8e ${pct * 0.6}%, #7a8bb0 100%)`;
  if (r >= 4) return `linear-gradient(90deg, #c07a2a ${pct * 0.6}%, #e9c989 100%)`;
  return `linear-gradient(90deg, #853a3a ${pct * 0.6}%, #c27575 100%)`;
}

export function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  } catch {
    return '';
  }
}

export function compareValues(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) && Array.isArray(b)) {
    return JSON.stringify(a.sort()) === JSON.stringify(b.sort());
  }
  return a === b;
}

export type CompareField = {
  label: string;
  key: keyof KeyboardLog | null;
  getter?: (log: KeyboardLog) => string | number | string[];
  isRating?: boolean;
  invertRating?: boolean;
};

export const COMPARE_FIELDS: { group: string; fields: CompareField[] }[] = [
  {
    group: '基础信息',
    fields: [
      { label: '整体评分', key: 'overallRating', isRating: true },
      { label: '品牌', key: 'brand' },
      { label: '型号', key: 'model' },
      { label: '入手日期', key: 'purchaseDate', getter: (l) => formatDate(l.purchaseDate) },
    ],
  },
  {
    group: '轴体',
    fields: [
      { label: '轴体名称', key: 'switchName' },
      { label: '轴体类型', key: 'switchType' },
      { label: '润滑情况', key: 'switchLubed' },
    ],
  },
  {
    group: '键帽',
    fields: [
      { label: '键帽材质', key: 'keycapMaterial' },
      { label: '键帽高度', key: 'keycapProfile' },
      { label: '键帽工艺', key: 'keycapProcess' },
    ],
  },
  {
    group: '结构与填充',
    fields: [
      { label: '定位板', key: 'plateMaterial', getter: (l) => `${l.plateMaterial} · ${l.plateThickness}` },
      { label: '填充材料', key: 'fillMaterial' },
      { label: '外壳材质', key: 'caseMaterial' },
    ],
  },
  {
    group: '手感与声音',
    fields: [
      { label: '声音倾向', key: 'soundCharacter' },
      { label: '声音标签', key: 'soundTags' },
      { label: '回弹感', key: 'reboundRating', isRating: true },
      { label: '段落感', key: 'tactilityRating', isRating: true },
      { label: '打字疲劳', key: 'fatigueRating', isRating: true, invertRating: true },
    ],
  },
];
