import { del, get, set } from 'idb-keyval';
import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';
import { defaultCatalog, defaultSettings } from './lib/defaults';
import { calculateQuote } from './lib/pricing';
import type { Catalog, Counters, Invoice, Payment, Quote, Settings } from './lib/types';
import { addDaysISO, deepClone, todayISO, uid } from './lib/util';

const idbStorage: StateStorage = {
  getItem: async (name) => (await get<string>(name)) ?? null,
  setItem: async (name, value) => set(name, value),
  removeItem: async (name) => del(name),
};

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
          extras: [],
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
        c.units.forEach((u) => (u.id = uid('u')));
        return getState().createQuote({ ...c, id: uid('q'), title: `${src.title} (copy)`, status: 'draft', date: todayISO(), createdAt: Date.now() });
      },
      createInvoiceFromQuote: (quoteId) => {
        const { quotes, catalog, settings, counters } = getState();
        const q = quotes.find((x) => x.id === quoteId);
        if (!q) return null;
        const calc = calculateQuote(q, catalog, settings);
        const lines = calc.units.map((u) => ({
          id: uid('l'),
          description: `${u.unit.name} (${u.unit.width} × ${u.unit.height} × ${u.unit.depth} mm)`,
          qty: u.unit.qty,
          unitPrice: u.sellEach,
        }));
        const tr = settings.pricing.transportOptions.find((t) => t.id === q.transportId);
        if (calc.transport > 0) lines.push({ id: uid('l'), description: tr ? `Transport – ${tr.name}` : 'Transport', qty: 1, unitPrice: calc.transport });
        for (const e of q.extras) lines.push({ id: uid('l'), description: e.description, qty: e.qty, unitPrice: e.unitPrice });
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
      importData: (d) => setState({ settings: d.settings, catalog: d.catalog, quotes: d.quotes, invoices: d.invoices, counters: d.counters }),
      resetCatalog: () => setState({ catalog: defaultCatalog() }),
    }),
    {
      name: 'woodquote-data',
      version: 1,
      storage: createJSONStorage(() => idbStorage),
      partialize: (s) => ({ settings: s.settings, catalog: s.catalog, quotes: s.quotes, invoices: s.invoices, counters: s.counters }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<AppData>;
        const d = defaultSettings();
        return {
          ...current,
          ...p,
          // keep new default keys when the app is updated
          settings: p.settings
            ? { company: { ...d.company, ...p.settings.company }, pricing: { ...d.pricing, ...p.settings.pricing }, doc: { ...d.doc, ...p.settings.doc }, ai: { ...d.ai, ...p.settings.ai } }
            : current.settings,
        };
      },
      onRehydrateStorage: () => () => useStore.setState({ hydrated: true }),
    },
  ),
);

export const exportData = (): AppData => {
  const { settings, catalog, quotes, invoices, counters } = useStore.getState();
  return { settings, catalog, quotes, invoices, counters };
};
