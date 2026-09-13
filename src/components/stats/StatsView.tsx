import { useMemo } from 'react';
import { BarChart3, Trophy, AlertTriangle, List } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import {
  SWITCH_TYPE_LABELS,
  SOUND_CHARACTER_LABELS,
  type SwitchType,
  type SoundCharacter,
} from '@/types';
import { getRatingGradient } from '@/utils/helpers';

const typeColorMap: Record<string, string> = {
  linear: 'bg-slateblue-500/20 text-slateblue-400 border-slateblue-500/30',
  tactile: 'bg-moss-500/20 text-moss-400 border-moss-500/30',
  clicky: 'bg-wine-500/20 text-wine-400 border-wine-500/30',
  other: 'bg-ink-600/40 text-ink-400 border-ink-600/50',
};

const typeBarColorMap: Record<string, string> = {
  linear: 'linear-gradient(90deg, #5a6b8e 0%, #7a8bb0 100%)',
  tactile: 'linear-gradient(90deg, #6b8e5a 0%, #8bb078 100%)',
  clicky: 'linear-gradient(90deg, #853a3a 0%, #c27575 100%)',
  other: 'linear-gradient(90deg, #55555e 0%, #7a7a88 100%)',
};

const soundColorMap: Record<string, string> = {
  deep: 'bg-[#5a4a8e]/20 text-[#a894d4] border-[#5a4a8e]/40',
  bright: 'bg-brass-300/20 text-brass-200 border-brass-300/35',
  muffled: 'bg-[#6e5a4f]/30 text-[#d4b49a] border-[#6e5a4f]/40',
  neutral: 'bg-ink-600/40 text-ink-400 border-ink-600/50',
};

const soundBarColorMap: Record<string, string> = {
  deep: 'linear-gradient(90deg, #5a4a8e 0%, #a894d4 100%)',
  bright: 'linear-gradient(90deg, #c07a2a 0%, #e9c989 100%)',
  muffled: 'linear-gradient(90deg, #6e5a4f 0%, #d4b49a 100%)',
  neutral: 'linear-gradient(90deg, #55555e 0%, #9a9aa8 100%)',
};

