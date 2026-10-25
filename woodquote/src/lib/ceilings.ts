// Ceilings: rhinoboard (gypsum) and PVC strip ceilings, worked out per room
// from its size – boards or strips, brandering and its nails, board fixings,
// jointing, cornices / trims, paint, insulation, designs, labour and demolition.
import { defaultCeilingRates } from './defaults';
import type { Catalog, CeilingArea, CeilingJob, CeilingProduct, CeilingRates, CeilingSystem, Settings } from './types';
import { round2, uid } from './util';
import { tradeTotals, type TradeArea, type TradeCalc, type TradeLine } from './trades';

export const CEILING_SYSTEMS: Record<CeilingSystem, string> = { rhino: 'Rhinoboard (gypsum board)', pvc: 'PVC strip ceiling' };

export const ceilingRates = (s: Settings): CeilingRates => ({ ...defaultCeilingRates(), ...s.ceilingRates });

const products = (cat: Catalog) => cat.ceilingProducts ?? [];
export const ceilingProduct = (cat: Catalog, id: string | null | undefined) => products(cat).find((p) => p.id === id);
/** Products of one kind that suit a ceiling system. */
export const ceilingChoices = (cat: Catalog, kind: CeilingProduct['kind'] | CeilingProduct['kind'][], system?: CeilingSystem) => {
  const kinds = Array.isArray(kind) ? kind : [kind];
  return products(cat).filter((p) => kinds.includes(p.kind) && (!system || !p.system || p.system === 'both' || p.system === system));
};

/** A room with sensible defaults for the chosen system (first matching products from the price list). */
export function newCeilingArea(cat: Catalog, system: CeilingSystem = 'rhino', name = 'Room'): CeilingArea {
  const first = (k: CeilingProduct['kind']) => ceilingChoices(cat, k, system)[0]?.id ?? null;
  return {
    id: uid('ca'),
    name,
    length: 4000,
    width: 3500,
    area: null,
    perimeter: null,
    system,
    boardId: system === 'rhino' ? first('board') : first('pvc'),
    branderingId: first('brandering'),
    branderingSpacing: system === 'rhino' ? 400 : 600,
    trussSpacing: 760,
    corniceId: system === 'rhino' ? first('cornice') : first('trim'),
    paintId: system === 'rhino' ? first('paint') : null,
    coats: 2,
    colour: system === 'rhino' ? 'White' : '',
    insulationId: null,
    downlights: 0,
    demolish: false,
    designs: [],
    notes: '',
  };
}

/** Switch a room between rhinoboard and PVC, picking matching products. */
export function setCeilingSystem(a: CeilingArea, system: CeilingSystem, cat: Catalog) {
  if (a.system === system) return;
  const n = newCeilingArea(cat, system, a.name);
  Object.assign(a, { system, boardId: n.boardId, corniceId: n.corniceId, paintId: n.paintId, branderingSpacing: n.branderingSpacing, colour: n.colour });
}

export const newCeilingJob = (s: Settings): CeilingJob => {
  const r = ceilingRates(s);
  return { areas: [], extras: [], markupPercent: r.markupPercent, wastePercent: r.wastePercent };
};

export const ceilingArea = (a: CeilingArea) => (a.area && a.area > 0 ? a.area : (a.length * a.width) / 1e6);
export const ceilingPerimeter = (a: CeilingArea) => (a.perimeter && a.perimeter > 0 ? a.perimeter : (2 * (a.length + a.width)) / 1000);

