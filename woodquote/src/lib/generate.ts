// Turns a parametric Unit into a cut list (parts), hardware list, aluminium cuts
// and 3D placement boxes. Coordinates: x = left→right, y = floor→up,
// z = back (0) → front. All mm.
import type {
  Accessory,
  AluminiumLine,
  Box3,
  Catalog,
  HardwareLine,
  Part,
  PartRole,
  PricingSettings,
  RailRender,
  Unit,
  UnitBuild,
} from './types';
import { clamp, sum } from './util';

const GAP = 3; // reveal between fronts
const SLIDE_ZONE = 80; // depth reserved for sliding door tracks
const DRAWER_CLEAR = 26; // runner clearance (13mm each side)
const ALU_W = 20; // visual width of aluminium frame profile

export const hingesForDoor = (heightMm: number): number =>
  heightMm <= 900 ? 2 : heightMm <= 1600 ? 3 : heightMm <= 2000 ? 4 : 5;

export function pickRunner(cat: Catalog, selectedId: string | null, available: number): { acc: Accessory | null; fits: boolean } {
  const sel = cat.accessories.find((a) => a.id === selectedId) ?? null;
  if (!sel) return { acc: null, fits: true };
  if (!sel.family || !sel.lengthMm) return { acc: sel, fits: (sel.lengthMm ?? 0) <= available };
  const fam = cat.accessories
    .filter((a) => a.category === 'runner' && a.family === sel.family && a.lengthMm)
    .sort((a, b) => (a.lengthMm ?? 0) - (b.lengthMm ?? 0));
  const fitting = fam.filter((a) => (a.lengthMm ?? 0) <= available);
  if (fitting.length) return { acc: fitting[fitting.length - 1], fits: true };
  return { acc: fam[0] ?? sel, fits: false };
}

