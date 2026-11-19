// En-Quote's database, split into separate stores ("bins") so the app loads
// and saves in small pieces instead of one big file:
//
//   enquote-data      settings, price lists, invoices, counters, and one
//                     record per quotation (only changed quotations are written)
//   enquote-finishes  finish texture images (PNG / JPG), loaded only when shown
//   enquote-renders   captured views and photo renders
//
// Save points (backups) stay in the original store, so older ones still restore.
import { createStore, delMany, entries, getMany, keys, setMany, type UseStore } from 'idb-keyval';

const hasIdb = typeof indexedDB !== 'undefined';

export interface Bin {
  name: string;
  idb: UseStore | null;
  /** used when the device has no IndexedDB (tests, some private windows) */
  mem: Map<string, unknown>;
}

const open = (db: string, store: string): Bin => ({ name: db, idb: hasIdb ? createStore(db, store) : null, mem: new Map() });

export const dataBin = open('enquote-data', 'records');
export const finishBin = open('enquote-finishes', 'images');
export const renderBin = open('enquote-renders', 'renders');

export async function readMany<T = unknown>(bin: Bin, ks: string[]): Promise<(T | undefined)[]> {
  if (!ks.length) return [];
  return bin.idb ? getMany<T>(ks, bin.idb) : ks.map((k) => bin.mem.get(k) as T | undefined);
}
export async function read<T = unknown>(bin: Bin, k: string): Promise<T | undefined> {
  return (await readMany<T>(bin, [k]))[0];
}
export async function writeMany(bin: Bin, list: [string, unknown][]) {
  if (!list.length) return;
  if (bin.idb) await setMany(list, bin.idb);
  else for (const [k, v] of list) bin.mem.set(k, v);
}
export const write = (bin: Bin, k: string, v: unknown) => writeMany(bin, [[k, v]]);
export async function remove(bin: Bin, ks: string[]) {
  if (!ks.length) return;
  if (bin.idb) await delMany(ks, bin.idb);
  else for (const k of ks) bin.mem.delete(k);
}
export async function listKeys(bin: Bin): Promise<string[]> {
  return bin.idb ? ((await keys(bin.idb)) as string[]) : [...bin.mem.keys()];
}
export async function listEntries<T = unknown>(bin: Bin): Promise<[string, T][]> {
  return bin.idb ? ((await entries(bin.idb)) as [string, T][]) : ([...bin.mem.entries()] as [string, T][]);
}

export const DATA_VERSION = 3;
export const K = {
  meta: 'meta',
  settings: 'settings',
  catalog: 'catalog',
  invoices: 'invoices',
  order: 'quote-order',
  quote: (id: string) => `quote:${id}`,
};
