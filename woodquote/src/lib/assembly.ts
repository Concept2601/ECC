// Cabinet groups: any number of cabinets (and free-standing appliances), each
// placed anywhere and facing any way, quoted as one item — islands with
// cupboards all round, peninsulas, back-to-back units, display groups.
import { fitUnit, splitWidths } from './fit';
import { buildUnit, topThickness, unitExtents } from './generate';
import { bay, createUnit, PRODUCT_LABELS as PRODUCT_LABEL, sec } from './presets';
import type { Appliance, Assembly, AssemblyPiece, Box3, Catalog, Part, PricingSettings, ProductType, SlatWall, Unit, UnitBuild } from './types';
import { deepClone, uid } from './util';

const rad = (d: number) => (d * Math.PI) / 180;
const clean = (v: number) => Math.round(v * 1e6) / 1e6;

/** Same rotation as room placements: local (x, z) of a piece → group plan. */
export function turn(lx: number, lz: number, p: { x: number; z: number; rot: number }): [number, number] {
  const t = rad(-p.rot);
  const c = clean(Math.cos(t));
  const s = clean(Math.sin(t));
  return [p.x + lx * c + lz * s, p.z - lx * s + lz * c];
}

export const FACINGS: { rot: number; label: string; short: string }[] = [
  { rot: 0, label: 'Faces the front', short: '↓ Front' },
  { rot: 180, label: 'Faces the back', short: '↑ Back' },
  { rot: 90, label: 'Faces left', short: '← Left' },
  { rot: 270, label: 'Faces right', short: '→ Right' },
];

/** Local footprint of a piece (its own back-left origin). */
export function pieceRect(p: AssemblyPiece, cat: Catalog): { x0: number; x1: number; z0: number; z1: number; h: number; y0: number } {
  if (p.slats) return { x0: 0, x1: p.slats.width, z0: 0, z1: slatDepth(p.slats, cat), h: p.slats.bottom + p.slats.height, y0: p.slats.bottom };
  if (p.unit) {
    const e = unitExtents(p.unit, cat);
    return { x0: e.x0, x1: e.x1, z0: e.z0, z1: e.z1, h: e.y1, y0: e.y0 };
  }
  const a = cat.appliances.find((x) => x.id === p.applianceId);
  return { x0: 0, x1: a?.width ?? 600, z0: 0, z1: a?.depth ?? 600, h: a?.height ?? 850, y0: 0 };
}

export function pieceFootprint(p: AssemblyPiece, cat: Catalog): [number, number][] {
  const r = pieceRect(p, cat);
  return [
    [r.x0, r.z0],
    [r.x1, r.z0],
    [r.x1, r.z1],
    [r.x0, r.z1],
  ].map(([x, z]) => turn(x, z, p));
}

export function assemblyBounds(a: Assembly, cat: Catalog, only?: (p: AssemblyPiece) => boolean) {
  const pts = a.pieces.filter((p) => !only || only(p)).flatMap((p) => pieceFootprint(p, cat));
  if (!pts.length) return { x0: 0, x1: 600, z0: 0, z1: 600 };
  const xs = pts.map((q) => q[0]);
  const zs = pts.map((q) => q[1]);
  return { x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs) };
}

export const assemblyUnits = (a: Assembly): Unit[] => a.pieces.map((p) => p.unit).filter(Boolean) as Unit[];

/** Pieces under the shared worktop take its height; their own tops are removed. */
export function syncAssembly(a: Assembly, cat: Catalog) {
  const counter = cat.countertops.find((c) => c.id === a.top.countertopId) ?? null;
  if (a.layout === 'row') layoutRow(a, cat);
  for (const p of a.pieces) {
    p.rot = ((Math.round(p.rot) % 360) + 360) % 360;
    const u = p.unit;
    if (!u) continue;
    if (p.underTop && counter && u.mount === 'floor') {
      u.countertopId = null;
      u.topBoardId = null;
      u.overhang = { front: 0, back: 0, left: 0, right: 0 };
      u.height = Math.max(200, a.top.height - counter.thickness);
    }
  }
}

