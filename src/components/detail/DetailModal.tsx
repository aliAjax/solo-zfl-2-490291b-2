import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Pencil, Trash2, Calendar } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { SWITCH_TYPE_LABELS, SOUND_CHARACTER_LABELS } from '@/types';
import { getRatingGradient, formatDate } from '@/utils/helpers';

export default function DetailModal() {
  const { ui, closeDetail, openFormModal, deleteLog } = useAppStore();
  const log = ui.detailLog;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && log) closeDetail();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [log, closeDetail]);

  if (!log) return null;

  const renderRatingBar = (label: string, value: number, invert = false) => (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[11px] font-mono uppercase tracking-wider text-ink-500">{label}</span>
        <span className="font-mono text-sm font-bold text-ink-200">{value}/10</span>
      </div>
      <div className="rating-bar-track h-2.5">
        <div
          className="rating-bar-fill"
          style={{
            width: `${(value / 10) * 100}%`,
            background: invert ? getRatingGradient(11 - value) : getRatingGradient(value),
          }}
        />
      </div>
    </div>
  );

  const InfoRow = ({ label, value }: { label: string; value?: string | number }) => (
    value || value === 0 ? (
      <div>
        <div className="text-[11px] font-mono uppercase tracking-wider text-ink-500 mb-1">
          {label}
        </div>
        <div className="text-sm text-ink-100">{value}</div>
      </div>
    ) : null
  );

  const handleDelete = () => {
    if (confirm(`确定删除「${log.name}」这条记录吗？`)) {
      deleteLog(log.id);
    }
  };

  return createPortal(
    <div
      className="modal-backdrop"
      onClick={(e) => e.target === e.currentTarget && closeDetail()}
    >
      <div className="modal-surface scrollbar-thin">
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-ink-700/60 bg-gradient-to-b from-ink-800/98 to-ink-800/90 backdrop-blur-sm">
          <div>
            <h2 className="font-mono text-lg font-bold text-gradient-brass">
              {log.name}
            </h2>
            <p className="text-xs text-ink-500 mt-0.5 flex items-center gap-1.5">
              <Calendar className="h-3 w-3" />
              记录于 {formatDate(log.createdAt)}
              {log.updatedAt !== log.createdAt && ` · 更新于 ${formatDate(log.updatedAt)}`}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => openFormModal(log)}
              className="p-2 rounded-lg text-ink-400 hover:text-moss-400 hover:bg-moss-500/10 transition-colors"
              title="编辑"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              onClick={handleDelete}
              className="p-2 rounded-lg text-ink-400 hover:text-wine-400 hover:bg-wine-500/10 transition-colors"
              title="删除"
            >
              <Trash2 className="h-4 w-4" />
            </button>
            <button
              onClick={closeDetail}
              className="p-2 rounded-lg text-ink-500 hover:text-ink-200 hover:bg-ink-700/60 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="p-5 sm:p-6 space-y-6 animate-fadeIn">
          <div className="flex flex-col sm:flex-row sm:items-start gap-5">
            <div
              className="shrink-0 flex items-center justify-center w-24 h-24 rounded-2xl font-mono text-3xl font-bold"
              style={{
                background: getRatingGradient(log.overallRating),
                boxShadow:
                  'inset 0 1px 0 rgba(255,255,255,0.25), 0 6px 20px rgba(0,0,0,0.4)',
              }}
            >
              <div className="text-center text-ink-950 drop-shadow-sm">
                <div>{log.overallRating}</div>
                <div className="text-[10px] font-semibold opacity-70 tracking-wider">SCORE</div>
              </div>
            </div>

            <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 gap-4">
              <InfoRow label="品牌" value={log.brand} />
              <InfoRow label="型号" value={log.model} />
              <InfoRow label="入手日期" value={formatDate(log.purchaseDate)} />
              <InfoRow label="轴体类型" value={SWITCH_TYPE_LABELS[log.switchType]} />
              <InfoRow label="声音倾向" value={SOUND_CHARACTER_LABELS[log.soundCharacter]} />
              <InfoRow label="外壳材质" value={log.caseMaterial} />
            </div>
          </div>

          <div className="divider" />

          <div className="space-y-5">
            <h3 className="font-mono text-sm font-semibold text-brass-200 flex items-center gap-2">
              <span className="w-1 h-4 rounded bg-brass-300" />
              核心配置
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-5">
              <InfoRow label="轴体" value={log.switchName} />
              <InfoRow label="润滑" value={log.switchLubed} />
              <InfoRow label="键帽" value={`${log.keycapMaterial} · ${log.keycapProfile} 高度`} />
              <InfoRow label="键帽工艺" value={log.keycapProcess} />
              <InfoRow label="定位板" value={`${log.plateMaterial} · ${log.plateThickness}`} />
              <InfoRow label="填充材料" value={log.fillMaterial} />
            </div>
          </div>

          <div className="divider" />

          <div className="space-y-5">
            <h3 className="font-mono text-sm font-semibold text-brass-200 flex items-center gap-2">
              <span className="w-1 h-4 rounded bg-brass-300" />
              手感评分
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-5">
              {renderRatingBar('整体手感', log.overallRating)}
              {renderRatingBar('回弹感', log.reboundRating)}
              {renderRatingBar('段落感', log.tactilityRating)}
              {renderRatingBar('打字疲劳度', log.fatigueRating, true)}
            </div>
          </div>

          {log.soundTags.length > 0 && (
            <>
              <div className="divider" />
              <div className="space-y-3">
                <h3 className="font-mono text-sm font-semibold text-brass-200 flex items-center gap-2">
                  <span className="w-1 h-4 rounded bg-brass-300" />
                  声音描述
                </h3>
                <div className="flex flex-wrap gap-2">
                  {log.soundTags.map((t) => (
                    <span
                      key={t}
                      className="px-3 py-1 rounded-full text-xs font-mono bg-brass-300/12 text-brass-100 border border-brass-300/25"
                    >
                      #{t}
                    </span>
                  ))}
                </div>
              </div>
            </>
          )}

          {log.notes && (
            <>
              <div className="divider" />
              <div className="space-y-3">
                <h3 className="font-mono text-sm font-semibold text-brass-200 flex items-center gap-2">
                  <span className="w-1 h-4 rounded bg-brass-300" />
                  手感备注
                </h3>
                <div className="rounded-xl bg-ink-900/60 border border-ink-700/60 p-4 text-sm text-ink-200 leading-relaxed whitespace-pre-wrap">
                  {log.notes}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
