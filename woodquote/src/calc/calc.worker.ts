// Quotation maths in the background: building every cabinet, packing the
// sheets and pricing big kitchens happens here, so typing, dragging and the
// 3D view never wait for it.
import { calculateQuote } from '../lib/pricing';
import type { Catalog, Quote, Settings } from '../lib/types';

let catalog: Catalog | null = null;
let settings: Settings | null = null;

export type CalcRequest = { id: number; quote: Quote; catalog?: Catalog; settings?: Settings };

self.onmessage = (e: MessageEvent<CalcRequest>) => {
  const m = e.data;
  if (m.catalog) catalog = m.catalog;
  if (m.settings) settings = m.settings;
  try {
    if (!catalog || !settings) throw new Error('prices not loaded');
    const calc = calculateQuote(m.quote, catalog, settings);
    (self as unknown as Worker).postMessage({ id: m.id, calc });
  } catch (err) {
    (self as unknown as Worker).postMessage({ id: m.id, error: String((err as Error)?.message ?? err) });
  }
};
