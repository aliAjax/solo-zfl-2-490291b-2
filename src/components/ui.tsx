import { useEffect, type HTMLAttributes, type ReactNode, type ButtonHTMLAttributes, type SelectHTMLAttributes, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { cn } from '../lib/utils'

export function Card({ children, className, ...rest }: HTMLAttributes<HTMLDivElement> & { children: ReactNode }) {
  return (
    <div className={cn('rounded-xl border border-ink-700/70 bg-ink-900/70 shadow-card', className)} {...rest}>
      {children}
    </div>
  )
}

type BtnVariant = 'primary' | 'ghost' | 'danger' | 'soft' | 'gold'
export function Btn({
  variant = 'soft',
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant }) {
  const styles: Record<BtnVariant, string> = {
    primary: 'bg-moss-600 hover:bg-moss-500 text-ink-50 border-transparent',
    gold: 'bg-brass-400 hover:bg-brass-300 text-ink-950 border-transparent font-semibold',
    danger: 'bg-wine-600 hover:bg-wine-500 text-ink-50 border-transparent',
    soft: 'bg-ink-800 hover:bg-ink-700 text-ink-100 border-ink-600',
    ghost: 'bg-transparent hover:bg-ink-800 text-ink-300 border-transparent',
  }
  return (
    <button
      className={cn(
        'inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-35',
        styles[variant],
        className,
      )}
      {...props}
    />
  )
}

export function Badge({ children, tone = 'neutral', className }: { children: ReactNode; tone?: 'neutral' | 'green' | 'red' | 'gold' | 'blue' | 'purple'; className?: string }) {
  const tones = {
    neutral: 'bg-ink-800 text-ink-200 border-ink-600',
    green: 'bg-moss-600/20 text-moss-400 border-moss-600/40',
    red: 'bg-wine-600/20 text-wine-400 border-wine-600/40',
    gold: 'bg-brass-400/15 text-brass-300 border-brass-400/40',
    blue: 'bg-slateblue-500/20 text-slateblue-400 border-slateblue-500/40',
    purple: 'bg-purple-500/15 text-purple-300 border-purple-500/40',
  }
  return (
    <span className={cn('inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium', tones[tone], className)}>
      {children}
    </span>
  )
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-ink-400">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-ink-500">{hint}</span>}
    </label>
  )
}

const inputCls =
  'w-full rounded-lg border border-ink-600 bg-ink-950/70 px-3 py-1.5 text-sm text-ink-100 outline-none focus:border-brass-400/70 focus:ring-1 focus:ring-brass-400/30'

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(inputCls, props.className)} />
}
export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cn(inputCls, 'min-h-[64px]', props.className)} />
}
export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cn(inputCls, 'appearance-none', props.className)} />
}

export function Modal({
  open,
  onClose,
  title,
  children,
  width = 'max-w-lg',
}: {
  open: boolean
  onClose: () => void
  title: ReactNode
  children: ReactNode
  width?: string
}) {
  useEffect(() => {
    if (!open) return
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink-950/70 p-4 backdrop-blur-sm animate-fadeIn" onMouseDown={onClose}>
      <div className={cn('my-8 w-full rounded-2xl border border-ink-700 bg-ink-900 shadow-glow animate-scaleIn', width)} onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-ink-700 px-5 py-3.5">
          <h3 className="text-base font-semibold text-ink-100">{title}</h3>
          <button className="text-ink-400 hover:text-ink-100" onClick={onClose}>✕</button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  )
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <div className="rounded-lg border border-dashed border-ink-700 px-4 py-8 text-center text-sm text-ink-500">{children}</div>
}

export function Stat({ label, value, tone = 'text-ink-100' }: { label: string; value: ReactNode; tone?: string }) {
  return (
    <Card className="px-4 py-3">
      <div className="text-xs uppercase tracking-wide text-ink-500">{label}</div>
      <div className={cn('mt-1 font-mono text-2xl font-semibold', tone)}>{value}</div>
    </Card>
  )
}
