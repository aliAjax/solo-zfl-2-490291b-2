import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { SWITCH_TYPE_LABELS, SOUND_CHARACTER_LABELS, type KeyboardLog } from '@/types';

interface Props {
  logs: KeyboardLog[];
  onSelectA: (id: string) => void;
  onSelectB: (id: string) => void;
  currentA: string | null;
  currentB: string | null;
}

export default function CompareSelect({
  logs,
  onSelectA,
  onSelectB,
  currentA,
  currentB,
}: Props) {
  const [openA, setOpenA] = useState(false);
  const [openB, setOpenB] = useState(false);

  const renderSelect = (
    slot: 'A' | 'B',
    current: string | null,
    open: boolean,
    setOpen: (o: boolean) => void,
    onSelect: (id: string) => void,
  ) => {
    const selected = logs.find((l) => l.id === current);
    const accentStyle =
      slot === 'A'
        ? {
            border: 'border-slateblue-500/40',
            bg: 'bg-slateblue-500/10',
          }
        : {
            border: 'border-wine-500/40',
            bg: 'bg-wine-500/10',
          };

    return (
      <div className="relative flex-1">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${
            selected
              ? `${accentStyle.border} ${accentStyle.bg}`
              : 'border-ink-700/70 bg-ink-800/60 hover:border-brass-300/40'
          }`}
        >
          <div
            className={`w-8 h-8 rounded-lg flex items-center justify-center font-mono text-sm font-bold ${
              slot === 'A' ? 'bg-slateblue-500/25 text-slateblue-400' : 'bg-wine-500/25 text-wine-400'
            }`}
          >
            {slot}
          </div>
          <div className="flex-1 min-w-0 text-left">
            {selected ? (
              <>
                <div className="font-mono text-sm font-semibold text-ink-100 truncate">
                  {selected.name}
                </div>
                <div className="text-xs text-ink-500 truncate">
                  {selected.brand} {selected.model} · {selected.switchName}
                </div>
              </>
            ) : (
              <div className="text-sm text-ink-500">选择键盘 {slot}...</div>
            )}
          </div>
          <ChevronDown
            className={`h-4 w-4 text-ink-500 transition-transform duration-200 ${
              open ? 'rotate-180' : ''
            }`}
          />
        </button>
        {open && (
          <div className="absolute top-full left-0 right-0 mt-2 z-20 rounded-xl border border-ink-700/80 bg-ink-800/98 backdrop-blur-xl shadow-glow max-h-72 overflow-y-auto scrollbar-thin animate-scaleIn origin-top">
            {logs.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-ink-500">暂无记录</div>
            ) : (
              logs.map((l) => {
                const disabled =
                  (slot === 'A' && l.id === currentB) ||
                  (slot === 'B' && l.id === currentA);
                return (
                  <button
                    key={l.id}
                    type="button"
                    disabled={disabled}
                    onClick={() => {
                      onSelect(l.id);
                      setOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-3 border-b border-ink-700/50 last:border-b-0 transition-colors ${
                      disabled
                        ? 'opacity-40 cursor-not-allowed'
                        : l.id === current
                          ? `${accentStyle.bg}`
                          : 'hover:bg-ink-700/50'
                    }`}
                  >
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center font-mono text-sm font-bold shrink-0"
                      style={{
                        background:
                          l.overallRating >= 8
                            ? 'linear-gradient(135deg,#6b8e5a,#8bb078)'
                            : l.overallRating >= 6
                              ? 'linear-gradient(135deg,#5a6b8e,#7a8bb0)'
                              : l.overallRating >= 4
                                ? 'linear-gradient(135deg,#c07a2a,#e9c989)'
                                : 'linear-gradient(135deg,#853a3a,#c27575)',
                        color: '#1a1a1e',
                      }}
                    >
                      {l.overallRating}
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <div className="font-mono text-sm font-semibold text-ink-100 truncate">
                        {l.name}
                      </div>
                      <div className="text-[11px] text-ink-500 truncate">
                        {SWITCH_TYPE_LABELS[l.switchType]} · {SOUND_CHARACTER_LABELS[l.soundCharacter]}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="card-surface p-4 sm:p-5 animate-fadeIn">
      <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-3 sm:gap-5">
        {renderSelect('A', currentA, openA, setOpenA, onSelectA)}
        <div className="flex flex-col items-center justify-center pt-3">
          <div className="keycap !h-9 !w-9 !min-w-[36px] !rounded-lg !text-sm">VS</div>
        </div>
        {renderSelect('B', currentB, openB, setOpenB, onSelectB)}
      </div>
    </div>
  );
}