export interface AssemblyBuild {
  pieces: { piece: AssemblyPiece; build: UnitBuild | null }[];
  /** shared worktop and loose appliances, in group plan coordinates */
  extra: UnitBuild;
  top: Box3 | null;
  /** one-piece exposed end / back boards across the whole group */
  panels: { side: 'front' | 'back' | 'left' | 'right'; box: Box3; materialId: string }[];
  size: { x0: number; x1: number; z0: number; z1: number; h: number };
}

const emptyBuild = (): UnitBuild => ({ parts: [], hardware: [], aluminium: [], rails: [], lights: [], appliances: [], inserts: [], applianceList: [], warnings: [] });

/** Board used for the group's exposed panels (its own choice, else the first cabinet's front board). */
export function panelBoard(a: Assembly, cat: Catalog) {
  const id = a.panels?.materialId ?? a.pieces.find((p) => p.unit)?.unit?.frontMaterialId;
  return cat.boards.find((b) => b.id === id) ?? cat.boards[0];
}

/**
 * Footprint of the cabinets under the worktop (all floor cabinets when there is
 * no shared worktop), grown by the exposed panels around it.
 */
export function coreBounds(a: Assembly, cat: Catalog) {
  const under = a.pieces.filter((p) => p.underTop && p.unit && p.unit.mount === 'floor');
  const core = under.length ? under : a.pieces.filter((p) => p.unit && p.unit.mount === 'floor');
  if (!core.length) return null;
  const b = assemblyBounds(a, cat, (p) => core.includes(p));
  const t = a.panels ? panelBoard(a, cat)?.thickness ?? 18 : 0;
  const pn = a.panels;
  return { cab: b, x0: b.x0 - (pn?.left ? t : 0), x1: b.x1 + (pn?.right ? t : 0), z0: b.z0 - (pn?.back ? t : 0), z1: b.z1 + (pn?.front ? t : 0), t };
}

