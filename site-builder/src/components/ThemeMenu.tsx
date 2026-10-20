import { useEffect, useRef, useState } from 'react';
import { PROFILES, useAppTheme, type Mode } from '../appTheme';
import { Segmented } from './ui';

/** Topbar control for the studio's colour profile and light / dark mode. */
export function ThemeMenu() {
  const [theme, setTheme] = useAppTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', close);
    };
  }, [open]);

  return (
    <div className="theme-menu" ref={ref}>
      <button className="icon-btn" aria-label="Colour profile" aria-expanded={open} title="Colour profile" onClick={() => setOpen(!open)}>
        <span className="profile-dot" />
      </button>
      {open && (
        <div className="theme-pop" role="dialog" aria-label="Colour profile">
          <p className="field-label">Colour profile</p>
          <div className="profile-grid" role="radiogroup">
            {PROFILES.map((p) => (
              <button key={p.id} role="radio" aria-checked={theme.profile === p.id} className={`profile${theme.profile === p.id ? ' on' : ''}`} onClick={() => setTheme({ ...theme, profile: p.id })}>
                <span className="profile-dot lg" style={{ background: `linear-gradient(135deg, ${p.fill === 'ink' ? '#111827' : p.fill} 0 58%, ${p.accent} 58%)` }} />
                {p.name}
              </button>
            ))}
          </div>
          <Segmented<Mode> label="Appearance" value={theme.mode} onChange={(mode) => setTheme({ ...theme, mode })} options={[{ value: 'auto', label: 'Auto' }, { value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }]} />
        </div>
      )}
    </div>
  );
}
