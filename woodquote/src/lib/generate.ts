// Turns a parametric Unit into a cut list (parts), hardware list, aluminium cuts,
// appliances, lights and 3D placement boxes. Coordinates: x = left→right,
// y = floor→up, z = back (0) → front. All mm.
import type {
  Accessory,
  AluminiumLine,
  Appliance,
  ApplianceRender,
  Box3,
  BoxMeta,
  Catalog,
  DoorMaterial,
  HardwareLine,
  InsertRender,
  LightRender,
  Part,
  PartRole,
  PricingSettings,
  RailRender,
  Section,
  SectionRef,
  Unit,
  UnitBuild,
} from './types';
import { clamp, kelvinToHex, sum } from './util';
import { buildCornerUnit } from './corner';

const GAP = 3; // reveal between fronts
const SLIDE_ZONE = 80; // depth reserved for sliding wardrobe door tracks
const DRAWER_CLEAR = 26; // runner clearance (13mm each side)
const ALU_W = 20; // visual width of aluminium frame profile

export const hingesForDoor = (heightMm: number): number => (heightMm <= 900 ? 2 : heightMm <= 1600 ? 3 : heightMm <= 2000 ? 4 : 5);

export function pickRunner(cat: Catalog, selectedId: string | null, available: number): { acc: Accessory | null; fits: boolean } {
  const sel = cat.accessories.find((a) => a.id === selectedId) ?? null;
  if (!sel) return { acc: null, fits: true };
  if (!sel.family || !sel.lengthMm) return { acc: sel, fits: (sel.lengthMm ?? 0) <= available };
  const fam = cat.accessories.filter((a) => a.category === 'runner' && a.family === sel.family && a.lengthMm).sort((a, b) => (a.lengthMm ?? 0) - (b.lengthMm ?? 0));
  const fitting = fam.filter((a) => (a.lengthMm ?? 0) <= available);
  if (fitting.length) return { acc: fitting[fitting.length - 1], fits: true };
  return { acc: fam[0] ?? sel, fits: false };
}

/** Same hinge family, matching the overlay type of the door. */
export function pickHinge(cat: Catalog, selectedId: string | null, fit: Section['fit']): Accessory | null {
  const sel = cat.accessories.find((a) => a.id === selectedId) ?? null;
  if (!sel || !sel.family || sel.fit === fit) return sel;
  return cat.accessories.find((a) => a.category === 'hinge' && a.family === sel.family && a.fit === fit) ?? sel;
}

export interface BuildContext {
  /** top surface height when the top is supplied by a kitchen run */
  topY?: number;
  /** front edge of the shared worktop (z) for hob / sink positioning */
  topFront?: number;
}

export function topThickness(u: Unit, cat: Catalog): number {
  const counter = cat.countertops.find((c) => c.id === u.countertopId);
  if (counter) return counter.thickness;
  return cat.boards.find((b) => b.id === u.topBoardId)?.thickness ?? 0;
}

