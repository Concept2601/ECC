// Quotation maths: builds every unit and kitchen run, optimises sheets across
// the whole job, prices materials / hardware / appliances, then allocates costs
// back to each quoted item so item prices always add up to the quote total.
import { describeUnit } from './describe';
import { buildUnit } from './generate';
import { packBars, packSheets, priceBoardPlan, type BarPlan, type BoardPlan, type Piece } from './optimizer';
import { buildRun, describeRun, type RunBuild } from './runs';
import { splitForStock, type JoinPlan } from './joinery';
import type { Accessory, Catalog, Invoice, PricingSettings, Quote, Run, Settings, Unit, UnitBuild } from './types';
import { round2, sum } from './util';

export type CostGroup = 'Boards' | 'Edge banding' | 'Glass' | 'Aluminium' | 'Countertops' | 'Hardware' | 'Appliances';
export const COST_GROUPS: CostGroup[] = ['Boards', 'Edge banding', 'Glass', 'Aluminium', 'Countertops', 'Hardware', 'Appliances'];

export interface CostLine {
  key: string;
  group: CostGroup;
  description: string;
  qty: number;
  unit: string;
  unitPrice: number;
  total: number;
  note?: string;
}

/** One buildable piece of the job: a unit, a module of a run, or a run's worktop. */
export interface Entry {
  key: string;
  itemId: string;
  name: string;
  qty: number; // total pieces built (unit qty × run qty)
  build: UnitBuild;
  unit: Unit | null;
  labourOverride: number | null;
}

export interface ItemPrice {
  kind: 'unit' | 'run';
  id: string;
  name: string;
  qty: number;
  unit?: Unit;
  run?: Run;
  build?: UnitBuild; // single units
  runBuild?: RunBuild; // kitchen runs
  entries: Entry[];
  lines: string[]; // description
  materials: number; // allocated materials & hardware for all qty
  appliances: number;
  labour: number;
  installation: number;
  cost: number;
  sell: number; // total selling price for all qty
  sellEach: number;
}

export interface QuoteCalc {
  items: ItemPrice[];
  entries: Entry[];
  boardPlans: BoardPlan[];
  barPlans: BarPlan[];
  /** Parts bigger than the stock that are cut in pieces and joined. */
  joins: (JoinPlan & { qty: number })[];
  costLines: CostLine[];
  materialsCost: number; // incl. appliances
  appliancesCost: number;
  labour: number;
  installation: number;
  markup: number;
  unitsSell: number;
  transport: number;
  extras: number;
  subtotal: number;
  discount: number;
  taxable: number;
  tax: number;
  total: number;
  warnings: string[];
}

export const accessoryPacks = (a: Accessory, qty: number): number => (a.unit === 'm' ? qty : Math.ceil(qty / Math.max(1, a.packQty)));

/* Builds are pure functions of (unit or run, catalog, pricing), so unchanged
   cabinets are reused between recalculations instead of rebuilt each keystroke. */
const buildCache = new WeakMap<Catalog, WeakMap<PricingSettings, Map<string, unknown>>>();
function cached<T>(cat: Catalog, pr: PricingSettings, key: string, make: () => T): T {
  let byPr = buildCache.get(cat);
  if (!byPr) buildCache.set(cat, (byPr = new WeakMap()));
  let m = byPr.get(pr);
  if (!m) byPr.set(pr, (m = new Map()));
  const hit = m.get(key);
  if (hit) return hit as T;
  const v = make();
  m.set(key, v);
  if (m.size > 400) m.delete(m.keys().next().value as string);
  return v;
}

/** Sheet packing is the slowest step; the same cut list always gives the same plan. */
const packCache = new Map<string, ReturnType<typeof packSheets>>();
function cachedPack(...args: Parameters<typeof packSheets>): ReturnType<typeof packSheets> {
  const key = JSON.stringify(args);
  const hit = packCache.get(key);
  if (hit) return hit;
  const v = packSheets(...args);
  packCache.set(key, v);
  if (packCache.size > 60) packCache.delete(packCache.keys().next().value as string);
  return v;
}

