// "Measure a space": given the width, height and depth of an opening or wall,
// work out what fits, size units to fill it, and lay out a kitchen run that
// uses the width exactly — for quick quotes on site.
import { createUnit, PRODUCT_LABELS, PRODUCT_ORDER } from './presets';
import { baseModule, customModule, gapModule, syncRun, tallModule, createRun, type BaseTemplate } from './runs';
import type { Appliance, Catalog, ProductType, Run, Unit } from './types';
import { deepClone, uid } from './util';

export interface Space {
  width: number;
  height: number;
  depth: number;
  /** Gap left each side for scribing / fitting (built-in). */
  sideGap: number;
  /** Gap left at the top (built-in). */
  topGap: number;
}

/** Which sizes a product fills: the whole height (wardrobes) or its normal height (base units). */
const FILLS_HEIGHT: Partial<Record<ProductType, boolean>> = { wardrobe: true, sliding_wardrobe: true, built_in: true, bookshelf: true, kitchen_tall: true, custom: true };
/** Comfortable bay width per product (bays are repeated to fill wide spaces). */
const IDEAL_BAY: Partial<Record<ProductType, number>> = { wardrobe: 600, sliding_wardrobe: 800, built_in: 600, bookshelf: 700, kitchen_base: 600, kitchen_wall: 600, kitchen_tall: 600, tv_stand: 600, vanity: 600, island: 600, custom: 600 };
const MIN_WIDTH: Partial<Record<ProductType, number>> = { kitchen_base: 150, kitchen_wall: 150, tv_stand: 600, island: 900, wardrobe: 400, sliding_wardrobe: 1000 };

export interface FitResult {
  type: ProductType;
  label: string;
  unit: Unit | null;
  standard: { w: number; h: number; d: number; fits: boolean; sideBySide: number; leftover: number };
  note: string;
}

export function usable(sp: Space) {
  return { w: Math.max(0, sp.width - 2 * sp.sideGap), h: Math.max(0, sp.height - sp.topGap), d: sp.depth };
}

/** A unit of this type sized to fill the space (null when it can't be made to fit). */
export function fitUnit(type: ProductType, sp: Space): Unit | null {
  const u = createUnit(type);
  const { w, h, d } = usable(sp);
  if (w < (MIN_WIDTH[type] ?? 150) || h < 200 || d < 100) return null;
  u.width = Math.round(w);
  if (FILLS_HEIGHT[type] || h < u.height) u.height = Math.round(Math.min(h, type === 'kitchen_wall' ? 1200 : h));
  u.depth = Math.round(Math.min(d, Math.max(u.depth, type === 'island' ? d : u.depth)));
  if (d < u.depth) u.depth = Math.round(d);
  if (sp.sideGap > 0 || sp.topGap > 0) u.installType = 'builtIn';
  // repeat the template's bays so each stays a sensible width
  const ideal = IDEAL_BAY[type] ?? 600;
  const want = Math.max(1, Math.min(12, Math.round(u.width / ideal)));
  if (u.bays.length && want !== u.bays.length && !u.sliding.enabled) {
    const src = u.bays;
    u.bays = Array.from({ length: want }, (_, i) => {
      const b = deepClone(src[i % src.length]);
      b.id = uid('b');
      b.sections.forEach((s) => (s.id = uid('s')));
      return b;
    });
  }
  u.name = `${PRODUCT_LABELS[type]} ${u.width}×${u.height}×${u.depth}`;
  return u;
}

export function fitAll(sp: Space, only?: ProductType | 'any'): FitResult[] {
  const { w, h, d } = usable(sp);
  return PRODUCT_ORDER.filter((t) => !only || only === 'any' || only === t).map((type) => {
    const std = createUnit(type);
    const sh = std.mount === 'wall' ? std.height : std.height;
    const fits = std.width <= w && sh <= h && std.depth <= d;
    const n = Math.floor(w / std.width);
    const unit = fitUnit(type, sp);
    const note = !unit ? 'Too small for this item' : unit.depth < std.depth ? `Shallower than standard (${std.depth} → ${unit.depth} mm)` : unit.height < std.height ? `Lower than standard (${std.height} → ${unit.height} mm)` : 'Fits';
    return { type, label: PRODUCT_LABELS[type], unit, standard: { w: std.width, h: sh, d: std.depth, fits, sideBySide: n, leftover: Math.round(w - n * std.width) }, note };
  });
}

const STD_WIDTHS = [1000, 900, 800, 600, 500, 450, 400, 300];

/** Split a length into standard cabinet widths; the last cabinet takes up the odd size, under 150 mm becomes a filler. */
export function splitWidths(len: number): { widths: number[]; filler: number } {
  const widths: number[] = [];
  let left = Math.round(len);
  while (left >= 150) {
    const x = STD_WIDTHS.find((s) => s <= left && (left - s === 0 || left - s >= 300)) ?? Math.min(left, 1000);
    widths.push(x);
    left -= x;
  }
  return { widths, filler: left };
}

/** A straight kitchen that uses the measured wall exactly. */
export function fitKitchen(sp: Space): Run | null {
  const { w, h, d } = usable(sp);
  if (w < 600) return null;
  const run = createRun('straight');
  run.name = `Kitchen – ${sp.width} mm wall`;
  run.baseDepth = Math.min(560, Math.max(300, d - 40));
  run.tallHeight = Math.min(2200, Math.max(1800, h - 50));
  run.wallBottom = Math.min(run.wallBottom, Math.max(1300, h - run.wallHeight - 50));
  run.targets = [w, null, null];
  const mods = [];
  let left = w;
  if (w >= 3000 && h >= 2000) {
    mods.push(tallModule('fridge', run, 600));
    left -= 600;
  }
  const wanted: [BaseTemplate, number, 'doors' | 'hood' | 'glass' | 'door'][] = [
    ['drawers', 600, 'doors'],
    ['hob', 600, 'hood'],
    ['doors', 800, 'doors'],
    ['sink', 900, 'glass'],
    ['dishwasher', 600, 'door'],
  ];
  for (const [tpl, wd, wall] of wanted) {
    if (left - wd < 0) continue;
    mods.push(baseModule(tpl, run, wall, wd));
    left -= wd;
  }
  const { widths, filler } = splitWidths(left);
  for (const wd of widths) mods.push(baseModule(wd <= 450 ? 'door' : 'doors', run, 'doors', wd));
  if (filler > 0) mods.push(customModule({ kind: 'filler', width: filler, height: null, depth: null }, run));
  run.legs[0] = mods;
  syncRun(run);
  void gapModule;
  return run;
}

export function appliancesThatFit(cat: Catalog, sp: Space): Appliance[] {
  const { w, h, d } = usable(sp);
  return cat.appliances.filter((a) => a.width <= w && a.height <= h && a.depth <= d).sort((a, b) => a.category.localeCompare(b.category) || b.width - a.width);
}
