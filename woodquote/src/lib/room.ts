// Room layout: a rectangular room with adjustable wall heights, windows, doors
// and open-plan openings (optionally with an RC beam over them). Quoted units
// and kitchens are placed in the room so the client sees the design in context.
import { unitExtents } from './generate';
import { activeLegs, legLength } from './runs';
import type { ItemPrice } from './pricing';
import type { Catalog, Room, RoomOpening, RoomPlacement, WallSide } from './types';
import { uid } from './util';

export const WALL_NAMES = ['Back wall', 'Right wall', 'Front wall', 'Left wall'];
export const OPENING_LABELS: Record<RoomOpening['kind'], string> = { window: 'Window', door: 'Door', opening: 'Open-plan opening' };

export const wallLength = (room: Room, w: WallSide) => (w === 0 || w === 2 ? room.width : room.depth);

export function newOpening(kind: RoomOpening['kind'], wall: WallSide, room: Room): RoomOpening {
  const L = wallLength(room, wall);
  const width = kind === 'window' ? 1200 : kind === 'door' ? 850 : Math.min(2400, L - 400);
  return {
    id: uid('op'),
    kind,
    wall,
    offset: Math.max(0, Math.round((L - width) / 2)),
    width,
    height: kind === 'window' ? 2100 : kind === 'door' ? 2100 : room.wallHeights[wall],
    sill: kind === 'window' ? 1000 : 0,
    beam: kind === 'opening',
    beamDepth: 300,
    label: OPENING_LABELS[kind],
  };
}

export function defaultRoom(): Room {
  const room: Room = {
    width: 4200,
    depth: 3600,
    wallHeights: [2700, 2700, 2700, 2700],
    wallThickness: 150,
    showWalls: [true, true, false, true],
    wallColor: '#e9e4dc',
    floorColor: '#c9b49a',
    openings: [],
    placements: [],
  };
  room.openings.push({ ...newOpening('window', 0, room), offset: 1500 });
  room.openings.push({ ...newOpening('door', 3, room), offset: 2400 });
  return room;
}

/** Local footprint of a quoted item (relative to its own back-left origin). */
export function itemBounds(it: ItemPrice, cat: Catalog) {
  if (it.kind === 'run' && it.runBuild) return { x0: 0, x1: it.runBuild.size.w, z0: 0, z1: it.runBuild.size.d, h: it.runBuild.size.h };
  if (it.unit) {
    const e = unitExtents(it.unit, cat);
    return { x0: e.x0, x1: e.x1, z0: e.z0, z1: e.z1, h: e.y1 };
  }
  return { x0: 0, x1: 600, z0: 0, z1: 600, h: 900 };
}

/** Rotate a local (x, z) point by the placement and move it into the room. */
export function placeXZ(lx: number, lz: number, p: RoomPlacement): [number, number] {
  const t = (-p.rot * Math.PI) / 180;
  const c = Math.round(Math.cos(t));
  const s = Math.round(Math.sin(t));
  return [p.x + lx * c + lz * s, p.z - lx * s + lz * c];
}

/** Floor outlines of an item: one per wall of cabinets for L / U kitchens. */
export function footprints(it: ItemPrice, cat: Catalog, p: RoomPlacement): [number, number][][] {
  if (it.kind === 'run' && it.run) {
    const r = it.run;
    const D = r.baseDepth + r.counterOverhang;
    const LA = legLength(r.legs[0]);
    const rects: [number, number, number, number][] = [[0, 0, LA, D]];
    const n = activeLegs(r);
    if (n > 1) rects.push([LA - D, r.baseDepth, LA, r.baseDepth + legLength(r.legs[1])]);
    if (n > 2) rects.push([0, r.baseDepth, D, r.baseDepth + legLength(r.legs[2])]);
    return rects.map(([x0, z0, x1, z1]) =>
      [
        [x0, z0],
        [x1, z0],
        [x1, z1],
        [x0, z1],
      ].map(([x, z]) => placeXZ(x, z, p)),
    );
  }
  return [footprint(it, cat, p)];
}

export function footprint(it: ItemPrice, cat: Catalog, p: RoomPlacement): [number, number][] {
  const b = itemBounds(it, cat);
  return [
    [b.x0, b.z0],
    [b.x1, b.z0],
    [b.x1, b.z1],
    [b.x0, b.z1],
  ].map(([x, z]) => placeXZ(x, z, p));
}