export function quoteItems(q: Quote, cat: Catalog, settings: Settings): { items: Omit<ItemPrice, 'materials' | 'appliances' | 'labour' | 'installation' | 'cost' | 'sell' | 'sellEach'>[]; entries: Entry[] } {
  const pr = settings.pricing;
  const items: ReturnType<typeof quoteItems>['items'] = [];
  const entries: Entry[] = [];
  for (const u of q.units) {
    const build = cached(cat, pr, `u${JSON.stringify(u)}`, () => buildUnit(u, cat, pr));
    const e: Entry = { key: u.id, itemId: u.id, name: u.name, qty: u.qty, build, unit: u, labourOverride: u.labourOverride };
    entries.push(e);
    items.push({ kind: 'unit', id: u.id, name: u.name, qty: u.qty, unit: u, build, entries: [e], lines: describeUnit(u, cat) });
  }
  for (const r of q.runs ?? []) {
    const rb = cached(cat, pr, `r${JSON.stringify(r)}`, () => buildRun(r, cat, pr));
    const es: Entry[] = rb.pieces.map((p) => ({ key: `${r.id}:${p.unit.id}`, itemId: r.id, name: `${r.name} – ${p.unit.name}`, qty: r.qty, build: p.build, unit: p.unit, labourOverride: p.unit.labourOverride }));
    es.push({ key: `${r.id}:extra`, itemId: r.id, name: `${r.name} – worktop & appliances`, qty: r.qty, build: rb.extra, unit: null, labourOverride: null });
    entries.push(...es);
    items.push({ kind: 'run', id: r.id, name: r.name, qty: r.qty, run: r, runBuild: rb, entries: es, lines: describeRun(r, cat) });
  }
  return { items, entries };
}

