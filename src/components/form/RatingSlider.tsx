import { useState } from 'react';

interface Props {
  label: string;
  value: number;
  min?: number;
  max?: number;
  onChange: (val: number) => void;
  hint?: string;
  invert?: boolean;
}

export default function RatingSlider({
  label,
  value,
  min = 1,
  max = 10,
  onChange,
  hint,
  invert,
}: Props) {
  const [focused, setFocused] = useState(false);
  const pct = ((value - min) / (max - min)) * 100;

  const getColor = () => {
    const r = invert ? 11 - value : value;
    if (r >= 8) return '#6b8e5a';
    if (r >= 6) return '#5a6b8e';
    if (r >= 4) return '#d4944a';
    return '#a65252';
  };
  const color = getColor();

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <label className="text-sm font-medium text-ink-200">{label}</label>
        <div
          className={`inline-flex items-baseline gap-0.5 px-2.5 py-1 rounded-md font-mono text-sm font-bold transition-all ${
            focused ? 'scale-105' : ''
          }`}
          style={{
            background: `${color}22`,
            color,
            border: `1px solid ${color}44`,
          }}
        >
          {value}
          <span className="text-[10px] font-semibold opacity-60">/ {max}</span>
        </div>
      </div>
      <div className="relative">
        <input
          type="range"
          min={min}
          max={max}
          value={value}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full"
          style={{
            background: `linear-gradient(90deg, ${color} ${pct}%, #141418 ${pct}%)`,
          }}
        />
      </div>
      {hint && <p className="text-[11px] text-ink-500">{hint}</p>}
    </div>
  );
}
