// Tiling: floors and walls worked out per room – tiles and boxes (with waste
// for the laying pattern), adhesive and grout by weight, spacers, levelling
// clips, trims, skirting, waterproofing, primer, silicone, screed, demolition
// and labour.
import { defaultTilingRates } from './defaults';
import type { Catalog, Settings, TileArea, TilePattern, TileProduct, TileSupply, TileSupplyKind, TilingJob, TilingRates } from './types';
import { round2, uid } from './util';
import { tradeTotals, type TradeArea, type TradeCalc, type TradeLine } from './trades';

export const TILE_PATTERNS: Record<TilePattern, { label: string; waste: number }> = {
  straight: { label: 'Straight (grid)', waste: 10 },
  brick: { label: 'Brick / offset', waste: 12 },
  diagonal: { label: 'Diagonal 45°', waste: 15 },
  herringbone: { label: 'Herringbone', waste: 20 },
  chevron: { label: 'Chevron', waste: 20 },
};

export const tilingRates = (s: Settings): TilingRates => {
  const d = defaultTilingRates();
  return { ...d, ...s.tilingRates, patternExtra: { ...d.patternExtra, ...s.tilingRates?.patternExtra } };
};

export const tileProduct = (cat: Catalog, id: string | null | undefined) => (cat.tiles ?? []).find((t) => t.id === id);
export const tileSupply = (cat: Catalog, id: string | null | undefined) => (cat.tileSupplies ?? []).find((t) => t.id === id);
export const supplies = (cat: Catalog, kind: TileSupplyKind) => (cat.tileSupplies ?? []).filter((t) => t.kind === kind);

const isLarge = (t: TileProduct | undefined) => !!t && Math.max(t.width, t.height) >= 600;

/** A room with sensible defaults from the price list. */
export function newTileArea(cat: Catalog, surface: 'floor' | 'wall' = 'floor', name = 'Room'): TileArea {
  const tiles = cat.tiles ?? [];
  const tile = surface === 'floor' ? (tiles.find((t) => t.type === 'porcelain' && t.width === t.height) ?? tiles[0]) : (tiles.find((t) => /wall/i.test(t.name)) ?? tiles[0]);
  const area: TileArea = {
    id: uid('ta'),
    name,
    surface,
    length: surface === 'floor' ? 4000 : 3000,
    width: surface === 'floor' ? 3500 : 2400,
    deduct: 0,
    tileId: tile?.id ?? null,
    pattern: 'straight',
    waste: null,
    joint: 3,
    adhesiveId: null,
    groutId: supplies(cat, 'grout')[0]?.id ?? null,
    spacersId: null,
    levelling: false,
    trimLength: 0,
    trimId: supplies(cat, 'trim')[0]?.id ?? null,
    skirting: surface === 'floor',
    skirtingHeight: 100,
    waterproof: false,
    primer: false,
    silicone: surface === 'wall',
    demolish: false,
    screed: false,
    notes: '',
  };
  fitSupplies(area, cat);
  return area;
}

/** Adhesive, spacers and levelling that suit the chosen tile. */
export function fitSupplies(a: TileArea, cat: Catalog) {
  const t = tileProduct(cat, a.tileId);
  const adh = supplies(cat, 'adhesive');
  a.adhesiveId = (t && (t.type === 'porcelain' || isLarge(t)) ? adh.find((x) => /flex|porcelain|large/i.test(x.name)) : adh.find((x) => !/flex/i.test(x.name)))?.id ?? adh[0]?.id ?? null;
  const sp = supplies(cat, 'spacers');
  a.spacersId = (sp.find((x) => new RegExp(`${a.joint}\\s*mm`).test(x.name)) ?? sp[0])?.id ?? null;
  a.levelling = isLarge(t);
}

export const newTilingJob = (s: Settings): TilingJob => ({ areas: [], extras: [], markupPercent: tilingRates(s).markupPercent });

