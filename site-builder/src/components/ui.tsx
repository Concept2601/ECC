import { useEffect, useId, useRef, type ReactNode } from 'react';
import type { Check } from '../lib/audits';

export function Field({ label, hint, children, wide }: { label: string; hint?: ReactNode; children: ReactNode; wide?: boolean }) {
  return (
    <label className={`field${wide ? ' wide' : ''}`}>
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="hint">{hint}</span>}
    </label>
  );
}

export function Text({ label, value, onChange, hint, placeholder, type = 'text', maxLength, counter, wide }: {
  label: string;
  value: string | undefined;
  onChange: (v: string) => void;
  hint?: ReactNode;
  placeholder?: string;
  type?: string;
  maxLength?: number;
  counter?: [number, number];
  wide?: boolean;
}) {
  const len = (value ?? '').length;
  const c = counter ? (len >= counter[0] && len <= counter[1] ? 'ok' : len === 0 ? '' : 'warn') : '';
  return (
    <Field label={label} wide={wide} hint={<>{hint}{counter && <span className={`counter ${c}`}>{len} / {counter[0]}–{counter[1]}</span>}</>}>
      <input type={type} value={value ?? ''} placeholder={placeholder} maxLength={maxLength} onChange={(e) => onChange(e.target.value)} />
    </Field>
  );
}

export function Area({ label, value, onChange, hint, rows = 3, placeholder, mono, counter }: {
  label: string;
  value: string | undefined;
  onChange: (v: string) => void;
  hint?: ReactNode;
  rows?: number;
  placeholder?: string;
  mono?: boolean;
  counter?: [number, number];
}) {
  const len = (value ?? '').length;
  const c = counter ? (len >= counter[0] && len <= counter[1] ? 'ok' : len === 0 ? '' : 'warn') : '';
  return (
    <Field label={label} wide hint={<>{hint}{counter && <span className={`counter ${c}`}>{len} / {counter[0]}–{counter[1]}</span>}</>}>
      <textarea className={mono ? 'mono' : ''} rows={rows} value={value ?? ''} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </Field>
  );
}

export function Select<T extends string | number>({ label, value, options, onChange, hint }: {
  label: string;
  value: T;
  options: { value: T; label: string }[] | readonly T[];
  onChange: (v: T) => void;
  hint?: ReactNode;
}) {
  const opts = (options as unknown[]).map((o) => (typeof o === 'object' ? (o as { value: T; label: string }) : { value: o as T, label: String(o) }));
  return (
    <Field label={label} hint={hint}>
      <select value={String(value)} onChange={(e) => onChange(opts.find((o) => String(o.value) === e.target.value)!.value)}>
        {opts.map((o) => (
          <option key={String(o.value)} value={String(o.value)}>{o.label}</option>
        ))}
      </select>
    </Field>
  );
}

export function Toggle({ label, checked, onChange, hint }: { label: string; checked: boolean; onChange: (v: boolean) => void; hint?: ReactNode }) {
  const id = useId();
  return (
    <div className="toggle-row">
      <div>
        <label htmlFor={id} className="field-label">{label}</label>
        {hint && <p className="hint">{hint}</p>}
      </div>
      <button id={id} type="button" role="switch" aria-checked={checked} className={`switch${checked ? ' on' : ''}`} onClick={() => onChange(!checked)}>
        <span />
      </button>
    </div>
  );
}

export function Color({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <Field label={label}>
      <span className="color">
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} aria-label={`${label} picker`} />
        <input value={value} onChange={(e) => /^#[0-9a-f]{0,6}$/i.test(e.target.value) && onChange(e.target.value)} spellCheck={false} />
      </span>
    </Field>
  );
}

export function Segmented<T extends string | number>({ value, options, onChange, label }: {
  value: T;
  options: { value: T; label: ReactNode; title?: string }[];
  onChange: (v: T) => void;
  label?: string;
}) {
  return (
    <div className="field">
      {label && <span className="field-label">{label}</span>}
      <div className="segmented" role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <button key={String(o.value)} type="button" role="radio" aria-checked={o.value === value} title={o.title} className={o.value === value ? 'on' : ''} onClick={() => onChange(o.value)}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function Card({ title, subtitle, children, actions, className }: { title?: ReactNode; subtitle?: ReactNode; children: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <section className={`card ${className ?? ''}`}>
      {(title || actions) && (
        <header className="card-head">
          <div>
            {title && <h3>{title}</h3>}
            {subtitle && <p className="muted">{subtitle}</p>}
          </div>
          {actions && <div className="row">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

export function PageHead({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="page-head">
      <div>
        <h1>{title}</h1>
        {subtitle && <p className="muted">{subtitle}</p>}
      </div>
      {actions && <div className="row">{actions}</div>}
    </header>
  );
}

export function Score({ value, label, size = 88 }: { value: number; label?: string; size?: number }) {
  const r = size / 2 - 7;
  const c = 2 * Math.PI * r;
  const tone = value >= 90 ? 'good' : value >= 60 ? 'ok' : 'bad';
  return (
    <div className={`score ${tone}`} style={{ width: size }} role="img" aria-label={`${label ?? 'Score'}: ${value} out of 100`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} className="track" />
        <circle cx={size / 2} cy={size / 2} r={r} className="bar" strokeDasharray={c} strokeDashoffset={c * (1 - value / 100)} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      </svg>
      <span className="score-num">{value}</span>
      {label && <span className="score-label">{label}</span>}
    </div>
  );
}

const ICON: Record<Check['status'], string> = { pass: '✓', warn: '!', fail: '✕' };

export function Checks({ checks, onFix }: { checks: Check[]; onFix?: (tab: string) => void }) {
  const order = { fail: 0, warn: 1, pass: 2 };
  return (
    <ul className="checks">
      {[...checks].sort((a, b) => order[a.status] - order[b.status]).map((c) => (
        <li key={c.id} className={c.status}>
          <span className="check-icon" aria-label={c.status}>{ICON[c.status]}</span>
          <div>
            <strong>{c.label}</strong>
            <p>{c.detail}</p>
          </div>
          {c.status !== 'pass' && c.fix && onFix && (
            <button className="btn sm ghost" onClick={() => onFix(c.fix!)}>Fix</button>
          )}
        </li>
      ))}
    </ul>
  );
}

export function Modal({ title, onClose, children, wide, footer }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean; footer?: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  // Keep the latest onClose without re-running focus handling on every render.
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeRef.current();
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      prev?.focus();
    };
  }, []);
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal${wide ? ' wide' : ''}`} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={ref}>
        <header className="modal-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">✕</button>
        </header>
        <div className="modal-body">{children}</div>
        {footer && <footer className="modal-foot">{footer}</footer>}
      </div>
    </div>
  );
}

export function Empty({ icon, title, children }: { icon: string; title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <div className="empty-icon" aria-hidden="true">{icon}</div>
      <h3>{title}</h3>
      {children}
    </div>
  );
}

export function Badge({ tone = 'neutral', children }: { tone?: 'neutral' | 'good' | 'warn' | 'bad' | 'info'; children: ReactNode }) {
  return <span className={`badge ${tone}`}>{children}</span>;
}
