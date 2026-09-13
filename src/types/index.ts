export type SwitchType = 'linear' | 'tactile' | 'clicky' | 'other';
export type SoundCharacter = 'deep' | 'bright' | 'muffled' | 'neutral';
export type KeycapMaterial = 'ABS' | 'PBT' | 'PC' | '混合' | '其他';
export type KeycapProfile = 'Cherry' | 'SA' | 'DSA' | 'OEM' | 'XDA' | 'KAT' | 'MT3' | '其他';
export type PlateMaterial = '铝' | '铜' | '钢' | 'PC/FR4' | '碳纤维' | '塑料' | '其他';
export type CaseMaterial = '铝合金' | '塑料' | '木头' | '亚克力' | '黄铜' | '不锈钢' | '其他';

export interface KeyboardLog {
  id: string;
  name: string;
  brand: string;
  model: string;
  purchaseDate: string;
  overallRating: number;
  switchName: string;
  switchType: SwitchType;
  switchLubed: string;
  keycapMaterial: KeycapMaterial;
  keycapProfile: KeycapProfile;
  keycapProcess: string;
  plateMaterial: PlateMaterial;
  plateThickness: string;
  fillMaterial: string;
  caseMaterial: CaseMaterial;
  soundCharacter: SoundCharacter;
  soundTags: string[];
  reboundRating: number;
  tactilityRating: number;
  fatigueRating: number;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface FilterState {
  switchType: SwitchType | 'all';
  soundCharacter: SoundCharacter | 'all';
  minRating: number;
  searchKeyword: string;
}

export type ViewMode = 'list' | 'compare' | 'stats';

export interface UIState {
  viewMode: ViewMode;
  selectedForCompare: string[];
  formModalOpen: boolean;
  editingLog: KeyboardLog | null;
  detailLog: KeyboardLog | null;
  importExportModalOpen: boolean;
}

export const SWITCH_TYPE_LABELS: Record<SwitchType, string> = {
  linear: '线性轴',
  tactile: '段落轴',
  clicky: '点击轴',
  other: '其他',
};

export const SOUND_CHARACTER_LABELS: Record<SoundCharacter, string> = {
  deep: '低沉',
  bright: '清脆',
  muffled: '闷响',
  neutral: '中性',
};

export const SWITCH_TYPES: SwitchType[] = ['linear', 'tactile', 'clicky', 'other'];
export const SOUND_CHARACTERS: SoundCharacter[] = ['deep', 'bright', 'muffled', 'neutral'];
export const KEYCAP_MATERIALS: KeycapMaterial[] = ['ABS', 'PBT', 'PC', '混合', '其他'];
export const KEYCAP_PROFILES: KeycapProfile[] = ['Cherry', 'SA', 'DSA', 'OEM', 'XDA', 'KAT', 'MT3', '其他'];
export const PLATE_MATERIALS: PlateMaterial[] = ['铝', '铜', '钢', 'PC/FR4', '碳纤维', '塑料', '其他'];
export const CASE_MATERIALS: CaseMaterial[] = ['铝合金', '塑料', '木头', '亚克力', '黄铜', '不锈钢', '其他'];

export const PRESET_SOUND_TAGS = [
  '沙脆', '麻将音', '雨滴声', '低频闷', '高频亮',
  '回响声', '塑料感', '金属感', '木头声', '软弹',
  '硬朗', '细腻', '厚重', '空灵', '干净',
];