export function buildUnit(u: Unit, cat: Catalog, pricing: PricingSettings, ctx: BuildContext = {}): UnitBuild {
  if (u.corner) return buildCornerUnit(u, cat, pricing);
  const board = (id: string | null) => cat.boards.find((b) => b.id === id) ?? null;
  const acc = (id: string | null) => cat.accessories.find((a) => a.id === id) ?? null;
  const appl = (id: string | null) => cat.appliances.find((a) => a.id === id) ?? null;
  const warnings: string[] = [];

  const carcass = board(u.carcassMaterialId) ?? cat.boards[0];
  const front = board(u.frontMaterialId) ?? carcass;
  const back = board(u.backMaterialId);
  const counter = cat.countertops.find((c) => c.id === u.countertopId) ?? null;
  const topBoard = counter ? null : board(u.topBoardId);
  const glass = cat.glass.find((g) => g.id === u.glassId) ?? cat.glass[0] ?? null;
  const alu = cat.aluminium.find((a) => a.id === u.aluminiumId) ?? cat.aluminium[0] ?? null;

  const W = u.width;
  const H = u.height;
  const D = u.depth;
  const t = carcass?.thickness ?? 16;
  const ft = front?.thickness ?? t;
  const backT = back?.thickness ?? 0;
  const ct = topThickness(u, cat);
  const wall = u.mount === 'wall';
  const baseH = wall || u.base === 'none' ? 0 : u.baseHeight;
  const topY = H - ct;
  const sliding = u.sliding.enabled;
  const hasOverlayFronts = !sliding && u.bays.some((b) => b.sections.some((s) => s.front !== 'open' && s.front !== 'appliance' && s.fit !== 'inset'));
  const Dc = D - (sliding ? SLIDE_ZONE : hasOverlayFronts ? ft : 0); // carcass depth
  const cd = Dc - backT; // depth of panels in front of the back panel
  const carcassH = topY - baseH;

  if (carcassH < 2 * t + 50) warnings.push('Unit is too short for its base / top settings.');
  if (cd < 100) warnings.push('Unit depth is very small — check the depth value.');

  /* -------------------------------------------------------- collectors */
  const parts = new Map<string, Part>();
  const addPart = (name: string, role: PartRole, kind: Part['kind'], materialId: string | null, length: number, width: number, thickness: number, edgeLen: number, edgingId: string | null, box: Box3 | null, qty = 1) => {
    const L = Math.round(length);
    const Wd = Math.round(width);
    if (L <= 0 || Wd <= 0) return;
    const key = `${name}|${materialId}|${L}|${Wd}`;
    const existing = parts.get(key);
    if (existing) {
      existing.qty += qty;
      if (box) existing.boxes.push(box);
    } else parts.set(key, { key, name, role, kind, materialId, length: L, width: Wd, thickness, qty, edgeLength: Math.round(edgeLen) / 1000, edgingId: edgeLen > 0 ? edgingId : null, boxes: box ? [box] : [] });
  };
  const hw = new Map<string, HardwareLine>();
  const addHw = (key: string, accessoryId: string | null | undefined, qty: number, reason: string) => {
    if (!accessoryId || qty <= 0 || !acc(accessoryId)) return;
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
  const lightsR: LightRender[] = [];
  const applR: ApplianceRender[] = [];
  const inserts: InsertRender[] = [];
  const applianceCount = new Map<string, number>();
  const useAppliance = (a: Appliance) => applianceCount.set(a.id, (applianceCount.get(a.id) ?? 0) + 1);

  let joints = 0;
  let hinges = 0;
  let runnerPairs = 0;
  let handlePcs = 0;
  let backPerimeter = 0;
  let doorSeq = 0;

  const handle = acc(u.handleId);
  const addHandle = (frontWidth: number) => {
    if (!handle) return;
    if (handle.unit === 'm') addHw('handle', handle.id, frontWidth / 1000, 'Handle profile');
    else {
      addHw('handle', handle.id, 1, handle.style === 'push' ? 'Push-to-open per front' : 'Handles');
      if (handle.style !== 'push') handlePcs++;
    }
  };

  const eCar = u.edgingId;
  const eFront = u.frontEdgingId;
  const cm = carcass?.id ?? null;
  const fm = front?.id ?? null;

  /* ------------------------------------------------------------ carcass */
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
    for (let k = 0; k < pieces; k++) addPart(pieces > 1 ? 'Back panel (strip)' : 'Back panel', 'back', 'board', back.id, carcassH, pw, backT, 0, null, { x: k * pw, y: baseH, z: 0, w: pw, h: carcassH, d: backT });
    backPerimeter += 2 * (carcassH + W) + (pieces - 1) * carcassH * 2;
  }

  /* --------------------------------------------------------------- base */
  if (u.base === 'plinth' && baseH > 0) {
    const r = u.plinthRecess;
    const ps = u.plinthSides;
    const xL = ps.left ? r : 0;
    const xR = ps.right ? W - r : W;
    const zF = D - r - t;
    if (ps.front) addPart('Kick board (front)', 'plinth', 'board', cm, xR - xL, baseH, t, xR - xL, eCar, { x: xL, y: 0, z: zF, w: xR - xL, h: baseH, d: t });
    if (ps.back) addPart('Kick board (back)', 'plinth', 'board', cm, xR - xL, baseH, t, xR - xL, eCar, { x: xL, y: 0, z: r, w: xR - xL, h: baseH, d: t });
    else addPart('Plinth rail (rear)', 'plinth', 'board', cm, W - 2 * t, baseH, t, 0, eCar, { x: t, y: 0, z: backT + 40, w: W - 2 * t, h: baseH, d: t });
    const z0 = ps.back ? r + t : backT + 40 + t;
    const z1 = ps.front ? zF : D - r;
    if (ps.left) addPart('Kick board (left)', 'plinth', 'board', cm, z1 - z0, baseH, t, z1 - z0, eCar, { x: r, y: 0, z: z0, w: t, h: baseH, d: z1 - z0 });
    if (ps.right) addPart('Kick board (right)', 'plinth', 'board', cm, z1 - z0, baseH, t, z1 - z0, eCar, { x: W - r - t, y: 0, z: z0, w: t, h: baseH, d: z1 - z0 });
    joints += 4;
    addHw('leg', u.legId && acc(u.legId)?.name.toLowerCase().includes('plinth') ? u.legId : null, 4 + 2 * Math.floor(Math.max(0, W - 1) / 1000), 'Plinth legs');
  } else if (u.base === 'legs' && baseH > 0) {
    const legs = 4 + 2 * Math.floor(Math.max(0, W - 1) / 1000);
    addHw('leg', u.legId, legs, `${legs} legs`);
  }

  /* ---------------------------------------------------------- top / overhang */
  const fp = u.finishPanels;
  const fpT = (side: 'left' | 'right' | 'back') => (fp[side].enabled ? board(fp[side].materialId)?.thickness ?? 18 : 0);
  const oL = -fpT('left') - u.overhang.left;
  const oR = W + fpT('right') + u.overhang.right;
  const oB = -fpT('back') - u.overhang.back;
  const oF = D + u.overhang.front;
  if (counter) {
    addPart('Countertop', 'counter', 'counter', counter.id, oR - oL, oF - oB, counter.thickness, 0, null, { x: oL, y: topY, z: oB, w: oR - oL, h: ct, d: oF - oB });
  } else if (topBoard) {
    const edge = (oR - oL) + 2 * (oF - oB);
    addPart('Top (overhanging)', 'finish', 'board', topBoard.id, oR - oL, oF - oB, topBoard.thickness, edge, u.frontEdgingId ?? eCar, { x: oL, y: topY, z: oB, w: oR - oL, h: ct, d: oF - oB });
  }

  /* ------------------------------------------------------- finish panels */
  const panelY0 = (p: typeof fp.left) => (p.toFloor && !wall ? 0 : baseH);
  const finishPanel = (name: string, side: 'left' | 'right' | 'back') => {
    const p = fp[side];
    if (!p.enabled) return;
    const m = board(p.materialId);
    if (!m) return;
    const pt = m.thickness;
    const y0 = panelY0(p);
    const h = topY - y0;
    const box: Box3 =
      side === 'left'
        ? { x: -pt, y: y0, z: -fpT('back'), w: pt, h, d: D + fpT('back') }
        : side === 'right'
          ? { x: W, y: y0, z: -fpT('back'), w: pt, h, d: D + fpT('back') }
          : { x: 0, y: y0, z: -pt, w: W, h, d: pt };
    const slatW = Math.max(5, p.slatWidth || 40);
    const slatG = Math.max(0, p.slatGap ?? 15);
    box.meta = { style: p.style, slatWidth: slatW, slatGap: slatG };
    const pw = side === 'back' ? W : D + fpT('back');
    addPart(`Finish panel (${name})`, 'finish', 'board', m.id, h, pw, pt, side === 'back' ? 0 : h + pw, eFront ?? eCar, box);
    if (p.style === 'shaker') {
      addPart(`Shaker frame stile (${name})`, 'finish', 'board', m.id, h, 70, pt, 0, null, null, 2);
      addPart(`Shaker frame rail (${name})`, 'finish', 'board', m.id, pw - 140, 70, pt, 0, null, null, 2);
    }
    if (p.style === 'slatted') {
      // as many whole slats as fit, gaps shared out evenly
      const n = Math.max(1, Math.floor((pw + slatG) / (slatW + slatG)));
      addPart(`Slat ${slatW}mm (${name})`, 'finish', 'board', m.id, h, slatW, pt, (h / 1000) * 2 * 1000, eFront ?? eCar, null, n);
    }
    if (p.style === 'fluted') addHw(`flute-${side}`, 'sv-notch', Math.ceil(pw / 100), `Fluting machining (${name})`);
  };
  finishPanel('left', 'left');
  finishPanel('right', 'right');
  finishPanel('back', 'back');

  /* -------------------------------------------------------- front panels */
  const doorHinge = (material: DoorMaterial, fit: Section['fit']) => (material === 'wood' ? pickHinge(cat, u.hingeId, fit) : acc(u.glassHingeId) ?? pickHinge(cat, u.hingeId, fit));

  /** a door / flap / sliding panel in wood, framed glass or frameless glass */
  const makePanel = (name: string, material: DoorMaterial, x: number, y: number, w: number, h: number, z: number, meta: BoxMeta) => {
    const m = { ...meta, door: meta.door ?? `d${doorSeq++}` };
    if (material === 'wood') {
      addPart(name, 'door', 'board', fm, Math.max(h, w) === h ? h : w, Math.max(h, w) === h ? w : h, ft, 2 * (h + w), eFront, { x, y, z, w, h, d: ft, meta: m });
    } else if (material === 'glass') {
      const gw = w - 2 * ALU_W;
      const gh = h - 2 * ALU_W;
      if (glass) addPart(`${name} glass`, 'glass', 'glass', glass.id, gh, gw, glass.thickness, 0, null, { x: x + ALU_W, y: y + ALU_W, z: z + 8, w: gw, h: gh, d: glass.thickness, meta: { ...m, handle: false } });
      addAlu([h, h, w, w], [
        { x, y, z, w: ALU_W, h, d: 20, meta: { ...m, handle: false } },
        { x: x + w - ALU_W, y, z, w: ALU_W, h, d: 20, meta: { ...m, handle: false } },
        { x: x + ALU_W, y, z, w: w - 2 * ALU_W, h: ALU_W, d: 20, meta: { ...m, handle: false } },
        { x: x + ALU_W, y: y + h - ALU_W, z, w: w - 2 * ALU_W, h: ALU_W, d: 20, meta: { ...m } },
      ]);
    } else if (glass) {
      addPart(`${name} (frameless glass)`, 'glass', 'glass', glass.id, h, w, glass.thickness, 0, null, { x, y, z, w, h, d: Math.max(6, glass.thickness), meta: m });
    }
  };

  /* -------------------------------------------------------------- interior */
  const n = Math.max(1, u.bays.length);
  const clearW = innerW - (n - 1) * t;
  const bayTotal = sum(u.bays.map((b) => b.size)) || 1;
  const y0 = baseH + t;
  const y1 = topY - t;
  const Hi = y1 - y0;
  let pins = 0;
  let x = t;
  const bayGeo: { x: number; w: number; shelves: { y: number }[]; topSecY: number }[] = [];

  type Edges = { left: boolean; right: boolean; bottom: boolean; top: boolean };
  /** one compartment: either split further (side by side / stacked) or filled with its front and contents */
  const cell = (s: Section, ref: SectionRef, bx: number, sy: number, bw: number, sh: number, edges: Edges, geo: { shelves: { y: number }[] }): void => {
    const i = ref.bay;
    const parts = s.split?.parts ?? [];
    if (s.split && parts.length > 1) {
      const k = parts.length;
      const total = sum(parts.map((p) => p.size)) || 1;
      if (s.split.dir === 'cols') {
        const clear = bw - (k - 1) * t;
        let px = bx;
        parts.forEach((p, idx) => {
          const pw = (clear * p.size) / total;
          if (idx < k - 1) {
            addPart('Partition', 'carcass', 'board', cm, sh, cd, t, sh, eCar, { x: px + pw, y: sy, z: backT, w: t, h: sh, d: cd, meta: { ref } });
            joints += 2;
          }
          cell(p, { ...ref, path: [...(ref.path ?? []), idx] }, px, sy, pw, sh, { ...edges, left: edges.left && idx === 0, right: edges.right && idx === k - 1 }, geo);
          px += pw + t;
        });
      } else {
        const clear = sh - (k - 1) * t;
        let py = sy;
        parts.forEach((p, idx) => {
          const ph = (clear * p.size) / total;
          if (idx < k - 1) {
            addPart('Fixed shelf', 'shelf', 'board', cm, bw, cd, t, bw, eCar, { x: bx, y: py + ph, z: backT, w: bw, h: t, d: cd, meta: { ref } });
            geo.shelves.push({ y: py + ph });
            joints += 2;
          }
          cell(p, { ...ref, path: [...(ref.path ?? []), idx] }, bx, py, bw, ph, { ...edges, bottom: edges.bottom && idx === 0, top: edges.top && idx === k - 1 }, geo);
          py += ph + t;
        });
      }
      return;
    }
    const isAppliance = s.front === 'appliance' && !sliding;
    if (s.shelves > 0 && !isAppliance) {
      for (let k = 0; k < s.shelves; k++) {
        const yy = sy + (sh * (k + 1)) / (s.shelves + 1) - t / 2;
        addPart('Adjustable shelf', 'shelf', 'board', cm, bw - 2, cd - 20, t, bw - 2, eCar, { x: bx + 1, y: yy, z: backT, w: bw - 2, h: t, d: cd - 20, meta: { ref } });
        geo.shelves.push({ y: yy });
        pins += 4;
      }
    }
    if (s.hangingRail && !isAppliance) {
      addHw('rail', u.railId, acc(u.railId)?.unit === 'm' ? bw / 1000 : 1, 'Hanging rail');
      rails.push({ box: { x: bx, y: sy + sh - 70, z: backT + cd / 2 - 12, w: bw, h: 25, d: 15, meta: { ref } } });
    }
    if (s.insertId) {
      const ins = acc(s.insertId);
      if (ins) {
        addHw('insert', ins.id, 1, 'Pull-out / organiser');
        if (ins.minWidth && bw < ins.minWidth) warnings.push(`Bay ${i + 1}: ${ins.name} needs at least ${ins.minWidth}mm clear width.`);
        inserts.push({ accessoryId: ins.id, box: { x: bx + 15, y: sy + 15, z: backT + 15, w: bw - 30, h: sh - 30, d: cd - 50, meta: { ref } }, ref });
      }
    }

    // the opening this front covers
    const kind = sliding && s.front !== 'drawer' ? 'open' : s.front;
    if (sliding && s.front !== 'drawer' && s.front !== 'open') warnings.push(`Bay ${i + 1}: compartment fronts are replaced by the sliding wardrobe doors.`);
    if (kind === 'open') return;
    const fit = sliding ? 'inset' : s.fit;
    let fx0: number, fx1: number, fy0: number, fy1: number, fz: number;
    if (fit === 'inset' || kind === 'appliance') {
      fx0 = bx + 2;
      fx1 = bx + bw - 2;
      fy0 = sy + 2;
      fy1 = sy + sh - 2;
      fz = Dc - ft;
    } else {
      const outer = fit === 'half' ? t / 2 : 0;
      fx0 = (edges.left ? outer : bx - t / 2) + GAP / 2;
      fx1 = (edges.right ? W - outer : bx + bw + t / 2) - GAP / 2;
      fy0 = (edges.bottom ? baseH + outer : sy - t / 2) + GAP / 2;
      fy1 = (edges.top ? topY - outer : sy + sh + t / 2) - GAP / 2;
      fz = Dc;
    }
    const fw = fx1 - fx0;
    const fh = fy1 - fy0;

    if (kind === 'door') {
      const material = s.doorMaterial;
      const hingeAcc = doorHinge(material, fit);
      if (s.opening === 'pair') {
        const dw = (fw - GAP) / 2;
        ([['left', fx0], ['right', fx0 + dw + GAP]] as const).forEach(([side, dx]) => {
          makePanel('Door', material, dx, fy0, dw, fh, fz, { ref, hinge: side, handle: true });
          const hn = hingesForDoor(fh);
          addHw('hinge', hingeAcc?.id, hn, `Door hinges (${fit})`);
          hinges += hn;
          addHandle(dw);
        });
      } else if (s.opening === 'up' || s.opening === 'down') {
        makePanel(s.opening === 'up' ? 'Lift-up flap' : 'Drop-down flap', material, fx0, fy0, fw, fh, fz, { ref, hinge: s.opening === 'up' ? 'top' : 'bottom', handle: true });
        const hn = fw > 900 ? 3 : 2;
        addHw('hinge', hingeAcc?.id, hn, 'Flap hinges');
        hinges += hn;
        if (s.opening === 'up') addHw('stay', u.stayId, fw > 600 ? 2 : 1, 'Lift-up stays');
        else addHw('stay', 'st-drop', 2, 'Drop-down stays');
        addHandle(fw);
      } else {
        makePanel('Door', material, fx0, fy0, fw, fh, fz, { ref, hinge: s.opening, handle: true });
        const hn = hingesForDoor(fh);
        addHw('hinge', hingeAcc?.id, hn, `Door hinges (${fit})`);
        hinges += hn;
        addHandle(fw);
      }
    } else if (kind === 'sliding') {
      const roller = acc('ro-mini') ?? acc(u.rollerId);
      addHw('track', u.trackId, fw / 1000, 'Cabinet sliding track');
      if (s.slide === 'bypass') {
        const pw = fw / 2 + 15;
        makePanel('Sliding door', s.doorMaterial, fx0, fy0, pw, fh, fz + ft + 4, { ref, slide: 'right', handle: true });
        makePanel('Sliding door', s.doorMaterial, fx1 - pw, fy0, pw, fh, fz, { ref, slide: 'left', handle: true });
        addHw('roller', roller?.id, 2, 'Sliding rollers');
        addHandle(pw);
        addHandle(pw);
      } else {
        makePanel('Sliding door', s.doorMaterial, fx0, fy0, fw, fh, fz, { ref, slide: s.slide, handle: true });
        addHw('roller', roller?.id, 1, 'Sliding rollers');
        addHandle(fw);
      }
    } else if (kind === 'appliance') {
      const a = appl(s.applianceId);
      if (a) {
        useAppliance(a);
        // appliance fascias may overlap the carcass edges; bottom appliances may use the plinth zone
        const roomW = bw + 2 * t;
        const roomH = sh + 2 * t + (edges.bottom ? baseH : 0);
        if (a.width > roomW + 5) warnings.push(`Bay ${i + 1}: ${a.name} (${a.width}mm) is wider than the ${Math.round(roomW)}mm space.`);
        if (a.height > roomH + 5) warnings.push(`Bay ${i + 1}: ${a.name} (${a.height}mm) is taller than the ${Math.round(roomH)}mm space.`);
        const aw = Math.min(bw - 4, a.width);
        const ah = Math.min(sh - 4, a.height);
        const integrated = /integrated/i.test(a.variant);
        applR.push({ applianceId: a.id, ref, box: { x: bx + (bw - aw) / 2, y: sy + (sh - ah) / 2, z: Math.max(backT, Dc + ft - a.depth), w: aw, h: ah, d: Math.min(a.depth, Dc + ft - backT), meta: { ref } } });
        if (integrated) {
          makePanel('Appliance door panel', 'wood', fx0, fy0, fw, fh, Dc, { ref, handle: true });
          addHandle(fw);
        }
      } else warnings.push(`Bay ${i + 1}: choose an appliance for the appliance compartment.`);
    } else if (kind === 'drawer') {
      const dc = Math.max(1, s.drawerCount);
      const dh = (fh - (dc - 1) * GAP) / dc;
      const avail = (fit === 'inset' ? cd - ft : cd) - 10;
      const { acc: runner, fits } = pickRunner(cat, u.runnerId, avail);
      if (!fits) warnings.push(`Bay ${i + 1}: unit is too shallow for the selected runner range.`);
      const L = runner?.lengthMm ?? Math.floor(avail / 50) * 50;
      for (let k = 0; k < dc; k++) {
        const dy = fy0 + k * (dh + GAP);
        const door = `d${doorSeq++}`;
        const meta: BoxMeta = { ref, door, drawer: true };
        addPart('Drawer front', 'drawerFront', 'board', fm, fw, dh, ft, 2 * (fw + dh), eFront, { x: fx0, y: dy, z: fz, w: fw, h: dh, d: ft, meta: { ...meta, handle: true } });
        const boxH = clamp(dh - 50, 60, 250);
        const boxW = bw - DRAWER_CLEAR;
        const bx0 = bx + DRAWER_CLEAR / 2;
        const by0 = dy + 15;
        const bz0 = fz - L;
        addPart('Drawer side', 'drawerBox', 'board', cm, L, boxH, t, L, eCar, { x: bx0, y: by0, z: bz0, w: t, h: boxH, d: L, meta });
        addPart('Drawer side', 'drawerBox', 'board', cm, L, boxH, t, L, eCar, { x: bx0 + boxW - t, y: by0, z: bz0, w: t, h: boxH, d: L, meta });
        addPart('Drawer front/back (inner)', 'drawerBox', 'board', cm, boxW - 2 * t, boxH, t, boxW - 2 * t, eCar, { x: bx0 + t, y: by0, z: bz0, w: boxW - 2 * t, h: boxH, d: t, meta });
        addPart('Drawer front/back (inner)', 'drawerBox', 'board', cm, boxW - 2 * t, boxH, t, 0, eCar, { x: bx0 + t, y: by0, z: fz - t, w: boxW - 2 * t, h: boxH, d: t, meta });
        addPart('Drawer bottom', 'drawerBox', 'board', back?.id ?? cm, L, boxW, back?.thickness ?? t, 0, null, { x: bx0, y: by0 - 3, z: bz0, w: boxW, h: back?.thickness ?? t, d: L, meta });
        joints += 4;
        runnerPairs++;
        if (runner) addHw('runner', runner.id, 1, `Drawer runners ${runner.size}`);
        addHandle(fw);
      }
    }
  };

  u.bays.forEach((bay, i) => {
    const bw = (clearW * bay.size) / bayTotal;
    const bx = x;
    const geo = { x: bx, w: bw, shelves: [] as { y: number }[], topSecY: y1 };
    bayGeo.push(geo);
    if (i < n - 1) {
      addPart('Divider', 'carcass', 'board', cm, Hi, cd, t, Hi, eCar, { x: bx + bw, y: y0, z: backT, w: t, h: Hi, d: cd });
      joints += 2;
    }
    const m = Math.max(1, bay.sections.length);
    const clearH = Hi - (m - 1) * t;
    const secTotal = sum(bay.sections.map((s) => s.size)) || 1;
    let y = y0;
    bay.sections.forEach((top, j) => {
      const sh = (clearH * top.size) / secTotal;
      const sy = y;
      const ref: SectionRef = { bay: i, section: j };
      if (j < m - 1) {
        addPart('Fixed shelf', 'shelf', 'board', cm, bw, cd, t, bw, eCar, { x: bx, y: sy + sh, z: backT, w: bw, h: t, d: cd, meta: { ref } });
        geo.shelves.push({ y: sy + sh });
        joints += 2;
      }
      if (j === m - 1) geo.topSecY = sy + sh;
      cell(top, ref, bx, sy, bw, sh, { left: i === 0, right: i === n - 1, bottom: j === 0, top: j === m - 1 }, geo);
      y = sy + sh + t;
    });
    x = bx + bw + t;
  });

  /* ----------------------------------------------------- sliding wardrobe */
  if (sliding) {
    const p = Math.max(2, u.sliding.panels);
    const overlap = 30;
    const dw = (W + (p - 1) * overlap) / p;
    const dh = carcassH - 15;
    const mirror = cat.glass.find((g) => /mirror/i.test(g.name)) ?? glass;
    for (let k = 0; k < p; k++) {
      const dx = k * (dw - overlap);
      const dz = Dc + 10 + (k % 2 === 0 ? 0 : ft + 12);
      const meta: BoxMeta = { door: `sl${k}`, slide: k % 2 === 0 ? 'right' : 'left', handle: true };
      if (u.sliding.style === 'board') {
        addPart('Sliding door', 'door', 'board', fm, dh, dw, ft, 2 * (dh + dw), eFront, { x: dx, y: baseH + 5, z: dz, w: dw, h: dh, d: ft, meta });
      } else {
        const g = u.sliding.style === 'mirror' ? mirror : glass;
        if (g) addPart(u.sliding.style === 'mirror' ? 'Mirror panel' : 'Glass panel', 'glass', 'glass', g.id, dh - 2 * ALU_W, dw - 2 * ALU_W, g.thickness, 0, null, { x: dx + ALU_W, y: baseH + 5 + ALU_W, z: dz + 8, w: dw - 2 * ALU_W, h: dh - 2 * ALU_W, d: g.thickness, meta: { ...meta, handle: false } });
        addAlu([dh, dh, dw, dw], [
          { x: dx, y: baseH + 5, z: dz, w: ALU_W, h: dh, d: 25, meta: { ...meta, handle: false } },
          { x: dx + dw - ALU_W, y: baseH + 5, z: dz, w: ALU_W, h: dh, d: 25, meta: { ...meta, handle: false } },
          { x: dx + ALU_W, y: baseH + 5, z: dz, w: dw - 2 * ALU_W, h: ALU_W, d: 25, meta: { ...meta, handle: false } },
          { x: dx + ALU_W, y: baseH + 5 + dh - ALU_W, z: dz, w: dw - 2 * ALU_W, h: ALU_W, d: 25, meta },
        ]);
      }
      addHw('roller', u.rollerId, 1, 'Roller set per door');
      if (handle && handle.unit !== 'm') addHandle(dw);
    }
    const track = acc(u.trackId);
    if (track) addHw('track', track.id, track.unit === 'm' ? W / 1000 : 1, 'Top & bottom track');
  }

  /* -------------------------------------------------- top appliances */
  const surfaceY = ctx.topY != null ? ctx.topY - (wall ? u.mountHeight : 0) : ct > 0 ? H : topY;
  for (const ta of u.topAppliances) {
    const a = appl(ta.applianceId);
    const g = bayGeo[Math.min(ta.bay, bayGeo.length - 1)];
    if (!a || !g) continue;
    useAppliance(a);
    if (counter || ctx.topY != null) addHw('cutout', 'sv-cutout', 1, `Cut-out for ${a.name}`);
    else if (!topBoard) warnings.push(`${a.name} needs a countertop.`);
    // worktop edges in unit coordinates
    const frontEdge = ctx.topFront ?? D + u.overhang.front;
    const backEdge = ctx.topY != null ? 0 : -fpT('back') - u.overhang.back;
    const x0 = ta.xOffset != null ? ta.xOffset : g.x + g.w / 2 - a.width / 2;
    // centred on the worktop, but kept 50 mm clear of the front edge where the worktop allows it
    const centred = (frontEdge + backEdge) / 2 - a.depth / 2;
    const z0 = ta.frontGap != null ? frontEdge - ta.frontGap - a.depth : Math.max(backEdge, Math.min(centred, frontEdge - 50 - a.depth));
    applR.push({ applianceId: a.id, box: { x: x0, y: surfaceY, z: z0, w: a.width, h: a.height, d: a.depth } });
    const toFront = Math.round(frontEdge - (z0 + a.depth));
    if (toFront < 50) warnings.push(`${a.name} is only ${toFront}mm from the worktop front edge (50mm minimum).`);
    if (ctx.topY == null) {
      if (x0 - oL < 50) warnings.push(`${a.name} is only ${Math.round(x0 - oL)}mm from the left edge of the top.`);
      if (oR - (x0 + a.width) < 50) warnings.push(`${a.name} is only ${Math.round(oR - x0 - a.width)}mm from the right edge of the top.`);
    }
    if (a.width > g.w + 2 * t + 40 && ta.xOffset == null) warnings.push(`${a.name} is wider than bay ${ta.bay + 1} below it.`);
    const dd = appl(ta.downdraftId ?? null);
    if (dd) {
      useAppliance(dd);
      if (counter || ctx.topY != null) addHw('cutout', 'sv-cutout', 1, `Cut-out for ${dd.name}`);
      const dz = z0 - dd.depth - 15;
      if (dz < backEdge + 20) warnings.push(`Not enough worktop behind ${a.name} for the ${dd.name} — move the hob forward.`);
      applR.push({ applianceId: dd.id, box: { x: x0 + (a.width - dd.width) / 2, y: surfaceY, z: dz, w: dd.width, h: dd.height, d: dd.depth } });
    }
  }

  /* ------------------------------------------------------------- lights */
  let driverNeeded = false;
  for (const l of u.lights) {
    const la = acc(l.accessoryId);
    if (!la) continue;
    const color = l.temperature > 0 ? kelvinToHex(l.temperature) : l.color;
    const bays = l.bays.length ? l.bays.filter((b) => b < bayGeo.length) : bayGeo.map((_, k) => k);
    const strips: { box: Box3; dir: LightRender['dir'] }[] = [];
    const runAlong = (x0: number, len: number, y: number, z: number, dir: LightRender['dir']) => strips.push({ box: { x: x0, y, z, w: len, h: 8, d: 12 }, dir });
    switch (l.location) {
      case 'underCabinet':
        for (const b of bays) runAlong(bayGeo[b].x, bayGeo[b].w, baseH - 10, Dc - 50, 'down');
        break;
      case 'insideTop':
        for (const b of bays) runAlong(bayGeo[b].x + 5, bayGeo[b].w - 10, bayGeo[b].topSecY - 10, Dc - 50, 'down');
        break;
      case 'shelves':
        for (const b of bays) for (const s of bayGeo[b].shelves) runAlong(bayGeo[b].x + 5, bayGeo[b].w - 10, s.y - 9, Dc - 60, 'down');
        break;
      case 'plinth':
        if (u.base === 'plinth' && baseH > 0) runAlong(0, W, 6, D - u.plinthRecess + 5, 'down');
        else warnings.push('Plinth lighting needs a plinth / kick board.');
        break;
      case 'top':
        runAlong(0, W, H + 2, D * 0.3, 'up');
        break;
      case 'backPanel':
        for (const b of bays) runAlong(bayGeo[b].x + 5, bayGeo[b].w - 10, bayGeo[b].topSecY - 40, backT + 2, 'front');
        break;
      case 'custom':
        if (l.custom) {
          const c = l.custom;
          strips.push({ box: c.vertical ? { x: c.x, y: c.y, z: c.z, w: 12, h: Math.max(10, c.length), d: 12 } : { x: c.x, y: c.y, z: c.z, w: Math.max(10, c.length), h: 8, d: 12 }, dir: c.dir });
        }
        break;
    }
    if (!strips.length) continue;
    driverNeeded = true;
    if (la.lightKind === 'spot') {
      let spots = 0;
      for (const s of strips) {
        const len = Math.max(s.box.w, s.box.h);
        const k = Math.max(1, Math.round(len / 450));
        for (let q = 0; q < k; q++) {
          const along = (len * (q + 0.5)) / k;
          const vertical = s.box.h > s.box.w;
          lightsR.push({ box: { x: (vertical ? s.box.x : s.box.x + along) - 30, y: vertical ? s.box.y + along : s.box.y, z: s.box.z - 20, w: 60, h: 8, d: 60 }, color, dir: s.dir });
        }
        spots += k;
      }
      addHw(`light-${l.id}`, la.id, spots, `Spotlights (${l.location})`);
    } else {
      for (const s of strips) lightsR.push({ box: s.box, color, dir: s.dir });
      const metres = sum(strips.map((s) => Math.max(s.box.w, s.box.h))) / 1000;
      addHw(`light-${l.id}`, la.id, la.unit === 'm' ? metres : Math.ceil(metres), `LED ${l.location} ${l.temperature ? `${l.temperature}K` : 'RGB'}`);
    }
    if (l.sensorId) addHw(`sensor-${l.id}`, l.sensorId, 1, 'Light switch / sensor');
  }
  if (driverNeeded) addHw('driver', 'lt-driver', 1, 'LED driver');

  /* ------------------------------------------------- mounting / fixings */
  if (wall) addHw('hanger', 'fx-hanger', W > 900 ? 2 : 1, 'Wall hanging brackets');
  if (u.installType === 'builtIn') addHw('fix', 'fx-bracket', H > 1500 ? 4 : 2, 'Built-in wall fixing');

  /* -------------------------------------------------------------- extra */
  for (const e of u.extraParts) addPart(e.name || 'Extra part', 'extra', 'board', e.materialId, e.length, e.width, board(e.materialId)?.thickness ?? t, e.edgeLength * 1000, eCar, null, e.qty);

  /* ------------------------------------------------------------ fixings */
  if (pins) addHw('pins', u.shelfPinId, pins, 'Shelf support pins');
  const connector = acc(u.connectorId);
  if (connector) addHw('connector', connector.id, joints * 2, `${joints} joints × 2`);
  const screwQty = (connector ? 0 : joints * pricing.screwsPerJoint) + hinges * 4 + runnerPairs * 12 + handlePcs * 2 + Math.ceil(backPerimeter / 150);
  addHw('screws', u.screwId, screwQty, 'Assembly, hinge, runner & back fixing');

  const hardware = [...hw.values()].map((h) => ({ ...h, qty: Math.round(h.qty * 100) / 100 }));
  for (const h of hardware) {
    const o = u.hardwareOverrides[h.key];
    if (o !== undefined) h.qty = o;
  }
  for (const e of u.extraHardware) hardware.push({ key: `x:${e.id}`, accessoryId: e.accessoryId, qty: e.qty, reason: 'Added manually' });

  const build: UnitBuild = {
    parts: [...parts.values()],
    hardware: hardware.filter((h) => h.qty > 0),
    aluminium: [...aluMap.values()],
    rails,
    lights: lightsR,
    appliances: applR,
    inserts,
    applianceList: [...applianceCount.entries()].map(([applianceId, qty]) => ({ applianceId, qty })),
    warnings: [...new Set(warnings)],
  };
  if (wall) shiftBuild(build, u.mountHeight);
  return build;
}

