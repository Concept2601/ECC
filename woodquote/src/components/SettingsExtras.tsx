// Settings cards for saving, keyboard shortcuts and performance.
import { Cpu, Download, History, Keyboard, RefreshCw, RotateCcw, Save, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useHistory } from '../app/history';
import { AUTOSAVE_CHOICES, RENDER_QUALITY, usePrefs, type RenderQuality } from '../app/prefs';
import { deleteSave, restoreSave, saveNow, savePointJson, useSaves } from '../app/savepoints';
import { ACTIONS, actionKeys, keyLabel, keyName, shortcutCapture, type ActionId } from '../app/shortcuts';
import { shareTextFile } from '../pdf/pdf';
import { refreshApp } from './AppShell';
import { Card, confirmAction, Field, NumInput, Toggle } from './ui';

const when = (t: number) => new Date(t).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

export function SavingCard() {
  const prefs = usePrefs();
  const { points, lastSavedAt, dirty, saving } = useSaves();
  const { past, future, clear } = useHistory();
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <Card title="Save & auto-save">
        <div className="space-y-3 text-sm">
          <p className="text-stone-600">
            Every change is kept on this device as you work. <b>Save</b> (Ctrl+S) also makes a save point you can go back to, and auto-save makes one on a timer while there are changes.
            {window.woodquoteDesktop ? ' On this PC each save is also written to Documents\\En-Quote\\Backups.' : ''}
          </p>
          <div className="flex items-center gap-2">
            <button className="btn-primary" disabled={saving} onClick={() => void saveNow('manual')}>
              <Save size={16} /> Save now
            </button>
            <span className="text-xs text-stone-500">{dirty ? 'Unsaved changes' : lastSavedAt ? `Last saved ${when(lastSavedAt)}` : 'Not saved yet'}</span>
          </div>
          <Field label="Auto-save every">
            <select className="input" value={prefs.autoSaveMinutes} onChange={(e) => prefs.set({ autoSaveMinutes: Number(e.target.value) })}>
              {AUTOSAVE_CHOICES.map((m) => (
                <option key={m} value={m}>
                  {m === 0 ? 'Off' : m === 1 ? '1 minute' : `${m} minutes`}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Custom interval (minutes)">
            <NumInput min={0} max={240} suffix="min" value={prefs.autoSaveMinutes} onChange={(v) => prefs.set({ autoSaveMinutes: v })} />
          </Field>
          <Field label="Automatic save points to keep">
            <NumInput min={1} max={200} step={1} value={prefs.keepAutoSaves} onChange={(v) => prefs.set({ keepAutoSaves: Math.round(v) })} />
          </Field>
          {window.woodquoteDesktop && <Toggle label="Also write backup files on this PC" checked={prefs.backupFiles} onChange={(v) => prefs.set({ backupFiles: v })} />}
          <div className="rounded-xl bg-stone-50 p-3 text-xs text-stone-600">
            <History size={14} className="mr-1 inline" /> Undo history: {past.length} step{past.length === 1 ? '' : 's'} back, {future.length} forward.{' '}
            <button className="font-semibold text-brand-700" onClick={clear}>
              Clear
            </button>
          </div>
        </div>
      </Card>
      <Card title={`Save points (${points.length})`}>
        <div className="max-h-[420px] space-y-1 overflow-y-auto">
          {points.map((p) => (
            <div key={p.id} className="flex items-center gap-2 rounded-xl border border-stone-200 px-3 py-2 text-sm">
              <div className="min-w-0 flex-1">
                <div className="font-semibold">
                  {p.label} <span className={`chip ${p.kind === 'auto' ? 'bg-stone-100 text-stone-600' : 'bg-emerald-100 text-emerald-800'}`}>{p.kind}</span>
                </div>
                <div className="text-xs text-stone-500">
                  {when(p.at)} · {p.quotes} quotes · {p.invoices} invoices
                </div>
              </div>
              <button className="btn-secondary px-2 py-1 text-xs" title="Go back to this save (can be undone)" onClick={async () => confirmAction(`Restore everything to ${when(p.at)}? You can undo this.`) && (await restoreSave(p.id))}>
                <RotateCcw size={14} /> Restore
              </button>
              <button className="btn-ghost px-2" aria-label="Export this save" onClick={async () => { const j = await savePointJson(p.id); if (j) await shareTextFile(`woodquote-save-${p.id}.json`, j, 'application/json'); }}>
                <Download size={14} />
              </button>
              <button className="btn-ghost px-2 text-red-600" aria-label="Delete this save" onClick={() => confirmAction('Delete this save point?') && void deleteSave(p.id)}>
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          {!points.length && <p className="p-4 text-center text-sm text-stone-500">No save points yet. Press Save or Ctrl+S.</p>}
        </div>
      </Card>
    </div>
  );
}

export function ShortcutsCard() {
  const shortcuts = usePrefs((s) => s.shortcuts);
  const set = usePrefs((s) => s.set);
  const [recording, setRecording] = useState<ActionId | null>(null);
  useEffect(() => {
    if (!recording) return;
    shortcutCapture.active = true;
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.key === 'Escape') return setRecording(null);
      const k = keyName(e);
      if (!k) return;
      set({ shortcuts: { ...usePrefs.getState().shortcuts, [recording]: [k] } });
      setRecording(null);
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      shortcutCapture.active = false;
      window.removeEventListener('keydown', onKey, true);
    };
  }, [recording, set]);
  const used = new Map<string, ActionId[]>();
  for (const a of ACTIONS) for (const k of actionKeys(a.id, shortcuts)) used.set(k, [...(used.get(k) ?? []), a.id]);
  const groups = [...new Set(ACTIONS.map((a) => a.group))];
  return (
    <Card
      title="Keyboard shortcuts"
      actions={
        <button className="btn-secondary px-3 py-1.5 text-xs" onClick={() => confirmAction('Put every shortcut back to its default key?') && set({ shortcuts: {} })}>
          <RotateCcw size={14} /> Reset all
        </button>
      }
    >
      <p className="mb-3 text-sm text-stone-600">
        <Keyboard size={14} className="mr-1 inline" /> Click <b>Change</b> and press the new key combination (Esc cancels). Shortcuts also appear in the Windows menu bar. Ctrl means ⌘ on a Mac.
      </p>
      <div className="space-y-4">
        {groups.map((g) => (
          <div key={g}>
            <h4 className="label">{g}</h4>
            <div className="divide-y divide-stone-100 rounded-xl border border-stone-200">
              {ACTIONS.filter((a) => a.group === g).map((a) => {
                const keys = actionKeys(a.id, shortcuts);
                const clash = keys.some((k) => (used.get(k)?.length ?? 0) > 1);
                return (
                  <div key={a.id} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
                    <span className="min-w-0 flex-1">
                      {a.label}
                      {a.page && <span className="ml-1 text-[11px] text-stone-400">(on pages that offer it)</span>}
                    </span>
                    {recording === a.id ? (
                      <span className="animate-pulse rounded-md bg-brand-100 px-2 py-0.5 text-xs font-semibold text-brand-800">Press keys…</span>
                    ) : (
                      keys.map((k) => (
                        <kbd key={k} className={`rounded-md border px-1.5 py-0.5 font-mono text-[11px] ${clash ? 'border-red-400 bg-red-50 text-red-700' : 'border-stone-300 bg-stone-50'}`}>
                          {keyLabel(k)}
                        </kbd>
                      ))
                    )}
                    <button className="btn-secondary px-2 py-1 text-xs" onClick={() => setRecording(recording === a.id ? null : a.id)}>
                      {recording === a.id ? 'Cancel' : 'Change'}
                    </button>
                    {shortcuts[a.id] && (
                      <button className="btn-ghost px-2 py-1 text-xs" onClick={() => { const n = { ...shortcuts }; delete n[a.id]; set({ shortcuts: n }); }}>
                        Default
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function webglInfo(): string {
  try {
    const gl = document.createElement('canvas').getContext('webgl2') ?? document.createElement('canvas').getContext('webgl');
    if (!gl) return 'Not available';
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    return String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
  } catch {
    return 'Not available';
  }
}

export function PerformanceCard() {
  const quality = usePrefs((s) => s.renderQuality);
  const set = usePrefs((s) => s.set);
  const [sys, setSys] = useState<Awaited<ReturnType<NonNullable<NonNullable<Window['woodquoteDesktop']>['systemInfo']>>> | null>(null);
  const [gpu] = useState(webglInfo);
  useEffect(() => {
    window.woodquoteDesktop?.systemInfo?.().then(setSys).catch(() => undefined);
  }, []);
  const nav = navigator as Navigator & { deviceMemory?: number };
  const mem = (performance as Performance & { memory?: { usedJSHeapSize: number; jsHeapSizeLimit: number } }).memory;
  const rows: [string, string][] = [
    ['Graphics (WebGL)', gpu],
    ['Processor', sys ? `${sys.cpu} · ${sys.cores} threads` : `${nav.hardwareConcurrency ?? '?'} threads`],
    ['Memory', sys ? `${(sys.ramMb / 1024).toFixed(1)} GB installed · app may use up to ${(sys.heapMb / 1024).toFixed(1)} GB` : nav.deviceMemory ? `about ${nav.deviceMemory} GB` : 'unknown'],
  ];
  if (mem) rows.push(['App memory in use', `${Math.round(mem.usedJSHeapSize / 1048576)} MB of ${Math.round(mem.jsHeapSizeLimit / 1048576)} MB`]);
  if (sys) rows.push(['System', sys.os], ['Graphics cards', sys.gpu?.join(', ') || 'unknown'], ['GPU drawing', `${sys.gpuStatus.gpu_compositing ?? '?'} compositing · ${sys.gpuStatus.rasterization ?? '?'} rasterisation · WebGL ${sys.gpuStatus.webgl ?? '?'}`]);
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <Card title="3D render quality">
        <div className="space-y-2">
          {(Object.keys(RENDER_QUALITY) as RenderQuality[]).map((k) => (
            <label key={k} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 ${quality === k ? 'border-brand-600 bg-brand-50' : 'border-stone-200'}`}>
              <input type="radio" className="mt-1" checked={quality === k} onChange={() => set({ renderQuality: k })} />
              <span>
                <span className="block text-sm font-semibold">{RENDER_QUALITY[k].label}</span>
                <span className="block text-xs text-stone-500">{RENDER_QUALITY[k].note}</span>
              </span>
            </label>
          ))}
          <p className="text-xs text-stone-500">3D views only redraw while you move them, so an idle render uses no graphics power. Totals are recalculated only for the cabinets you change.</p>
        </div>
      </Card>
      <Card title="This device">
        <div className="space-y-3">
          <dl className="divide-y divide-stone-100 rounded-xl border border-stone-200 text-sm">
            {rows.map(([k, v]) => (
              <div key={k} className="flex gap-3 px-3 py-2">
                <dt className="w-36 shrink-0 text-stone-500">{k}</dt>
                <dd className="min-w-0 break-words">{v}</dd>
              </div>
            ))}
          </dl>
          <button className="btn-secondary w-full" onClick={refreshApp}>
            <RefreshCw size={16} /> Refresh the app (F5) — your work stays
          </button>
          <p className="text-xs text-stone-500">
            <Cpu size={12} className="mr-1 inline" />
            {window.woodquoteDesktop ? 'The Windows app runs on the main graphics card with GPU drawing on and a large memory allowance. If the window ever stops responding it offers to reload.' : 'For the most power on a PC, use the Windows app.'}
          </p>
        </div>
      </Card>
    </div>
  );
}