export function buildAssembly(a: Assembly, cat: Catalog, pricing: PricingSettings): AssemblyBuild {
  const counterTop = cat.countertops.find((c) => c.id === a.top.countertopId) ?? null;
  const cb = coreBounds(a, cat);
  const pieces = a.pieces.map((piece) => {
    const u = piece.unit;
    if (piece.slats) return { piece, build: buildSlats(piece.slats, cat) };
    if (!u) return { piece, build: null };
    // cabinets under the shared worktop: hobs and sinks sit in that worktop, not on the carcass
    let ctx: { topY: number; topFront: number; topBack: number } | undefined;
    if (piece.underTop && counterTop && u.mount === 'floor') {
      // the shared worktop's edges seen from this cabinet (its own front/back direction)
      const ub = cb!;
      const o = a.top.overhang;
      const corners: [number, number][] = [
        [ub.x0 - o.left, ub.z0 - o.back],
        [ub.x1 + o.right, ub.z0 - o.back],
        [ub.x1 + o.right, ub.z1 + o.front],
        [ub.x0 - o.left, ub.z1 + o.front],
      ];
      const t = rad(-piece.rot);
      const c = clean(Math.cos(t));
      const sn = clean(Math.sin(t));
      const lz = corners.map(([x, z]) => (x - piece.x) * sn + (z - piece.z) * c);
      ctx = { topY: a.top.height, topFront: Math.max(...lz), topBack: Math.min(0, Math.min(...lz)) };
    }
    return { piece, build: buildUnit(u, cat, pricing, ctx) };
  });
  const extra = emptyBuild();
  const counts = new Map<string, number>();
  for (const p of a.pieces) {
    if (p.unit || !p.applianceId) continue;
    counts.set(p.applianceId, (counts.get(p.applianceId) ?? 0) + 1);
  }
  extra.applianceList = [...counts.entries()].map(([applianceId, qty]) => ({ applianceId, qty }));
  let top: Box3 | null = null;
  const counter = cat.countertops.find((c) => c.id === a.top.countertopId) ?? null;
  const under = a.pieces.filter((p) => p.underTop && p.unit && p.unit.mount === 'floor');
  if (counter && under.length && cb) {
    const b = cb;
    const o = a.top.overhang;
    top = { x: b.x0 - o.left, y: a.top.height - counter.thickness, z: b.z0 - o.back, w: b.x1 - b.x0 + o.left + o.right, h: counter.thickness, d: b.z1 - b.z0 + o.front + o.back };
    const part: Part = { key: 'group-top', name: 'Worktop (whole group)', role: 'counter', kind: 'counter', materialId: counter.id, length: Math.round(Math.max(top.w, top.d)), width: Math.round(Math.min(top.w, top.d)), thickness: counter.thickness, qty: 1, edgeLength: 0, edgingId: null, boxes: [] };
    extra.parts.push(part);
    if (Math.max(top.w, top.d) > 3000) extra.warnings.push('The worktop is over 3 m long — it will need a joint.');
  } else if (a.top.countertopId && !under.length) extra.warnings.push('No cabinet is set to sit under the shared worktop.');
  // exposed panels: one board per side across the whole group, floor to worktop underside
  const panels: AssemblyBuild['panels'] = [];
  const board = panelBoard(a, cat);
  if (a.panels && cb && board) {
    const t = cb.t;
    const h = top ? top.y : Math.max(...a.pieces.filter((p) => p.unit?.mount === 'floor').map((p) => p.unit!.height));
    const edging = a.pieces.find((p) => p.unit)?.unit?.frontEdgingId ?? null;
    const add = (side: 'front' | 'back' | 'left' | 'right', box: Box3, len: number) => {
      panels.push({ side, box, materialId: board.id });
      // front and top edges banded
      extra.parts.push({ key: `group-panel-${side}`, name: `Exposed ${side === 'left' || side === 'right' ? 'end' : side} panel (one piece, ${side})`, role: 'finish', kind: 'board', materialId: board.id, length: Math.round(h), width: Math.round(len), thickness: board.thickness, qty: 1, edgeLength: Math.round(h + len) / 1000, edgingId: edging, boxes: [] });
    };
    if (a.panels.left) add('left', { x: cb.x0, y: 0, z: cb.z0, w: t, h, d: cb.z1 - cb.z0 }, cb.z1 - cb.z0);
    if (a.panels.right) add('right', { x: cb.x1 - t, y: 0, z: cb.z0, w: t, h, d: cb.z1 - cb.z0 }, cb.z1 - cb.z0);
    if (a.panels.back) add('back', { x: cb.cab.x0, y: 0, z: cb.z0, w: cb.cab.x1 - cb.cab.x0, h, d: t }, cb.cab.x1 - cb.cab.x0);
    if (a.panels.front) add('front', { x: cb.cab.x0, y: 0, z: cb.z1 - t, w: cb.cab.x1 - cb.cab.x0, h, d: t }, cb.cab.x1 - cb.cab.x0);
  }
  // overlapping cabinets
  const fp = a.pieces.map((p) => {
    const pts = pieceFootprint(p, cat);
    const xs = pts.map((q) => q[0]);
    const zs = pts.map((q) => q[1]);
    return { p, x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs), y0: pieceRect(p, cat).y0, y1: pieceRect(p, cat).h };
  });
  for (let i = 0; i < fp.length; i++)
    for (let j = i + 1; j < fp.length; j++) {
      const A = fp[i];
      const B = fp[j];
      const ov = Math.min(A.x1, B.x1) - Math.max(A.x0, B.x0) > 5 && Math.min(A.z1, B.z1) - Math.max(A.z0, B.z0) > 5 && Math.min(A.y1, B.y1) - Math.max(A.y0, B.y0) > 5;
      if (ov) extra.warnings.push(`${pieceName(A.p, cat)} overlaps ${pieceName(B.p, cat)}.`);
    }
  const b = assemblyBounds(a, cat);
  const h = Math.max(top ? a.top.height : 0, ...a.pieces.map((p) => pieceRect(p, cat).h));
  return {
    pieces,
    extra,
    top,
    panels,
    size: { x0: Math.min(b.x0, cb?.x0 ?? Infinity, top?.x ?? Infinity), x1: Math.max(b.x1, cb?.x1 ?? -Infinity, top ? top.x + top.w : -Infinity), z0: Math.min(b.z0, cb?.z0 ?? Infinity, top?.z ?? Infinity), z1: Math.max(b.z1, cb?.z1 ?? -Infinity, top ? top.z + top.d : -Infinity), h },
  };
}

