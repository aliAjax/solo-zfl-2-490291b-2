import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Save, FileText, Cpu, Keyboard as KeyboardIcon, Layers, Volume2 } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import {
  PRESET_SOUND_TAGS,
  SWITCH_TYPES,
  SOUND_CHARACTERS,
  KEYCAP_MATERIALS,
  KEYCAP_PROFILES,
  PLATE_MATERIALS,
  CASE_MATERIALS,
  SWITCH_TYPE_LABELS,
  SOUND_CHARACTER_LABELS,
  type KeyboardLog,
  type SwitchType,
  type SoundCharacter,
  type KeycapMaterial,
  type KeycapProfile,
  type PlateMaterial,
  type CaseMaterial,
} from '@/types';
import RatingSlider from './RatingSlider';
import Section from './Section';
import TagInput from './TagInput';

type FormState = Omit<KeyboardLog, 'id' | 'createdAt' | 'updatedAt'>;

const emptyForm: FormState = {
  name: '',
  brand: '',
  model: '',
  purchaseDate: new Date().toISOString().slice(0, 10),
  overallRating: 7,
  switchName: '',
  switchType: 'linear',
  switchLubed: '',
  keycapMaterial: 'PBT',
  keycapProfile: 'Cherry',
  keycapProcess: '',
  plateMaterial: '铝',
  plateThickness: '1.5mm',
  fillMaterial: '',
  caseMaterial: '铝合金',
  soundCharacter: 'neutral',
  soundTags: [],
  reboundRating: 6,
  tactilityRating: 5,
  fatigueRating: 5,
  notes: '',
};

