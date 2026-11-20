// Corner cupboards (base and wall-hung) with their own width along each wall:
// Width A = unit.width along the main wall, Width B = corner.widthB along the
// side wall, both at the unit depth.
//
//  L style        two doors meeting in the inside corner (corner / bi-fold hinges)
//  diagonal style one angled door across the corner (five-sided carcass)
//
// Coordinates follow buildUnit: x along the main wall (0 = open end), z from the
// main wall (0) to the front. The side arm runs along +z at x = A (right hand)
// or x = 0 (left hand). Side-arm boxes are drawn in their own frame so their
// doors, handles and opening work like any front.
import { hingesForDoor, shiftBuild, topThickness } from './generate';
import type { Box3, BoxMeta, Catalog, HardwareLine, Part, PartRole, PricingSettings, Unit, UnitBuild } from './types';

const GAP = 3;
const ALU_W = 20;
/** widest door before it is split into more doors */
export const MAX_CORNER_DOOR = 600;
/** how many doors cover an opening: automatic (max 600mm each) unless set by hand */
export const cornerDoorCount = (width: number, chosen?: number | null) => Math.max(1, chosen && chosen > 0 ? Math.round(chosen) : Math.ceil((width - 1) / MAX_CORNER_DOOR));
const deg = (r: number) => (r * 180) / Math.PI;

