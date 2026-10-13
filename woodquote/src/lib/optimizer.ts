// Sheet cutting optimiser. Packs rectangular parts onto stock sheets, accounting
// for saw kerf, edge trim and grain direction, and reports how much of each sheet
// is used, how much is a reusable offcut and how much is waste.
//
// Two strategies:
//  - guillotine: every cut runs edge-to-edge (panel saw / table saw friendly)
//  - nested: MaxRects free-form nesting (CNC friendly, usually tighter)
import type { AluminiumProfile, BoardMaterial } from './types';

export interface Piece {
  id: string;
  label: string;
  length: number; // along grain
  width: number;
  canRotate: boolean;
}

export interface Placement {
  piece: Piece;
  x: number; // along sheet length
  y: number; // along sheet width
  l: number; // placed size along sheet length
  w: number;
  rotated: boolean;
}

export interface Rect {
  x: number;
  y: number;
  w: number; // along sheet length
  h: number; // along sheet width
}

export interface SheetLayout {
  placements: Placement[];
  usedArea: number; // mm² of parts
  offcuts: Rect[]; // reusable leftovers
  offcutArea: number;
  wasteArea: number; // sheet area - used - reusable offcuts
}

export interface CutOptions {
  kerf: number;
  trim: number;
  minOffcut: number;
  mode: 'guillotine' | 'nested';
}

export interface SheetPlan {
  sheets: SheetLayout[];
  oversize: Piece[];
  sheetArea: number;
  partsArea: number;
  utilisation: number; // 0..1 of purchased sheet area
}

const fitsIn = (r: Rect, l: number, w: number) => l <= r.w && w <= r.h;

function orientations(p: Piece, kerf: number): { l: number; w: number; rotated: boolean }[] {
  const o = [{ l: p.length + kerf, w: p.width + kerf, rotated: false }];
  if (p.canRotate && p.length !== p.width) o.push({ l: p.width + kerf, w: p.length + kerf, rotated: true });
  return o;
}

/* ------------------------------------------------------------ guillotine */

interface GuillotineBin {
  free: Rect[];
  placements: Placement[];
}

type Heuristic = 'area' | 'shortSide' | 'longSide';

function score(h: Heuristic, f: Rect, l: number, w: number): number {
  const lw = f.w - l;
  const lh = f.h - w;
  if (h === 'area') return f.w * f.h - l * w;
  if (h === 'shortSide') return Math.min(lw, lh) * 1e6 + Math.max(lw, lh);
  return Math.max(lw, lh) * 1e6 + Math.min(lw, lh);
}

function guillotineInsert(bin: GuillotineBin, p: Piece, kerf: number, h: Heuristic): boolean {
  let best: { fi: number; l: number; w: number; rotated: boolean; score: number } | null = null;
  bin.free.forEach((f, fi) => {
    for (const o of orientations(p, kerf)) {
      if (!fitsIn(f, o.l, o.w)) continue;
      const sc = score(h, f, o.l, o.w);
      if (!best || sc < best.score) best = { fi, ...o, score: sc };
    }
  });
  if (!best) return false;
  const b = best as { fi: number; l: number; w: number; rotated: boolean };
  const f = bin.free[b.fi];
  bin.placements.push({ piece: p, x: f.x, y: f.y, l: b.l - kerf, w: b.w - kerf, rotated: b.rotated });
  // split along the shorter leftover axis so the larger remainder stays whole
  const rw = f.w - b.l;
  const rh = f.h - b.w;
  const right: Rect = rw < rh ? { x: f.x + b.l, y: f.y, w: rw, h: b.w } : { x: f.x + b.l, y: f.y, w: rw, h: f.h };
  const top: Rect = rw < rh ? { x: f.x, y: f.y + b.w, w: f.w, h: rh } : { x: f.x, y: f.y + b.w, w: b.l, h: rh };
  bin.free.splice(b.fi, 1);
  if (right.w > 0 && right.h > 0) bin.free.push(right);
  if (top.w > 0 && top.h > 0) bin.free.push(top);
  return true;
}

