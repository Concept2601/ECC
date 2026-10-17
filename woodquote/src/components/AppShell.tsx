// App-wide behaviour: keyboard shortcuts, undo history, save / auto-save,
// the shortcut help sheet and the Windows menu bar.
import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { startHistory, useHistory } from '../app/history';
import { usePrefs } from '../app/prefs';
import { saveNow, startSaving, useSaves } from '../app/savepoints';
import { ACTIONS, actionKeys, installKeyHandler, keyLabel, runAction, toAccelerator, useShortcuts, type ActionId } from '../app/shortcuts';
import { useStore } from '../store';
import { Modal } from './ui';

let started = false;

/** Reload the whole app. Work is already stored, so nothing is lost; give the last write a moment to land. */
export function refreshApp() {
  setTimeout(() => window.location.reload(), 150);
}

export function ShortcutHelp({ open, onClose }: { open: boolean; onClose: () => void }) {
  const custom = usePrefs((s) => s.shortcuts);
  const { pathname } = useLocation();
  // each page opens at the top
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  const groups = [...new Set(ACTIONS.map((a) => a.group))];
  return (
    <Modal open={open} onClose={onClose} title="Keyboard shortcuts">
      <div className="space-y-4">
        {groups.map((g) => (
          <div key={g}>
            <h4 className="label">{g}</h4>
            <div className="divide-y divide-stone-100 rounded-xl border border-stone-200">
              {ACTIONS.filter((a) => a.group === g).map((a) => (
                <div key={a.id} className="flex items-center justify-between gap-3 px-3 py-1.5 text-sm">
                  <span>{a.label}</span>
                  <span className="flex flex-wrap justify-end gap-1">
                    {actionKeys(a.id, custom).map((k) => (
                      <kbd key={k} className="rounded-md border border-stone-300 bg-stone-50 px-1.5 py-0.5 font-mono text-[11px]">
                        {keyLabel(k)}
                      </kbd>
                    ))}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
        <p className="text-xs text-stone-500">Change any of these in Settings › Keyboard shortcuts. Esc closes dialogs.</p>
      </div>
    </Modal>
  );
}

function Toast() {
  const message = useSaves((s) => s.message);
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => useSaves.setState({ message: null }), 2500);
    return () => clearTimeout(t);
  }, [message]);
  if (!message) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex justify-center px-4" role="status">
      <div className="max-w-md truncate rounded-xl bg-stone-900/90 px-4 py-2 text-sm text-white shadow-lg">{message}</div>
    </div>
  );
}

export default function AppShell() {
  const nav = useNavigate();
  const [help, setHelp] = useState(false);
  const custom = usePrefs((s) => s.shortcuts);

  useEffect(() => {
    if (started) return;
    started = true;
    startHistory();
    startSaving();
    installKeyHandler();
  }, []);

  useShortcuts({
    undo: () => useHistory.getState().undo(),
    redo: () => useHistory.getState().redo(),
    save: () => void saveNow('manual'),
    refresh: () => refreshApp(),
    newQuote: () => nav(`/quotes/${useStore.getState().createQuote()}`),
    newInvoice: () => nav('/invoices?new=1'),
    spaceFit: () => nav('/fit'),
    help: () => setHelp(true),
    back: () => nav(-1),
    goHome: () => nav('/'),
    goQuotes: () => nav('/quotes'),
    goInvoices: () => nav('/invoices'),
    goPrices: () => nav('/settings/materials'),
    goSettings: () => nav('/settings'),
    goReader: () => nav('/reader'),
  });

  // Windows app: menu bar with the same commands and keys
  useEffect(() => {
    const d = window.woodquoteDesktop;
    if (!d?.setMenu) return;
    d.setMenu(ACTIONS.map((a) => ({ id: a.id, label: a.label, group: a.group, accelerator: actionKeys(a.id, custom)[0] ? toAccelerator(actionKeys(a.id, custom)[0]) : undefined })));
  }, [custom]);
  useEffect(() => {
    window.woodquoteDesktop?.onCommand?.((id) => {
      if (id === 'help') setHelp(true);
      else runAction(id as ActionId);
    });
  }, []);

  return (
    <>
      <ShortcutHelp open={help} onClose={() => setHelp(false)} />
      <Toast />
    </>
  );
}
