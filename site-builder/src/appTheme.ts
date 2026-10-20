import { useEffect, useState } from 'react';
import { contrastRatio, mix, readableOn } from './lib/color';
import { BRAND } from './brand/BrandLogo';

export interface Profile {
  id: string;
  name: string;
  /** Button / highlight fill. 'ink' = black on light, white on dark. */
  fill: string;
  /** Hue used for links, active states and focus rings. */
  color: string;
  accent: string;
}

/** Colour profiles built from the Think Different Visuals palette. */
export const PROFILES: Profile[] = [
  { id: 'signature', name: 'Signature', fill: BRAND.blue, color: BRAND.blue, accent: BRAND.orange },
  { id: 'sunrise', name: 'Sunrise', fill: BRAND.orange, color: BRAND.orange, accent: BRAND.blue },
  { id: 'midnight', name: 'Midnight', fill: BRAND.navy, color: BRAND.navy, accent: BRAND.orange },
  { id: 'noir', name: 'Noir', fill: 'ink', color: BRAND.blue, accent: BRAND.orange },
];

export type Mode = 'auto' | 'light' | 'dark';
export interface AppTheme {
  profile: string;
  mode: Mode;
}

const KEY = 'tdv-app-theme';
const PANEL = { light: '#ffffff', dark: '#0f1624' };
const INK = { light: '#111827', dark: '#f4f6fa' };

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
  return { profile: 'signature', mode: 'auto' };
}

const prefersDark = () => window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;

export function applyTheme(t: AppTheme) {
  const dark = t.mode === 'dark' || (t.mode === 'auto' && prefersDark());
  const scheme = dark ? 'dark' : 'light';
  const p = PROFILES.find((x) => x.id === t.profile) ?? PROFILES[0];
  const panel = PANEL[scheme];
  const root = document.documentElement;
  const fill = p.fill === 'ink' ? INK[scheme] : p.fill;
  // The brand navies are too dark to read as text on a dark UI; there, text highlights use the orange
  // instead of a lightened (off-brand) blue, while fills and tints stay navy.
  const hue = dark && contrastRatio(p.color, panel) < 3 ? p.accent : p.color;
  const vars: Record<string, string> = {
    '--brand': textSafe(hue, panel, dark),
    '--brand-fill': fill,
    '--brand-ink': readableOn(fill),
    '--brand-soft': mix(p.color, panel, dark ? 0.45 : 0.88),
    '--accent': p.accent,
    '--accent-text': textSafe(p.accent, panel, dark),
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
