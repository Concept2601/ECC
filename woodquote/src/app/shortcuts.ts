// Keyboard shortcuts. Every command has default keys that can be changed in
// Settings. Global commands (undo, save, new quotation…) always work; page
// commands (PDF, delete, next cabinet…) work on the pages that offer them.
import { useEffect, useRef } from 'react';
import { usePrefs } from './prefs';

export type ActionId =
  | 'undo' | 'redo' | 'save' | 'refresh' | 'newQuote' | 'newInvoice' | 'spaceFit' | 'help' | 'back'
  | 'goHome' | 'goQuotes' | 'goInvoices' | 'goPrices' | 'goSettings' | 'goReader'
  | 'pdf' | 'duplicate' | 'delete' | 'prev' | 'next' | 'moveLeft' | 'moveRight' | 'insert' | 'edit' | 'addUnit' | 'addKitchen' | 'room';

export interface ActionDef {
  id: ActionId;
  label: string;
  group: 'File' | 'Edit' | 'Go to' | 'On this page';
  keys: string[];
  /** Works only where a page provides it. */
  page?: boolean;
}

export const ACTIONS: ActionDef[] = [
  { id: 'newQuote', label: 'New quotation', group: 'File', keys: ['Ctrl+N'] },
  { id: 'newInvoice', label: 'New invoice', group: 'File', keys: ['Ctrl+Shift+N'] },
  { id: 'spaceFit', label: 'Measure a space (quick quote)', group: 'File', keys: ['Ctrl+M'] },
  { id: 'save', label: 'Save', group: 'File', keys: ['Ctrl+S'] },
  { id: 'pdf', label: 'PDF of this quotation / invoice', group: 'File', keys: ['Ctrl+P'], page: true },
  { id: 'refresh', label: 'Refresh (reload the app, keeps your work)', group: 'File', keys: ['F5', 'Ctrl+R'] },
  { id: 'undo', label: 'Undo', group: 'Edit', keys: ['Ctrl+Z'] },
  { id: 'redo', label: 'Redo', group: 'Edit', keys: ['Ctrl+Y', 'Ctrl+Shift+Z'] },
  { id: 'duplicate', label: 'Duplicate', group: 'Edit', keys: ['Ctrl+D'], page: true },
  { id: 'delete', label: 'Delete selected', group: 'Edit', keys: ['Delete'], page: true },
  { id: 'insert', label: 'Insert custom cabinet / space', group: 'Edit', keys: ['Insert', 'Ctrl+I'], page: true },
  { id: 'goHome', label: 'Home', group: 'Go to', keys: ['Ctrl+1'] },
  { id: 'goQuotes', label: 'Quotations', group: 'Go to', keys: ['Ctrl+2'] },
  { id: 'goInvoices', label: 'Invoices', group: 'Go to', keys: ['Ctrl+3'] },
  { id: 'goPrices', label: 'Prices & materials', group: 'Go to', keys: ['Ctrl+4'] },
  { id: 'goSettings', label: 'Settings', group: 'Go to', keys: ['Ctrl+,', 'Ctrl+5'] },
  { id: 'goReader', label: 'Diagram reader', group: 'Go to', keys: ['Ctrl+6'] },
  { id: 'back', label: 'Back', group: 'Go to', keys: ['Alt+ArrowLeft'] },
  { id: 'help', label: 'Keyboard shortcuts', group: 'Go to', keys: ['F1', 'Ctrl+/'] },
  { id: 'addUnit', label: 'Add unit to quotation', group: 'On this page', keys: ['Ctrl+U'], page: true },
  { id: 'addKitchen', label: 'Add kitchen to quotation', group: 'On this page', keys: ['Ctrl+K'], page: true },
  { id: 'room', label: 'Open room layout', group: 'On this page', keys: ['Ctrl+L'], page: true },
  { id: 'prev', label: 'Select previous cabinet / item', group: 'On this page', keys: ['ArrowLeft', 'Ctrl+['], page: true },
  { id: 'next', label: 'Select next cabinet / item', group: 'On this page', keys: ['ArrowRight', 'Ctrl+]'], page: true },
  { id: 'moveLeft', label: 'Move selected left', group: 'On this page', keys: ['Ctrl+ArrowLeft'], page: true },
  { id: 'moveRight', label: 'Move selected right', group: 'On this page', keys: ['Ctrl+ArrowRight'], page: true },
  { id: 'edit', label: 'Design / edit selected', group: 'On this page', keys: ['Enter', 'F2'], page: true },
];

export const actionKeys = (id: ActionId, custom = usePrefs.getState().shortcuts): string[] => custom[id] ?? ACTIONS.find((a) => a.id === id)?.keys ?? [];

