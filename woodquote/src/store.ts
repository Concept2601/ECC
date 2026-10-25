import { del, get, set } from 'idb-keyval';
import { create } from 'zustand';
import { createJSONStorage, persist, type PersistStorage, type StateStorage, type StorageValue } from 'zustand/middleware';
import { DEFAULTS_ADDED_LATER, defaultCatalog, defaultSettings } from './lib/defaults';
import { normalizeUnit } from './lib/presets';
import { normalizeRoom } from './lib/room';
import { calculateQuote } from './lib/pricing';
import type { Catalog, Counters, Invoice, Payment, Quote, Settings } from './lib/types';
import { addDaysISO, deepClone, todayISO, uid } from './lib/util';

const mem = new Map<string, string>();
const hasIdb = typeof indexedDB !== 'undefined';
const idbStorage: StateStorage = {
  getItem: async (name) => (hasIdb ? ((await get<string>(name)) ?? null) : (mem.get(name) ?? null)),
  setItem: async (name, value) => (hasIdb ? set(name, value) : void mem.set(name, value)),
  removeItem: async (name) => (hasIdb ? del(name) : void mem.delete(name)),
};

/**
 * Saving the whole database on every keystroke froze the app on big jobs
 * (photos, logos, many quotes). Writes are now coalesced: the latest state is
 * written once typing pauses, at most every few seconds while busy, and right
 * away when the app is hidden or closed.
 */
const jsonStorage = createJSONStorage<AppData>(() => idbStorage)!;
const pending = new Map<string, StorageValue<AppData>>();
let saveTimer: ReturnType<typeof setTimeout> | undefined;
let firstPending = 0;
export function flushSave() {
  clearTimeout(saveTimer);
  saveTimer = undefined;
  firstPending = 0;
  const jobs = [...pending.entries()];
  pending.clear();
  return Promise.all(jobs.map(([n, v]) => jsonStorage.setItem(n, v)));
}
const lazyStorage: PersistStorage<AppData> = {
  getItem: (name) => jsonStorage.getItem(name),
  setItem: (name, value) => {
    pending.set(name, value);
    const now = Date.now();
    if (!firstPending) firstPending = now;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => void flushSave(), now - firstPending > 4000 ? 0 : 700);
  },
  removeItem: (name) => {
    pending.delete(name);
    return jsonStorage.removeItem(name);
  },
};
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => void flushSave());
  document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && void flushSave());
}

export interface AppData {
  settings: Settings;
  catalog: Catalog;
  quotes: Quote[];
  invoices: Invoice[];
  counters: Counters;
}

interface AppState extends AppData {
  hydrated: boolean;
  updateSettings: (fn: (s: Settings) => void) => void;
  updateCatalog: (fn: (c: Catalog) => void) => void;
  createQuote: (init?: Partial<Quote>) => string;
  updateQuote: (id: string, fn: (q: Quote) => void) => void;
  deleteQuote: (id: string) => void;
  duplicateQuote: (id: string) => string | null;
  createInvoiceFromQuote: (quoteId: string) => string | null;
  createInvoice: () => string;
  updateInvoice: (id: string, fn: (i: Invoice) => void) => void;
  deleteInvoice: (id: string) => void;
  addPayment: (invoiceId: string, p: Omit<Payment, 'id' | 'receiptNumber'>) => string;
  importData: (d: AppData) => void;
  resetCatalog: () => void;
}

/** Add catalog items / fields introduced by newer app versions, keeping user edits. */
export const defaultIds = (d: Catalog = defaultCatalog()) => [d.boards, d.countertops, d.edging, d.glass, d.aluminium, d.accessories, d.appliances, d.ceilingProducts ?? [], d.tiles ?? [], d.tileSupplies ?? []].flatMap((l) => l.map((x) => x.id));

/**
 * Your library always wins: your prices and names are kept as they are and
 * items you deleted are never put back. Only built-in items added by a newer
 * version of the app (never offered on this device before) are appended.
 * Libraries saved before this was tracked are treated as having seen every
 * current built-in item, so nothing deleted comes back.
 */