/* -------------------------------------------------------------- maxrects */

interface MaxRectsBin {
  free: Rect[];
  placements: Placement[];
}

const intersects = (a: Rect, b: Rect) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
const contains = (a: Rect, b: Rect) => b.x >= a.x && b.y >= a.y && b.x + b.w <= a.x + a.w && b.y + b.h <= a.y + a.h;

function maxRectsInsert(bin: MaxRectsBin, p: Piece, kerf: number, h: Heuristic): boolean {
  let best: { r: Rect; rotated: boolean; s: number } | null = null;
  for (const f of bin.free) {
    for (const o of orientations(p, kerf)) {
      if (!fitsIn(f, o.l, o.w)) continue;
      const s = score(h, f, o.l, o.w);
      if (!best || s < best.s) best = { r: { x: f.x, y: f.y, w: o.l, h: o.w }, rotated: o.rotated, s };
    }
  }
  if (!best) return false;
  const used = best.r;
  bin.placements.push({ piece: p, x: used.x, y: used.y, l: used.w - kerf, w: used.h - kerf, rotated: best.rotated });
  const next: Rect[] = [];
  for (const f of bin.free) {
    if (!intersects(f, used)) {
      next.push(f);
      continue;
    }
    if (used.x > f.x) next.push({ x: f.x, y: f.y, w: used.x - f.x, h: f.h });
    if (used.x + used.w < f.x + f.w) next.push({ x: used.x + used.w, y: f.y, w: f.x + f.w - used.x - used.w, h: f.h });
    if (used.y > f.y) next.push({ x: f.x, y: f.y, w: f.w, h: used.y - f.y });
    if (used.y + used.h < f.y + f.h) next.push({ x: f.x, y: used.y + used.h, w: f.w, h: f.y + f.h - used.y - used.h });
  }
  bin.free = next.filter((r, i) => !next.some((o, j) => j !== i && contains(o, r) && (!contains(r, o) || j < i)));
  return true;
}

/** Pick non-overlapping free rectangles that are big enough to reuse. */
function reusableOffcuts(free: Rect[], minOffcut: number, kerf: number): Rect[] {
  const candidates = free
    .map((r) => ({ ...r, w: r.w - kerf, h: r.h - kerf }))
    .filter((r) => r.w >= minOffcut && r.h >= minOffcut)
    .sort((a, b) => b.w * b.h - a.w * a.h);
  const chosen: Rect[] = [];
  for (const c of candidates) if (!chosen.some((o) => intersects(o, c))) chosen.push(c);
  return chosen;
}

