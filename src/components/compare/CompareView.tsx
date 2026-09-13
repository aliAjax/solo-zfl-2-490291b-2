import { useMemo } from 'react';
import { ArrowLeftRight, X } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import CompareSelect from './CompareSelect';
import CompareRow from './CompareRow';
import { COMPARE_FIELDS, getRatingGradient } from '@/utils/helpers';

export default function CompareView() {
  const { logs, ui, clearCompareSelect, setViewMode } = useAppStore();
  const selected = ui.selectedForCompare;

  const [idA, idB] = selected;

  const logA = useMemo(() => logs.find((l) => l.id === idA), [logs, idA]);
  const logB = useMemo(() => logs.find((l) => l.id === idB), [logs, idB]);

  const onSelectA = (id: string) => {
    // 保持 B 不变，替换 A；如果 B 和新 A 相同则交换
    if (id === idB) {
      useAppStore.setState({ ui: { ...ui, selectedForCompare: [idB, idA] } });
    } else {
      useAppStore.setState({
        ui: { ...ui, selectedForCompare: [id, idB].filter(Boolean) as string[] },
      });
    }
  };
  const onSelectB = (id: string) => {
    if (id === idA) {
      useAppStore.setState({ ui: { ...ui, selectedForCompare: [idB, idA] } });
    } else {
      const arr = idA ? [idA, id] : [id];
      useAppStore.setState({ ui: { ...ui, selectedForCompare: arr } });
    }
  };

  const swap = () => {
    useAppStore.setState({ ui: { ...ui, selectedForCompare: [idB, idA].filter(Boolean) as string[] } });
  };

  // 计算差异统计
  const diffStats = useMemo(() => {
    if (!logA || !logB) return null;
    let total = 0;
    let diff = 0;
    COMPARE_FIELDS.forEach((g) => {
      g.fields.forEach((f) => {
        total++;
        const a = f.getter ? f.getter(logA) : f.key ? (logA as any)[f.key] : '';
        const b = f.getter ? f.getter(logB) : f.key ? (logB as any)[f.key] : '';
        const arrA = Array.isArray(a);
        const arrB = Array.isArray(b);
        let equal: boolean;
        if (arrA && arrB) {
          equal = JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());
        } else if (f.isRating && f.key) {
          equal = a === b;
        } else {
          equal = a === b;
        }
        if (!equal) diff++;
      });
    });
    return { total, diff, same: total - diff };
  }, [logA, logB]);

  const renderHeaderCard = (side: 'A' | 'B') => {
    const log = side === 'A' ? logA : logB;
    const classes =
      side === 'A'
        ? {
            card: 'rounded-xl border border-slateblue-500/30 bg-gradient-to-br from-slateblue-500/10 via-ink-800/60 to-ink-800/60 p-5 sm:p-6 relative overflow-hidden',
            glow: 'absolute -top-6 -right-6 w-24 h-24 rounded-full blur-2xl opacity-40 bg-slateblue-500/40',
            badge:
              'inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase tracking-wider bg-slateblue-500/20 text-slateblue-400 border border-slateblue-500/30 mb-2',
          }
        : {
            card: 'rounded-xl border border-wine-500/30 bg-gradient-to-br from-wine-500/10 via-ink-800/60 to-ink-800/60 p-5 sm:p-6 relative overflow-hidden',
            glow: 'absolute -top-6 -right-6 w-24 h-24 rounded-full blur-2xl opacity-40 bg-wine-500/40',
            badge:
              'inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase tracking-wider bg-wine-500/20 text-wine-400 border border-wine-500/30 mb-2',
          };
    if (!log) {
      return (
        <div className={`rounded-xl border-2 border-dashed border-ink-700/70 bg-ink-800/30 p-5 sm:p-6`}>
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-mono text-lg font-bold bg-ink-700/60 text-ink-500 mb-3`}>
            {side}
          </div>
          <div className="font-mono text-base font-semibold text-ink-500 mb-1">
            待选择
          </div>
          <div className="text-xs text-ink-600">使用上方下拉选择要对比的键盘</div>
        </div>
      );
    }
    return (
      <div className={classes.card}>
        <div className={classes.glow} />
        <div className="relative">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <div className={classes.badge}>
                键盘 {side}
              </div>
              <h3 className="font-mono text-lg sm:text-xl font-bold text-ink-50 leading-snug">
                {log.name}
              </h3>
              <p className="text-xs text-ink-500 mt-0.5">
                {log.brand} {log.model}
              </p>
            </div>
            <div
              className="shrink-0 w-14 h-14 sm:w-16 sm:h-16 rounded-xl flex items-center justify-center font-mono text-xl sm:text-2xl font-bold"
              style={{
                background: getRatingGradient(log.overallRating),
                boxShadow:
                  'inset 0 1px 0 rgba(255,255,255,0.25), 0 4px 14px rgba(0,0,0,0.4)',
                color: '#1a1a1e',
              }}
            >
              {log.overallRating}
            </div>
          </div>
          <p className="font-mono text-xs sm:text-sm text-ink-300 leading-relaxed line-clamp-2">
            {log.switchName}
          </p>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-5">
      <CompareSelect
        logs={logs}
        onSelectA={onSelectA}
        onSelectB={onSelectB}
        currentA={idA ?? null}
        currentB={idB ?? null}
      />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button onClick={() => setViewMode('list')} className="btn-ghost text-xs">
            ← 返回列表
          </button>
          {logA && logB && (
            <button onClick={swap} className="btn-ghost text-xs">
              <ArrowLeftRight className="h-3.5 w-3.5" />
              交换
            </button>
          )}
        </div>

        {diffStats && (
          <div className="flex items-center gap-2 text-xs font-mono">
            <span className="text-ink-500">对比 {diffStats.total} 项 ·</span>
            <span className="chip chip-active">
              <span className="text-brass-200">{diffStats.diff}</span> 项不同
            </span>
            <span className="chip chip-inactive">
              <span className="text-ink-300">{diffStats.same}</span> 项相同
            </span>
            <button
              onClick={clearCompareSelect}
              className="p-1.5 rounded-md text-ink-500 hover:text-wine-400 hover:bg-wine-500/10 transition-colors"
              title="清除对比"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-5">
        {renderHeaderCard('A')}
        {renderHeaderCard('B')}
      </div>

      <div className="card-surface p-3 sm:p-5 animate-fadeIn">
        <div className="space-y-5">
          {COMPARE_FIELDS.map((group, gi) => (
            <div key={group.group} className="relative">
              {gi > 0 && <div className="divider mb-4 -mx-3 sm:-mx-5" />}
              <div className="flex items-center gap-2 mb-2 px-1">
                <div
                  className="w-1.5 h-1.5 rounded-full bg-brass-300"
                  style={{ boxShadow: '0 0 8px rgba(212,148,74,0.6)' }}
                />
                <h3 className="font-mono text-xs font-semibold uppercase tracking-wider text-brass-200">
                  {group.group}
                </h3>
              </div>
              <div className="space-y-0.5">
                {group.fields.map((f) => (
                  <CompareRow
                    key={f.label}
                    label={f.label}
                    field={f}
                    logA={logA}
                    logB={logB}
                  />
                ))}
              </div>
            </div>
          ))}

          {(logA?.notes || logB?.notes) && (
            <>
              <div className="divider -mx-3 sm:-mx-5" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <div>
                  <div className="text-[11px] font-mono uppercase tracking-wider text-slateblue-400 mb-2 px-1">
                    键盘 A · 手感备注
                  </div>
                  <div className="rounded-xl bg-slateblue-500/5 border border-slateblue-500/15 p-4 text-sm text-ink-200 leading-relaxed whitespace-pre-wrap min-h-[80px]">
                    {logA?.notes || <span className="text-ink-600 italic">无备注</span>}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] font-mono uppercase tracking-wider text-wine-400 mb-2 px-1">
                    键盘 B · 手感备注
                  </div>
                  <div className="rounded-xl bg-wine-500/5 border border-wine-500/15 p-4 text-sm text-ink-200 leading-relaxed whitespace-pre-wrap min-h-[80px]">
                    {logB?.notes || <span className="text-ink-600 italic">无备注</span>}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
