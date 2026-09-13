import { Search, X, SlidersHorizontal } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import {
  SWITCH_TYPES,
  SOUND_CHARACTERS,
  SWITCH_TYPE_LABELS,
  SOUND_CHARACTER_LABELS,
  type SwitchType,
  type SoundCharacter,
} from '@/types';

export default function FilterBar() {
  const { filter, setFilter, resetFilter } = useAppStore();
  const { switchType, soundCharacter, minRating, searchKeyword } = filter;

  const hasActiveFilter =
    switchType !== 'all' || soundCharacter !== 'all' || minRating > 0 || searchKeyword !== '';

  return (
    <div className="card-surface p-4 sm:p-5 animate-fadeIn">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-brass-300" />
            <h3 className="text-sm font-semibold text-ink-200 font-mono">筛选条件</h3>
            {hasActiveFilter && (
              <button
                onClick={resetFilter}
                className="chip chip-inactive !py-0.5 !text-[11px]"
              >
                <X className="h-3 w-3" />
                清除筛选
              </button>
            )}
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-500" />
            <input
              type="text"
              value={searchKeyword}
              onChange={(e) => setFilter({ searchKeyword: e.target.value })}
              placeholder="搜索名称、轴体、备注..."
              className="input-field pl-9"
            />
          </div>
        </div>

        <div className="divider" />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div>
            <label className="block text-[11px] font-mono uppercase tracking-wider text-ink-500 mb-2">
              轴体类型
            </label>
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => setFilter({ switchType: 'all' })}
                className={`chip ${switchType === 'all' ? 'chip-active' : 'chip-inactive'}`}
              >
                全部
              </button>
              {SWITCH_TYPES.map((t) => (
                <button
                  key={t}
                  onClick={() => setFilter({ switchType: t as SwitchType })}
                  className={`chip ${switchType === t ? 'chip-active' : 'chip-inactive'}`}
                >
                  {SWITCH_TYPE_LABELS[t]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-mono uppercase tracking-wider text-ink-500 mb-2">
              声音倾向
            </label>
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => setFilter({ soundCharacter: 'all' })}
                className={`chip ${soundCharacter === 'all' ? 'chip-active' : 'chip-inactive'}`}
              >
                全部
              </button>
              {SOUND_CHARACTERS.map((s) => (
                <button
                  key={s}
                  onClick={() => setFilter({ soundCharacter: s as SoundCharacter })}
                  className={`chip ${soundCharacter === s ? 'chip-active' : 'chip-inactive'}`}
                >
                  {SOUND_CHARACTER_LABELS[s]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-baseline justify-between mb-2">
              <label className="text-[11px] font-mono uppercase tracking-wider text-ink-500">
                最低评分
              </label>
              <span className="font-mono text-sm font-bold text-brass-300">
                ≥ {minRating}/10
              </span>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={0}
                max={10}
                step={1}
                value={minRating}
                onChange={(e) => setFilter({ minRating: Number(e.target.value) })}
                className="flex-1"
              />
              <span className="font-mono text-xs text-ink-400 w-10 shrink-0">
                {minRating === 0 ? '不限' : minRating}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