/** Move every 3D box of a build up by dy (wall-hung units). */
export function shiftBuild(b: UnitBuild, dy: number) {
  const mv = (bx: Box3) => (bx.y += dy);
  b.parts.forEach((p) => p.boxes.forEach(mv));
  b.aluminium.forEach((a) => a.boxes.forEach(mv));
  b.rails.forEach((r) => mv(r.box));
  b.lights.forEach((l) => mv(l.box));
  b.appliances.forEach((a) => mv(a.box));
  b.inserts.forEach((a) => mv(a.box));
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
  const t = carcass?.thickness ?? 16;
  const baseH = u.mount === 'wall' || u.base === 'none' ? 0 : u.baseHeight;
  const topY = u.height - topThickness(u, cat);
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

/** Overall footprint including finish panels and top overhangs. */
export function unitExtents(u: Unit, cat: Catalog) {
  const th = (side: 'left' | 'right' | 'back') => (u.finishPanels[side].enabled ? cat.boards.find((b) => b.id === u.finishPanels[side].materialId)?.thickness ?? 18 : 0);
  const hasTop = !!(u.countertopId || u.topBoardId);
  const x0 = -th('left') - (hasTop ? u.overhang.left : 0);
  const x1 = u.width + th('right') + (hasTop ? u.overhang.right : 0);
  const z0 = -th('back') - (hasTop ? u.overhang.back : 0);
  const z1 = u.depth + (hasTop ? u.overhang.front : 0);
  const y0 = u.mount === 'wall' ? u.mountHeight : 0;
  // corner cupboards also run Width B along the side wall
  if (u.corner) return { x0: Math.min(0, x0), x1: Math.max(u.width, x1), z0: Math.min(0, z0), z1: Math.max(z1, u.corner.widthB), y0, y1: y0 + u.height };
  return { x0, x1, z0, z1, y0, y1: y0 + u.height };
}