export function calculateQuote(q: Quote, cat: Catalog, settings: Settings): QuoteCalc {
  const pr = settings.pricing;
  const { items: rawItems, entries } = quoteItems(q, cat, settings);
  const warnings: string[] = [];
  entries.forEach((e) => e.build.warnings.forEach((w) => warnings.push(`${e.name}: ${w}`)));

  // usage[resourceKey][entryIndex] = raw quantity; charged[resourceKey] = cost
  const usage = new Map<string, number[]>();
  const charged = new Map<string, number>();
  const use = (key: string, ei: number, qty: number) => {
    const arr = usage.get(key) ?? new Array(entries.length).fill(0);
    arr[ei] += qty;
    usage.set(key, arr);
  };
  const costLines: CostLine[] = [];

  /* ---------------------------------------------------------- boards */
  const piecesByBoard = new Map<string, Piece[]>();
  const joins: (JoinPlan & { qty: number })[] = [];
  entries.forEach((e, ei) => {
    for (const p of e.build.parts) {
      if (p.kind !== 'board' || !p.materialId) continue;
      const mat = cat.boards.find((b) => b.id === p.materialId);
      if (!mat) continue;
      const n = p.qty * e.qty;
      use(`board:${mat.id}`, ei, p.length * p.width * n);
      const list = piecesByBoard.get(mat.id) ?? [];
      // too big for the sheet / plank → cut in equal pieces and joined
      const jp = splitForStock(p, mat, pr, e.name);
      if (jp) {
        joins.push({ ...jp, qty: n });
        for (const [id, q] of Object.entries(jp.fixings)) use(`hw:${id}`, ei, q * n);
        for (let k = 0; k < n; k++) {
          jp.pieces.forEach((pc, j) => list.push({ id: `${e.key}:${p.key}:${k}:${j}`, label: `${e.name} – ${p.name} (${j + 1}/${jp.pieces.length})`, length: pc.length, width: pc.width, canRotate: !mat.grain }));
          jp.cleats.forEach((c, j) => list.push({ id: `${e.key}:${p.key}:${k}:c${j}`, label: `${e.name} – ${c.label}`, length: c.length, width: c.width, canRotate: !mat.grain }));
        }
      } else for (let k = 0; k < n; k++) list.push({ id: `${e.key}:${p.key}:${k}`, label: `${e.name} – ${p.name}`, length: p.length, width: p.width, canRotate: !mat.grain });
      piecesByBoard.set(mat.id, list);
    }
  });
  const boardPlans: BoardPlan[] = [];
  for (const [id, pieces] of piecesByBoard) {
    const mat = cat.boards.find((b) => b.id === id)!;
    const plan = priceBoardPlan(mat, cachedPack(pieces, mat.sheetLength, mat.sheetWidth, { kerf: pr.kerf, trim: pr.sheetTrim, minOffcut: pr.minOffcut, mode: pr.cutMode }), pr.boardCharging);
    boardPlans.push(plan);
    if (plan.oversize.length) warnings.push(`${plan.oversize.length} part(s) could not be placed on a ${mat.name} sheet.`);
    charged.set(`board:${id}`, plan.chargedCost);
    costLines.push({ key: `board:${id}`, group: 'Boards', description: mat.name, qty: plan.sheets.length, unit: 'sheet', unitPrice: mat.pricePerSheet, total: plan.chargedCost, note: `${Math.round(plan.utilisation * 100)}% used${pr.boardCharging === 'usedArea' && plan.offcutValue > 0 ? ', reusable offcuts credited' : ''}` });
  }

  /* ----------------------------------- edging/glass/counters/hardware */
  entries.forEach((e, ei) => {
    for (const p of e.build.parts) {
      const n = p.qty * e.qty;
      if (p.edgingId && p.edgeLength > 0) use(`edge:${p.edgingId}`, ei, p.edgeLength * n);
      if (p.kind === 'glass' && p.materialId) use(`glass:${p.materialId}`, ei, (p.length * p.width * n) / 1e6);
      if (p.kind === 'counter' && p.materialId) use(`counter:${p.materialId}`, ei, (p.length * p.width * n) / 1e6);
    }
    for (const a of e.build.aluminium) use(`alu:${a.profileId}`, ei, sum(a.pieces) * e.qty);
    for (const h of e.build.hardware) use(`hw:${h.accessoryId}`, ei, h.qty * e.qty);
    for (const a of e.build.applianceList) use(`appl:${a.applianceId}`, ei, a.qty * e.qty);
  });

  for (const ed of cat.edging) {
    const m = sum(usage.get(`edge:${ed.id}`) ?? []);
    if (!m) continue;
    const metres = Math.ceil(m * (1 + pr.edgingWastePercent / 100));
    const total = metres * ed.pricePerMeter;
    charged.set(`edge:${ed.id}`, total);
    costLines.push({ key: `edge:${ed.id}`, group: 'Edge banding', description: ed.name, qty: metres, unit: 'm', unitPrice: ed.pricePerMeter, total, note: `incl. ${pr.edgingWastePercent}% waste` });
  }
  for (const g of cat.glass) {
    const a = sum(usage.get(`glass:${g.id}`) ?? []);
    if (!a) continue;
    const total = a * g.pricePerSqm;
    charged.set(`glass:${g.id}`, total);
    costLines.push({ key: `glass:${g.id}`, group: 'Glass', description: g.name, qty: round2(a), unit: 'm²', unitPrice: g.pricePerSqm, total });
  }
  for (const c of cat.countertops) {
    const a = sum(usage.get(`counter:${c.id}`) ?? []);
    if (!a) continue;
    const total = a * c.pricePerSqm;
    charged.set(`counter:${c.id}`, total);
    costLines.push({ key: `counter:${c.id}`, group: 'Countertops', description: c.name, qty: round2(a), unit: 'm²', unitPrice: c.pricePerSqm, total });
  }

  const barPlans: BarPlan[] = [];
  for (const prof of cat.aluminium) {
    const pieces: number[] = [];
    entries.forEach((e) => {
      for (const a of e.build.aluminium) if (a.profileId === prof.id) for (let k = 0; k < e.qty; k++) pieces.push(...a.pieces);
    });
    if (!pieces.length) continue;
    const plan = packBars(prof, pieces, pr.kerf);
    barPlans.push(plan);
    charged.set(`alu:${prof.id}`, plan.cost);
    costLines.push({ key: `alu:${prof.id}`, group: 'Aluminium', description: prof.name, qty: plan.bars.length, unit: `× ${prof.stockLength / 1000}m`, unitPrice: prof.pricePerLength, total: plan.cost, note: `${round2(plan.totalLength / 1000)}m cut, ${round2(plan.offcut / 1000)}m offcut` });
  }

  for (const a of cat.accessories) {
    const qty = sum(usage.get(`hw:${a.id}`) ?? []);
    if (!qty) continue;
    const packs = accessoryPacks(a, qty);
    const total = packs * a.price;
    charged.set(`hw:${a.id}`, total);
    const unitLabel = a.unit === 'm' ? 'm' : a.packQty > 1 ? `pack of ${a.packQty}` : a.unit;
    costLines.push({ key: `hw:${a.id}`, group: 'Hardware', description: `${a.name} ${a.size}`.trim(), qty: a.unit === 'm' ? round2(packs) : packs, unit: unitLabel, unitPrice: a.price, total, note: a.packQty > 1 && a.unit !== 'm' ? `${Math.ceil(qty)} pcs needed` : undefined });
  }

  for (const ap of cat.appliances) {
    const qty = sum(usage.get(`appl:${ap.id}`) ?? []);
    if (!qty) continue;
    const total = q.includeAppliances ? qty * ap.price : 0;
    charged.set(`appl:${ap.id}`, total);
    costLines.push({ key: `appl:${ap.id}`, group: 'Appliances', description: `${ap.name} (${ap.width}×${ap.height})`, qty, unit: 'pc', unitPrice: q.includeAppliances ? ap.price : 0, total, note: q.includeAppliances ? undefined : 'supplied by client' });
  }

  /* --------------------------------------------------- allocate to entries */
  const matPerEntry = new Array(entries.length).fill(0);
  const applPerEntry = new Array(entries.length).fill(0);
  for (const [key, arr] of usage) {
    const total = charged.get(key) ?? 0;
    const s = sum(arr);
    if (!s) continue;
    const target = key.startsWith('appl:') ? applPerEntry : matPerEntry;
    arr.forEach((v, i) => (target[i] += (total * v) / s));
  }
  const markupF = 1 + q.markupPercent / 100;
  const entryLabour = entries.map((e, i) =>
    e.labourOverride != null ? e.labourOverride * e.qty : pr.labourMode === 'percent' ? (matPerEntry[i] * pr.labourPercent) / 100 : e.unit ? pr.labourPerUnit * e.qty : 0,
  );
  const entryInstall = entries.map((_, i) => (q.installation ? (matPerEntry[i] * pr.installationPercent) / 100 : 0));

  const items: ItemPrice[] = rawItems.map((it) => {
    const idx = it.entries.map((e) => entries.indexOf(e));
    const materials = sum(idx.map((i) => matPerEntry[i]));
    const appliances = sum(idx.map((i) => applPerEntry[i]));
    const labour = sum(idx.map((i) => entryLabour[i]));
    const installation = sum(idx.map((i) => entryInstall[i]));
    const cost = materials + appliances + labour + installation;
    const sell = round2(cost * markupF);
    return { ...it, materials, appliances, labour, installation, cost, sell, sellEach: round2(sell / Math.max(1, it.qty)) };
  });

  const appliancesCost = sum(items.map((u) => u.appliances));
  const materialsCost = sum(items.map((u) => u.materials)) + appliancesCost;
  const labour = sum(items.map((u) => u.labour));
  const installation = sum(items.map((u) => u.installation));
  const unitsSell = sum(items.map((u) => u.sell));
  const markup = unitsSell - (materialsCost + labour + installation);
  const transportOpt = pr.transportOptions.find((t) => t.id === q.transportId);
  const transport = (transportOpt?.price ?? 0) + (q.transportCustom || 0);
  const extras = sum(q.extras.map((e) => e.qty * e.unitPrice));
  const subtotal = round2(unitsSell + transport + extras);
  const discount = round2(q.discountType === 'percent' ? (subtotal * q.discountValue) / 100 : Math.min(q.discountValue, subtotal));
  const taxable = subtotal - discount;
  const tax = q.applyTax ? round2((taxable * pr.taxRate) / 100) : 0;
  return { items, entries, boardPlans, barPlans, joins, costLines, materialsCost, appliancesCost, labour, installation, markup, unitsSell, transport, extras, subtotal, discount, taxable, tax, total: round2(taxable + tax), warnings: [...new Set(warnings)] };
}

