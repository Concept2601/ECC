// Room layout: walls drawn one after another (each with its own length,
// direction and height), windows, doors and open-plan openings (optionally with
// an RC beam). Quoted units and kitchens are placed in the room so the client
// sees the design in context.
import { unitExtents } from './generate';
import type { ItemPrice } from './pricing';
import { activeLegs, legLength } from './runs';
import type { Catalog, Room, RoomOpening, RoomPlacement, RoomWall, WallSide } from './types';
import { uid } from './util';

export const OPENING_LABELS: Record<RoomOpening['kind'], string> = { window: 'Window', door: 'Door', opening: 'Open-plan opening' };

const rad = (deg: number) => (deg * Math.PI) / 180;
const clean = (v: number) => Math.round(v * 1000) / 1000;

export const newWall = (length: number, angle: number, height = 2700): RoomWall => ({ id: uid('w'), length, angle: ((angle % 360) + 360) % 360, height, visible: true });

export function wallName(room: Room, i: number): string {
  const a = room.walls[i]?.angle ?? 0;
  const dir = a === 0 ? '→' : a === 90 ? '↓' : a === 180 ? '←' : a === 270 ? '↑' : `${Math.round(a)}°`;
  return `Wall ${i + 1} ${dir}`;
}

export const wallLength = (room: Room, w: WallSide) => room.walls[w]?.length ?? 0;
export const wallDir = (w: RoomWall): [number, number] => [clean(Math.cos(rad(w.angle))), clean(Math.sin(rad(w.angle)))];

/** Corner points: vertices[i] is where wall i starts (last point = end of the last wall). */
export function vertices(room: Room): [number, number][] {
  const pts: [number, number][] = [[0, 0]];
  for (const w of room.walls) {
    const [dx, dz] = wallDir(w);
    const [x, z] = pts[pts.length - 1];
    pts.push([x + dx * w.length, z + dz * w.length]);
  }
  return pts;
}

export function isClosed(room: Room): boolean {
  const v = vertices(room);
  const end = v[v.length - 1];
  return Math.hypot(end[0], end[1]) < 20;
}

/** +1 when walls go clockwise on the plan (interior on the right-hand side of each wall). */
export function orientation(room: Room): 1 | -1 {
  const v = vertices(room);
  let a = 0;
  for (let i = 0; i < v.length - 1; i++) a += v[i][0] * v[i + 1][1] - v[i + 1][0] * v[i][1];
  return a >= 0 ? 1 : -1;
}

/** Unit vector pointing into the room from wall i. */
export function inwardNormal(room: Room, i: number): [number, number] {
  const [dx, dz] = wallDir(room.walls[i]);
  const s = orientation(room);
  return [-dz * s, dx * s];
}

/** Make the last wall end exactly where the first one starts. */
export function closeRoom(room: Room): Room {
  if (room.walls.length < 3) return room;
  const v = vertices(room);
  const start = v[v.length - 2];
  const len = Math.round(Math.hypot(start[0], start[1]));
  const angle = Math.round((((Math.atan2(-start[1], -start[0]) * 180) / Math.PI + 360) % 360) * 10) / 10;
  const walls = room.walls.map((w, i) => (i === room.walls.length - 1 ? { ...w, length: len, angle } : w));
  return { ...room, walls };
}

export function roomExtents(room: Room) {
  const v = vertices(room);
  const xs = v.map((p) => p[0]);
  const zs = v.map((p) => p[1]);
  return { x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs), h: Math.max(...room.walls.map((w) => w.height)) };
}

export type RoomShape = 'rect' | 'L' | 'angled';
export const ROOM_SHAPES: Record<RoomShape, string> = { rect: 'Rectangle', L: 'L-shaped room', angled: 'Angled corner' };
export function roomShape(shape: RoomShape, height = 2700): RoomWall[] {
  if (shape === 'L') return [newWall(5000, 0, height), newWall(2400, 90, height), newWall(2000, 180, height), newWall(1800, 90, height), newWall(3000, 180, height), newWall(4200, 270, height)];
  if (shape === 'angled') return [newWall(4200, 0, height), newWall(2400, 90, height), newWall(1697, 135, height), newWall(3000, 180, height), newWall(3600, 270, height)];
  return [newWall(4200, 0, height), newWall(3600, 90, height), newWall(4200, 180, height), newWall(3600, 270, height)];
}

export function newOpening(kind: RoomOpening['kind'], wall: WallSide, room: Room): RoomOpening {
  const L = wallLength(room, wall);
  const width = kind === 'window' ? 1200 : kind === 'door' ? 850 : Math.min(2400, Math.max(600, L - 400));
  return {
    id: uid('op'),
    kind,
    wall,
    offset: Math.max(0, Math.round((L - width) / 2)),
    width,
    height: kind === 'opening' ? room.walls[wall]?.height ?? 2700 : 2100,
    sill: kind === 'window' ? 1000 : 0,
    beam: kind === 'opening',
    beamDepth: 300,
    label: OPENING_LABELS[kind],
  };
}