export function mergeCatalog(c: Partial<Catalog>): Catalog {
  const d = defaultCatalog();
  const all = defaultIds(d);
  const later = new Set(DEFAULTS_ADDED_LATER);
  const seen = new Set(c.defaultsSeen ?? all.filter((x) => !later.has(x)));
  const mergeList = <T extends { id: string }>(user: T[] | undefined, def: T[]): T[] => {
    if (!user) return def.filter((x) => !seen.has(x.id) || !c.defaultsSeen);
    const byId = new Map(def.map((x) => [x.id, x]));
    // fill only fields a newer version added; never overwrite what is stored
    const out = user.map((x) => ({ ...(byId.get(x.id) ?? {}), ...x }) as T);
    const have = new Set(out.map((x) => x.id));
    return [...out, ...def.filter((x) => !have.has(x.id) && !seen.has(x.id))];
  };
  // a library with no boards at all cannot price anything, so that one list is refilled
  const boards = (c.boards?.length ? mergeList(c.boards, d.boards) : d.boards).map((b) => ({ ...b, finish: b.finish ?? (/gloss/i.test(b.name) ? 'gloss' : 'matte') }));
  const countertops = mergeList(c.countertops, d.countertops).map((t) => ({ ...t, finish: t.finish ?? 'satin' }));
  return { boards, countertops, edging: mergeList(c.edging, d.edging), glass: mergeList(c.glass, d.glass), aluminium: mergeList(c.aluminium, d.aluminium), accessories: mergeList(c.accessories, d.accessories), appliances: mergeList(c.appliances, d.appliances), ceilingProducts: mergeList(c.ceilingProducts, d.ceilingProducts ?? []), tiles: mergeList(c.tiles, d.tiles ?? []), tileSupplies: mergeList(c.tileSupplies, d.tileSupplies ?? []), defaultsSeen: [...new Set([...seen, ...all])] };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normalizeQuote(q: any): Quote {
  return { ...q, units: (q.units ?? []).map(normalizeUnit), runs: q.runs ?? [], assemblies: q.assemblies ?? [], attachments: q.attachments ?? [], includeAppliances: q.includeAppliances ?? true, room: normalizeRoom(q.room) };
}

/**
 * Bring data from any WoodQuote version up to date: the app's own storage,
 * backup files, save points and Windows backup files (which wrap it in
 * { data }). Missing settings get today's defaults; old quotes, rooms and
 * kitchens are converted; counters never go backwards.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normalizeData(raw: any): AppData {
  const p = (raw?.data && (raw.data.quotes || raw.data.settings) ? raw.data : raw ?? {}) as Partial<AppData>;
  const d = defaultSettings();
  const s = (p.settings ?? {}) as Partial<Settings>;
  const quotes = (Array.isArray(p.quotes) ? p.quotes : []).map(normalizeQuote);
  const invoices = (Array.isArray(p.invoices) ? p.invoices : []).map((i) => ({ ...i, lines: i.lines ?? [], payments: i.payments ?? [], client: i.client ?? { name: '', phone: '', email: '', address: '' } }));
  // the running number is the last group of digits ("QUO-0012" → 12)
  const tail = (v?: string) => Number(/(\d+)\D*$/.exec(String(v ?? ''))?.[1] ?? 0);
  const n = (list: { number?: string }[]) => Math.max(0, ...list.map((x) => tail(x.number)));
  const c = (p.counters ?? {}) as Partial<Counters>;
  return {
    settings: {
      company: { ...d.company, ...s.company },
      pricing: { ...d.pricing, ...s.pricing },
      doc: { ...d.doc, ...s.doc },
      ai: { ...d.ai, ...s.ai },
      services: Array.isArray(s.services) ? s.services : d.services,
      ceilingRates: { ...d.ceilingRates!, ...s.ceilingRates },
      ceilingDesigns: Array.isArray(s.ceilingDesigns) ? s.ceilingDesigns : d.ceilingDesigns,
      ceilingExtras: Array.isArray(s.ceilingExtras) ? s.ceilingExtras : d.ceilingExtras,
      tilingRates: { ...d.tilingRates!, ...s.tilingRates, patternExtra: { ...d.tilingRates!.patternExtra, ...s.tilingRates?.patternExtra } },
      tilingExtras: Array.isArray(s.tilingExtras) ? s.tilingExtras : d.tilingExtras,
    },
    catalog: p.catalog ? mergeCatalog(p.catalog) : defaultCatalog(),
    quotes,
    invoices,
    counters: {
      quote: Math.max(c.quote ?? 0, n(quotes)),
      invoice: Math.max(c.invoice ?? 0, n(invoices)),
      receipt: Math.max(c.receipt ?? 0, ...invoices.flatMap((i) => i.payments.map((x) => tail(x.receiptNumber)))),
    },
  };
}

/** True when a file looks like WoodQuote data from any version. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const isWoodQuoteData = (raw: any) => !!raw && (Array.isArray(raw.quotes) || Array.isArray(raw.data?.quotes) || !!raw.settings || !!raw.data?.settings);

const num = (prefix: string, n: number) => `${prefix}${String(n).padStart(4, '0')}`;

export const useStore = create<AppState>()(
  persist(
    (setState, getState) => ({
      hydrated: false,
      settings: defaultSettings(),
      catalog: defaultCatalog(),
      quotes: [],
      invoices: [],
      counters: { quote: 0, invoice: 0, receipt: 0 },

      updateSettings: (fn) => {
        const s = deepClone(getState().settings);
        fn(s);
        setState({ settings: s });
      },
      updateCatalog: (fn) => {
        const c = deepClone(getState().catalog);
        fn(c);
        setState({ catalog: c });
      },
      createQuote: (init) => {
        const { counters, settings } = getState();
        const n = counters.quote + 1;
        const q: Quote = {
          id: uid('q'),
          number: num(settings.doc.quotePrefix, n),
          title: 'New quotation',
          date: todayISO(),
          status: 'draft',
          client: { name: '', phone: '', email: '', address: '' },
          units: [],
          runs: [],
          assemblies: [],
          extras: [],
          attachments: [],
          includeAppliances: true,
          room: null,
          transportId: null,
          transportCustom: 0,
          installation: false,
          markupPercent: settings.pricing.markupPercent,
          discountType: 'percent',
          discountValue: 0,
          applyTax: settings.pricing.taxRate > 0,
          notes: '',
          sourceImage: null,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          ...init,
        };
        setState({ quotes: [q, ...getState().quotes], counters: { ...counters, quote: n } });
        return q.id;
      },
      updateQuote: (id, fn) =>
        setState({
          quotes: getState().quotes.map((q) => {
            if (q.id !== id) return q;
            const c = deepClone(q);
            fn(c);
            c.updatedAt = Date.now();
            return c;
          }),
        }),
      deleteQuote: (id) => setState({ quotes: getState().quotes.filter((q) => q.id !== id) }),
      duplicateQuote: (id) => {
        const src = getState().quotes.find((q) => q.id === id);
        if (!src) return null;
        const c = deepClone(src);
        // new ids, with the room plan following its items
        const ids = new Map<string, string>();
        c.units.forEach((u) => ids.set(u.id, (u.id = uid('u'))));
        c.runs.forEach((r) => ids.set(r.id, (r.id = uid('r'))));
        (c.assemblies ?? []).forEach((a) => ids.set(a.id, (a.id = uid('g'))));
        if (c.room) c.room.placements = c.room.placements.map((p) => ({ ...p, itemId: ids.get(p.itemId) ?? p.itemId }));
        return getState().createQuote({ ...c, id: uid('q'), title: `${src.title} (copy)`, status: 'draft', date: todayISO(), createdAt: Date.now() });
      },
      createInvoiceFromQuote: (quoteId) => {
        const { quotes, catalog, settings, counters } = getState();
        const q = quotes.find((x) => x.id === quoteId);
        if (!q) return null;
        const calc = calculateQuote(q, catalog, settings);
        const lines = calc.items.map((it) => ({
          id: uid('l'),
          description: it.kind === 'unit' && it.unit ? `${it.name} (${it.unit.width} × ${it.unit.height} × ${it.unit.depth} mm)` : `${it.name} – ${it.lines[0] ?? ''}`,
          qty: it.qty,
          unitPrice: it.sellEach,
        }));
        // ceilings and tiling: one line per room, then their add-ons
        for (const t of [calc.ceilings, calc.tiling])
          if (t) {
            for (const ar of t.areas) lines.push({ id: uid('l'), description: `${t.title} – ${ar.name}: ${ar.summary}`, qty: 1, unitPrice: ar.sell ?? 0 });
            for (const e of t.extras) lines.push({ id: uid('l'), description: `${t.title} – ${e.description}${e.unit ? ` (per ${e.unit})` : ''}`, qty: e.qty, unitPrice: e.unitPrice });
          }
        const tr = settings.pricing.transportOptions.find((t) => t.id === q.transportId);
        if (calc.transport > 0) lines.push({ id: uid('l'), description: tr ? `Transport – ${tr.name}` : 'Transport', qty: 1, unitPrice: calc.transport });
        for (const e of q.extras) lines.push({ id: uid('l'), description: e.unit ? `${e.description} (per ${e.unit})` : e.description, qty: e.qty, unitPrice: e.unitPrice });
        const n = counters.invoice + 1;
        const date = todayISO();
        const inv: Invoice = {
          id: uid('i'),
          number: num(settings.doc.invoicePrefix, n),
          quoteId: q.id,
          quoteNumber: q.number,
          date,
          dueDate: addDaysISO(date, 14),
          client: deepClone(q.client),
          lines,
          discountType: q.discountType,
          discountValue: q.discountValue,
          applyTax: q.applyTax,
          depositType: 'percent',
          depositValue: 60,
          payments: [],
          notes: '',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        setState({
          invoices: [inv, ...getState().invoices],
          counters: { ...getState().counters, invoice: n },
          quotes: getState().quotes.map((x) => (x.id === q.id ? { ...x, status: 'invoiced' } : x)),
        });
        return inv.id;
      },
      createInvoice: () => {
        const { counters, settings } = getState();
        const n = counters.invoice + 1;
        const date = todayISO();
        const inv: Invoice = {
          id: uid('i'),
          number: num(settings.doc.invoicePrefix, n),
          quoteId: null,
          quoteNumber: '',
          date,
          dueDate: addDaysISO(date, 14),
          client: { name: '', phone: '', email: '', address: '' },
          lines: [{ id: uid('l'), description: '', qty: 1, unitPrice: 0 }],
          discountType: 'percent',
          discountValue: 0,
          applyTax: settings.pricing.taxRate > 0,
          depositType: 'percent',
          depositValue: 60,
          payments: [],
          notes: '',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        setState({ invoices: [inv, ...getState().invoices], counters: { ...counters, invoice: n } });
        return inv.id;
      },
      updateInvoice: (id, fn) =>
        setState({
          invoices: getState().invoices.map((i) => {
            if (i.id !== id) return i;
            const c = deepClone(i);
            fn(c);
            c.updatedAt = Date.now();
            return c;
          }),
        }),
      deleteInvoice: (id) => setState({ invoices: getState().invoices.filter((i) => i.id !== id) }),
      addPayment: (invoiceId, p) => {
        const { counters, settings } = getState();
        const n = counters.receipt + 1;
        const pay: Payment = { ...p, id: uid('p'), receiptNumber: num(settings.doc.receiptPrefix, n) };
        getState().updateInvoice(invoiceId, (i) => i.payments.push(pay));
        setState({ counters: { ...getState().counters, receipt: n } });
        return pay.id;
      },
      importData: (d) => setState(normalizeData(d)),
      resetCatalog: () => setState({ catalog: { ...defaultCatalog(), defaultsSeen: defaultIds() } }),
    }),
    {
      name: 'woodquote-data',
      version: 2,
      // data is upgraded in merge() below, so older versions pass straight through
      migrate: (state) => state as AppData,
      storage: lazyStorage,
      partialize: (s) => ({ settings: s.settings, catalog: s.catalog, quotes: s.quotes, invoices: s.invoices, counters: s.counters }),
      merge: (persisted, current) => ({ ...current, ...(persisted ? normalizeData(persisted) : {}) }),
      onRehydrateStorage: () => () => useStore.setState({ hydrated: true }),
    },
  ),
);

export const exportData = (): AppData => {
  const { settings, catalog, quotes, invoices, counters } = useStore.getState();
  return { settings, catalog, quotes, invoices, counters };
};
