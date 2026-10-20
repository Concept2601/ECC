import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Site, Version } from './types';
import { deleteSite, listSites, saveSite } from './lib/storage';
import { clone, uid } from './lib/util';

type Updater = (draft: Site) => void;

interface Store {
  sites: Site[];
  loaded: boolean;
  site?: Site;
  saving: 'saved' | 'saving' | 'error';
  open: (id: string | undefined) => void;
  create: (site: Site) => Promise<void>;
  remove: (id: string) => Promise<void>;
  /** Mutate the open site. Consecutive edits with the same `group` merge into one undo step. */
  update: (fn: Updater, group?: string) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  snapshot: (label: string) => Version;
  restore: (v: Version) => void;
  toast: (msg: string, kind?: 'ok' | 'err') => void;
  toasts: { id: string; msg: string; kind: 'ok' | 'err' }[];
}

const Ctx = createContext<Store | null>(null);
const HISTORY_LIMIT = 80;

/** A version snapshot excludes history so snapshots don't nest. */
export const snapshotOf = (s: Site) => JSON.stringify({ ...s, versions: [], deployments: [] });

export function StoreProvider({ children }: { children: ReactNode }) {
  const [sites, setSites] = useState<Site[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [openId, setOpenId] = useState<string>();
  const [saving, setSaving] = useState<Store['saving']>('saved');
  const [toasts, setToasts] = useState<Store['toasts']>([]);
  const past = useRef<Site[]>([]);
  const future = useRef<Site[]>([]);
  const lastGroup = useRef<{ key?: string; at: number }>({ at: 0 });
  const saveTimer = useRef<number>();
  const [, force] = useState(0);

  useEffect(() => {
    listSites()
      .then((s) => setSites(s.sort((a, b) => b.updatedAt - a.updatedAt)))
      .catch(() => setSites([]))
      .finally(() => setLoaded(true));
  }, []);

  const site = sites.find((s) => s.id === openId);
  // Latest site, so several updates in one tick build on each other.
  const latest = useRef<Site | undefined>(site);
  latest.current = site;

  const toast = useCallback((msg: string, kind: 'ok' | 'err' = 'ok') => {
    const id = uid('t');
    setToasts((t) => [...t, { id, msg, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  }, []);

  const persist = useCallback((s: Site) => {
    setSaving('saving');
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      saveSite(s)
        .then(() => setSaving('saved'))
        .catch(() => {
          setSaving('error');
          toast('Could not save — your browser storage may be full.', 'err');
        });
    }, 400);
  }, [toast]);

  const replace = useCallback((next: Site) => {
    latest.current = next;
    setSites((list) => list.map((s) => (s.id === next.id ? next : s)));
    persist(next);
  }, [persist]);

  const update = useCallback(
    (fn: Updater, group?: string) => {
      const site = latest.current;
      if (!site) return;
      const draft = clone(site);
      fn(draft);
      draft.updatedAt = Date.now();
      const now = Date.now();
      const merge = group && lastGroup.current.key === group && now - lastGroup.current.at < 1200;
      if (!merge) {
        past.current.push(site);
        if (past.current.length > HISTORY_LIMIT) past.current.shift();
      }
      lastGroup.current = { key: group, at: now };
      future.current = [];
      replace(draft);
    },
    [replace],
  );

  const undo = useCallback(() => {
    const prev = past.current.pop();
    if (!prev || !site) return;
    future.current.push(site);
    lastGroup.current = { at: 0 };
    replace(prev);
    force((n) => n + 1);
  }, [site, replace]);

  const redo = useCallback(() => {
    const next = future.current.pop();
    if (!next || !site) return;
    past.current.push(site);
    replace(next);
    force((n) => n + 1);
  }, [site, replace]);

  const open = useCallback((id: string | undefined) => {
    past.current = [];
    future.current = [];
    setOpenId(id);
  }, []);

  const create = useCallback(async (s: Site) => {
    await saveSite(s);
    setSites((list) => [s, ...list]);
  }, []);

  const remove = useCallback(async (id: string) => {
    await deleteSite(id);
    setSites((list) => list.filter((s) => s.id !== id));
  }, []);

  const snapshot = useCallback(
    (label: string): Version => {
      const v: Version = { id: uid('v'), at: Date.now(), label, snapshot: snapshotOf(latest.current!) };
      update((d) => {
        d.versions = [v, ...d.versions].slice(0, 30);
      });
      return v;
    },
    [update],
  );

  const restore = useCallback(
    (v: Version) => {
      const data = JSON.parse(v.snapshot) as Site;
      update((d) => {
        const keep = { id: d.id, versions: d.versions, deployments: d.deployments };
        Object.assign(d, data, keep);
      });
      toast(`Restored “${v.label}”`);
    },
    [update, toast],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 'z') return;
      const t = e.target as HTMLElement;
      if (t.isContentEditable || /INPUT|TEXTAREA/.test(t.tagName)) return;
      e.preventDefault();
      if (e.shiftKey) redo();
      else undo();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo]);

  const value = useMemo<Store>(
    () => ({
      sites,
      loaded,
      site,
      saving,
      open,
      create,
      remove,
      update,
      undo,
      redo,
      canUndo: past.current.length > 0,
      canRedo: future.current.length > 0,
      snapshot,
      restore,
      toast,
      toasts,
    }),
    [sites, loaded, site, saving, open, create, remove, update, undo, redo, snapshot, restore, toast, toasts, past.current.length, future.current.length],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const s = useContext(Ctx);
  if (!s) throw new Error('useStore outside provider');
  return s;
}

/** For components that only render inside an open project. */
export function useSite() {
  const s = useStore();
  if (!s.site) throw new Error('No site open');
  return { ...s, site: s.site };
}