export const tiledArea = (a: TileArea) => Math.max(0, (a.length * a.width) / 1e6 - Math.max(0, a.deduct));
export const tilePerimeter = (a: TileArea) => (2 * (a.length + a.width)) / 1000;
export const wastePercent = (a: TileArea) => (a.waste != null && a.waste >= 0 ? a.waste : TILE_PATTERNS[a.pattern].waste);

/** Adhesive (kg/m², notched trowel) by tile size; walls take a little less. */
export function adhesiveRate(t: TileProduct | undefined, surface: 'floor' | 'wall') {
  const side = t ? Math.max(t.width, t.height) : 400;
  const r = side <= 200 ? 3 : side <= 400 ? 4 : side <= 600 ? 5 : 6.5;
  return surface === 'wall' ? r * 0.9 : r;
}

/** Grout (kg/m²) = (L + W) / (L × W) × joint × depth × 1.6 */
export const groutRate = (t: TileProduct | undefined, joint: number) => (t ? ((t.width + t.height) / (t.width * t.height)) * Math.max(0.5, joint) * t.thickness * 1.6 : 0.3);

export function tileAreaLines(a: TileArea, cat: Catalog, r: TilingRates): { lines: TradeLine[]; warnings: string[]; summary: string; tiles: number; boxes: number } {
  const lines: TradeLine[] = [];
  const warnings: string[] = [];
  const room = a.name;
  const A = tiledArea(a);
  const P = tilePerimeter(a);
  const t = tileProduct(cat, a.tileId);
  const sup = (s: TileSupply | undefined, qty: number, note = '') => {
    if (!s || qty <= 0) return;
    lines.push({ area: room, kind: 'material', group: 'Materials', description: s.name, qty, unit: s.unit, unitPrice: s.price, total: round2(qty * s.price), note });
  };
  const lab = (description: string, qty: number, unit: string, rate: number) => {
    if (qty <= 0 || rate <= 0) return;
    lines.push({ area: room, kind: 'labour', group: 'Labour', description, qty: round2(qty), unit, unitPrice: round2(rate), total: round2(qty * rate) });
  };
  // skirting (floors) is cut from the same tile
  const skirtM = a.surface === 'floor' && a.skirting ? P : 0;
  const tileM2 = A + (skirtM * a.skirtingHeight) / 1000;
  let tiles = 0;
  let boxes = 0;
  if (!t) warnings.push(`${room}: choose a tile.`);
  else {
    const each = (t.width * t.height) / 1e6;
    tiles = Math.ceil((tileM2 * (1 + wastePercent(a) / 100)) / each);
    boxes = Math.ceil(tiles / Math.max(1, t.perBox));
    lines.push({ area: room, kind: 'material', group: 'Tiles', description: `${t.name} (${t.perBox} per box, ${round2(t.perBox * each)} m²)`, qty: boxes, unit: 'box', unitPrice: t.price, total: round2(boxes * t.price), note: `${tiles} tiles · ${round2(tileM2)} m² + ${wastePercent(a)}% waste` });
  }
  const adh = tileSupply(cat, a.adhesiveId);
  if (adh) {
    const kg = tileM2 * adhesiveRate(t, a.surface) * 1.05;
    sup(adh, Math.ceil(kg / Math.max(1, adh.coverage)), `≈ ${Math.round(kg)} kg`);
  }
  const grout = tileSupply(cat, a.groutId);
  if (grout) {
    const kg = tileM2 * groutRate(t, a.joint) * 1.1;
    sup(grout, Math.max(1, Math.ceil(kg / Math.max(0.5, grout.coverage))), `≈ ${round2(kg)} kg, ${a.joint} mm joints`);
  }
  const spacers = tileSupply(cat, a.spacersId);
  if (spacers && tiles) sup(spacers, Math.max(1, Math.ceil((tiles * 3) / Math.max(1, spacers.coverage))));
  if (a.levelling && tiles) {
    const clips = supplies(cat, 'levelling')[0];
    sup(clips, Math.max(1, Math.ceil((tiles * 3) / Math.max(1, clips?.coverage ?? 100))), 'levelling clips');
  }
  const trim = tileSupply(cat, a.trimId);
  if (trim && a.trimLength > 0) sup(trim, Math.ceil(a.trimLength / Math.max(0.5, trim.coverage)), `${round2(a.trimLength)} m of edges`);
  if (a.waterproof) {
    const wp = supplies(cat, 'waterproofing')[0];
    const wpA = A + (a.surface === 'floor' ? P * 0.15 : 0);
    sup(wp, Math.max(1, Math.ceil(wpA / Math.max(0.5, wp?.coverage ?? 4))), `${round2(wpA)} m² incl. upturns`);
    lab('Waterproofing', wpA, 'm²', r.waterproofPerM2);
  }
  if (a.primer) sup(supplies(cat, 'primer')[0], Math.max(1, Math.ceil(A / Math.max(1, supplies(cat, 'primer')[0]?.coverage ?? 25))));
  if (a.silicone) {
    const sil = supplies(cat, 'silicone')[0];
    const m = a.surface === 'floor' ? P : a.length / 1000 + (2 * a.width) / 1000;
    sup(sil, Math.max(1, Math.ceil(m / Math.max(1, sil?.coverage ?? 8))), `${round2(m)} m of joints`);
  }
  if (a.screed) {
    sup(supplies(cat, 'screed')[0], Math.max(1, Math.ceil(A / Math.max(0.5, supplies(cat, 'screed')[0]?.coverage ?? 5))));
    lab('Screed / level the floor', A, 'm²', r.screedPerM2);
  }
  if (a.demolish) lab('Remove old tiles (renovation)', A, 'm²', r.demolitionPerM2);
  const extra = (r.patternExtra[a.pattern] ?? 0) + (isLarge(t) ? r.largeFormatExtra : 0);
  const base = a.surface === 'floor' ? r.floorPerM2 : r.wallPerM2;
  lab(`Lay ${a.surface} tiles – ${TILE_PATTERNS[a.pattern].label.toLowerCase()}${isLarge(t) ? ', large format' : ''}`, A, 'm²', base * (1 + extra / 100));
  if (skirtM) lab('Cut and fix tile skirting', skirtM, 'm', r.skirtingPerM);

  if (a.surface === 'floor' && t && t.width * t.height < 90000 && t.type !== 'mosaic') warnings.push(`${room}: small tiles on a floor – check they are rated for floors.`);
  if (a.deduct > (a.length * a.width) / 1e6) warnings.push(`${room}: more is deducted than the area.`);
  const summary = [
    `${a.surface === 'floor' ? 'Floor' : 'Wall'} ${(a.length / 1000).toFixed(2)} × ${(a.width / 1000).toFixed(2)} m${a.deduct ? ` less ${round2(a.deduct)} m²` : ''} = ${round2(A)} m²`,
    t ? `${t.name}, ${t.type}, ${t.finish}` : '',
    `${TILE_PATTERNS[a.pattern].label}, ${a.joint} mm joints`,
    tiles ? `${tiles} tiles = ${boxes} box${boxes === 1 ? '' : 'es'}` : '',
    skirtM ? `tile skirting ${round2(skirtM)} m` : '',
    a.waterproof ? 'waterproofed' : '',
    a.screed ? 'floor screeded' : '',
    a.demolish ? 'old tiles removed' : '',
  ].filter(Boolean);
  return { lines, warnings, summary: summary.join(' · '), tiles, boxes };
}

export function calculateTiling(job: TilingJob | undefined, cat: Catalog, s: Settings): TradeCalc | null {
  if (!job || (!job.areas.length && !job.extras.length)) return null;
  const r = tilingRates(s);
  const areas: TradeArea[] = [];
  const lines: TradeLine[] = [];
  const warnings: string[] = [];
  for (const a of job.areas) {
    const x = tileAreaLines(a, cat, r);
    lines.push(...x.lines);
    warnings.push(...x.warnings);
    areas.push({ id: a.id, name: a.name, size: round2(tiledArea(a)), summary: x.summary, lines: x.lines });
  }
  return tradeTotals('tiling', 'Tiling', areas, lines, job.extras, job.markupPercent, warnings);
}