export const pieceName = (p: AssemblyPiece, cat: Catalog) => p.unit?.name ?? (p.slats ? 'Wall slats' : (cat.appliances.find((a) => a.id === p.applianceId)?.name ?? 'Appliance'));

/* ------------------------------------------------------------- wall slats */

export const slatDepth = (s: SlatWall, cat: Catalog) => (cat.boards.find((b) => b.id === s.materialId)?.thickness ?? 18) + (s.backerId ? (cat.boards.find((b) => b.id === s.backerId)?.thickness ?? 16) : 0);
export const slatCount = (s: SlatWall) => Math.max(1, Math.floor((s.width + s.slatGap) / (s.slatWidth + s.slatGap)));

/**
 * Slats cut from board, set out evenly across the width (the gaps share any
 * left-over), each fixed with silicone and wall anchors about every 500 mm.
 * A backing board, when chosen, is siliconed and anchored on a 400 mm grid.
 */
export function buildSlats(s: SlatWall, cat: Catalog): UnitBuild {
  const b = emptyBuild();
  const board = cat.boards.find((x) => x.id === s.materialId);
  const backer = s.backerId ? cat.boards.find((x) => x.id === s.backerId) : undefined;
  const n = slatCount(s);
  const gap = n > 1 ? (s.width - n * s.slatWidth) / (n - 1) : 0;
  const bt = backer?.thickness ?? 0;
  const t = board?.thickness ?? 18;
  if (backer) b.parts.push({ key: 'slat-backer', name: 'Slat wall backing board', role: 'finish', kind: 'board', materialId: backer.id, length: Math.round(s.height), width: Math.round(s.width), thickness: bt, qty: 1, edgeLength: 0, edgingId: null, boxes: [{ x: 0, y: s.bottom, z: 0, w: s.width, h: s.height, d: bt }] });
  if (board) {
    const boxes = Array.from({ length: n }, (_, i) => ({ x: n > 1 ? i * (s.slatWidth + gap) : (s.width - s.slatWidth) / 2, y: s.bottom, z: bt, w: s.slatWidth, h: s.height, d: t }));
    b.parts.push({ key: 'slat', name: 'Wall slat', role: 'finish', kind: 'board', materialId: board.id, length: Math.round(s.height), width: Math.round(s.slatWidth), thickness: t, qty: n, edgeLength: 0, edgingId: null, boxes });
  }
  const perSlat = Math.ceil(s.height / 500) + 1;
  let anchors = n * perSlat;
  let tubes = (n * s.height) / 1000 / 8; // one bead per slat, ~8 m of bead per 300 ml tube
  if (backer) {
    anchors += (Math.ceil(s.width / 400) + 1) * (Math.ceil(s.height / 400) + 1);
    tubes += (s.width * s.height) / 1e6 / 1.5;
  }
  b.hardware.push({ key: 'slat-anchor', accessoryId: 'fx-anchor', qty: anchors, reason: `Wall anchors for ${n} slats${backer ? ' and the backing board' : ''}` });
  b.hardware.push({ key: 'slat-silicone', accessoryId: 'fx-silicone', qty: Math.max(1, Math.ceil(tubes)), reason: 'Silicone / adhesive to fix the slats to the wall' });
  if (!board) b.warnings.push('Choose a board for the slats.');
  if (gap < 0) b.warnings.push('The slats are wider than the wall space.');
  if (board && s.height > Math.max(board.sheetLength, board.sheetWidth)) b.warnings.push(`Slats are taller than a ${board.name} sheet – they will be joined.`);
  return b;
}

export function slatPiece(width = 1800, height = 2400, bottom = 0, materialId = 'b-mdf18-walnut'): AssemblyPiece {
  return { id: uid('gp'), unit: null, applianceId: null, x: 0, z: 0, rot: 0, underTop: false, slats: { width, height, bottom, slatWidth: 40, slatGap: 15, materialId, backerId: null } };
}

