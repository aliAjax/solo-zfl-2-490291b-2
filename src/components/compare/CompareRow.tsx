import type { KeyboardLog } from '@/types';
import { SWITCH_TYPE_LABELS, SOUND_CHARACTER_LABELS } from '@/types';
import { getRatingGradient, compareValues, type CompareField } from '@/utils/helpers';

interface Props {
  label: string;
  field: CompareField;
  logA?: KeyboardLog;
  logB?: KeyboardLog;
  groupName?: string;
}

function getFieldValue(log: KeyboardLog | undefined, field: CompareField): string | number | string[] {
  if (!log) return '';
  if (field.getter) return field.getter(log);
  if (!field.key) return '';
  const v = log[field.key];
  if (field.key === 'switchType' && typeof v === 'string') return SWITCH_TYPE_LABELS[v as keyof typeof SWITCH_TYPE_LABELS] || v;
  if (field.key === 'soundCharacter' && typeof v === 'string') return SOUND_CHARACTER_LABELS[v as keyof typeof SOUND_CHARACTER_LABELS] || v;
  return v as string | number | string[];
}

export default function CompareRow({ label, field, logA, logB, groupName }: Props) {
  const valA = getFieldValue(logA, field);
  const valB = getFieldValue(logB, field);
  const hasBoth = logA && logB;
  const different = hasBoth ? !compareValues(valA, valB) : false;

  const renderCell = (
    value: string | number | string[],
    log: KeyboardLog | undefined,
    side: 'A' | 'B',
  ) => {
    if (!log) {
      return (
        <div className="text-xs text-ink-600 italic font-mono">
          — 未选择 —
        </div>
      );
    }

    if (field.isRating && typeof value === 'number') {
      const invert = field.invertRating;
      return (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="font-mono text-sm font-bold text-ink-100">{value}</span>
            <span className="text-[10px] font-mono text-ink-500">/ 10</span>
          </div>
          <div className="rating-bar-track h-2">
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
    }

    if (Array.isArray(value)) {
      if (value.length === 0) {
        return <div className="text-xs text-ink-600 italic">无</div>;
      }
      return (
        <div className="flex flex-wrap gap-1">
          {value.map((t) => (
            <span
              key={t}
              className={`px-2 py-0.5 text-[11px] rounded-full ${
                side === 'A'
                  ? 'bg-slateblue-500/15 text-slateblue-400 border border-slateblue-500/30'
                  : 'bg-wine-500/15 text-wine-400 border border-wine-500/30'
              }`}
            >
              #{t}
            </span>
          ))}
        </div>
      );
    }

    if (!value && value !== 0) {
      return <div className="text-xs text-ink-600 italic">未记录</div>;
    }

    return (
      <div className={`text-sm text-ink-100 ${field.key === 'switchName' ? 'font-mono' : ''}`}>
        {value}
      </div>
    );
  };

  const rowBg = different
    ? 'bg-gradient-to-r from-slateblue-500/6 via-brass-300/4 to-wine-500/6'
    : hasBoth
      ? 'hover:bg-ink-800/40'
      : '';

  return (
    <div
      className={`grid grid-cols-[110px_1fr_1px_1fr] sm:grid-cols-[140px_1fr_1px_1fr] gap-3 sm:gap-5 py-3.5 px-3 sm:px-4 -mx-3 sm:-mx-4 rounded-lg transition-colors ${rowBg}`}
    >
      <div className="flex items-center">
        <div className="text-[11px] sm:text-xs font-mono uppercase tracking-wider text-ink-400 leading-tight pr-2">
          {label}
          {groupName && (
            <div className="text-[9px] sm:text-[10px] text-ink-600 mt-0.5 normal-case tracking-normal not-italic">
              {groupName}
            </div>
          )}
        </div>
      </div>
      <div className="min-w-0 flex items-center">{renderCell(valA, logA, 'A')}</div>
      <div className="w-px bg-gradient-to-b from-transparent via-ink-700/60 to-transparent self-stretch my-1" />
      <div className="min-w-0 flex items-center">{renderCell(valB, logB, 'B')}</div>
    </div>
  );
}
