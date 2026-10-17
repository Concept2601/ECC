// Undo / redo for everything the user edits (quotes, invoices, prices,
// settings). Every store update replaces the changed objects instead of
// mutating them, so a snapshot is just the set of references at that moment.
import { create } from 'zustand';
import { useStore, type AppData } from '../store';

const LIMIT = 150;
/** Edits closer together than this (typing, dragging) undo as one step. */
const GROUP_MS = 800;

const pick = (s: AppData): AppData => ({ settings: s.settings, catalog: s.catalog, quotes: s.quotes, invoices: s.invoices, counters: s.counters });
const changed = (a: AppData, b: AppData) => a.settings !== b.settings || a.catalog !== b.catalog || a.quotes !== b.quotes || a.invoices !== b.invoices || a.counters !== b.counters;

interface HistoryState {
  past: AppData[];
  future: AppData[];
  canUndo: boolean;
  canRedo: boolean;
  undo: () => boolean;
  redo: () => boolean;
  clear: () => void;
}

let applying = false;
let lastPush = 0;

export const useHistory = create<HistoryState>()((set, get) => ({
  past: [],
  future: [],
  canUndo: false,
  canRedo: false,
  undo: () => {
    const { past, future } = get();
    const prev = past[past.length - 1];
    if (!prev) return false;
    const now = pick(useStore.getState());
    applying = true;
    useStore.setState(prev);
    applying = false;
    lastPush = 0;
    const p = past.slice(0, -1);
    const f = [...future, now];
    set({ past: p, future: f, canUndo: p.length > 0, canRedo: true });
    return true;
  },
  redo: () => {
    const { past, future } = get();
    const next = future[future.length - 1];
    if (!next) return false;
    const now = pick(useStore.getState());
    applying = true;
    useStore.setState(next);
    applying = false;
    lastPush = 0;
    const p = [...past, now];
    const f = future.slice(0, -1);
    set({ past: p, future: f, canUndo: true, canRedo: f.length > 0 });
    return true;
  },
  clear: () => set({ past: [], future: [], canUndo: false, canRedo: false }),
}));

/** Start recording edits (call once, after the saved data has loaded). */
export function startHistory() {
  // each click or tap starts a new undo step; typing and dragging group up
  window.addEventListener('pointerdown', breakUndoGroup, true);
  return useStore.subscribe((state, prev) => {
    if (applying || !state.hydrated || !prev.hydrated) return;
    if (!changed(state, prev)) return;
    const now = Date.now();
    const h = useHistory.getState();
    // a burst of edits keeps the snapshot from before the burst
    if (now - lastPush < GROUP_MS && h.past.length) {
      lastPush = now;
      if (h.future.length) useHistory.setState({ future: [], canRedo: false });
      return;
    }
    lastPush = now;
    const past = [...h.past, pick(prev)].slice(-LIMIT);
    useHistory.setState({ past, future: [], canUndo: true, canRedo: false });
  });
}

/** Force the next edit to start a new undo step (e.g. after a button press). */
export const breakUndoGroup = () => {
  lastPush = 0;
};