/** Everything one room needs. */
export function ceilingAreaLines(a: CeilingArea, job: CeilingJob, cat: Catalog, r: CeilingRates): { lines: TradeLine[]; warnings: string[]; summary: string } {
  const lines: TradeLine[] = [];
  const warnings: string[] = [];
  const A = ceilingArea(a);
  const P = ceilingPerimeter(a);
  const waste = 1 + Math.max(0, job.wastePercent) / 100;
  const room = a.name;
  const mat = (p: CeilingProduct | undefined, qty: number, note = '') => {
    if (!p || qty <= 0) return;
    lines.push({ area: room, kind: 'material', group: 'Materials', description: p.name, qty, unit: p.unit, unitPrice: p.price, total: round2(qty * p.price), note });
  };
  const lab = (description: string, qty: number, unit: string, rate: number) => {
    if (qty <= 0 || rate <= 0) return;
    lines.push({ area: room, kind: 'labour', group: 'Labour', description, qty: round2(qty), unit, unitPrice: rate, total: round2(qty * rate) });
  };
  const long = Math.max(a.length, a.width) / 1000;
  const short = Math.min(a.length, a.width) / 1000;

  // boards / strips
  const board = ceilingProduct(cat, a.boardId);
  if (!board) warnings.push(`${room}: choose a ${a.system === 'rhino' ? 'board' : 'PVC strip'}.`);
  else {
    const each = ((board.length ?? 3000) * (board.width ?? 1200)) / 1e6;
    mat(board, Math.ceil((A * waste) / Math.max(0.01, each)), `${round2(A)} m² + ${job.wastePercent}% waste`);
  }

  // brandering: rows across the short side, each running the long side; nailed at every truss
  const brand = ceilingProduct(cat, a.branderingId);
  const sp = Math.max(200, a.branderingSpacing) / 1000;
  const rows = Math.floor(short / sp) + 1;
  const branderingM = rows * long * (A / Math.max(0.01, long * short));
  if (brand) {
    const len = (brand.length ?? 6600) / 1000;
    mat(brand, Math.ceil((branderingM * 1.05) / len), `${rows} rows at ${a.branderingSpacing} mm centres ≈ ${Math.round(branderingM)} m`);
  }
  const crossings = Math.ceil(rows * (long / (Math.max(300, a.trussSpacing) / 1000) + 1) * (A / Math.max(0.01, long * short)));
  const nails = ceilingChoices(cat, 'fixing').find((p) => /nail/i.test(p.name));
  if (nails) mat(nails, Math.max(1, Math.ceil((crossings * 2) / Math.max(1, nails.coverage ?? 200))), `${crossings * 2} nails into the trusses`);

  // board fixings
  if (a.system === 'rhino') {
    const screws = ceilingChoices(cat, 'fixing', 'rhino').find((p) => /screw/i.test(p.name));
    const n = Math.ceil(A * (1 / sp) * (1000 / 150)); // every 150 mm along each brandering
    if (screws) mat(screws, Math.max(1, Math.ceil(n / Math.max(1, screws.coverage ?? 1000))), `≈ ${n} screws`);
    // jointing: long-edge joints every board width plus butt joints
    const bw = (board?.width ?? 1200) / 1000;
    const bl = (board?.length ?? 3000) / 1000;
    const joints = A / bw + A / bl;
    const tape = ceilingChoices(cat, 'tape', 'rhino')[0];
    if (tape) mat(tape, Math.max(1, Math.ceil((joints * 1.1) / Math.max(1, tape.coverage ?? 90))), `≈ ${Math.round(joints)} m of joints`);
    const filler = ceilingChoices(cat, 'filler', 'rhino')[0];
    if (filler) mat(filler, Math.max(1, Math.ceil(A / Math.max(1, filler.coverage ?? 40))));
  } else {
    const clips = ceilingChoices(cat, 'fixing', 'pvc').find((p) => /pvc|clip/i.test(p.name));
    const sw = (board?.width ?? 250) / 1000;
    const n = Math.ceil(A * (1 / sp) * (1 / sw));
    if (clips) mat(clips, Math.max(1, Math.ceil(n / Math.max(1, clips.coverage ?? 500))), `≈ ${n} fixings`);
  }

  // cornice / wall trim round the room
  const cornice = ceilingProduct(cat, a.corniceId);
  if (cornice) {
    const len = (cornice.length ?? 3000) / 1000;
    mat(cornice, Math.ceil((P * 1.1) / len), `${round2(P)} m perimeter`);
    if (a.system === 'rhino' && cornice.kind === 'cornice') {
      const adh = ceilingChoices(cat, 'adhesive', 'rhino')[0];
      if (adh) mat(adh, Math.max(1, Math.ceil(P / Math.max(1, adh.coverage ?? 30))));
    }
    lab(cornice.kind === 'cornice' ? 'Fit cornice' : 'Fit wall trim', P, 'm', r.cornicePerM);
  }

  // paint (rhinoboard)
  const paint = ceilingProduct(cat, a.paintId);
  if (paint && a.system === 'rhino' && a.coats > 0) {
    mat(paint, Math.max(1, Math.ceil((A * a.coats) / Math.max(1, paint.coverage ?? 40))), `${a.coats} coat${a.coats === 1 ? '' : 's'}${a.colour ? `, ${a.colour}` : ''}`);
    lab(`Paint ceiling (${a.coats} coat${a.coats === 1 ? '' : 's'})`, A, 'm²', r.paintPerM2);
  }

  // insulation
  const ins = ceilingProduct(cat, a.insulationId);
  if (ins) {
    mat(ins, Math.ceil(A / Math.max(1, ins.coverage ?? 10)));
    lab('Lay insulation', A, 'm²', r.insulationPerM2);
  }

  // labour, demolition, cut-outs and designs
  if (a.demolish) lab('Remove old ceiling (renovation)', A, 'm²', r.demolitionPerM2);
  lab(`Install ${a.system === 'rhino' ? 'rhinoboard' : 'PVC'} ceiling with brandering`, A, 'm²', a.system === 'rhino' ? r.rhinoPerM2 : r.pvcPerM2);
  if (a.downlights > 0) lab('Light cut-outs', a.downlights, 'each', r.downlightEach);
  for (const d of a.designs) if (d.qty > 0) lines.push({ area: room, kind: 'labour', group: 'Design', description: d.name, qty: d.qty, unit: d.unit, unitPrice: d.price, total: round2(d.qty * d.price) });

  if (a.branderingSpacing > 600) warnings.push(`${room}: brandering wider than 600 mm apart will let the ceiling sag.`);
  if (a.system === 'pvc' && board && (board.length ?? 6000) / 1000 < short) warnings.push(`${room}: PVC strips are shorter than the room – plan H-joints.`);
  const sys = a.system === 'rhino' ? `${board?.name ?? 'Rhinoboard'}` : `${board?.name ?? 'PVC strips'}`;
  const summary = [
    `${(a.length / 1000).toFixed(2)} × ${(a.width / 1000).toFixed(2)} m (${round2(A)} m²)`,
    sys,
    brand ? `brandering at ${a.branderingSpacing} mm centres` : '',
    cornice ? cornice.name : '',
    paint && a.system === 'rhino' ? `painted${a.colour ? ` ${a.colour}` : ''}` : '',
    a.designs.filter((d) => d.qty > 0).map((d) => `${d.name} ${d.qty} ${d.unit}`).join(', '),
    a.downlights ? `${a.downlights} light cut-outs` : '',
    a.demolish ? 'old ceiling removed' : '',
  ].filter(Boolean);
  return { lines, warnings, summary: summary.join(' · ') };
}

export function calculateCeilings(job: CeilingJob | undefined, cat: Catalog, s: Settings): TradeCalc | null {
  if (!job || (!job.areas.length && !job.extras.length)) return null;
  const r = ceilingRates(s);
  const areas: TradeArea[] = [];
  const lines: TradeLine[] = [];
  const warnings: string[] = [];
  for (const a of job.areas) {
    const x = ceilingAreaLines(a, job, cat, r);
    lines.push(...x.lines);
    warnings.push(...x.warnings);
    areas.push({ id: a.id, name: a.name, size: round2(ceilingArea(a)), summary: x.summary, lines: x.lines });
  }
  return tradeTotals('ceilings', 'Ceilings', areas, lines, job.extras, job.markupPercent, warnings);
}
