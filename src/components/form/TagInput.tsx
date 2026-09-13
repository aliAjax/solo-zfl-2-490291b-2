import { useState, useEffect, useRef } from 'react';
import { X, Plus } from 'lucide-react';

interface Props {
  tags: string[];
  onChange: (tags: string[]) => void;
  presetSuggestions?: string[];
  placeholder?: string;
}

export default function TagInput({
  tags,
  onChange,
  presetSuggestions = [],
  placeholder = '输入标签后按回车添加',
}: Props) {
  const [input, setInput] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (input.trim()) setShowSuggestions(true);
  }, [input]);

  const addTag = (raw: string) => {
    const t = raw.trim().replace(/^#/, '');
    if (!t) return;
    if (tags.includes(t)) return;
    onChange([...tags, t]);
    setInput('');
    setShowSuggestions(false);
  };

  const removeTag = (t: string) => onChange(tags.filter((x) => x !== t));

  const filtered = presetSuggestions.filter(
    (s) => !tags.includes(s) && s.toLowerCase().includes(input.toLowerCase()),
  );

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2 p-2.5 rounded-lg bg-ink-900/80 border border-ink-700/80 focus-within:border-brass-300/60 focus-within:shadow-[0_0_0_3px_rgba(212,148,74,0.1)] transition-all min-h-[48px]">
        {tags.map((t) => (
          <span
            key={t}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-brass-300/15 text-brass-100 border border-brass-300/30"
          >
            #{t}
            <button
              type="button"
              onClick={() => removeTag(t)}
              className="ml-0.5 p-0.5 rounded hover:bg-wine-500/30 hover:text-wine-400 transition-colors"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          type="text"
          value={input}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',' || e.key === ' ') {
              if (e.key !== ' ' || input.trim()) {
                e.preventDefault();
                addTag(input);
              }
            } else if (e.key === 'Backspace' && !input && tags.length) {
              e.preventDefault();
              onChange(tags.slice(0, -1));
            }
          }}
          placeholder={tags.length === 0 ? placeholder : ''}
          className="flex-1 min-w-[120px] bg-transparent text-sm text-ink-100 placeholder-ink-500 outline-none"
        />
        {input.trim() && (
          <button
            type="button"
            onMouseDown={() => addTag(input)}
            className="p-1 rounded text-ink-500 hover:text-brass-300 hover:bg-brass-300/10 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {presetSuggestions.length > 0 && (
        <div>
          <p className="text-[11px] font-mono uppercase tracking-wider text-ink-500 mb-1.5">
            推荐标签
          </p>
          <div className="flex flex-wrap gap-1.5">
            {showSuggestions && filtered.length > 0
              ? filtered.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onMouseDown={() => addTag(s)}
                    className="chip chip-inactive text-[11px]"
                  >
                    + #{s}
                  </button>
                ))
              : !showSuggestions &&
                presetSuggestions
                  .filter((s) => !tags.includes(s))
                  .slice(0, 8)
                  .map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => addTag(s)}
                      className="chip chip-inactive text-[11px]"
                    >
                      + #{s}
                    </button>
                  ))}
          </div>
        </div>
      )}
    </div>
  );
}