export function packSheets(pieces: Piece[], sheetLength: number, sheetWidth: number, opt: CutOptions): SheetPlan {
  const L = sheetLength - 2 * opt.trim + opt.kerf;
  const Wd = sheetWidth - 2 * opt.trim + opt.kerf;
  const sheetArea = sheetLength * sheetWidth;
  const oversize: Piece[] = [];
  const valid = pieces.filter((p) => {
    const ok = orientations(p, opt.kerf).some((o) => o.l <= L && o.w <= Wd);
    if (!ok) oversize.push(p);
    return ok;
  });
  const sorts: ((a: Piece, b: Piece) => number)[] = [
    (a, b) => Math.max(b.length, b.width) - Math.max(a.length, a.width) || b.length * b.width - a.length * a.width,
    (a, b) => b.length * b.width - a.length * a.width,
    (a, b) => b.length - a.length || b.width - a.width,
    (a, b) => b.width - a.width || b.length - a.length,
  ];
  const heuristics: Heuristic[] = ['shortSide', 'area', 'longSide'];
  const insert = opt.mode === 'guillotine' ? guillotineInsert : maxRectsInsert;

  // Try several orderings/heuristics; keep the plan with the fewest sheets and,
  // on a tie, the biggest reusable leftover on the last sheet.
  let bins: (GuillotineBin | MaxRectsBin)[] = [];
  let bestScore = Infinity;
  for (const sortFn of sorts) {
    const sorted = [...valid].sort(sortFn);
    for (const h of heuristics) {
      const trial: (GuillotineBin | MaxRectsBin)[] = [];
      for (const p of sorted) {
        if (trial.some((b) => insert(b, p, opt.kerf, h))) continue;
        const b = { free: [{ x: 0, y: 0, w: L, h: Wd }], placements: [] };
        insert(b, p, opt.kerf, h);
        trial.push(b);
      }
      const last = trial[trial.length - 1];
      const lastFree = last ? Math.max(0, ...last.free.map((r) => r.w * r.h)) : 0;
      const sc = trial.length * 1e12 - lastFree;
      if (sc < bestScore) {
        bestScore = sc;
        bins = trial;
      }
    }
  }

  const sheets: SheetLayout[] = bins.map((b) => {
    const usedArea = b.placements.reduce((a, p) => a + p.l * p.w, 0);
    const offcuts = reusableOffcuts(b.free, opt.minOffcut, opt.kerf).map((r) => ({ ...r, x: r.x + opt.trim, y: r.y + opt.trim }));
    const offcutArea = offcuts.reduce((a, r) => a + r.w * r.h, 0);
    return {
      placements: b.placements.map((p) => ({ ...p, x: p.x + opt.trim, y: p.y + opt.trim })),
      usedArea,
      offcuts,
      offcutArea,
      wasteArea: Math.max(0, sheetArea - usedArea - offcutArea),
    };
  });
  const partsArea = valid.reduce((a, p) => a + p.length * p.width, 0);
  return { sheets, oversize, sheetArea, partsArea, utilisation: sheets.length ? partsArea / (sheets.length * sheetArea) : 0 };
}

export interface BoardPlan extends SheetPlan {
  material: BoardMaterial;
  fullSheetsCost: number;
  usedCost: number; // value of the board area that ends up in parts
  offcutValue: number; // value of reusable offcuts
  wasteCost: number; // value of unusable waste (incl. kerf & trim)
  chargedCost: number; // what the quotation charges for this board
}

export function priceBoardPlan(material: BoardMaterial, plan: SheetPlan, charging: 'fullSheets' | 'usedArea'): BoardPlan {
  const perMm2 = material.pricePerSheet / plan.sheetArea;
  const fullSheetsCost = plan.sheets.length * material.pricePerSheet;
  const usedCost = plan.partsArea * perMm2;
  const offcutValue = plan.sheets.reduce((a, s) => a + s.offcutArea, 0) * perMm2;
  const wasteCost = Math.max(0, fullSheetsCost - usedCost - offcutValue);
  const chargedCost = charging === 'fullSheets' ? fullSheetsCost : fullSheetsCost - offcutValue;
  return { ...plan, material, fullSheetsCost, usedCost, offcutValue, wasteCost, chargedCost };
}

/* ---------------------------------------------- 1D (aluminium) optimiser */

export interface BarPlan {
  profile: AluminiumProfile;
  bars: number[][]; // pieces per stock bar
  totalLength: number;
  offcut: number; // leftover length across bars
  cost: number;
  oversize: number[];
}

export function packBars(profile: AluminiumProfile, pieces: number[], kerf: number): BarPlan {
  const oversize = pieces.filter((p) => p > profile.stockLength);
  const sorted = pieces.filter((p) => p <= profile.stockLength).sort((a, b) => b - a);
  const bars: { left: number; cuts: number[] }[] = [];
  for (const p of sorted) {
    const bar = bars.find((b) => b.left >= p);
    if (bar) {
      bar.cuts.push(p);
      bar.left -= p + kerf;
    } else bars.push({ left: profile.stockLength - p - kerf, cuts: [p] });
  }
  const totalLength = pieces.reduce((a, b) => a + b, 0);
  return {
    profile,
    bars: bars.map((b) => b.cuts),
    totalLength,
    offcut: bars.reduce((a, b) => a + Math.max(0, b.left), 0),
    cost: (bars.length + oversize.length * 2) * profile.pricePerLength,
    oversize,
  };
}
