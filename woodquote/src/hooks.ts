import { useMemo } from 'react';
import { calculateInvoice, calculateQuote } from './lib/pricing';
import type { Invoice, Quote } from './lib/types';
import { money } from './lib/util';
import { useStore } from './store';

export const useMoney = () => {
  const cur = useStore((s) => s.settings.pricing.currency);
  return (n: number) => money(n, cur);
};

export function useQuoteCalc(q: Quote | undefined) {
  const catalog = useStore((s) => s.catalog);
  const settings = useStore((s) => s.settings);
  return useMemo(() => (q ? calculateQuote(q, catalog, settings) : null), [q, catalog, settings]);
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