export function defaultRoom(): Room {
  const walls = roomShape('rect');
  walls[2].visible = false; // front wall cut away for viewing
  const room: Room = { walls, wallThickness: 150, wallColor: '#e9e4dc', floorColor: '#c9b49a', openings: [], placements: [] };
  room.openings.push({ ...newOpening('window', 0, room), offset: 1500 });
  room.openings.push({ ...newOpening('door', 3, room), offset: 400 });
  return room;
}

/** Upgrade rooms saved before walls were editable (fixed rectangle). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normalizeRoom(r: any): Room | null {
  if (!r) return null;
  if (Array.isArray(r.walls)) return r as Room;
  const W = r.width ?? 4200;
  const D = r.depth ?? 3600;
  const hs: number[] = r.wallHeights ?? [2700, 2700, 2700, 2700];
  const vis: boolean[] = r.showWalls ?? [true, true, false, true];
  const walls = [newWall(W, 0, hs[0]), newWall(D, 90, hs[1]), newWall(W, 180, hs[2]), newWall(D, 270, hs[3])].map((w, i) => ({ ...w, visible: vis[i] }));
  // the front and left walls now run the other way round the room
  const openings = (r.openings ?? []).map((o: RoomOpening) => (o.wall === 2 ? { ...o, offset: W - o.offset - o.width } : o.wall === 3 ? { ...o, offset: D - o.offset - o.width } : o));
  return { walls, wallThickness: r.wallThickness ?? 150, wallColor: r.wallColor ?? '#e9e4dc', floorColor: r.floorColor ?? '#c9b49a', openings, placements: r.placements ?? [] };
}

/* ----------------------------------------------------------- items */

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
  const t = rad(-p.rot);
  const c = clean(Math.cos(t));
  const s = clean(Math.sin(t));
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

/** Put an item's back flat against wall i, facing into the room, keeping its position along the wall. */
export function snapToWall(room: Room, it: ItemPrice, cat: Catalog, p: RoomPlacement, wall: WallSide): RoomPlacement {
  const w = room.walls[wall];
  if (!w) return p;
  const b = itemBounds(it, cat);
  const v = vertices(room)[wall];
  const [dx, dz] = wallDir(w);
  const rot = (((w.angle + (orientation(room) > 0 ? 0 : 180)) % 360) + 360) % 360;
  // where along the wall: project the item's current back-centre onto the wall line
  const cx = (b.x0 + b.x1) / 2;
  const [px, pz] = placeXZ(cx, b.z0, p);
  const half = (b.x1 - b.x0) / 2;
  const along = Math.min(Math.max((px - v[0]) * dx + (pz - v[1]) * dz, half), Math.max(half, w.length - half));
  const tx = v[0] + dx * along;
  const tz = v[1] + dz * along;
  const np: RoomPlacement = { ...p, rot, x: 0, z: 0 };
  const [ox, oz] = placeXZ(cx, b.z0, np);
  return { ...np, x: Math.round(tx - ox), z: Math.round(tz - oz) };
}

/** Give every item without a position a spot along the first wall (or the opposite wall when a kitchen is there). */
export function autoPlace(room: Room, items: ItemPrice[], cat: Catalog): Room {
  const placed = new Set(room.placements.map((p) => p.itemId));
  const placements = room.placements.filter((p) => items.some((i) => i.id === p.itemId));
  const hasRun = items.some((i) => i.kind === 'run');
  const target = hasRun && room.walls.length >= 3 ? 2 : 0;
  let cursor = 200;
  for (const it of items) {
    if (placed.has(it.id)) continue;
    const b = itemBounds(it, cat);
    if (it.kind === 'run') {
      placements.push({ itemId: it.id, x: 0, z: 0, rot: 0 });
      continue;
    }
    const w = room.walls[target];
    const v = vertices(room)[target];
    const [dx, dz] = wallDir(w);
    const along = cursor + (b.x1 - b.x0) / 2;
    const seed: RoomPlacement = { itemId: it.id, x: v[0] + dx * along - (b.x0 + b.x1) / 2, z: v[1] + dz * along - b.z0, rot: 0 };
    placements.push(snapToWall(room, it, cat, seed, target));
    cursor += b.x1 - b.x0 + 150;
  }
  return { ...room, placements };
}

/** Wall pieces around openings, in wall coordinates (u along the wall, y up). */
export function wallPieces(room: Room, wall: WallSide) {
  const L = wallLength(room, wall);
  const H = room.walls[wall]?.height ?? 2700;
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
  if (!isClosed(room)) w.push('The walls do not meet up — use “Close the room” or adjust the last wall.');
  for (const o of room.openings) {
    const wall = room.walls[o.wall];
    if (!wall) {
      w.push(`${o.label} is on a wall that no longer exists.`);
      continue;
    }
    if (o.offset + o.width > wall.length) w.push(`${o.label} runs past the end of ${wallName(room, o.wall)}.`);
    if (o.height > wall.height) w.push(`${o.label} is taller than ${wallName(room, o.wall)}.`);
  }
  return w;
}