/** Slatted wall panelling as its own item (behind a TV, beside a kitchen, on a BIC wall). */
export function slatGroup(width = 1800, height = 2400, materialId?: string): Assembly {
  const g = newAssembly('Wall slats');
  g.pieces.push(slatPiece(width, height, 0, materialId));
  return g;
}

export function newAssembly(name = 'Cabinet group'): Assembly {
  return { id: uid('g'), name, qty: 1, pieces: [], top: { countertopId: null, height: 900, overhang: { front: 20, back: 20, left: 20, right: 20 } }, notes: '' };
}

export function unitPiece(u: Unit, x = 0, z = 0, rot = 0): AssemblyPiece {
  const floorBase = u.mount === 'floor' && u.height <= 1000;
  return { id: uid('gp'), unit: u, applianceId: null, x, z, rot, underTop: floorBase };
}

export function appliancePiece(applianceId: string, x = 0, z = 0, rot = 0): AssemblyPiece {
  return { id: uid('gp'), unit: null, applianceId, x, z, rot, underTop: false };
}

/** A loose free-standing appliance (fridge, cooker, washing machine…) as its own item. */
export function applianceGroup(a: Appliance): Assembly {
  const g = newAssembly(a.name);
  g.pieces.push(appliancePiece(a.id));
  return g;
}

/** Wrap one cabinet type as a group so it can turn and sit with others. */
export function unitGroup(type: ProductType): Assembly {
  const u = createUnit(type);
  const g = newAssembly(u.name);
  g.pieces.push(unitPiece(u));
  if (u.countertopId) g.top = { ...g.top, countertopId: null };
  return g;
}

export type IslandSides = 1 | 2 | 4;
export const ISLAND_SIDES: { sides: IslandSides; label: string; hint: string }[] = [
  { sides: 4, label: 'Four sides', hint: 'Cupboards on the front, the back and both ends' },
  { sides: 2, label: 'Two sides', hint: 'Cupboards on the front and the back (back to back)' },
  { sides: 1, label: 'One side', hint: 'Cupboards on the front only; the back is a panel or seating' },
];

export interface IslandOptions {
  width: number;
  depth: number;
  height: number;
  sides: IslandSides;
  countertopId: string | null;
  /** one-sided islands: how far the worktop sticks out at the back for stools (0 = flush panel) */
  seatingOverhang: number;
}

/**
 * Islands with cupboards on four, two or one side. Front cabinets face the
 * front, back cabinets face the back (back to back on the centre line) and
 * four-sided islands get shallow end cupboards facing out at both ends.
 */
