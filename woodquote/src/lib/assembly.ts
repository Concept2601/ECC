// Cabinet groups: any number of cabinets (and free-standing appliances), each
// placed anywhere and facing any way, quoted as one item — islands with
// cupboards all round, peninsulas, back-to-back units, display groups.
import { fitUnit, splitWidths } from './fit';
import { buildUnit, topThickness, unitExtents } from './generate';
import { bay, createUnit, sec } from './presets';
import type { Appliance, Assembly, AssemblyPiece, Box3, Catalog, Part, PricingSettings, ProductType, Unit, UnitBuild } from './types';
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
  size: { x0: number; x1: number; z0: number; z1: number; h: number };
}

const emptyBuild = (): UnitBuild => ({ parts: [], hardware: [], aluminium: [], rails: [], lights: [], appliances: [], inserts: [], applianceList: [], warnings: [] });

export function buildAssembly(a: Assembly, cat: Catalog, pricing: PricingSettings): AssemblyBuild {
  const pieces = a.pieces.map((piece) => ({ piece, build: piece.unit ? buildUnit(piece.unit, cat, pricing) : null }));
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
  if (counter && under.length) {
    const b = assemblyBounds(a, cat, (p) => under.includes(p));
    const o = a.top.overhang;
    top = { x: b.x0 - o.left, y: a.top.height - counter.thickness, z: b.z0 - o.back, w: b.x1 - b.x0 + o.left + o.right, h: counter.thickness, d: b.z1 - b.z0 + o.front + o.back };
    const part: Part = { key: 'group-top', name: 'Worktop (whole group)', role: 'counter', kind: 'counter', materialId: counter.id, length: Math.round(Math.max(top.w, top.d)), width: Math.round(Math.min(top.w, top.d)), thickness: counter.thickness, qty: 1, edgeLength: 0, edgingId: null, boxes: [] };
    extra.parts.push(part);
    if (Math.max(top.w, top.d) > 3000) extra.warnings.push('The worktop is over 3 m long — it will need a joint.');
  } else if (a.top.countertopId && !under.length) extra.warnings.push('No cabinet is set to sit under the shared worktop.');
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
    size: { x0: Math.min(b.x0, top?.x ?? Infinity), x1: Math.max(b.x1, top ? top.x + top.w : -Infinity), z0: Math.min(b.z0, top?.z ?? Infinity), z1: Math.max(b.z1, top ? top.z + top.d : -Infinity), h },
  };
}

export const pieceName = (p: AssemblyPiece, cat: Catalog) => p.unit?.name ?? cat.appliances.find((a) => a.id === p.applianceId)?.name ?? 'Appliance';

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
  // one-sided islands get a finished back panel, so the cabinets are that much shallower
  const backPanel = twoSided ? 0 : 18;
  const frontD = twoSided ? Math.round(o.depth / 2) : o.depth - backPanel;
  const runLen = o.width - 2 * endD;
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
  let x = endD;
  widths.forEach((w, i) => {
    g.pieces.push(unitPiece(mk(w, frontD, i % 2 ? 'drawers' : 'doors'), x, o.depth - frontD, 0));
    x += w;
  });
  if (twoSided) {
    x = endD;
    for (const w of widths) {
      // facing the back: its origin is the right-hand end of its back on the centre line
      g.pieces.push(unitPiece(mk(w, o.depth - frontD, 'doors'), x + w, o.depth - frontD, 180));
      x += w;
    }
  }
  if (ends) {
    g.pieces.push(unitPiece(mk(o.depth, endD, o.depth > 500 ? 'doors' : 'door'), endD, 0, 90));
    g.pieces.push(unitPiece(mk(o.depth, endD, o.depth > 500 ? 'doors' : 'door'), o.width - endD, o.depth, 270));
  } else if (!twoSided) {
    // one-sided: the back of the cabinets is finished with a full back panel
    for (const p of g.pieces) if (p.unit) p.unit.finishPanels.back = { ...p.unit.finishPanels.back, enabled: true };
  }
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
  const appl = a.pieces.filter((p) => !p.unit);
  const b = assemblyBounds(a, cat);
  const faces = new Set(units.map((p) => FACINGS.find((f) => f.rot === p.rot)?.label.replace('Faces ', '') ?? `${p.rot}°`));
  const lines = [`${units.length} cabinet${units.length === 1 ? '' : 's'}${appl.length ? ` and ${appl.length} appliance${appl.length === 1 ? '' : 's'}` : ''} · overall ${Math.round(b.x1 - b.x0)} × ${Math.round(b.z1 - b.z0)} mm`];
  if (units.length) lines.push(`Fronts facing: ${[...faces].join(', ')}`);
  const counter = cat.countertops.find((c) => c.id === a.top.countertopId);
  if (counter) lines.push(`Worktop: ${counter.name}, ${a.top.height} mm high`);
  if (appl.length) lines.push(`Appliances: ${appl.map((p) => pieceName(p, cat)).join(', ')}`);
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
