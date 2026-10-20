import { useEffect, useState } from 'react';
import { contrastRatio, mix, readableOn } from './lib/color';

/** The six-colour "Think Different" spectrum, in stripe order. */
export const SPECTRUM = ['#61BB46', '#FDB827', '#F5821F', '#E03A3E', '#963D97', '#009DDC'] as const;

export interface Profile {
  id: string;
  name: string;
  color: string;
}

export const PROFILES: Profile[] = [
  { id: 'spectrum', name: 'Spectrum', color: '#009DDC' },
  { id: 'green', name: 'Green', color: SPECTRUM[0] },
  { id: 'yellow', name: 'Yellow', color: SPECTRUM[1] },
  { id: 'orange', name: 'Orange', color: SPECTRUM[2] },
  { id: 'red', name: 'Red', color: SPECTRUM[3] },
  { id: 'purple', name: 'Purple', color: SPECTRUM[4] },
  { id: 'blue', name: 'Blue', color: SPECTRUM[5] },
];

export type Mode = 'auto' | 'light' | 'dark';
export interface AppTheme {
  profile: string;
  mode: Mode;
}

const KEY = 'launchpad-app-theme';
const PANEL = { light: '#ffffff', dark: '#161618' };
const INK = { light: '#1d1d1f', dark: '#f5f5f7' };

/** Darken (light mode) or lighten (dark mode) until the colour is readable as text. */
function textSafe(color: string, against: string, dark: boolean) {
  let c = color;
  for (let i = 1; i <= 10 && contrastRatio(c, against) < 4.5; i++) c = mix(color, dark ? '#ffffff' : '#000000', i * 0.08);
  return c;
}

export function loadTheme(): AppTheme {
  try {
    const t = JSON.parse(localStorage.getItem(KEY) ?? '');
    if (PROFILES.some((p) => p.id === t.profile) && ['auto', 'light', 'dark'].includes(t.mode)) return t;
  } catch {
    // first visit, or storage unavailable
  }
  return { profile: 'spectrum', mode: 'auto' };
}

const prefersDark = () => window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;

export function applyTheme(t: AppTheme) {
  const dark = t.mode === 'dark' || (t.mode === 'auto' && prefersDark());
  const scheme = dark ? 'dark' : 'light';
  const p = PROFILES.find((x) => x.id === t.profile) ?? PROFILES[0];
  const panel = PANEL[scheme];
  const root = document.documentElement;
  // Spectrum keeps buttons monochrome (black on light, white on dark) and lets the rainbow do the talking.
  const fill = t.profile === 'spectrum' ? INK[scheme] : p.color;
  const vars: Record<string, string> = {
    '--brand': textSafe(p.color, panel, dark),
    '--brand-fill': fill,
    '--brand-ink': readableOn(fill),
    '--brand-soft': mix(p.color, panel, dark ? 0.8 : 0.88),
    '--accent': t.profile === 'spectrum' ? SPECTRUM[1] : p.color,
  };
  for (const [k, v] of Object.entries(vars)) root.style.setProperty(k, v);
  root.dataset.mode = scheme;
  root.dataset.profile = p.id;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#000000' : '#ffffff');
}

export function useAppTheme() {
  const [theme, setTheme] = useState(loadTheme);
  useEffect(() => {
    applyTheme(theme);
    try {
      localStorage.setItem(KEY, JSON.stringify(theme));
    } catch {
      // storage unavailable — theme still applies for this session
    }
    if (theme.mode !== 'auto') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const on = () => applyTheme(theme);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [theme]);
  return [theme, setTheme] as const;
}