export function islandGroup(o: IslandOptions): Assembly {
  const g = newAssembly(o.sides === 4 ? 'Island – cupboards on four sides' : o.sides === 2 ? 'Island – cupboards on two sides' : 'Island – cupboards on one side');
  const ends = o.sides === 4;
  const twoSided = o.sides >= 2;
  const endD = ends ? Math.min(400, Math.max(250, Math.round(o.depth * 0.3))) : 0;
  // exposed boards are one piece across the whole island: both ends (unless end cupboards) and the back of one-sided islands
  const T = 18;
  const endPanels = !ends;
  const backPanel = twoSided ? 0 : T;
  const frontD = twoSided ? Math.round(o.depth / 2) : o.depth - backPanel;
  const side0 = endD + (endPanels ? T : 0);
  const runLen = o.width - 2 * side0;
  const mk = (w: number, d: number, front: 'doors' | 'drawers' | 'door') => {
    const u = fitUnit('kitchen_base', { width: w, height: o.height, depth: d, sideGap: 0, topGap: 0 }) ?? createUnit('kitchen_base');
    u.width = w;
    u.depth = d;
    u.installType = 'standalone';
    u.name = `Island ${front === 'drawers' ? 'drawers' : 'cupboard'} ${w}mm`;
    // shallow end cupboards get doors and shelves only (drawer runners need ~450 mm depth)
    const canDrawer = d >= 420;
    if (front === 'drawers' && canDrawer) u.bays = [bay(1, [sec({ front: 'drawer', drawerCount: 3 })])];
    else if (front === 'door' || w < 600) u.bays = [bay(1, [sec({ front: 'door', opening: 'left', shelves: 1 })])];
    else u.bays = [bay(1, [sec({ front: 'door', opening: 'pair', shelves: 1 })])];
    return u;
  };
  const { widths } = splitWidths(Math.max(150, runLen));
  let x = side0;
  widths.forEach((w, i) => {
    g.pieces.push(unitPiece(mk(w, frontD, i % 2 ? 'drawers' : 'doors'), x, o.depth - frontD, 0));
    x += w;
  });
  if (twoSided) {
    x = side0;
    for (const w of widths) {
      // facing the back: its origin is the right-hand end of its back on the centre line
      g.pieces.push(unitPiece(mk(w, o.depth - frontD, 'doors'), x + w, o.depth - frontD, 180));
      x += w;
    }
  }
  if (ends) {
    g.pieces.push(unitPiece(mk(o.depth, endD, o.depth > 500 ? 'doors' : 'door'), endD, 0, 90));
    g.pieces.push(unitPiece(mk(o.depth, endD, o.depth > 500 ? 'doors' : 'door'), o.width - endD, o.depth, 270));
  }
  if (endPanels || backPanel) g.panels = { left: endPanels, right: endPanels, back: backPanel > 0, front: false, materialId: null };
  g.top = {
    countertopId: o.countertopId,
    height: o.height,
    overhang: { front: 20, back: twoSided ? 20 : Math.max(20, o.seatingOverhang), left: 20, right: 20 },
  };
  g.notes = o.sides === 4 ? 'Cupboards on all four sides.' : o.sides === 2 ? 'Cupboards back to back on the front and the back.' : o.seatingOverhang > 50 ? `Cupboards on the front; seating overhang ${o.seatingOverhang}mm at the back.` : 'Cupboards on the front; finished panel at the back.';
  return g;
}

export function cloneAssembly(a: Assembly): Assembly {
  const c = deepClone(a);
  c.id = uid('g');
  for (const p of c.pieces) {
    p.id = uid('gp');
    if (p.unit) p.unit.id = uid('u');
  }
  return c;
}

export function describeAssembly(a: Assembly, cat: Catalog): string[] {
  const units = a.pieces.filter((p) => p.unit);
  const appl = a.pieces.filter((p) => !p.unit && !p.slats);
  const slats = a.pieces.filter((p) => p.slats);
  const b = assemblyBounds(a, cat);
  const faces = new Set(units.map((p) => FACINGS.find((f) => f.rot === p.rot)?.label.replace('Faces ', '') ?? `${p.rot}°`));
  const what = [units.length ? `${units.length} cabinet${units.length === 1 ? '' : 's'}` : '', appl.length ? `${appl.length} appliance${appl.length === 1 ? '' : 's'}` : ''].filter(Boolean).join(' and ');
  const lines = units.length || appl.length ? [`${what} · overall ${Math.round(b.x1 - b.x0)} × ${Math.round(b.z1 - b.z0)} mm`] : [];
  if (units.length) lines.push(`Fronts facing: ${[...faces].join(', ')}`);
  const counter = cat.countertops.find((c) => c.id === a.top.countertopId);
  if (counter) lines.push(`Worktop: ${counter.name}, ${a.top.height} mm high`);
  if (appl.length) lines.push(`Appliances: ${appl.map((p) => pieceName(p, cat)).join(', ')}`);
  for (const p of slats) {
    const sl = p.slats!;
    const bd = cat.boards.find((x) => x.id === sl.materialId);
    lines.push(`Wall slats ${sl.width} × ${sl.height} mm: ${slatCount(sl)} × ${sl.slatWidth} mm ${bd?.name ?? ''}${sl.backerId ? ' on a backing board' : ''}, siliconed and anchored to the wall`);
  }
  if (a.notes) lines.push(a.notes);
  return lines;
}

export { topThickness };

