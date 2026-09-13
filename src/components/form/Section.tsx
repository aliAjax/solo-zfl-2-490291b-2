import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

interface Props {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

export default function Section({ title, subtitle, icon, children, defaultOpen = true }: Props) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border border-ink-700/70 rounded-xl overflow-hidden bg-ink-900/40">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-ink-800/40 transition-colors text-left"
      >
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-ink-800/80 text-brass-300 shrink-0">
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-mono text-sm font-semibold text-ink-100">{title}</h3>
          {subtitle && <p className="text-xs text-ink-500 truncate">{subtitle}</p>}
        </div>
        <ChevronDown
          className={`h-4 w-4 text-ink-500 transition-transform duration-300 shrink-0 ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>
      {open && (
        <div className="border-t border-ink-700/60 px-4 py-4 animate-fadeIn">
          <div className="space-y-4">{children}</div>
        </div>
      )}
    </div>
  );
}
