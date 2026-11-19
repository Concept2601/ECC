import { useEffect, useMemo, useState } from 'react';
import { lastCalc, peekCalc, requestCalc } from './calc/client';
import { calculateInvoice, type QuoteCalc } from './lib/pricing';
import type { Invoice, Quote } from './lib/types';
import { money } from './lib/util';
import { useStore } from './store';

export const useMoney = () => {
  const cur = useStore((s) => s.settings.pricing.currency);
  return (n: number) => money(n, cur);
};

/**
 * The quotation's prices, cut lists and 3D builds, worked out in the
 * background. While a change is being worked out the previous result stays on
 * screen, so typing and dragging never wait; null only until the first result.
 */
export function useQuoteCalc(q: Quote | undefined) {
  const catalog = useStore((s) => s.catalog);
  const settings = useStore((s) => s.settings);
  const [state, setState] = useState<{ id: string | null; calc: QuoteCalc | null }>(() => ({ id: q?.id ?? null, calc: q ? peekCalc(q, catalog, settings) : null }));
  useEffect(() => {
    if (!q) return;
    let alive = true;
    void requestCalc(q, catalog, settings).then((calc) => alive && setState({ id: q.id, calc }));
    return () => {
      alive = false;
    };
  }, [q, catalog, settings]);
  if (!q) return null;
  const now = peekCalc(q, catalog, settings);
  if (now) return now;
  // still working out the newest change: keep showing the last figures
  return (state.id === q.id ? state.calc : null) ?? lastCalc(q.id);
}

export function useInvoiceCalc(i: Invoice | undefined) {
  const settings = useStore((s) => s.settings);
  return useMemo(() => (i ? calculateInvoice(i, settings) : null), [i, settings]);
}

export const STATUS_STYLE: Record<string, string> = {
  draft: 'bg-stone-100 text-stone-700',
  sent: 'bg-sky-100 text-sky-800',
  accepted: 'bg-emerald-100 text-emerald-800',
  rejected: 'bg-red-100 text-red-700',
  invoiced: 'bg-violet-100 text-violet-800',
  unpaid: 'bg-red-100 text-red-700',
  'deposit paid': 'bg-amber-100 text-amber-800',
  'partially paid': 'bg-amber-100 text-amber-800',
  paid: 'bg-emerald-100 text-emerald-800',
};