/** Centre of a piece on the group plan. */
export function pieceCentre(p: AssemblyPiece, cat: Catalog): [number, number] {
  const r = pieceRect(p, cat);
  return turn((r.x0 + r.x1) / 2, (r.z0 + r.z1) / 2, p);
}

/** Turn a piece to face another way, spinning it on the spot (its centre stays put). */
export function setFacing(p: AssemblyPiece, rot: number, cat: Catalog) {
  const [cx, cz] = pieceCentre(p, cat);
  p.rot = ((Math.round(rot) % 360) + 360) % 360;
  const [nx, nz] = pieceCentre(p, cat);
  p.x = Math.round(p.x + cx - nx);
  p.z = Math.round(p.z + cz - nz);
}

/**
 * Drop a piece where it was dragged, pulled flush against nearby cabinets
 * (within `reach` mm) so backs, sides and ends line up without gaps.
 */
export function snapPiece(a: Assembly, p: AssemblyPiece, cat: Catalog, reach = 40): { x: number; z: number } {
  const box = (q: AssemblyPiece) => {
    const pts = pieceFootprint(q, cat);
    const xs = pts.map((v) => v[0]);
    const zs = pts.map((v) => v[1]);
    return { x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs) };
  };
  const me = box(p);
  let dx = 0;
  let dz = 0;
  let bx = reach + 1;
  let bz = reach + 1;
  for (const q of a.pieces) {
    if (q === p) continue;
    const o = box(q);
    for (const [mine, theirs] of [
      [me.x0, o.x1],
      [me.x1, o.x0],
      [me.x0, o.x0],
      [me.x1, o.x1],
    ]) {
      const d = theirs - mine;
      if (Math.abs(d) < bx) [bx, dx] = [Math.abs(d), d];
    }
    for (const [mine, theirs] of [
      [me.z0, o.z1],
      [me.z1, o.z0],
      [me.z0, o.z0],
      [me.z1, o.z1],
    ]) {
      const d = theirs - mine;
      if (Math.abs(d) < bz) [bz, dz] = [Math.abs(d), d];
    }
  }
  return { x: Math.round(p.x + (bx <= reach ? dx : 0)), z: Math.round(p.z + (bz <= reach ? dz : 0)) };
}

/** Where a new piece goes: just to the right of everything already in the group, facing the front. */
export function nextSpot(a: Assembly, cat: Catalog): { x: number; z: number } {
  if (!a.pieces.length) return { x: 0, z: 0 };
  const b = assemblyBounds(a, cat);
  return { x: Math.round(b.x1), z: Math.round(b.z0) };
}

/* ------------------------------------------------------------ cabinet rows */

/**
 * Cabinet rows (BIC walls, wardrobes, TV walls…): pieces stand side by side in
 * list order with their backs against the wall, like a kitchen run. A wall-hung
 * piece goes above the floor piece before it (several share it, centred);
 * `gapBefore` leaves a space.
 */
export function layoutRow(a: Assembly, cat: Catalog) {
  let x = 0;
  let host: { x: number; w: number; above: AssemblyPiece[] } | null = null;
  const hosts: { x: number; w: number; above: AssemblyPiece[] }[] = [];
  for (const p of a.pieces) {
    p.rot = 0;
    p.z = 0;
    const r = pieceRect(p, cat);
    const w = r.x1 - r.x0;
    const wallHung = p.unit?.mount === 'wall' || !!p.slats;
    if (wallHung && host) {
      host.above.push(p);
      continue;
    }
    x += Math.max(0, p.gapBefore ?? 0);
    p.x = Math.round(x - r.x0);
    if (!wallHung) {
      host = { x, w, above: [] };
      hosts.push(host);
    }
    x += w;
  }
  // wall-hung pieces centred over their floor piece
  // (slats behind and wall cabinets above are centred separately, as they sit at different depths)
  for (const h of hosts)
    for (const set of [h.above.filter((p) => p.slats), h.above.filter((p) => !p.slats)]) {
      if (!set.length) continue;
      const widths = set.map((p) => {
        const r = pieceRect(p, cat);
        return r.x1 - r.x0;
      });
      let ax = h.x + (h.w - widths.reduce((s, v) => s + v, 0)) / 2;
      set.forEach((p, i) => {
        p.x = Math.round(ax - pieceRect(p, cat).x0);
        ax += widths[i];
      });
    }
  // cabinets in front of wall slats stand off the wall by the slats' depth
  const slats = a.pieces.filter((p) => p.slats);
  for (const p of a.pieces) {
    if (p.slats) continue;
    const r = pieceRect(p, cat);
    const x0 = p.x + r.x0;
    const x1 = p.x + r.x1;
    const behind = slats.filter((sp) => Math.min(x1, sp.x + sp.slats!.width) - Math.max(x0, sp.x) > 5 && Math.min(r.h, sp.slats!.bottom + sp.slats!.height) - Math.max(r.y0, sp.slats!.bottom) > 5);
    if (behind.length) p.z = Math.max(...behind.map((sp) => slatDepth(sp.slats!, cat)));
  }
}