export function buildUnit(u: Unit, cat: Catalog, pricing: PricingSettings): UnitBuild {
  const board = (id: string | null) => cat.boards.find((b) => b.id === id) ?? null;
  const acc = (id: string | null) => cat.accessories.find((a) => a.id === id) ?? null;
  const warnings: string[] = [];

  const carcass = board(u.carcassMaterialId) ?? cat.boards[0];
  const front = board(u.frontMaterialId) ?? carcass;
  const back = board(u.backMaterialId);
  const counter = cat.countertops.find((c) => c.id === u.countertopId) ?? null;
  const glass = cat.glass.find((g) => g.id === u.glassId) ?? cat.glass[0] ?? null;
  const alu = cat.aluminium.find((a) => a.id === u.aluminiumId) ?? cat.aluminium[0] ?? null;

  const W = u.width;
  const H = u.height;
  const D = u.depth;
  const t = carcass?.thickness ?? 16;
  const ft = front?.thickness ?? t;
  const backT = back?.thickness ?? 0;
  const ct = counter?.thickness ?? 0;
  const baseH = u.base === 'none' ? 0 : u.baseHeight;
  const topY = H - ct;
  const sliding = u.sliding.enabled;
  const hasHingedFronts = !sliding && u.bays.some((b) => b.sections.some((s) => s.front !== 'open'));
  const Dc = D - (sliding ? SLIDE_ZONE : hasHingedFronts ? ft : 0); // carcass depth
  const cd = Dc - backT; // depth of panels in front of the back panel
  const carcassH = topY - baseH;

  if (carcassH < 2 * t + 50) warnings.push('Unit is too short for its base/countertop settings.');
  if (cd < 100) warnings.push('Unit depth is very small — check the depth value.');

  const parts = new Map<string, Part>();
  const addPart = (
    name: string,
    role: PartRole,
    kind: Part['kind'],
    materialId: string | null,
    length: number,
    width: number,
    thickness: number,
    edgeLen: number,
    edgingId: string | null,
    box: Box3 | null,
    qty = 1,
  ) => {
    const L = Math.round(length);
    const Wd = Math.round(width);
    if (L <= 0 || Wd <= 0) return;
    const key = `${name}|${materialId}|${L}|${Wd}`;
    const existing = parts.get(key);
    if (existing) {
      existing.qty += qty;
      if (box) existing.boxes.push(box);
    } else {
      parts.set(key, {
        key,
        name,
        role,
        kind,
        materialId,
        length: L,
        width: Wd,
        thickness,
        qty,
        edgeLength: Math.round(edgeLen) / 1000,
        edgingId: edgeLen > 0 ? edgingId : null,
        boxes: box ? [box] : [],
      });
    }
  };

  const hw = new Map<string, HardwareLine>();
  const addHw = (key: string, accessoryId: string | null | undefined, qty: number, reason: string) => {
    if (!accessoryId || qty <= 0) return;
    const k = `${key}:${accessoryId}`;
    const e = hw.get(k);
    if (e) e.qty += qty;
    else hw.set(k, { key: k, accessoryId, qty, reason });
  };

  const aluMap = new Map<string, AluminiumLine>();
  const addAlu = (pieces: number[], boxes: Box3[]) => {
    if (!alu) return;
    const e = aluMap.get(alu.id) ?? { profileId: alu.id, pieces: [], boxes: [] };
    e.pieces.push(...pieces.map(Math.round));
    e.boxes.push(...boxes);
    aluMap.set(alu.id, e);
  };
  const rails: RailRender[] = [];

  let joints = 0;
  let hinges = 0;
  let runnerPairs = 0;
  let handlePcs = 0;
  let backPerimeter = 0;

  const handle = acc(u.handleId);
  const addHandle = (frontWidth: number) => {
    if (!handle) return;
    if (handle.unit === 'm') addHw('handle', handle.id, frontWidth / 1000, 'Handle profile');
    else {
      addHw('handle', handle.id, 1, 'Handles');
      handlePcs++;
    }
  };

  const eCar = u.edgingId;
  const eFront = u.frontEdgingId;
  const cm = carcass?.id ?? null;
  const fm = front?.id ?? null;

  /* -------------------------------------------------------------- carcass */
  addPart('Side panel', 'carcass', 'board', cm, carcassH, cd, t, carcassH, eCar, { x: 0, y: baseH, z: backT, w: t, h: carcassH, d: cd });
  addPart('Side panel', 'carcass', 'board', cm, carcassH, cd, t, carcassH, eCar, { x: W - t, y: baseH, z: backT, w: t, h: carcassH, d: cd });
  const innerW = W - 2 * t;
  addPart('Bottom', 'carcass', 'board', cm, innerW, cd, t, innerW, eCar, { x: t, y: baseH, z: backT, w: innerW, h: t, d: cd });
  joints += 2;
  if (counter) {
    addPart('Top rail', 'carcass', 'board', cm, innerW, 100, t, 0, eCar, { x: t, y: topY - t, z: backT, w: innerW, h: t, d: 100 });
    addPart('Top rail', 'carcass', 'board', cm, innerW, 100, t, innerW, eCar, { x: t, y: topY - t, z: Dc - 100, w: innerW, h: t, d: 100 });
    joints += 4;
  } else {
    addPart('Top', 'carcass', 'board', cm, innerW, cd, t, innerW, eCar, { x: t, y: topY - t, z: backT, w: innerW, h: t, d: cd });
    joints += 2;
  }
  if (back) {
    // split the back into equal strips when it is bigger than one sheet
    const long = Math.max(back.sheetLength, back.sheetWidth) - 2 * pricing.sheetTrim;
    const short = Math.min(back.sheetLength, back.sheetWidth) - 2 * pricing.sheetTrim;
    const fits = (a: number, b: number) => (a <= long && b <= short) || (!back.grain && b <= long && a <= short);
    let pieces = 1;
    while (pieces < 8 && !fits(carcassH, W / pieces)) pieces++;
    const pw = W / pieces;
    for (let k = 0; k < pieces; k++)
      addPart(pieces > 1 ? 'Back panel (strip)' : 'Back panel', 'back', 'board', back.id, carcassH, pw, backT, 0, null, { x: k * pw, y: baseH, z: 0, w: pw, h: carcassH, d: backT });
    backPerimeter += 2 * (carcassH + W) + (pieces - 1) * carcassH * 2;
  }

  /* ----------------------------------------------------------------- base */
  if (u.base === 'plinth' && baseH > 0) {
    addPart('Plinth', 'plinth', 'board', cm, W, baseH, t, W, eCar, { x: 0, y: 0, z: Dc - 50 - t, w: W, h: baseH, d: t });
    addPart('Plinth rail (rear)', 'plinth', 'board', cm, W - 2 * t, baseH, t, 0, eCar, { x: t, y: 0, z: backT + 40, w: W - 2 * t, h: baseH, d: t });
    joints += 4;
  } else if (u.base === 'legs' && baseH > 0) {
    const legs = 4 + 2 * Math.floor(Math.max(0, W - 1) / 1000);
    addHw('leg', u.legId, legs, `${legs} legs`);
  }

  /* -------------------------------------------------------------- interior */
  const n = Math.max(1, u.bays.length);
  const clearW = innerW - (n - 1) * t;
  const bayTotal = sum(u.bays.map((b) => b.size)) || 1;
  const y0 = baseH + t;
  const y1 = topY - t;
  const Hi = y1 - y0;
  const pinsPerShelf = 4;
  let pins = 0;
  let x = t;

  u.bays.forEach((bay, i) => {
    const bw = (clearW * bay.size) / bayTotal;
    const bx = x;
    if (i < n - 1) {
      addPart('Divider', 'carcass', 'board', cm, Hi, cd, t, Hi, eCar, { x: bx + bw, y: y0, z: backT, w: t, h: Hi, d: cd });
      joints += 2;
    }
    const m = Math.max(1, bay.sections.length);
    const clearH = Hi - (m - 1) * t;
    const secTotal = sum(bay.sections.map((s) => s.size)) || 1;
    let y = y0;
    bay.sections.forEach((s, j) => {
      const sh = (clearH * s.size) / secTotal;
      const sy = y;
      if (j < m - 1) {
        addPart('Fixed shelf', 'shelf', 'board', cm, bw, cd, t, bw, eCar, { x: bx, y: sy + sh, z: backT, w: bw, h: t, d: cd });
        joints += 2;
      }
      // adjustable shelves
      if (s.shelves > 0) {
        for (let k = 0; k < s.shelves; k++) {
          const yy = sy + (sh * (k + 1)) / (s.shelves + 1) - t / 2;
          addPart('Adjustable shelf', 'shelf', 'board', cm, bw - 2, cd - 20, t, bw - 2, eCar, { x: bx + 1, y: yy, z: backT, w: bw - 2, h: t, d: cd - 20 });
          pins += pinsPerShelf;
        }
      }
      if (s.hangingRail) {
        addHw('rail', u.railId, acc(u.railId)?.unit === 'm' ? bw / 1000 : 1, 'Hanging rail');
        rails.push({ box: { x: bx, y: sy + sh - 70, z: backT + cd / 2 - 12, w: bw, h: 25, d: 15 } });
      }

      // fronts
      const frontKind = sliding && s.front !== 'drawer' ? 'open' : s.front;
      if (sliding && s.front !== 'drawer' && s.front !== 'open') {
        warnings.push(`Bay ${i + 1}: hinged fronts are ignored because sliding doors are enabled.`);
      }
      if (frontKind !== 'open') {
        let fx0: number, fx1: number, fy0: number, fy1: number, fz: number;
        if (sliding) {
          // internal drawers sit inside the bay behind the sliding doors
          fx0 = bx + 2;
          fx1 = bx + bw - 2;
          fy0 = sy;
          fy1 = sy + sh;
          fz = Dc - ft;
        } else {
          fx0 = (i === 0 ? 0 : bx - t / 2) + GAP / 2;
          fx1 = (i === n - 1 ? W : bx + bw + t / 2) - GAP / 2;
          fy0 = (j === 0 ? baseH : sy - t / 2) + GAP / 2;
          fy1 = (j === m - 1 ? topY : sy + sh + t / 2) - GAP / 2;
          fz = Dc;
        }
        const fw = fx1 - fx0;
        const fh = fy1 - fy0;

        if (frontKind === 'door' || frontKind === 'glassDoor') {
          const c = s.doorCount;
          const dw = (fw - (c - 1) * GAP) / c;
          for (let k = 0; k < c; k++) {
            const dx = fx0 + k * (dw + GAP);
            if (frontKind === 'door') {
              addPart('Door', 'door', 'board', fm, fh, dw, ft, 2 * (fh + dw), eFront, { x: dx, y: fy0, z: fz, w: dw, h: fh, d: ft });
            } else {
              const gw = dw - 2 * ALU_W;
              const gh = fh - 2 * ALU_W;
              if (glass) addPart('Glass panel', 'glass', 'glass', glass.id, gh, gw, glass.thickness, 0, null, { x: dx + ALU_W, y: fy0 + ALU_W, z: fz + 8, w: gw, h: gh, d: glass.thickness });
              addAlu([fh, fh, dw, dw], [
                { x: dx, y: fy0, z: fz, w: ALU_W, h: fh, d: 20 },
                { x: dx + dw - ALU_W, y: fy0, z: fz, w: ALU_W, h: fh, d: 20 },
                { x: dx + ALU_W, y: fy0, z: fz, w: dw - 2 * ALU_W, h: ALU_W, d: 20 },
                { x: dx + ALU_W, y: fy0 + fh - ALU_W, z: fz, w: dw - 2 * ALU_W, h: ALU_W, d: 20 },
              ]);
            }
            const hn = hingesForDoor(fh);
            addHw('hinge', u.hingeId, hn, 'Door hinges');
            hinges += hn;
            addHandle(dw);
          }
        } else if (frontKind === 'flap') {
          addPart('Flap door', 'door', 'board', fm, fw, fh, ft, 2 * (fh + fw), eFront, { x: fx0, y: fy0, z: fz, w: fw, h: fh, d: ft });
          const hn = fw > 900 ? 3 : 2;
          addHw('hinge', u.hingeId, hn, 'Flap hinges');
          hinges += hn;
          addHw('stay', u.stayId, fw > 600 ? 2 : 1, 'Flap stays');
          addHandle(fw);
        } else if (frontKind === 'drawer') {
          const dc = Math.max(1, s.drawerCount);
          const dh = (fh - (dc - 1) * GAP) / dc;
          const avail = (sliding ? cd - ft : cd) - 10;
          const { acc: runner, fits } = pickRunner(cat, u.runnerId, avail);
          if (!fits) warnings.push(`Bay ${i + 1}: unit is too shallow for the selected runner range.`);
          const L = runner?.lengthMm ?? Math.floor(avail / 50) * 50;
          for (let k = 0; k < dc; k++) {
            const dy = fy0 + k * (dh + GAP);
            addPart('Drawer front', 'drawerFront', 'board', fm, fw, dh, ft, 2 * (fw + dh), eFront, { x: fx0, y: dy, z: fz, w: fw, h: dh, d: ft });
            const boxH = clamp(dh - 50, 60, 250);
            const boxW = bw - DRAWER_CLEAR;
            const bx0 = bx + DRAWER_CLEAR / 2;
            const by0 = sy + (sh * k) / dc + 15;
            const bz0 = fz - L;
            addPart('Drawer side', 'drawerBox', 'board', cm, L, boxH, t, L, eCar, { x: bx0, y: by0, z: bz0, w: t, h: boxH, d: L });
            addPart('Drawer side', 'drawerBox', 'board', cm, L, boxH, t, L, eCar, { x: bx0 + boxW - t, y: by0, z: bz0, w: t, h: boxH, d: L });
            addPart('Drawer front/back (inner)', 'drawerBox', 'board', cm, boxW - 2 * t, boxH, t, boxW - 2 * t, eCar, { x: bx0 + t, y: by0, z: bz0, w: boxW - 2 * t, h: boxH, d: t });
            addPart('Drawer front/back (inner)', 'drawerBox', 'board', cm, boxW - 2 * t, boxH, t, 0, eCar, { x: bx0 + t, y: by0, z: fz - t, w: boxW - 2 * t, h: boxH, d: t });
            addPart('Drawer bottom', 'drawerBox', 'board', back?.id ?? cm, L, boxW, back?.thickness ?? t, 0, null, { x: bx0, y: by0 - 3, z: bz0, w: boxW, h: back?.thickness ?? t, d: L });
            joints += 4;
            runnerPairs++;
            if (runner) addHw('runner', runner.id, 1, `Drawer runners ${runner.size}`);
            addHandle(fw);
          }
        }
      }
      y = sy + sh + t;
    });
    x = bx + bw + t;
  });

  /* --------------------------------------------------------- sliding doors */
  if (sliding) {
    const p = Math.max(2, u.sliding.panels);
    const overlap = 30;
    const dw = (W + (p - 1) * overlap) / p;
    const dh = carcassH - 15;
    const mirror = cat.glass.find((g) => /mirror/i.test(g.name)) ?? glass;
    for (let k = 0; k < p; k++) {
      const dx = k * (dw - overlap);
      const dz = Dc + 10 + (k % 2 === 0 ? 0 : ft + 12);
      if (u.sliding.style === 'board') {
        addPart('Sliding door', 'door', 'board', fm, dh, dw, ft, 2 * (dh + dw), eFront, { x: dx, y: baseH + 5, z: dz, w: dw, h: dh, d: ft });
      } else {
        const g = u.sliding.style === 'mirror' ? mirror : glass;
        if (g) addPart(u.sliding.style === 'mirror' ? 'Mirror panel' : 'Glass panel', 'glass', 'glass', g.id, dh - 2 * ALU_W, dw - 2 * ALU_W, g.thickness, 0, null, { x: dx + ALU_W, y: baseH + 5 + ALU_W, z: dz + 8, w: dw - 2 * ALU_W, h: dh - 2 * ALU_W, d: g.thickness });
        addAlu([dh, dh, dw, dw], [
          { x: dx, y: baseH + 5, z: dz, w: ALU_W, h: dh, d: 25 },
          { x: dx + dw - ALU_W, y: baseH + 5, z: dz, w: ALU_W, h: dh, d: 25 },
          { x: dx + ALU_W, y: baseH + 5, z: dz, w: dw - 2 * ALU_W, h: ALU_W, d: 25 },
          { x: dx + ALU_W, y: baseH + 5 + dh - ALU_W, z: dz, w: dw - 2 * ALU_W, h: ALU_W, d: 25 },
        ]);
      }
      addHw('roller', u.rollerId, 1, 'Roller set per door');
      if (handle && handle.unit !== 'm') addHandle(dw);
    }
    const track = acc(u.trackId);
    if (track) addHw('track', track.id, track.unit === 'm' ? W / 1000 : 1, 'Top & bottom track');
  }

  /* ------------------------------------------------------------ countertop */
  if (counter) {
    const depth = D + u.countertopOverhang;
    const z0 = u.type === 'island' ? -u.countertopOverhang : 0;
    addPart('Countertop', 'counter', 'counter', counter.id, W, depth, counter.thickness, 0, null, { x: 0, y: topY, z: z0, w: W, h: ct, d: depth });
  }

  /* ----------------------------------------------------------------- extra */
  for (const e of u.extraParts) {
    addPart(e.name || 'Extra part', 'extra', 'board', e.materialId, e.length, e.width, board(e.materialId)?.thickness ?? t, e.edgeLength * 1000, eCar, null, e.qty);
  }

  /* -------------------------------------------------------------- fixings */
  if (pins) addHw('pins', u.shelfPinId, pins, 'Shelf support pins');
  const connector = acc(u.connectorId);
  if (connector) addHw('connector', connector.id, joints * 2, `${joints} joints × 2`);
  const screwQty =
    (connector ? 0 : joints * pricing.screwsPerJoint) + hinges * 4 + runnerPairs * 12 + handlePcs * 2 + Math.ceil(backPerimeter / 150);
  addHw('screws', u.screwId, screwQty, 'Assembly, hinge, runner & back fixing');

  const hardware = [...hw.values()].map((h) => ({ ...h, qty: Math.round(h.qty * 100) / 100 }));
  for (const h of hardware) {
    const o = u.hardwareOverrides[h.key];
    if (o !== undefined) h.qty = o;
  }
  for (const e of u.extraHardware) hardware.push({ key: `x:${e.id}`, accessoryId: e.accessoryId, qty: e.qty, reason: 'Added manually' });

  return { parts: [...parts.values()], hardware: hardware.filter((h) => h.qty > 0), aluminium: [...aluMap.values()], rails, warnings: [...new Set(warnings)] };
}

