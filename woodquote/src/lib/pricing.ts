// Quotation maths: builds every unit, optimises sheets across the whole job,
// prices materials/hardware, then allocates costs back to each unit so unit
// prices always add up to the quote total.
import { buildUnit } from './generate';
import { packBars, packSheets, priceBoardPlan, type BarPlan, type BoardPlan, type Piece } from './optimizer';
import type { Accessory, Catalog, Invoice, Quote, Settings, Unit, UnitBuild } from './types';
import { round2, sum } from './util';

export type CostGroup = 'Boards' | 'Edge banding' | 'Glass' | 'Aluminium' | 'Countertops' | 'Hardware';

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

export interface UnitPrice {
  unit: Unit;
  build: UnitBuild;
  materials: number; // allocated material + hardware cost for all qty
  labour: number;
  installation: number;
  cost: number;
  sell: number; // total selling price for all qty
  sellEach: number;
}

export interface QuoteCalc {
  units: UnitPrice[];
  boardPlans: BoardPlan[];
  barPlans: BarPlan[];
  costLines: CostLine[];
  materialsCost: number;
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

export const accessoryPacks = (a: Accessory, qty: number): number =>
  a.unit === 'm' ? qty : Math.ceil(qty / Math.max(1, a.packQty));

export function calculateQuote(q: Quote, cat: Catalog, settings: Settings): QuoteCalc {
  const pr = settings.pricing;
  const builds = q.units.map((u) => ({ unit: u, build: buildUnit(u, cat, pr) }));
  const warnings: string[] = [];
  builds.forEach(({ unit, build }) => build.warnings.forEach((w) => warnings.push(`${unit.name}: ${w}`)));

  // usage[resourceKey][unitIndex] = raw quantity; charged[resourceKey] = cost
  const usage = new Map<string, number[]>();
  const charged = new Map<string, number>();
  const use = (key: string, ui: number, qty: number) => {
    const arr = usage.get(key) ?? new Array(q.units.length).fill(0);
    arr[ui] += qty;
    usage.set(key, arr);
  };
  const costLines: CostLine[] = [];

  /* ---------------------------------------------------------- boards */
  const piecesByBoard = new Map<string, Piece[]>();
  builds.forEach(({ unit, build }, ui) => {
    for (const p of build.parts) {
      if (p.kind !== 'board' || !p.materialId) continue;
      const mat = cat.boards.find((b) => b.id === p.materialId);
      if (!mat) continue;
      const n = p.qty * unit.qty;
      use(`board:${mat.id}`, ui, p.length * p.width * n);
      const list = piecesByBoard.get(mat.id) ?? [];
      for (let k = 0; k < n; k++) list.push({ id: `${unit.id}:${p.key}:${k}`, label: `${unit.name} – ${p.name}`, length: p.length, width: p.width, canRotate: !mat.grain });
      piecesByBoard.set(mat.id, list);
    }
  });
  const boardPlans: BoardPlan[] = [];
  for (const [id, pieces] of piecesByBoard) {
    const mat = cat.boards.find((b) => b.id === id)!;
    const plan = priceBoardPlan(mat, packSheets(pieces, mat.sheetLength, mat.sheetWidth, { kerf: pr.kerf, trim: pr.sheetTrim, minOffcut: pr.minOffcut, mode: pr.cutMode }), pr.boardCharging);
    boardPlans.push(plan);
    if (plan.oversize.length) warnings.push(`${plan.oversize.length} part(s) are larger than a ${mat.name} sheet — they need joining or a bigger board.`);
    charged.set(`board:${id}`, plan.chargedCost);
    costLines.push({
      key: `board:${id}`,
      group: 'Boards',
      description: mat.name,
      qty: plan.sheets.length,
      unit: 'sheet',
      unitPrice: mat.pricePerSheet,
      total: plan.chargedCost,
      note: `${Math.round(plan.utilisation * 100)}% used${pr.boardCharging === 'usedArea' && plan.offcutValue > 0 ? `, reusable offcuts credited` : ''}`,
    });
  }

  /* ----------------------------------------------- edging/glass/counters */
  builds.forEach(({ unit, build }, ui) => {
    for (const p of build.parts) {
      const n = p.qty * unit.qty;
      if (p.edgingId && p.edgeLength > 0) use(`edge:${p.edgingId}`, ui, p.edgeLength * n);
      if (p.kind === 'glass' && p.materialId) use(`glass:${p.materialId}`, ui, (p.length * p.width * n) / 1e6);
      if (p.kind === 'counter' && p.materialId) use(`counter:${p.materialId}`, ui, (p.length * p.width * n) / 1e6);
    }
    for (const a of build.aluminium) use(`alu:${a.profileId}`, ui, sum(a.pieces) * unit.qty);
    for (const h of build.hardware) use(`hw:${h.accessoryId}`, ui, h.qty * unit.qty);
  });

  for (const e of cat.edging) {
    const m = sum(usage.get(`edge:${e.id}`) ?? []);
    if (!m) continue;
    const metres = Math.ceil(m * (1 + pr.edgingWastePercent / 100));
    const total = metres * e.pricePerMeter;
    charged.set(`edge:${e.id}`, total);
    costLines.push({ key: `edge:${e.id}`, group: 'Edge banding', description: e.name, qty: metres, unit: 'm', unitPrice: e.pricePerMeter, total, note: `incl. ${pr.edgingWastePercent}% waste` });
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

  /* ------------------------------------------------------------ aluminium */
  const barPlans: BarPlan[] = [];
  for (const prof of cat.aluminium) {
    const pieces: number[] = [];
    builds.forEach(({ unit, build }) => {
      for (const a of build.aluminium) if (a.profileId === prof.id) for (let k = 0; k < unit.qty; k++) pieces.push(...a.pieces);
    });
    if (!pieces.length) continue;
    const plan = packBars(prof, pieces, pr.kerf);
    barPlans.push(plan);
    charged.set(`alu:${prof.id}`, plan.cost);
    costLines.push({ key: `alu:${prof.id}`, group: 'Aluminium', description: prof.name, qty: plan.bars.length, unit: `× ${prof.stockLength / 1000}m`, unitPrice: prof.pricePerLength, total: plan.cost, note: `${round2(plan.totalLength / 1000)}m cut, ${round2(plan.offcut / 1000)}m offcut` });
  }

  /* ------------------------------------------------------------- hardware */
  for (const a of cat.accessories) {
    const qty = sum(usage.get(`hw:${a.id}`) ?? []);
    if (!qty) continue;
    const packs = accessoryPacks(a, qty);
    const total = packs * a.price;
    charged.set(`hw:${a.id}`, total);
    const unitLabel = a.unit === 'm' ? 'm' : a.packQty > 1 ? `pack of ${a.packQty}` : a.unit;
    costLines.push({ key: `hw:${a.id}`, group: 'Hardware', description: `${a.name} ${a.size}`.trim(), qty: a.unit === 'm' ? round2(packs) : packs, unit: unitLabel, unitPrice: a.price, total, note: a.packQty > 1 && a.unit !== 'm' ? `${Math.ceil(qty)} pcs needed` : undefined });
  }

  /* --------------------------------------------------- allocate to units */
  const materialsPerUnit = new Array(q.units.length).fill(0);
  for (const [key, arr] of usage) {
    const total = charged.get(key) ?? 0;
    const s = sum(arr);
    if (!s) continue;
    arr.forEach((v, i) => (materialsPerUnit[i] += (total * v) / s));
  }
  const markupF = 1 + q.markupPercent / 100;
  const units: UnitPrice[] = builds.map(({ unit, build }, i) => {
    const materials = materialsPerUnit[i];
    const labour =
      unit.labourOverride != null
        ? unit.labourOverride * unit.qty
        : pr.labourMode === 'percent'
          ? (materials * pr.labourPercent) / 100
          : pr.labourPerUnit * unit.qty;
    const installation = q.installation ? (materials * pr.installationPercent) / 100 : 0;
    const cost = materials + labour + installation;
    const sell = round2(cost * markupF);
    return { unit, build, materials, labour, installation, cost, sell, sellEach: round2(sell / Math.max(1, unit.qty)) };
  });

  const materialsCost = sum(units.map((u) => u.materials));
  const labour = sum(units.map((u) => u.labour));
  const installation = sum(units.map((u) => u.installation));
  const unitsSell = sum(units.map((u) => u.sell));
  const markup = unitsSell - (materialsCost + labour + installation);
  const transportOpt = pr.transportOptions.find((t) => t.id === q.transportId);
  const transport = (transportOpt?.price ?? 0) + (q.transportCustom || 0);
  const extras = sum(q.extras.map((e) => e.qty * e.unitPrice));
  const subtotal = round2(unitsSell + transport + extras);
  const discount = round2(q.discountType === 'percent' ? (subtotal * q.discountValue) / 100 : Math.min(q.discountValue, subtotal));
  const taxable = subtotal - discount;
  const tax = q.applyTax ? round2((taxable * pr.taxRate) / 100) : 0;
  return {
    units,
    boardPlans,
    barPlans,
    costLines,
    materialsCost,
    labour,
    installation,
    markup,
    unitsSell,
    transport,
    extras,
    subtotal,
    discount,
    taxable,
    tax,
    total: round2(taxable + tax),
    warnings: [...new Set(warnings)],
  };
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