/** Overall length of a row (floor pieces and gaps). */
export const rowLength = (a: Assembly, cat: Catalog) => {
  const b = assemblyBounds(a, cat);
  return Math.round(b.x1 - b.x0);
};

export type RowPreset = 'bic' | 'wardrobe' | 'tv' | 'display' | 'empty';
export const ROW_PRESETS: { id: RowPreset; label: string; hint: string }[] = [
  { id: 'bic', label: 'BIC wall', hint: 'Built-in cupboards side by side, floor to ceiling' },
  { id: 'wardrobe', label: 'Wardrobe wall', hint: 'Hinged wardrobes side by side' },
  { id: 'tv', label: 'TV wall unit', hint: 'TV stand between two tall displays, shelf above' },
  { id: 'display', label: 'Display / shelving wall', hint: 'Open display units side by side' },
  { id: 'empty', label: 'Empty row', hint: 'Add your own cabinets one by one' },
];

/** A row of cabinets for a wall `width` mm long and `height` mm high. */
export function rowGroup(preset: RowPreset, width = 2400, height = 2400): Assembly {
  const label = ROW_PRESETS.find((p) => p.id === preset)?.label ?? 'Cabinet row';
  const g = newAssembly(label);
  g.layout = 'row';
  g.top = { ...g.top, countertopId: null };
  const add = (type: ProductType, w: number, h?: number, over?: Partial<Unit>) => {
    const u = createUnit(type);
    u.width = Math.round(w);
    if (h) u.height = Math.round(h);
    Object.assign(u, over);
    const p = unitPiece(u);
    p.underTop = false;
    g.pieces.push(p);
    return u;
  };
  const split = (type: ProductType, h: number) => {
    const n = Math.max(1, Math.round(width / (type === 'bookshelf' ? 900 : 1000)));
    const w = Math.round(width / n);
    for (let i = 0; i < n; i++) add(type, i === n - 1 ? width - w * (n - 1) : w, h, { name: `${PRODUCT_LABEL[type]} ${i + 1}` });
  };
  if (preset === 'bic') split('built_in', height);
  else if (preset === 'wardrobe') split('wardrobe', height);
  else if (preset === 'display') split('bookshelf', Math.min(height, 2100));
  else if (preset === 'tv') {
    const side = Math.max(400, Math.min(600, Math.round(width * 0.18)));
    const mid = Math.max(900, width - 2 * side);
    add('bookshelf', side, Math.min(height, 2000), { name: 'Tall display (left)' });
    const stand = add('tv_stand', mid, undefined, { name: 'TV stand' });
    stand.installType = 'builtIn';
    stand.overhang = { ...stand.overhang, left: 0, right: 0 };
    add('kitchen_wall', mid, 350, { name: 'Shelf unit above the TV', mount: 'wall', mountHeight: Math.min(height, 2000) - 350, depth: 300 });
    // slatted feature wall behind the TV, between the stand and the shelf
    g.pieces.push(slatPiece(mid, Math.min(height, 2000) - 350 - 500, 500));
    add('bookshelf', side, Math.min(height, 2000), { name: 'Tall display (right)' });
  }
  return g;
}