/* --------------------------------------------------------------- invoices */

export interface InvoiceCalc {
  subtotal: number;
  discount: number;
  taxable: number;
  tax: number;
  total: number;
  depositDue: number;
  paid: number;
  balance: number;
  status: 'unpaid' | 'deposit paid' | 'partially paid' | 'paid';
}

export function calculateInvoice(inv: Invoice, settings: Settings): InvoiceCalc {
  const subtotal = round2(sum(inv.lines.map((l) => l.qty * l.unitPrice)));
  const discount = round2(inv.discountType === 'percent' ? (subtotal * inv.discountValue) / 100 : Math.min(inv.discountValue, subtotal));
  const taxable = subtotal - discount;
  const tax = inv.applyTax ? round2((taxable * settings.pricing.taxRate) / 100) : 0;
  const total = round2(taxable + tax);
  const depositDue = round2(inv.depositType === 'percent' ? (total * inv.depositValue) / 100 : Math.min(inv.depositValue, total));
  const paid = round2(sum(inv.payments.map((p) => p.amount)));
  const balance = round2(total - paid);
  const status = paid <= 0 ? 'unpaid' : balance <= 0.004 ? 'paid' : paid + 0.004 >= depositDue && depositDue > 0 ? 'deposit paid' : 'partially paid';
  return { subtotal, discount, taxable, tax, total, depositDue, paid, balance, status };
}

/** Balance remaining immediately after a given payment (for receipts). */
export function balanceAfterPayment(inv: Invoice, settings: Settings, paymentId: string): { paidToDate: number; balance: number; total: number } {
  const { total } = calculateInvoice(inv, settings);
  const sorted = [...inv.payments].sort((a, b) => a.date.localeCompare(b.date));
  let paidToDate = 0;
  for (const p of sorted) {
    paidToDate += p.amount;
    if (p.id === paymentId) break;
  }
  return { paidToDate: round2(paidToDate), balance: round2(total - paidToDate), total };
}
