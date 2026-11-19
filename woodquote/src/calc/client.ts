// Sends quotations to the background calculator and hands back the result.
// Only the newest version of a quotation is worked out (older requests made
// while you type are skipped), and results are remembered per version.
import { calculateQuote, type QuoteCalc } from '../lib/pricing';
import type { Catalog, Quote, Settings } from '../lib/types';

type Pending = { quote: Quote; catalog: Catalog; settings: Settings; resolve: (c: QuoteCalc) => void }[];

const done = new WeakMap<Quote, { catalog: Catalog; settings: Settings; calc: QuoteCalc }>();
/** the newest finished result per quotation id, shown while a newer version is worked out */
const latest = new Map<string, QuoteCalc>();
const remember = (quote: Quote, catalog: Catalog, settings: Settings, calc: QuoteCalc) => {
  done.set(quote, { catalog, settings, calc });
  latest.set(quote.id, calc);
};
let worker: Worker | null = null;
let broken = typeof Worker === 'undefined';
let sentCatalog: Catalog | null = null;
let sentSettings: Settings | null = null;
let seq = 0;
/** per quotation id: the request being worked on, and the newest one waiting behind it */
const busy = new Map<string, number>();
const waiting = new Map<string, Pending>();
const callbacks = new Map<number, { quoteId: string; quote: Quote; catalog: Catalog; settings: Settings; resolve: (c: QuoteCalc) => void }>();

function getWorker(): Worker | null {
  if (broken) return null;
  if (!worker) {
    try {
      worker = new Worker(new URL('./calc.worker.ts', import.meta.url), { type: 'module' });
      worker.onmessage = (e: MessageEvent<{ id: number; calc?: QuoteCalc; error?: string }>) => finish(e.data.id, e.data.calc, e.data.error);
      worker.onerror = () => {
        // no background worker on this device: work on the page instead
        broken = true;
        worker = null;
        for (const [id] of callbacks) finish(id, undefined, 'worker failed');
      };
    } catch {
      broken = true;
      worker = null;
    }
  }
  return worker;
}

function finish(id: number, calc: QuoteCalc | undefined, error?: string) {
  const cb = callbacks.get(id);
  if (!cb) return;
  callbacks.delete(id);
  busy.delete(cb.quoteId);
  const result = calc ?? (error ? calculateQuote(cb.quote, cb.catalog, cb.settings) : undefined);
  if (result) {
    remember(cb.quote, cb.catalog, cb.settings, result);
    cb.resolve(result);
  }
  // the newest change made while this one was being worked out
  const next = waiting.get(cb.quoteId);
  if (next?.length) {
    waiting.delete(cb.quoteId);
    const last = next[next.length - 1];
    send(last.quote, last.catalog, last.settings, (c) => next.forEach((p) => p.resolve(c)));
  }
}

function send(quote: Quote, catalog: Catalog, settings: Settings, resolve: (c: QuoteCalc) => void) {
  const w = getWorker();
  const local = () => {
    // fallback: a moment later on the page, so the keystroke itself is not held up
    setTimeout(() => {
      const calc = calculateQuote(quote, catalog, settings);
      remember(quote, catalog, settings, calc);
      resolve(calc);
    }, 0);
  };
  if (!w) return local();
  const id = ++seq;
  busy.set(quote.id, id);
  callbacks.set(id, { quoteId: quote.id, quote, catalog, settings, resolve });
  const msg: { id: number; quote: Quote; catalog?: Catalog; settings?: Settings } = { id, quote };
  if (catalog !== sentCatalog) msg.catalog = sentCatalog = catalog;
  if (settings !== sentSettings) msg.settings = sentSettings = settings;
  try {
    w.postMessage(msg);
  } catch {
    // something in the quotation could not be sent to the worker: work it out here
    callbacks.delete(id);
    busy.delete(quote.id);
    sentCatalog = sentSettings = null;
    local();
  }
}

/** The last result worked out for this quotation (maybe for an older version), or null. */
export function lastCalc(quoteId: string): QuoteCalc | null {
  return latest.get(quoteId) ?? null;
}

/** A result already worked out for exactly this version of the quotation. */
export function peekCalc(quote: Quote, catalog: Catalog, settings: Settings): QuoteCalc | null {
  const d = done.get(quote);
  return d && d.catalog === catalog && d.settings === settings ? d.calc : null;
}

export function requestCalc(quote: Quote, catalog: Catalog, settings: Settings): Promise<QuoteCalc> {
  const hit = peekCalc(quote, catalog, settings);
  if (hit) return Promise.resolve(hit);
  return new Promise((resolve) => {
    if (busy.has(quote.id) && !broken) {
      const list = waiting.get(quote.id) ?? [];
      list.push({ quote, catalog, settings, resolve });
      waiting.set(quote.id, list);
      return;
    }
    send(quote, catalog, settings, resolve);
  });
}