/** Front-elevation geometry for the visual editor (same maths as buildUnit). */
export interface ElevationBay {
  index: number;
  x: number;
  w: number;
  sections: { index: number; y: number; h: number }[];
}

export function elevation(u: Unit, cat: Catalog): { t: number; baseH: number; topY: number; bays: ElevationBay[] } {
  const carcass = cat.boards.find((b) => b.id === u.carcassMaterialId) ?? cat.boards[0];
  const counter = cat.countertops.find((c) => c.id === u.countertopId) ?? null;
  const t = carcass?.thickness ?? 16;
  const baseH = u.base === 'none' ? 0 : u.baseHeight;
  const topY = u.height - (counter?.thickness ?? 0);
  const n = Math.max(1, u.bays.length);
  const clearW = u.width - 2 * t - (n - 1) * t;
  const bt = sum(u.bays.map((b) => b.size)) || 1;
  const Hi = topY - baseH - 2 * t;
  let x = t;
  return {
    t,
    baseH,
    topY,
    bays: u.bays.map((b, i) => {
      const w = (clearW * b.size) / bt;
      const m = Math.max(1, b.sections.length);
      const clearH = Hi - (m - 1) * t;
      const st = sum(b.sections.map((s) => s.size)) || 1;
      let y = baseH + t;
      const sections = b.sections.map((s, j) => {
        const h = (clearH * s.size) / st;
        const r = { index: j, y, h };
        y += h + t;
        return r;
      });
      const r = { index: i, x, w, sections };
      x += w + t;
      return r;
    }),
  };
}