/** "Ctrl+Shift+Z" style name for a key press (null for lone modifier keys). */
export function keyName(e: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'altKey' | 'shiftKey' | 'code'>): string | null {
  if (['Control', 'Shift', 'Alt', 'Meta', 'AltGraph', 'CapsLock'].includes(e.key)) return null;
  let k = e.key;
  if (k === ' ') k = 'Space';
  else if (k.length === 1) k = /^Digit\d$/.test(e.code) ? e.code.slice(5) : k.toUpperCase();
  if (k === 'Esc') k = 'Escape';
  const mods = [e.ctrlKey || e.metaKey ? 'Ctrl' : '', e.altKey ? 'Alt' : '', e.shiftKey && (k.length > 1 || /[A-Z0-9]/.test(k)) ? 'Shift' : ''].filter(Boolean);
  return [...mods, k].join('+');
}

/** Pretty label for showing a key combination. */
export const keyLabel = (k: string) => k.replace('ArrowLeft', '←').replace('ArrowRight', '→').replace('ArrowUp', '↑').replace('ArrowDown', '↓');

/* ------------------------------------------------------------ handlers */

type Handler = () => unknown;
type HandlerMap = Partial<Record<ActionId, Handler>>;
const layers: { map: React.MutableRefObject<HandlerMap> }[] = [];

/** Offer commands on the current page (the most recently mounted page wins). */
export function useShortcuts(map: HandlerMap) {
  const ref = useRef(map);
  ref.current = map;
  useEffect(() => {
    const layer = { map: ref };
    layers.push(layer);
    notify();
    return () => {
      layers.splice(layers.indexOf(layer), 1);
      notify();
    };
  }, []);
}

/** Like useShortcuts, but the page fills `ref.current` itself (handy after early returns). */
export function usePageShortcuts() {
  const ref = useRef<HandlerMap>({});
  useEffect(() => {
    const layer = { map: ref };
    layers.push(layer);
    notify();
    return () => {
      layers.splice(layers.indexOf(layer), 1);
      notify();
    };
  }, []);
  return ref;
}

/** Run a command: page handlers first, then the global one. Returns true if something handled it. */
export function runAction(id: ActionId): boolean {
  for (let i = layers.length - 1; i >= 0; i--) {
    const h = layers[i].map.current[id];
    if (h && h() !== false) return true;
  }
  return false;
}

export const pageHas = (id: ActionId) => layers.some((l) => !!l.map.current[id]);

const listeners = new Set<() => void>();
function notify() {
  listeners.forEach((f) => f());
}
export const onShortcutsChange = (f: () => void) => (listeners.add(f), () => void listeners.delete(f));

const isTyping = (t: EventTarget | null) => {
  const el = t as HTMLElement | null;
  if (!el) return false;
  if (el.isContentEditable) return true;
  const tag = el.tagName;
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (tag !== 'INPUT') return false;
  const type = (el as HTMLInputElement).type;
  return !['checkbox', 'radio', 'button', 'range', 'color', 'file', 'submit'].includes(type);
};

/** Install the window-wide key handler. `capturing` pauses it while a new key is being recorded in Settings. */
export const shortcutCapture = { active: false };
export function installKeyHandler() {
  const onKey = (e: KeyboardEvent) => {
    if (shortcutCapture.active || (e.repeat && !/Arrow/.test(e.key))) return;
    const name = keyName(e);
    if (!name) return;
    const custom = usePrefs.getState().shortcuts;
    const typing = isTyping(e.target);
    const hasMod = /^(Ctrl|Alt)\+/.test(name) || /^F\d+$/.test(name);
    // plain keys (Delete, arrows, Enter) belong to the text box while typing
    if (typing && !hasMod) return;
    // Enter on a focused button or link presses it
    const tag = (e.target as HTMLElement | null)?.tagName;
    if (!hasMod && (name === 'Enter' || name === 'Space') && (tag === 'BUTTON' || tag === 'A' || tag === 'SUMMARY')) return;
    // an open dialog keeps plain keys for itself
    if (!hasMod && document.querySelector('[data-modal]')) return;
    for (const a of ACTIONS) {
      if (!actionKeys(a.id, custom).includes(name)) continue;
      if (runAction(a.id)) {
        e.preventDefault();
        e.stopPropagation();
      }
      return;
    }
  };
  window.addEventListener('keydown', onKey, true);
  return () => window.removeEventListener('keydown', onKey, true);
}

/** Electron accelerator text for the Windows menu. */
export function toAccelerator(k: string): string {
  return k
    .split('+')
    .map((p) => (p === 'Ctrl' ? 'CmdOrCtrl' : p.startsWith('Arrow') ? p.slice(5) : p === '+' ? 'Plus' : p))
    .join('+');
}