export default function StatsView() {
  const { logs, setViewMode } = useAppStore();

  const stats = useMemo(() => {
    if (logs.length === 0) {
      return null;
    }

    const total = logs.length;

    const avgRating =
      logs.reduce((sum, l) => sum + l.overallRating, 0) / total;

    const switchTypeCounts: Record<SwitchType, number> = {
      linear: 0,
      tactile: 0,
      clicky: 0,
      other: 0,
    };
    logs.forEach((l) => {
      switchTypeCounts[l.switchType]++;
    });

    const soundCounts: Record<SoundCharacter, number> = {
      deep: 0,
      bright: 0,
      muffled: 0,
      neutral: 0,
    };
    logs.forEach((l) => {
      soundCounts[l.soundCharacter]++;
    });

    const highestRated = logs.reduce((best, cur) =>
      cur.overallRating > best.overallRating ? cur : best,
    );

    const mostFatiguing = logs.reduce((worst, cur) =>
      cur.fatigueRating > worst.fatigueRating ? cur : worst,
    );

    return {
      total,
      avgRating,
      switchTypeCounts,
      soundCounts,
      highestRated,
      mostFatiguing,
    };
  }, [logs]);

  if (!stats) {
    return (
      <div className="space-y-5">
        <div className="flex items-center gap-2">
          <button onClick={() => setViewMode('list')} className="btn-ghost text-xs">
            ← 返回列表
          </button>
        </div>
        <div className="card-surface flex flex-col items-center justify-center py-20 px-6 text-center">
          <div className="keycap !h-14 !w-14 !min-w-[56px] !rounded-xl !text-xl mb-4 opacity-60">
            <BarChart3 className="h-6 w-6" />
          </div>
          <h3 className="font-mono text-base font-semibold text-ink-200 mb-2">
            暂无数据
          </h3>
          <p className="text-sm text-ink-500 max-w-sm">
            先创建一些键盘记录，再来查看统计概览吧～
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button onClick={() => setViewMode('list')} className="btn-ghost text-xs">
            <List className="h-3.5 w-3.5" />
            返回列表
          </button>
        </div>
        <div className="flex items-center gap-2 text-xs font-mono text-ink-500">
          <BarChart3 className="h-4 w-4 text-brass-300" />
          <span>基于 <span className="text-brass-300">{stats.total}</span> 条记录统计</span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="card-surface p-5 sm:p-6 relative overflow-hidden">
          <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full blur-3xl opacity-30 bg-brass-300/40" />
          <div className="relative">
            <div className="text-[10px] font-mono uppercase tracking-wider text-ink-500 mb-2">
              总记录数
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-4xl sm:text-5xl font-bold text-gradient-brass">
                {stats.total}
              </span>
              <span className="text-sm text-ink-500">把键盘</span>
            </div>
          </div>
        </div>

        <div className="card-surface p-5 sm:p-6 relative overflow-hidden">
          <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full blur-3xl opacity-30 bg-moss-500/40" />
          <div className="relative">
            <div className="text-[10px] font-mono uppercase tracking-wider text-ink-500 mb-2">
              平均评分
            </div>
            <div className="flex items-baseline gap-3">
              <div
                className="shrink-0 w-14 h-14 sm:w-16 sm:h-16 rounded-xl flex items-center justify-center font-mono text-2xl sm:text-3xl font-bold"
                style={{
                  background: getRatingGradient(Math.round(stats.avgRating)),
                  boxShadow:
                    'inset 0 1px 0 rgba(255,255,255,0.25), 0 4px 14px rgba(0,0,0,0.4)',
                  color: '#1a1a1e',
                }}
              >
                {stats.avgRating.toFixed(1)}
              </div>
              <div className="space-y-2 flex-1">
                <div className="rating-bar-track h-3">
                  <div
                    className="rating-bar-fill"
                    style={{
                      width: `${(stats.avgRating / 10) * 100}%`,
                      background: getRatingGradient(Math.round(stats.avgRating)),
                    }}
                  />
                </div>
                <div className="text-[10px] font-mono text-ink-500">
                  满分 10 分
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card-surface p-5 sm:p-6">
          <div className="flex items-center gap-2 mb-4">
            <div
              className="w-1.5 h-1.5 rounded-full bg-brass-300"
              style={{ boxShadow: '0 0 8px rgba(212,148,74,0.6)' }}
            />
            <h3 className="font-mono text-xs font-semibold uppercase tracking-wider text-brass-200">
              轴体类型占比
            </h3>
          </div>
          <div className="space-y-3">
            {(Object.keys(stats.switchTypeCounts) as SwitchType[]).map((type) => {
              const count = stats.switchTypeCounts[type];
              const pct = stats.total > 0 ? (count / stats.total) * 100 : 0;
              return (
                <div key={type}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className={`chip border text-[11px] ${typeColorMap[type]}`}>
                      {SWITCH_TYPE_LABELS[type]}
                    </span>
                    <span className="text-xs font-mono text-ink-400">
                      {count} <span className="text-ink-600">({pct.toFixed(0)}%)</span>
                    </span>
                  </div>
                  <div className="rating-bar-track h-2.5">
                    <div
                      className="rating-bar-fill"
                      style={{
                        width: `${pct}%`,
                        background: typeBarColorMap[type],
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="card-surface p-5 sm:p-6">
          <div className="flex items-center gap-2 mb-4">
            <div
              className="w-1.5 h-1.5 rounded-full bg-brass-300"
              style={{ boxShadow: '0 0 8px rgba(212,148,74,0.6)' }}
            />
            <h3 className="font-mono text-xs font-semibold uppercase tracking-wider text-brass-200">
              声音倾向分布
            </h3>
          </div>
          <div className="space-y-3">
            {(Object.keys(stats.soundCounts) as SoundCharacter[]).map((type) => {
              const count = stats.soundCounts[type];
              const pct = stats.total > 0 ? (count / stats.total) * 100 : 0;
              return (
                <div key={type}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className={`chip border text-[11px] ${soundColorMap[type]}`}>
                      {SOUND_CHARACTER_LABELS[type]}
                    </span>
                    <span className="text-xs font-mono text-ink-400">
                      {count} <span className="text-ink-600">({pct.toFixed(0)}%)</span>
                    </span>
                  </div>
                  <div className="rating-bar-track h-2.5">
                    <div
                      className="rating-bar-fill"
                      style={{
                        width: `${pct}%`,
                        background: soundBarColorMap[type],
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="card-surface p-5 sm:p-6 relative overflow-hidden">
          <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full blur-2xl opacity-40 bg-moss-500/40" />
          <div className="relative">
            <div className="flex items-center gap-1.5 mb-3">
              <Trophy className="h-4 w-4 text-moss-400" />
              <span className="text-[10px] font-mono uppercase tracking-wider text-moss-400">
                最高分键盘
              </span>
            </div>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h3 className="font-mono text-lg font-bold text-ink-100 truncate mb-1">
                  {stats.highestRated.name}
                </h3>
                <p className="text-xs text-ink-500 truncate mb-2">
                  {stats.highestRated.brand} {stats.highestRated.model}
                </p>
                <p className="text-xs text-ink-400 font-mono line-clamp-1">
                  {stats.highestRated.switchName}
                </p>
              </div>
              <div
                className="shrink-0 w-14 h-14 rounded-xl flex items-center justify-center font-mono text-2xl font-bold"
                style={{
                  background: getRatingGradient(stats.highestRated.overallRating),
                  boxShadow:
                    'inset 0 1px 0 rgba(255,255,255,0.25), 0 4px 14px rgba(0,0,0,0.4)',
                  color: '#1a1a1e',
                }}
              >
                {stats.highestRated.overallRating}
              </div>
            </div>
          </div>
        </div>

        <div className="card-surface p-5 sm:p-6 relative overflow-hidden">
          <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full blur-2xl opacity-40 bg-wine-500/40" />
          <div className="relative">
            <div className="flex items-center gap-1.5 mb-3">
              <AlertTriangle className="h-4 w-4 text-wine-400" />
              <span className="text-[10px] font-mono uppercase tracking-wider text-wine-400">
                最易疲劳键盘
              </span>
            </div>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h3 className="font-mono text-lg font-bold text-ink-100 truncate mb-1">
                  {stats.mostFatiguing.name}
                </h3>
                <p className="text-xs text-ink-500 truncate mb-2">
                  {stats.mostFatiguing.brand} {stats.mostFatiguing.model}
                </p>
                <div className="space-y-1">
                  <div className="rating-bar-track h-2">
                    <div
                      className="rating-bar-fill"
                      style={{
                        width: `${(stats.mostFatiguing.fatigueRating / 10) * 100}%`,
                        background: getRatingGradient(11 - stats.mostFatiguing.fatigueRating),
                      }}
                    />
                  </div>
                  <div className="text-[10px] font-mono text-ink-500">
                    疲劳度 {stats.mostFatiguing.fatigueRating}/10
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
