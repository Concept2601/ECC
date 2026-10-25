import { ArrowLeft, Menu, X } from 'lucide-react';
import { useEffect, useRef, useState, type ChangeEvent, type FocusEvent, type KeyboardEvent as RKeyboardEvent, type MouseEvent, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import EditTools from './EditTools';
import { useDrawer } from './Sidebar';

export function PageHeader({ title, subtitle, back, actions }: { title: string; subtitle?: string; back?: string | true; actions?: ReactNode }) {
  const nav = useNavigate();
  return (
    <header className="safe-top sticky top-0 z-30 border-b border-stone-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center gap-2 px-3 py-3">
        <button className="btn-ghost -ml-1 px-2 md:hidden" aria-label="Menu" onClick={() => useDrawer.setState({ open: true })}>
          <Menu size={20} />
        </button>
        {back && (
          <button className="btn-ghost -ml-1 px-2" aria-label="Back" onClick={() => (back === true ? nav(-1) : nav(back))}>
            <ArrowLeft size={20} />
          </button>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-bold leading-tight">{title}</h1>
          {subtitle && <p className="truncate text-xs text-stone-500">{subtitle}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <EditTools />
          {actions}
        </div>
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

const fmtNum = (v: number | null | undefined) => (v == null || Number.isNaN(v) ? '' : String(Math.round(v * 1000) / 1000));
const parseNum = (t: string) => {
  const c = t.replace(',', '.').trim();
  if (c === '' || c === '-' || c === '.' || c === '-.') return null;
  const n = Number(c);
  return Number.isFinite(n) ? n : null;
};

/**
 * Number box built for typing: while it has focus the text you type is never
 * overwritten or rebuilt into the design keystroke by keystroke. The value is
 * applied when you pause, press Enter or Tab, or leave the box; clearing it
 * leaves it empty until you type. Focus selects everything so typing replaces.
 * Up/Down arrows step (Shift ×10). The mouse wheel never changes it.
 */
function useNumText(value: number | null, commit: (n: number | null) => void, opts: { min?: number; max?: number; step?: number; nullable?: boolean; delay?: number }) {
  const [text, setText] = useState(fmtNum(value));
  const focused = useRef(false);
  const justFocused = useRef(false);
  const timer = useRef<number | undefined>(undefined);
  const last = useRef(value);
  useEffect(() => {
    last.current = value;
    if (!focused.current) setText(fmtNum(value));
  }, [value]);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const clamp = (n: number) => {
    if (opts.min != null) n = Math.max(opts.min, n);
    if (opts.max != null) n = Math.min(opts.max, n);
    return n;
  };
  const apply = (t: string, final: boolean) => {
    window.clearTimeout(timer.current);
    const n = parseNum(t);
    if (n == null) {
      if (!final) return;
      if (opts.nullable) {
        if (last.current != null) commit(null);
        setText('');
      } else setText(fmtNum(last.current));
      return;
    }
    // while typing, wait for a value that is already in range (typing 1200 passes 1, 12, 120)
    if (!final && ((opts.min != null && n < opts.min) || (opts.max != null && n > opts.max))) return;
    const v = clamp(n);
    if (v !== last.current) {
      last.current = v;
      commit(v);
    }
    if (final) setText(fmtNum(v));
  };
  const props = {
    type: 'text',
    inputMode: 'decimal' as const,
    autoComplete: 'off',
    value: text,
    onFocus: (e: FocusEvent<HTMLInputElement>) => {
      focused.current = true;
      justFocused.current = true;
      e.currentTarget.select();
    },
    // the click that focused the box would otherwise drop the selection again
    onMouseUp: (e: MouseEvent<HTMLInputElement>) => {
      if (justFocused.current) e.preventDefault();
      justFocused.current = false;
    },
    onChange: (e: ChangeEvent<HTMLInputElement>) => {
      const t = e.target.value.replace(/[^0-9.,-]/g, '');
      setText(t);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => apply(t, false), opts.delay ?? 700);
    },
    onBlur: () => {
      focused.current = false;
      apply(text, true);
    },
    onKeyDown: (e: RKeyboardEvent<HTMLInputElement>) => {
      if (['Enter', 'Escape', 'ArrowUp', 'ArrowDown'].includes(e.key)) e.stopPropagation();
      if (e.key === 'Enter') {
        apply(text, true);
        const el = e.currentTarget;
        requestAnimationFrame(() => el.select());
      }
      else if (e.key === 'Escape') {
        window.clearTimeout(timer.current);
        setText(fmtNum(last.current));
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
        const base = parseNum(text) ?? last.current ?? opts.min ?? 0;
        const st = (opts.step ?? 1) * (e.shiftKey ? 10 : 1) * (e.key === 'ArrowUp' ? 1 : -1);
        const v = clamp(Math.round((base + st) * 1000) / 1000);
        setText(fmtNum(v));
        last.current = v;
        commit(v);
      }
    },
  };
  return props;
}

export function NumInput({ value, onChange, min, max, step, suffix, className, placeholder }: { value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number; suffix?: string; className?: string; placeholder?: string }) {
  const props = useNumText(value, (n) => n != null && onChange(n), { min, max, step });
  return (
    <div className={`relative ${className ?? ''}`}>
      <input className="input pr-10" placeholder={placeholder} {...props} />
      {suffix && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-stone-400">{suffix}</span>}
    </div>
  );
}

/** Like NumInput, but an empty box means "automatic" (null). */
export function OptNumInput({ value, onChange, min, max, step, suffix, className, placeholder }: { value: number | null | undefined; onChange: (v: number | null) => void; min?: number; max?: number; step?: number; suffix?: string; className?: string; placeholder?: string }) {
  const props = useNumText(value ?? null, onChange, { min, max, step, nullable: true });
  return (
    <div className={`relative ${className ?? ''}`}>
      <input className="input pr-10" placeholder={placeholder} {...props} />
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
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div data-modal className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
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
