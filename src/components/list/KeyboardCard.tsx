import { Pencil, Trash2, Eye } from 'lucide-react';
import type { KeyboardLog } from '@/types';
import {
  SWITCH_TYPE_LABELS,
  SOUND_CHARACTER_LABELS,
} from '@/types';
import { useAppStore } from '@/store/useAppStore';
import { getRatingGradient, formatDate } from '@/utils/helpers';

interface Props {
  log: KeyboardLog;
  index: number;
}

export default function KeyboardCard({ log, index }: Props) {
  const { ui, toggleCompareSelect, openFormModal, openDetail, deleteLog } = useAppStore();
  const selected = ui.selectedForCompare.includes(log.id);

  const typeColorMap: Record<string, string> = {
    linear: 'bg-slateblue-500/20 text-slateblue-400 border-slateblue-500/30',
    tactile: 'bg-moss-500/20 text-moss-400 border-moss-500/30',
    clicky: 'bg-wine-500/20 text-wine-400 border-wine-500/30',
    other: 'bg-ink-600/40 text-ink-400 border-ink-600/50',
  };

  const soundColorMap: Record<string, string> = {
    deep: 'bg-[#5a4a8e]/20 text-[#a894d4] border-[#5a4a8e]/40',
    bright: 'bg-brass-300/20 text-brass-200 border-brass-300/35',
    muffled: 'bg-[#6e5a4f]/30 text-[#d4b49a] border-[#6e5a4f]/40',
    neutral: 'bg-ink-600/40 text-ink-400 border-ink-600/50',
  };

  return (
    <article
      style={{ animationDelay: `${Math.min(index * 50, 400)}ms` }}
      className={`group card-surface relative overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-glow animate-fadeIn cursor-pointer ${
        selected ? 'ring-2 ring-brass-300/70 shadow-glow' : ''
      }`}
      onClick={(e) => {
        // 避免点到按钮时触发
        const target = e.target as HTMLElement;
        if (target.closest('button')) return;
        openDetail(log);
      }}
    >
      {selected && (
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-brass-200 via-brass-300 to-brass-200" />
      )}

      <div className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-mono text-base font-bold text-ink-100 truncate">
                {log.name}
              </h3>
            </div>
            <p className="text-xs text-ink-500 truncate">
              {log.brand} {log.model} · {formatDate(log.purchaseDate)}
            </p>
          </div>
          <div
            className="shrink-0 relative inline-flex items-center justify-center w-12 h-12 rounded-xl font-mono text-sm font-bold"
            style={{
              background: getRatingGradient(log.overallRating),
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.2), 0 2px 8px rgba(0,0,0,0.35)',
            }}
          >
            <span className="text-ink-950 drop-shadow-sm">{log.overallRating}</span>
            <span className="absolute bottom-0.5 right-1 text-[9px] font-semibold text-ink-950/70">
              /10
            </span>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5 mb-4">
          <span className={`chip border ${typeColorMap[log.switchType]}`}>
            {SWITCH_TYPE_LABELS[log.switchType]}
          </span>
          <span className={`chip border ${soundColorMap[log.soundCharacter]}`}>
            {SOUND_CHARACTER_LABELS[log.soundCharacter]}
          </span>
          <span className="chip chip-inactive">{log.keycapMaterial}</span>
          <span className="chip chip-inactive">{log.plateMaterial}板</span>
        </div>

        <div className="space-y-2.5 mb-4">
          <div>
            <div className="flex items-baseline justify-between mb-1">
              <span className="text-[10px] font-mono uppercase tracking-wider text-ink-500">
                轴体
              </span>
            </div>
            <p className="text-sm text-ink-200 line-clamp-1 font-mono">
              {log.switchName}
            </p>
          </div>
          <div>
            <div className="flex items-baseline justify-between mb-1">
              <span className="text-[10px] font-mono uppercase tracking-wider text-ink-500">
                键帽
              </span>
            </div>
            <p className="text-sm text-ink-200 line-clamp-1">
              {log.keycapProfile} 高度 · {log.keycapProcess || '未记录工艺'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-4">
          <div>
            <div className="text-[10px] font-mono uppercase text-ink-500 mb-1">回弹</div>
            <div className="rating-bar-track">
              <div
                className="rating-bar-fill"
                style={{
                  width: `${(log.reboundRating / 10) * 100}%`,
                  background: getRatingGradient(log.reboundRating),
                }}
              />
            </div>
          </div>
          <div>
            <div className="text-[10px] font-mono uppercase text-ink-500 mb-1">段落</div>
            <div className="rating-bar-track">
              <div
                className="rating-bar-fill"
                style={{
                  width: `${(log.tactilityRating / 10) * 100}%`,
                  background: getRatingGradient(log.tactilityRating),
                }}
              />
            </div>
          </div>
          <div>
            <div className="text-[10px] font-mono uppercase text-ink-500 mb-1">疲劳</div>
            <div className="rating-bar-track">
              <div
                className="rating-bar-fill"
                style={{
                  width: `${(log.fatigueRating / 10) * 100}%`,
                  background: getRatingGradient(11 - log.fatigueRating),
                }}
              />
            </div>
          </div>
        </div>

        {log.soundTags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-4">
            {log.soundTags.slice(0, 4).map((t) => (
              <span
                key={t}
                className="px-1.5 py-0.5 text-[10px] font-mono rounded bg-ink-900/60 text-brass-200/80 border border-ink-700/70"
              >
                #{t}
              </span>
            ))}
            {log.soundTags.length > 4 && (
              <span className="px-1.5 py-0.5 text-[10px] font-mono rounded text-ink-500">
                +{log.soundTags.length - 4}
              </span>
            )}
          </div>
        )}

        <div className="divider mb-3" />

        <div className="flex items-center justify-between gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleCompareSelect(log.id);
            }}
            className={`flex-1 inline-flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-medium transition-all ${
              selected
                ? 'bg-brass-300/20 text-brass-100 border border-brass-300/40'
                : 'text-ink-500 hover:text-brass-200 hover:bg-brass-300/8 border border-transparent hover:border-brass-300/25'
            }`}
          >
            {selected ? '✓ 已选对比' : '加入对比'}
          </button>
          <div className="flex items-center gap-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                openDetail(log);
              }}
              className="p-1.5 rounded-md text-ink-500 hover:text-slateblue-400 hover:bg-slateblue-500/10 transition-all"
              title="查看详情"
            >
              <Eye className="h-4 w-4" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                openFormModal(log);
              }}
              className="p-1.5 rounded-md text-ink-500 hover:text-moss-400 hover:bg-moss-500/10 transition-all"
              title="编辑"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (confirm(`确定删除「${log.name}」这条记录吗？`)) {
                  deleteLog(log.id);
                }
              }}
              className="p-1.5 rounded-md text-ink-500 hover:text-wine-400 hover:bg-wine-500/10 transition-all"
              title="删除"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}
