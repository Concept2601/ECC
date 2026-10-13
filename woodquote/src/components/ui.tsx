import { ArrowLeft, X } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

export function PageHeader({ title, subtitle, back, actions }: { title: string; subtitle?: string; back?: string | true; actions?: ReactNode }) {
  const nav = useNavigate();
  return (
    <header className="safe-top sticky top-0 z-30 border-b border-stone-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center gap-2 px-3 py-3">
        {back && (
          <button className="btn-ghost -ml-1 px-2" aria-label="Back" onClick={() => (back === true ? nav(-1) : nav(back))}>
            <ArrowLeft size={20} />
          </button>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-bold leading-tight">{title}</h1>
          {subtitle && <p className="truncate text-xs text-stone-500">{subtitle}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-1">{actions}</div>
      </div>
    </header>
  );
}

export function Card({ title, children, actions, className }: { title?: ReactNode; children: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <section className={`card p-4 ${className ?? ''}`}>
      {(title || actions) && (
        <div className="mb-3 flex items-center justify-between gap-2">
          {title && <h2 className="text-sm font-bold uppercase tracking-wide text-stone-600">{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function Field({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={`block ${className ?? ''}`}>
      <span className="label">{label}</span>
      {children}
    </label>
  );
}

/** Number input that tolerates temporary empty / partial values while typing. */
export function NumInput({ value, onChange, min, max, step, suffix, className }: { value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number; suffix?: string; className?: string }) {
  const [text, setText] = useState(String(value));
  useEffect(() => {
    if (Number(text) !== value) setText(String(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <div className={`relative ${className ?? ''}`}>
      <input
        className="input pr-10"
        inputMode="decimal"
        type="number"
        value={text}
        min={min}
        max={max}
        step={step ?? 'any'}
        onChange={(e) => {
          setText(e.target.value);
          const n = Number.parseFloat(e.target.value);
          if (!Number.isNaN(n)) onChange(max != null ? Math.min(max, n) : n);
        }}
        onBlur={() => {
          let n = Number.parseFloat(text);
          if (Number.isNaN(n)) n = min ?? 0;
          if (min != null) n = Math.max(min, n);
          setText(String(n));
          onChange(n);
        }}
      />
      {suffix && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-stone-400">{suffix}</span>}
    </div>
  );
}

export function TextInput({ value, onChange, placeholder, multiline, rows }: { value: string; onChange: (v: string) => void; placeholder?: string; multiline?: boolean; rows?: number }) {
  return multiline ? (
    <textarea className="input" rows={rows ?? 3} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
  ) : (
    <input className="input" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
  );
}

export function Select<T extends string>({ value, onChange, options, allowNone }: { value: T | null; onChange: (v: T | null) => void; options: { value: T; label: string }[]; allowNone?: string }) {
  return (
    <select className="input" value={value ?? ''} onChange={(e) => onChange(e.target.value === '' ? null : (e.target.value as T))}>
      {allowNone && <option value="">{allowNone}</option>}
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 py-1">
      <span className="text-sm font-medium">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition ${checked ? 'bg-brand-600' : 'bg-stone-300'}`}
      >
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${checked ? 'left-[22px]' : 'left-0.5'}`} />
      </button>
    </label>
  );
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="no-scrollbar -mx-1 flex gap-1 overflow-x-auto px-1 py-1">
      {tabs.map((t) => (
        <button key={t.value} className={`tab ${value === t.value ? 'tab-active' : 'bg-white border border-stone-200'}`} onClick={() => onChange(t.value)}>
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function Modal({ open, onClose, title, children, footer }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
      <div className="safe-bottom flex max-h-[92vh] w-full max-w-lg flex-col rounded-t-3xl bg-white sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-stone-100 px-4 py-3">
          <h3 className="font-bold">{title}</h3>
          <button className="btn-ghost px-2" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="overflow-y-auto p-4">{children}</div>
        {footer && <div className="border-t border-stone-100 p-3">{footer}</div>}
      </div>
    </div>
  );
}

export function Empty({ icon, title, text, action }: { icon: ReactNode; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
      <div className="mb-1 rounded-2xl bg-brand-100 p-4 text-brand-700">{icon}</div>
      <h3 className="font-bold">{title}</h3>
      {text && <p className="max-w-sm text-sm text-stone-500">{text}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function Stat({ label, value, tone }: { label: string; value: string; tone?: 'good' | 'warn' | 'bad' }) {
  const c = tone === 'good' ? 'text-emerald-700' : tone === 'warn' ? 'text-amber-700' : tone === 'bad' ? 'text-red-700' : 'text-stone-900';
  return (
    <div className="card p-3">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-stone-500">{label}</div>
      <div className={`mt-1 text-lg font-bold ${c}`}>{value}</div>
    </div>
  );
}

export function Row({ label, value, strong }: { label: ReactNode; value: ReactNode; strong?: boolean }) {
  return (
    <div className={`flex items-center justify-between gap-3 py-1 text-sm ${strong ? 'font-bold text-base' : ''}`}>
      <span className={strong ? '' : 'text-stone-600'}>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

export function confirmAction(msg: string): boolean {
  return window.confirm(msg);
}