/** Give every item without a position a spot along the back wall. */
export function autoPlace(room: Room, items: ItemPrice[], cat: Catalog): Room {
  const placed = new Set(room.placements.map((p) => p.itemId));
  let cursor = 200;
  for (const p of room.placements) {
    const it = items.find((i) => i.id === p.itemId);
    if (it && p.rot === 0 && p.z < 300) cursor = Math.max(cursor, p.x + itemBounds(it, cat).x1 + 100);
  }
  const placements = room.placements.filter((p) => items.some((i) => i.id === p.itemId));
  for (const it of items) {
    if (placed.has(it.id)) continue;
    const b = itemBounds(it, cat);
    if (it.kind === 'run') placements.push({ itemId: it.id, x: 0, z: 0, rot: 0 });
    else {
      let p: RoomPlacement = { itemId: it.id, x: cursor - b.x0, z: -b.z0, rot: 0 };
      // a kitchen already occupies the back wall: line other units up on the front wall
      if (items.some((i) => i.kind === 'run')) p = snapToWall(room, it, cat, p, 2);
      placements.push(p);
      cursor += b.x1 - b.x0 + 150;
    }
  }
  return { ...room, placements };
}

/** Push an item flat against one of the walls, keeping its position along that wall. */
export function snapToWall(room: Room, it: ItemPrice, cat: Catalog, p: RoomPlacement, wall: WallSide): RoomPlacement {
  const b = itemBounds(it, cat);
  const rot = ([0, 90, 180, 270] as const)[wall === 0 ? 0 : wall === 1 ? 3 : wall === 2 ? 2 : 1];
  const np: RoomPlacement = { ...p, rot };
  // align the back of the item to the wall
  const pts = () => footprint(it, cat, np);
  const minX = () => Math.min(...pts().map((q) => q[0]));
  const maxX = () => Math.max(...pts().map((q) => q[0]));
  const minZ = () => Math.min(...pts().map((q) => q[1]));
  const maxZ = () => Math.max(...pts().map((q) => q[1]));
  if (wall === 0) np.z += -minZ();
  if (wall === 2) np.z += room.depth - maxZ();
  if (wall === 3) np.x += -minX();
  if (wall === 1) np.x += room.width - maxX();
  // keep inside the room along the wall
  if (wall === 0 || wall === 2) np.x += Math.max(0, -minX()) - Math.max(0, maxX() - room.width);
  else np.z += Math.max(0, -minZ()) - Math.max(0, maxZ() - room.depth);
  void b;
  return np;
}

/** Wall pieces around openings, in wall coordinates (u along the wall, y up). */
export function wallPieces(room: Room, wall: WallSide) {
  const L = wallLength(room, wall);
  const H = room.wallHeights[wall];
  const ops = room.openings.filter((o) => o.wall === wall).sort((a, b) => a.offset - b.offset);
  const pieces: { u0: number; u1: number; y0: number; y1: number; kind: 'wall' | 'beam' }[] = [];
  let u = 0;
  for (const o of ops) {
    const a = Math.max(u, Math.min(L, o.offset));
    const b = Math.max(a, Math.min(L, o.offset + o.width));
    if (a > u) pieces.push({ u0: u, u1: a, y0: 0, y1: H, kind: 'wall' });
    if (o.kind === 'window' && o.sill > 0) pieces.push({ u0: a, u1: b, y0: 0, y1: o.sill, kind: 'wall' });
    if (o.kind === 'opening') {
      if (o.beam) pieces.push({ u0: a, u1: b, y0: H - o.beamDepth, y1: H, kind: 'beam' });
      else if (o.height < H) pieces.push({ u0: a, u1: b, y0: o.height, y1: H, kind: 'wall' });
    } else if (o.height < H) pieces.push({ u0: a, u1: b, y0: o.height, y1: H, kind: 'wall' });
    u = Math.max(u, b);
  }
  if (u < L) pieces.push({ u0: u, u1: L, y0: 0, y1: H, kind: 'wall' });
  return { pieces, openings: ops, L, H };
}

export function roomWarnings(room: Room): string[] {
  const w: string[] = [];
  for (const o of room.openings) {
    const L = wallLength(room, o.wall);
    if (o.offset + o.width > L) w.push(`${o.label} runs past the end of the ${WALL_NAMES[o.wall].toLowerCase()}.`);
    if (o.height > room.wallHeights[o.wall]) w.push(`${o.label} is taller than the ${WALL_NAMES[o.wall].toLowerCase()}.`);
  }
  return w;
}