export function buildCornerUnit(u: Unit, cat: Catalog, pricing: PricingSettings): UnitBuild {
  const c = u.corner!;
  const board = (id: string | null) => cat.boards.find((b) => b.id === id) ?? null;
  const acc = (id: string | null) => cat.accessories.find((a) => a.id === id) ?? null;
  const warnings: string[] = [];
  const carcass = board(u.carcassMaterialId) ?? cat.boards[0];
  const front = board(u.frontMaterialId) ?? carcass;
  const back = board(u.backMaterialId);
  const counter = cat.countertops.find((x) => x.id === u.countertopId) ?? null;
  const topBoard = counter ? null : board(u.topBoardId);

  const A = u.width;
  const B = c.widthB;
  const D = u.depth;
  const H = u.height;
  const t = carcass?.thickness ?? 16;
  const ft = front?.thickness ?? t;
  const backT = back?.thickness ?? 0;
  const ct = topThickness(u, cat);
  const wall = u.mount === 'wall';
  const baseH = wall || u.base === 'none' ? 0 : u.baseHeight;
  const topY = H - ct;
  const carcassH = topY - baseH;
  const Dc = D - ft; // carcass depth behind overlay doors
  const cd = Dc - backT;
  const right = c.hand === 'right';
  if (B < D + 100) warnings.push(`Width B (${B}mm) should be at least the depth + 100mm (${D + 100}mm).`);
  if (A < D + 100) warnings.push(`Width A (${A}mm) should be at least the depth + 100mm (${D + 100}mm).`);
  if (carcassH < 2 * t + 50) warnings.push('Corner cupboard is too short for its base / top settings.');

  // the side arm's own frame: x along the side wall from its far end, z out from the side wall
  const arm: BoxMeta['frame'] = right ? { x: A, z: 0, rot: -90 } : { x: 0, z: B, rot: 90 };
  /** main-frame box, mirrored for left-hand corners */
  const mx = (x0: number, w: number) => (right ? x0 : A - x0 - w);
  /** side-arm box: u measured from the corner along the side wall */
  const ax = (u0: number, len: number) => (right ? u0 : B - u0 - len);
  const hinge = (h: 'left' | 'right') => (right ? h : h === 'left' ? 'right' : 'left');
  const poly = (pts: [number, number][]): [number, number][] => (right ? pts : pts.map(([x, z]) => [A - x, z]));

  const parts = new Map<string, Part>();
  const addPart = (name: string, role: PartRole, kind: Part['kind'], materialId: string | null, length: number, width: number, thickness: number, edgeLen: number, edgingId: string | null, box: Box3 | null, qty = 1) => {
    const L = Math.round(length);
    const W = Math.round(width);
    if (L <= 0 || W <= 0) return;
    const key = `${name}|${materialId}|${L}|${W}`;
    const e = parts.get(key);
    if (e) {
      e.qty += qty;
      if (box) e.boxes.push(box);
    } else parts.set(key, { key, name, role, kind, materialId, length: L, width: W, thickness, qty, edgeLength: Math.round(edgeLen) / 1000, edgingId: edgeLen > 0 ? edgingId : null, boxes: box ? [box] : [] });
  };
  const hw = new Map<string, HardwareLine>();
  const addHw = (key: string, id: string | null | undefined, qty: number, reason: string) => {
    if (!id || qty <= 0 || !acc(id)) return;
    const k = `${key}:${id}`;
    const e = hw.get(k);
    if (e) e.qty += qty;
    else hw.set(k, { key: k, accessoryId: id, qty, reason });
  };
  const cm = carcass?.id ?? null;
  const fm = front?.id ?? null;
  const eCar = u.edgingId;
  const eFront = u.frontEdgingId;
  let joints = 0;
  let hinges = 0;
  let doors = 0;
  const handle = acc(u.handleId);

  const glass = cat.glass.find((g) => g.id === u.glassId) ?? null;
  const alu = cat.aluminium.find((a) => a.id === u.aluminiumId) ?? null;
  const aluPieces: number[] = [];
  const aluBoxes: Box3[] = [];
  const material = c.doorMaterial ?? 'wood';
  const hingeId = material === 'wood' ? u.hingeId : (u.glassHingeId ?? u.hingeId);
  const door = (name: string, box: Box3, side: 'left' | 'right') => {
    const id = `cd${doors++}`;
    const m: BoxMeta = { ...box.meta, door: id, hinge: hinge(side), handle: true };
    const { x, y, z, w, h } = box;
    if (material === 'wood') addPart(name, 'door', 'board', fm, Math.max(h, w), Math.min(h, w), ft, 2 * (h + w), eFront, { ...box, meta: m });
    else if (material === 'glass') {
      if (glass) addPart(`${name} glass`, 'glass', 'glass', glass.id, h - 2 * ALU_W, w - 2 * ALU_W, glass.thickness, 0, null, { x: x + ALU_W, y: y + ALU_W, z: z + 8, w: w - 2 * ALU_W, h: h - 2 * ALU_W, d: glass.thickness, meta: { ...m, handle: false } });
      if (alu) {
        aluPieces.push(h, h, w, w);
        aluBoxes.push({ x, y, z, w: ALU_W, h, d: 20, meta: { ...m, handle: false } }, { x: x + w - ALU_W, y, z, w: ALU_W, h, d: 20, meta: { ...m, handle: false } }, { x: x + ALU_W, y, z, w: w - 2 * ALU_W, h: ALU_W, d: 20, meta: { ...m, handle: false } }, { x: x + ALU_W, y: y + h - ALU_W, z, w: w - 2 * ALU_W, h: ALU_W, d: 20, meta: m });
      }
    } else if (glass) addPart(`${name} (frameless glass)`, 'glass', 'glass', glass.id, h, w, glass.thickness, 0, null, { ...box, d: Math.max(6, glass.thickness), meta: m });
    const n = hingesForDoor(Math.max(h, w));
    hinges += n;
    addHw('hinge', hingeId, n, 'Corner door hinges');
    if (handle) addHw('handle', handle.id, handle.unit === 'm' ? w / 1000 : 1, handle.style === 'push' ? 'Push-to-open per front' : 'Handles');
  };
  /**
   * A row of n doors across an opening (x0 .. x0 + width in the box's own frame).
   * `cornerEnd` is the end that meets the inside corner: that door is hinged away from it.
   */
  const doorRow = (name: string, x0: number, width: number, n: number, base: Omit<Box3, 'x' | 'w'>, cornerEnd: 'start' | 'end' | 'none', place: (x: number, w: number) => number) => {
    const dw = (width - (n - 1) * GAP) / n;
    for (let k = 0; k < n; k++) {
      const local = x0 + k * (dw + GAP);
      // doors pair up from the middle; the door at the corner opens away from the corner
      let side: 'left' | 'right' = k < n / 2 ? 'left' : 'right';
      if (n % 2 === 1 && k === (n - 1) / 2) side = cornerEnd === 'start' ? 'right' : 'left';
      if (cornerEnd === 'start' && k === 0) side = 'right';
      if (cornerEnd === 'end' && k === n - 1) side = 'left';
      door(n > 1 ? `${name} ${k + 1}/${n}` : name, { ...base, x: place(local, dw), w: dw } as Box3, side);
    }
  };

  const y0 = baseH;
  const ch = carcassH;

  /* ---------------------------------------------------------- carcass */
  if (back) {
    addPart('Back panel (main wall)', 'back', 'board', back.id, ch, A, backT, 0, null, { x: 0, y: y0, z: 0, w: A, h: ch, d: backT });
    addPart('Back panel (side wall)', 'back', 'board', back.id, ch, B - backT, backT, 0, null, { x: ax(backT, B - backT), y: y0, z: 0, w: B - backT, h: ch, d: backT, meta: { frame: arm } });
  }
  addPart('End panel', 'carcass', 'board', cm, ch, cd, t, ch, eCar, { x: mx(0, t), y: y0, z: backT, w: t, h: ch, d: cd });
  addPart('End panel', 'carcass', 'board', cm, ch, cd, t, ch, eCar, { x: ax(B - t, t), y: y0, z: backT, w: t, h: ch, d: cd, meta: { frame: arm } });
  joints += 4;

  // horizontal panels: bottom, top and shelves
  const shelfYs: number[] = [];
  const nShelves = Math.max(0, Math.round(c.shelves));
  for (let k = 1; k <= nShelves; k++) shelfYs.push(y0 + t + ((ch - 2 * t) * k) / (nShelves + 1));
  const levels: { name: string; y: number; depth: number; role: PartRole }[] = [
    { name: 'Bottom', y: y0, depth: cd, role: 'carcass' },
    { name: 'Top', y: topY - t, depth: cd, role: 'carcass' },
    ...shelfYs.map((y) => ({ name: 'Shelf', y, depth: cd - 20, role: 'shelf' as PartRole })),
  ];

  if (c.style === 'L') {
    for (const lv of levels) {
      // two pieces meeting over the corner, dowelled together
      const mainLen = A - t - backT;
      const retLen = B - t - (backT + lv.depth);
      addPart(`${lv.name} (main wall)`, lv.role, 'board', cm, mainLen, lv.depth, t, mainLen, eCar, { x: mx(t, mainLen), y: lv.y, z: backT, w: mainLen, h: t, d: lv.depth });
      addPart(`${lv.name} (side wall)`, lv.role, 'board', cm, retLen, lv.depth, t, retLen, eCar, { x: ax(backT + lv.depth, retLen), y: lv.y, z: backT, w: retLen, h: t, d: lv.depth, meta: { frame: arm } });
      addHw('dowel', 'jn-dowel', 4, 'Corner panel joints');
    }
    // doors: one on each wall, meeting in the inside corner
    const doorH = wall ? H - GAP : ch;
    const dy = wall ? 0 : y0;
    const mainW = A - Dc - ft - 2 * GAP;
    const retW = B - Dc - 2 * GAP;
    if (!c.open) {
      const nA = cornerDoorCount(mainW, c.doorsA);
      const nB = cornerDoorCount(retW, c.doorsB);
      // main wall: the corner is at the far end (x = A); side wall: the corner is at its start
      doorRow('Corner door (main wall)', GAP, mainW, nA, { y: dy, z: Dc, h: doorH, d: ft }, 'end', (x, w) => mx(x, w));
      doorRow('Corner door (side wall)', Dc + GAP, retW, nB, { y: dy, z: Dc, h: doorH, d: ft, meta: { frame: arm } }, 'start', (x, w) => ax(x, w));
      if (mainW / nA < 150 || retW / nB < 150) warnings.push('Corner doors are very narrow — increase Width A / B, reduce the depth or use fewer doors.');
      addHw('bifold', 'h-reliant', 2, 'Bi-fold link between the corner doors');
    }
  } else {
    // five-sided panels cut from one board each
    const outline = (inset: number): [number, number][] =>
      poly([
        [t, backT],
        [A - backT, backT],
        [A - backT, B - t],
        [A - Dc + inset, B - t],
        [t, Dc - inset],
      ]);
    for (const lv of levels) {
      const inset = lv.role === 'shelf' ? 20 : 0;
      const L = A - t - backT;
      const W = B - t - backT;
      const diag = Math.hypot(A - Dc - t, B - t - Dc);
      addPart(`${lv.name} (diagonal corner)`, lv.role, 'board', cm, L, W, t, diag, eCar, { x: mx(t, L), y: lv.y, z: backT, w: L, h: t, d: W, meta: { shape: outline(inset) } });
    }
    // diagonal door across the corner
    const p1: [number, number] = right ? [0, Dc] : [Dc, B];
    const p2: [number, number] = right ? [A - Dc, B] : [A, Dc];
    const dx = p2[0] - p1[0];
    const dz = p2[1] - p1[1];
    const len = Math.hypot(dx, dz);
    const frame = { x: p1[0], z: p1[1], rot: deg(-Math.atan2(dz, dx)) };
    const doorH = wall ? H - GAP : ch;
    if (!c.open) {
      const n = cornerDoorCount(len - 2 * GAP, c.doorsA);
      doorRow('Diagonal corner door', GAP, len - 2 * GAP, n, { y: wall ? 0 : y0, z: 0, h: doorH, d: ft, meta: { frame } }, 'none', (x) => x);
    }
    if (len < 250) warnings.push('The diagonal door is very narrow — increase Width A / B.');
    if (!wall && u.base === 'plinth' && baseH > 0) addPart('Kick board (diagonal)', 'plinth', 'board', cm, len, baseH, t, len, eCar, { x: 0, y: 0, z: -u.plinthRecess - t, w: len, h: baseH, d: t, meta: { frame } });
  }

  /* ------------------------------------------------------------ base */
  if (!wall && u.base === 'plinth' && baseH > 0) {
    const r = u.plinthRecess;
    if (c.style === 'L') {
      const mainLen = A - (D - r) + t;
      addPart('Kick board (main wall)', 'plinth', 'board', cm, mainLen, baseH, t, mainLen, eCar, { x: mx(0, mainLen), y: 0, z: D - r - t, w: mainLen, h: baseH, d: t });
      const retLen = B - (D - r);
      addPart('Kick board (side wall)', 'plinth', 'board', cm, retLen, baseH, t, retLen, eCar, { x: ax(D - r, retLen), y: 0, z: D - r - t, w: retLen, h: baseH, d: t, meta: { frame: arm } });
    }
    addHw('leg', u.legId && acc(u.legId)?.name.toLowerCase().includes('plinth') ? u.legId : null, 6, 'Plinth legs');
  } else if (!wall && u.base === 'legs' && baseH > 0) addHw('leg', u.legId, 5, 'Legs');

  /* ------------------------------------------------------------- top */
  const topMat = counter ?? topBoard;
  if (topMat && !wall) {
    const oh = u.overhang.front;
    const kind: Part['kind'] = counter ? 'counter' : 'board';
    const role: PartRole = counter ? 'counter' : 'finish';
    if (c.style === 'L') {
      addPart('Worktop (main wall)', role, kind, topMat.id, A, D + oh, ct, counter ? 0 : A, eFront ?? eCar, { x: 0, y: topY, z: 0, w: A, h: ct, d: D + oh });
      addPart('Worktop (side wall)', role, kind, topMat.id, B - D - oh, D + oh, ct, counter ? 0 : B, eFront ?? eCar, { x: ax(D + oh, B - D - oh), y: topY, z: 0, w: B - D - oh, h: ct, d: D + oh, meta: { frame: arm } });
      if (counter) addHw('wt-joint', 'jn-connector', 3, 'Worktop corner joint bolts');
    } else {
      addPart('Worktop (diagonal corner)', role, kind, topMat.id, A, B, ct, counter ? 0 : A + B, eFront ?? eCar, {
        x: 0,
        y: topY,
        z: 0,
        w: A,
        h: ct,
        d: B,
        meta: { shape: poly([[0, 0], [A, 0], [A, B], [A - D - oh, B], [0, D + oh]]) },
      });
    }
  }

  /* ---------------------------------------------------------- fittings */
  if (c.carousel && !wall) {
    if (Math.min(A, B) < 750) warnings.push('A corner carousel needs at least 750mm on both walls.');
    addHw('insert', 'in-carousel', 1, 'Corner carousel / lazy susan');
  }
  addHw('pins', u.shelfPinId, nShelves * (c.style === 'L' ? 8 : 6), 'Shelf support pins');
  if (wall) {
    addHw('hanger', 'fx-hanger', 2, 'Wall hanging brackets');
    addHw('anchor', 'fx-anchor', 8, 'Wall anchors for the hanging brackets');
  }
  if (u.installType === 'builtIn') {
    addHw('fix', 'fx-bracket', 3, 'Built-in wall fixing');
    addHw('anchor', 'fx-anchor', 3, 'Wall anchors for the fixing brackets');
  }
  if (handle?.style === 'push' && doors > 0) addHw('buffer', 'fx-buffer', doors * 2, 'Buffers for push-to-open doors');
  const connector = acc(u.connectorId);
  if (connector) addHw('connector', connector.id, joints * 2, `${joints} joints × 2`);
  addHw('screws', u.screwId, (connector ? 0 : joints * pricing.screwsPerJoint) + hinges * 4 + Math.ceil((2 * (A + B) + 4 * ch) / 150), 'Assembly, hinge & back fixing');
  for (const e of u.extraParts) addPart(e.name || 'Extra part', 'extra', 'board', e.materialId, e.length, e.width, board(e.materialId)?.thickness ?? t, e.edgeLength * 1000, eCar, null, e.qty);

  const hardware = [...hw.values()].map((h) => ({ ...h, qty: Math.round(h.qty * 100) / 100 }));
  for (const h of hardware) {
    const o = u.hardwareOverrides[h.key];
    if (o !== undefined) h.qty = o;
  }
  for (const e of u.extraHardware) hardware.push({ key: `x:${e.id}`, accessoryId: e.accessoryId, qty: e.qty, reason: 'Added manually' });

  const aluminium = alu && aluPieces.length ? [{ profileId: alu.id, pieces: aluPieces.map(Math.round), boxes: aluBoxes }] : [];
  const build: UnitBuild = { parts: [...parts.values()], hardware: hardware.filter((h) => h.qty > 0), aluminium, rails: [], lights: [], appliances: [], inserts: [], applianceList: [], warnings };
  if (wall) shiftBuild(build, u.mountHeight);
  return build;
}
