// Save points: Save (Ctrl+S) and auto-save keep restorable copies of all
// quotes, invoices, prices and settings. Edits are also kept as you work, so
// nothing is lost if the app closes; save points let you go back in time.
import { del, get, set } from 'idb-keyval';
import { create } from 'zustand';
import { exportData, useStore, type AppData } from '../store';
import { usePrefs } from './prefs';

export interface SavePoint {
  id: string;
  at: number;
  kind: 'manual' | 'auto';
  label: string;
  quotes: number;
  invoices: number;
}

const KEY = 'woodquote-savepoints';
const dataKey = (id: string) => `woodquote-save-${id}`;

interface SaveState {
  points: SavePoint[];
  lastSavedAt: number | null;
  dirty: boolean;
  saving: boolean;
  message: string | null;
}

export const useSaves = create<SaveState>()(() => ({ points: [], lastSavedAt: null, dirty: false, saving: false, message: null }));

let loaded = false;
async function loadIndex() {
  if (loaded) return;
  loaded = true;
  try {
    const points = ((await get<SavePoint[]>(KEY)) ?? []).sort((a, b) => b.at - a.at);
    useSaves.setState({ points, lastSavedAt: points[0]?.at ?? null });
  } catch {
    /* storage unavailable */
  }
}

const stamp = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}_${String(d.getHours()).padStart(2, '0')}-${String(d.getMinutes()).padStart(2, '0')}`;

/** Save everything as a new save point. */
export async function saveNow(kind: 'manual' | 'auto' = 'manual', label?: string): Promise<SavePoint | null> {
  await loadIndex();
  if (useSaves.getState().saving) return null;
  useSaves.setState({ saving: true });
  try {
    const data = exportData();
    const at = Date.now();
    const p: SavePoint = { id: String(at), at, kind, label: label ?? (kind === 'auto' ? 'Auto-save' : 'Saved'), quotes: data.quotes.length, invoices: data.invoices.length };
    const json = JSON.stringify({ app: 'WoodQuote', version: 1, exportedAt: new Date(at).toISOString(), data });
    await set(dataKey(p.id), json);
    let points = [p, ...useSaves.getState().points];
    // keep the newest automatic saves and up to 30 manual ones
    const keepAuto = Math.max(1, usePrefs.getState().keepAutoSaves);
    const autos = points.filter((x) => x.kind === 'auto');
    const manuals = points.filter((x) => x.kind === 'manual');
    const drop = [...autos.slice(keepAuto), ...manuals.slice(30)];
    for (const d of drop) await del(dataKey(d.id));
    points = points.filter((x) => !drop.includes(x));
    await set(KEY, points);
    let message = kind === 'auto' ? 'Auto-saved' : 'Saved';
    if (window.woodquoteDesktop?.saveBackup && usePrefs.getState().backupFiles) {
      try {
        const file = await window.woodquoteDesktop.saveBackup(`WoodQuote-${stamp(new Date(at))}${kind === 'auto' ? '-auto' : ''}.json`, json);
        message += ` · ${file}`;
      } catch {
        /* file backup is a bonus */
      }
    }
    useSaves.setState({ points, lastSavedAt: at, dirty: false, message });
    return p;
  } finally {
    useSaves.setState({ saving: false });
  }
}

/** Put a save point back (this can itself be undone). */
export async function restoreSave(id: string): Promise<boolean> {
  const json = await get<string>(dataKey(id));
  if (!json) return false;
  const parsed = JSON.parse(json) as { data: AppData };
  useStore.getState().importData(parsed.data);
  return true;
}

export async function deleteSave(id: string) {
  await del(dataKey(id));
  const points = useSaves.getState().points.filter((p) => p.id !== id);
  await set(KEY, points);
  useSaves.setState({ points });
}

export async function savePointJson(id: string) {
  return get<string>(dataKey(id));
}

/** Track unsaved changes and run auto-save on the chosen interval. */
export function startSaving() {
  void loadIndex();
  const unsub = useStore.subscribe((s, prev) => {
    if (!s.hydrated || !prev.hydrated) return;
    if (s.quotes !== prev.quotes || s.invoices !== prev.invoices || s.catalog !== prev.catalog || s.settings !== prev.settings || s.counters !== prev.counters) {
      if (!useSaves.getState().dirty) useSaves.setState({ dirty: true });
    }
  });
  let timer: ReturnType<typeof setInterval> | null = null;
  const arm = () => {
    if (timer) clearInterval(timer);
    timer = null;
    const mins = usePrefs.getState().autoSaveMinutes;
    if (mins > 0) timer = setInterval(() => useSaves.getState().dirty && void saveNow('auto'), mins * 60_000);
  };
  arm();
  const unsubPrefs = usePrefs.subscribe((p, prev) => p.autoSaveMinutes !== prev.autoSaveMinutes && arm());
  return () => {
    unsub();
    unsubPrefs();
    if (timer) clearInterval(timer);
  };
}
