// Quotation totals for lists (dashboard, quotations, invoices). Working out a
// total builds every cabinet and packs the sheets, so each quotation is worked
// out once and remembered until it, the prices or the settings change. The
// loading page fills this in small steps so the app never stalls on start-up.
import { calculateQuote } from '../lib/pricing';
import type { Catalog, Quote, Settings } from '../lib/types';
import { useStore } from '../store';

let key: { catalog: Catalog; settings: Settings } | null = null;
let cache = new WeakMap<Quote, number>();

function fresh(catalog: Catalog, settings: Settings) {
  if (!key || key.catalog !== catalog || key.settings !== settings) {
    key = { catalog, settings };
    cache = new WeakMap();
  }
}

export function quoteTotal(q: Quote): number {
  const { catalog, settings } = useStore.getState();
  fresh(catalog, settings);
  let t = cache.get(q);
  if (t == null) {
    try {
      t = calculateQuote(q, catalog, settings).total;
    } catch {
      t = 0;
    }
    cache.set(q, t);
  }
  return t;
}

export const hasTotal = (q: Quote) => {
  const { catalog, settings } = useStore.getState();
  fresh(catalog, settings);
  return cache.has(q);
};

const nextFrame = () => new Promise<void>((r) => setTimeout(r, 0));

/** Work out every quotation's total, a few at a time, reporting progress (0–1). */
export async function warmTotals(onProgress: (done: number, total: number) => void) {
  const quotes = useStore.getState().quotes;
  let i = 0;
  for (const q of quotes) {
    const t0 = performance.now();
    quoteTotal(q);
    i++;
    // hand control back so the loading animation keeps moving
    if (performance.now() - t0 > 8 || i % 4 === 0) {
      onProgress(i, quotes.length);
      await nextFrame();
    }
  }
  onProgress(quotes.length, quotes.length);
}