export default function FormModal() {
  const { ui, closeFormModal, createLog, updateLog } = useAppStore();
  const isOpen = ui.formModalOpen;
  const editing = ui.editingLog;

  const [form, setForm] = useState<FormState>(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen) {
      if (editing) {
        setForm({
          name: editing.name,
          brand: editing.brand,
          model: editing.model,
          purchaseDate: editing.purchaseDate,
          overallRating: editing.overallRating,
          switchName: editing.switchName,
          switchType: editing.switchType,
          switchLubed: editing.switchLubed,
          keycapMaterial: editing.keycapMaterial,
          keycapProfile: editing.keycapProfile,
          keycapProcess: editing.keycapProcess,
          plateMaterial: editing.plateMaterial,
          plateThickness: editing.plateThickness,
          fillMaterial: editing.fillMaterial,
          caseMaterial: editing.caseMaterial,
          soundCharacter: editing.soundCharacter,
          soundTags: [...editing.soundTags],
          reboundRating: editing.reboundRating,
          tactilityRating: editing.tactilityRating,
          fatigueRating: editing.fatigueRating,
          notes: editing.notes,
        });
      } else {
        setForm({ ...emptyForm, purchaseDate: new Date().toISOString().slice(0, 10) });
      }
      setErrors({});
    }
  }, [isOpen, editing]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) closeFormModal();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, closeFormModal]);

  if (!isOpen) return null;

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key as string]) {
      setErrors((e) => ({ ...e, [key as string]: '' }));
    }
  };

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = '请输入键盘名称';
    if (!form.switchName.trim()) e.switchName = '请填写轴体名称';
    if (!form.brand.trim()) e.brand = '请输入品牌';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    if (editing) {
      updateLog(editing.id, form);
    } else {
      createLog(form);
    }
  };

  return createPortal(
    <div
      className="modal-backdrop"
      onClick={(e) => e.target === e.currentTarget && closeFormModal()}
    >
      <div className="modal-surface scrollbar-thin">
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-ink-700/60 bg-gradient-to-b from-ink-800/98 to-ink-800/90 backdrop-blur-sm">
          <div>
            <h2 className="font-mono text-lg font-bold text-gradient-brass">
              {editing ? '编辑手感记录' : '新建手感记录'}
            </h2>
            <p className="text-xs text-ink-500 mt-0.5">
              {editing ? '更新你之前记录的配置' : '为你的新键盘创建一条记录吧'}
            </p>
          </div>
          <button
            onClick={closeFormModal}
            className="p-2 rounded-lg text-ink-500 hover:text-ink-200 hover:bg-ink-700/60 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4">
          <Section title="基础信息" subtitle="给这把键盘起个响亮的名字" icon={<FileText className="h-4 w-4" />}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-ink-300 mb-1.5">
                  键盘昵称 <span className="text-wine-400">*</span>
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => update('name', e.target.value)}
                  placeholder="比如：日·夜 · 静、快乐轴机"
                  className={`input-field font-mono ${errors.name ? 'border-wine-500/60' : ''}`}
                />
                {errors.name && <p className="text-[11px] text-wine-400 mt-1">{errors.name}</p>}
              </div>
              <div>
                <label className="block text-xs font-medium text-ink-300 mb-1.5">
                  品牌 <span className="text-wine-400">*</span>
                </label>
                <input
                  type="text"
                  value={form.brand}
                  onChange={(e) => update('brand', e.target.value)}
                  placeholder="Matrix / Keychron / 自制..."
                  className={`input-field ${errors.brand ? 'border-wine-500/60' : ''}`}
                />
                {errors.brand && <p className="text-[11px] text-wine-400 mt-1">{errors.brand}</p>}
              </div>
              <div>
                <label className="block text-xs font-medium text-ink-300 mb-1.5">型号</label>
                <input
                  type="text"
                  value={form.model}
                  onChange={(e) => update('model', e.target.value)}
                  placeholder="8XV 2.0 / Q1 Pro / Zoom65..."
                  className="input-field"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-ink-300 mb-1.5">入手日期</label>
                <input
                  type="date"
                  value={form.purchaseDate}
                  onChange={(e) => update('purchaseDate', e.target.value)}
                  className="input-field"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-ink-300 mb-1.5">整体评分</label>
                <RatingSlider
                  label=""
                  value={form.overallRating}
                  onChange={(v) => update('overallRating', v)}
                  hint="综合手感与声音的主观评价，10 为满分"
                />
              </div>
            </div>
          </Section>

          <Section title="轴体配置" subtitle="最影响手感的核心部件" icon={<Cpu className="h-4 w-4" />}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-ink-300 mb-1.5">
                  轴体名称 <span className="text-wine-400">*</span>
                </label>
                <input
                  type="text"
                  value={form.switchName}
                  onChange={(e) => update('switchName', e.target.value)}
                  placeholder="Hyperglide MX Black / Gateron Baby Raccoon V2..."
                  className={`input-field font-mono ${errors.switchName ? 'border-wine-500/60' : ''}`}
                />
                {errors.switchName && (
                  <p className="text-[11px] text-wine-400 mt-1">{errors.switchName}</p>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-ink-300 mb-1.5">轴体类型</label>
                <div className="flex flex-wrap gap-1.5">
                  {SWITCH_TYPES.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => update('switchType', t as SwitchType)}
                      className={`chip ${form.switchType === t ? 'chip-active' : 'chip-inactive'}`}
                    >
                      {SWITCH_TYPE_LABELS[t]}
                    </button>
                  ))}
                </div>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-ink-300 mb-1.5">润滑情况</label>
                <input
                  type="text"
                  value={form.switchLubed}
                  onChange={(e) => update('switchLubed', e.target.value)}
                  placeholder="205g0 精润 + TX 105 润弹簧 / 原厂预润 / 未润..."
                  className="input-field"
                />
              </div>
            </div>
          </Section>

          <Section
            title="键帽"
            subtitle={`${form.keycapMaterial} · ${form.keycapProfile}`}
            icon={<KeyboardIcon className="h-4 w-4" />}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-ink-300 mb-1.5">键帽材质</label>
                <select
                  value={form.keycapMaterial}
                  onChange={(e) => update('keycapMaterial', e.target.value as KeycapMaterial)}
                  className="input-field appearance-none cursor-pointer"
                >
                  {KEYCAP_MATERIALS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-ink-300 mb-1.5">键帽高度</label>
                <select
                  value={form.keycapProfile}
                  onChange={(e) => update('keycapProfile', e.target.value as KeycapProfile)}
                  className="input-field appearance-none cursor-pointer"
                >
                  {KEYCAP_PROFILES.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-ink-300 mb-1.5">工艺 / 配色</label>
                <input
                  type="text"
                  value={form.keycapProcess}
                  onChange={(e) => update('keycapProcess', e.target.value)}
                  placeholder="热升华 / 双色注塑 · GMK Olivia++ / 原厂 PBT..."
                  className="input-field"
                />
              </div>
            </div>
          </Section>

          <Section
            title="定位板 & 填充"
            subtitle="结构决定声音的厚度"
            icon={<Layers className="h-4 w-4" />}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-ink-300 mb-1.5">定位板材质</label>
                <select
                  value={form.plateMaterial}
                  onChange={(e) => update('plateMaterial', e.target.value as PlateMaterial)}
                  className="input-field appearance-none cursor-pointer"
                >
                  {PLATE_MATERIALS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-ink-300 mb-1.5">定位板规格</label>
                <input
                  type="text"
                  value={form.plateThickness}
                  onChange={(e) => update('plateThickness', e.target.value)}
                  placeholder="1.5mm 铝 CNC / PC 半透 / FR4..."
                  className="input-field"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-ink-300 mb-1.5">填充材料</label>
                <input
                  type="text"
                  value={form.fillMaterial}
                  onChange={(e) => update('fillMaterial', e.target.value)}
                  placeholder="IXPE 轴下垫 + Poron 夹心棉 + EVA 底棉..."
                  className="input-field"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-ink-300 mb-1.5">外壳材质</label>
                <select
                  value={form.caseMaterial}
                  onChange={(e) => update('caseMaterial', e.target.value as CaseMaterial)}
                  className="input-field appearance-none cursor-pointer"
                >
                  {CASE_MATERIALS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </Section>

          <Section title="手感与声音" subtitle="最主观也是最重要的部分" icon={<Volume2 className="h-4 w-4" />}>
            <div className="space-y-5">
              <div>
                <label className="block text-xs font-medium text-ink-300 mb-2">声音倾向</label>
                <div className="flex flex-wrap gap-1.5">
                  {SOUND_CHARACTERS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => update('soundCharacter', s as SoundCharacter)}
                      className={`chip ${form.soundCharacter === s ? 'chip-active' : 'chip-inactive'}`}
                    >
                      {SOUND_CHARACTER_LABELS[s]}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-ink-300 mb-1.5">声音标签</label>
                <TagInput
                  tags={form.soundTags}
                  onChange={(t) => update('soundTags', t)}
                  presetSuggestions={PRESET_SOUND_TAGS}
                  placeholder="描述一下敲起来的感觉..."
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                <RatingSlider
                  label="回弹感"
                  value={form.reboundRating}
                  onChange={(v) => update('reboundRating', v)}
                  hint="越高越 Q 弹跟手"
                />
                <RatingSlider
                  label="段落感"
                  value={form.tactilityRating}
                  onChange={(v) => update('tactilityRating', v)}
                  hint="线性轴通常偏低"
                />
                <RatingSlider
                  label="打字疲劳"
                  value={form.fatigueRating}
                  onChange={(v) => update('fatigueRating', v)}
                  invert
                  hint="越高越累手"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-ink-300 mb-1.5">手感备注</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => update('notes', e.target.value)}
                  rows={4}
                  placeholder="详细描述一下这把键盘的感觉、使用场景、和其他键盘对比的感受..."
                  className="input-field resize-y min-h-[96px] leading-relaxed"
                />
              </div>
            </div>
          </Section>

          <div className="sticky bottom-0 -mx-5 sm:-mx-6 -mb-5 sm:-mb-6 mt-2 flex items-center justify-end gap-3 px-5 sm:px-6 py-4 border-t border-ink-700/60 bg-gradient-to-t from-ink-800 via-ink-800/95 to-ink-800/80 backdrop-blur-sm rounded-b-2xl">
            <button type="button" onClick={closeFormModal} className="btn-ghost">
              取消
            </button>
            <button type="submit" className="btn-primary min-w-[120px]">
              <Save className="h-4 w-4" />
              {editing ? '保存修改' : '保存记录'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
