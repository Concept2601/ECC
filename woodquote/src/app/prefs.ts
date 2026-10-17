// Per-device preferences: auto-save interval and keyboard shortcuts. Kept out
// of the quote data so they are not undone, exported or restored with backups.
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export interface Prefs {
  /** Minutes between automatic save points; 0 = off. */
  autoSaveMinutes: number;
  /** How many automatic save points to keep. */
  keepAutoSaves: number;
  /** Also write each save to Documents\WoodQuote\Backups (Windows app). */
  backupFiles: boolean;
  /** 3D render quality: how much of the graphics card and screen resolution to use. */
  renderQuality: RenderQuality;
  /** Custom key bindings by action id (missing = default keys). */
  shortcuts: Record<string, string[]>;
}

export type RenderQuality = 'saver' | 'balanced' | 'high' | 'max';
export const RENDER_QUALITY: Record<RenderQuality, { label: string; note: string; pixelRatio: number; antialias: boolean; shadows: number; gpu: 'low-power' | 'default' | 'high-performance' }> = {
  saver: { label: 'Phone / battery saver', note: 'Lighter 3D, no shadows — recommended for Android phones', pixelRatio: 1, antialias: false, shadows: 0, gpu: 'low-power' },
  balanced: { label: 'Balanced', note: 'Good looks, smooth on newer phones and most laptops', pixelRatio: 1.5, antialias: true, shadows: 1024, gpu: 'default' },
  high: { label: 'High', note: 'Full screen resolution, uses the main graphics card', pixelRatio: 2, antialias: true, shadows: 2048, gpu: 'high-performance' },
  max: { label: 'Maximum', note: 'Highest detail and shadows — needs a dedicated graphics card', pixelRatio: 3, antialias: true, shadows: 4096, gpu: 'high-performance' },
};

export const AUTOSAVE_CHOICES = [0, 1, 2, 5, 10, 15, 30];

/** Phones get the light setting (heavy 3D made some Android phones close the app). */
function defaultQuality(): RenderQuality {
  if (typeof window === 'undefined') return 'balanced';
  if (window.woodquoteDesktop) return 'high';
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4;
  if (/Android|iPhone|iPad/i.test(navigator.userAgent)) return mem >= 8 ? 'balanced' : 'saver';
  return window.innerWidth >= 1024 ? 'high' : 'balanced';
}

const safeStorage = createJSONStorage(() => {
  try {
    return window.localStorage;
  } catch {
    const mem = new Map<string, string>();
    return { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v), removeItem: (k: string) => void mem.delete(k) };
  }
});

export const usePrefs = create<Prefs & { set: (p: Partial<Prefs>) => void }>()(
  persist(
    (set) => ({
      autoSaveMinutes: 5,
      keepAutoSaves: 20,
      backupFiles: true,
      renderQuality: defaultQuality(),
      shortcuts: {},
      set: (p) => set(p),
    }),
    { name: 'woodquote-prefs', storage: safeStorage, partialize: ({ set: _s, ...rest }) => rest },
  ),
);
