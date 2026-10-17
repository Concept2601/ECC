// Kitchen runs: a whole wall (or L / U of walls) of linked cabinets quoted as
// one item. Each module is a normal Unit, so it is designed with the same editor;
// the run keeps heights, depths and widths consistent and adds the continuous
// worktop, free-standing appliances and chimney hoods.
import { buildUnit, topThickness, type BuildContext } from './generate';
import { baseUnit, bay, sec } from './presets';
import { leafSections } from './sections';
import type { Box3, Catalog, Part, PricingSettings, Run, RunModule, RunShape, Unit, UnitBuild } from './types';
import { sum, uid } from './util';

export const RUN_SHAPE_LABELS: Record<RunShape, string> = { straight: 'Straight (one wall)', L: 'L-shape (two walls)', U: 'U-shape (three walls)' };
export const LEG_LABELS = ['Back wall', 'Right wall', 'Left wall'];

/* ----------------------------------------------------------- templates */

export type BaseTemplate = 'doors' | 'door' | 'drawers' | 'sink' | 'hob' | 'dishwasher' | 'bin' | 'spice' | 'cornerL' | 'cornerDiag' | 'corner' | 'open';
export type WallTemplate = 'none' | 'doors' | 'door' | 'glass' | 'flap' | 'open' | 'hood';
export type TallTemplate = 'pantry' | 'ovenTower' | 'fridge' | 'broom';
export type GapTemplate = 'fridge' | 'stove' | 'dishwasher' | 'empty';

export const BASE_TEMPLATES: Record<BaseTemplate, string> = {
  doors: 'Double door', door: 'Single door', drawers: 'Drawer pack', sink: 'Sink unit', hob: 'Hob + oven', dishwasher: 'Dishwasher (integrated)', bin: 'Bin pull-out', spice: 'Spice pull-out', cornerL: 'Corner cupboard – L (both walls)', cornerDiag: 'Corner cupboard – diagonal (both walls)', corner: 'Blind corner (magic corner)', open: 'Open shelves',
};
export const WALL_TEMPLATES: Record<WallTemplate, string> = { none: 'Nothing above', doors: 'Double door', door: 'Single door', glass: 'Glass doors', flap: 'Lift-up flap', open: 'Open shelf', hood: 'Chimney hood' };
export const TALL_TEMPLATES: Record<TallTemplate, string> = { pantry: 'Pantry pull-out', ovenTower: 'Oven + microwave tower', fridge: 'Integrated fridge housing', broom: 'Broom cupboard' };
export const GAP_TEMPLATES: Record<GapTemplate, string> = { fridge: 'Free-standing fridge', stove: 'Free-standing stove', dishwasher: 'Free-standing dishwasher', empty: 'Empty space' };

const DEFAULT_WIDTH: Record<BaseTemplate, number> = { doors: 800, door: 450, drawers: 600, sink: 900, hob: 600, dishwasher: 600, bin: 450, spice: 150, cornerL: 900, cornerDiag: 900, corner: 1000, open: 400 };

function makeBase(tpl: BaseTemplate, width: number, run: Run): Unit {
  if (tpl === 'cornerL' || tpl === 'cornerDiag') {
    const style = tpl === 'cornerL' ? 'L' : 'diagonal';
    return baseUnit('corner_base', {
      name: `Base – Corner ${style === 'L' ? 'L' : 'diagonal'}`,
      width,
      installType: run.installType,
      hingeId: 'h-corner',
      corner: { widthB: width, style, hand: 'right', shelves: 1, carousel: false },
      bays: [bay(1, [sec({ front: 'door', opening: 'left', shelves: 1 })])],
    });
  }
  const u = baseUnit('kitchen_base', { name: `Base – ${BASE_TEMPLATES[tpl]}`, width, installType: run.installType });
  switch (tpl) {
    case 'doors':
      u.bays = [bay(1, [sec({ front: 'door', opening: 'pair', shelves: 1 })])];
      break;
    case 'door':
      u.bays = [bay(1, [sec({ front: 'door', opening: 'left', shelves: 1 })])];
      break;
    case 'drawers':
      u.bays = [bay(1, [sec({ front: 'drawer', drawerCount: 3 })])];
      break;
    case 'sink':
      u.bays = [bay(1, [sec({ front: 'door', opening: 'pair' })])];
      u.topAppliances = [{ id: uid('ta'), applianceId: 'ap-sink-single', bay: 0 }];
      break;
    case 'hob':
      u.bays = [bay(1, [sec({ front: 'drawer', size: 0.18 }), sec({ front: 'appliance', applianceId: 'ap-oven-elec', size: 1 })])];
      u.topAppliances = [{ id: uid('ta'), applianceId: 'ap-hob-gas4', bay: 0 }];
      break;
    case 'dishwasher':
      u.bays = [bay(1, [sec({ front: 'appliance', applianceId: 'ap-dw-int' })])];
      u.backMaterialId = null;
      break;
    case 'bin':
      u.bays = [bay(1, [sec({ front: 'door', opening: 'right', insertId: 'in-bin' })])];
      break;
    case 'spice':
      u.bays = [bay(1, [sec({ front: 'door', opening: 'right', insertId: 'in-spice' })])];
      break;
    case 'corner':
      u.bays = [bay(1, [sec({ front: 'door', opening: 'left', insertId: 'in-magic' })]), bay(0.8, [sec({ front: 'open' })])];
      u.hingeId = 'h-bic';
      break;
    case 'open':
      u.bays = [bay(1, [sec({ front: 'open', shelves: 1 })])];
      break;
  }
  return u;
}

function makeWall(tpl: WallTemplate, width: number, run: Run): Unit | null {
  if (tpl === 'none' || tpl === 'hood') return null;
  const u = baseUnit('kitchen_wall', { name: `Wall – ${WALL_TEMPLATES[tpl]}`, width, mount: 'wall', installType: run.installType, overhang: { front: 0, back: 0, left: 0, right: 0 } });
  u.lights = [{ id: uid('lt'), accessoryId: 'lt-profile', location: 'underCabinet', temperature: 3000, color: '#ffffff', bays: [], sensorId: 'lt-sensor-wave' }];
  switch (tpl) {
    case 'doors':
      u.bays = [bay(1, [sec({ front: 'door', opening: 'pair', shelves: 2 })])];
      break;
    case 'door':
      u.bays = [bay(1, [sec({ front: 'door', opening: width > 500 ? 'pair' : 'left', shelves: 2 })])];
      break;
    case 'glass':
      u.bays = [bay(1, [sec({ front: 'door', doorMaterial: 'glass', opening: width > 500 ? 'pair' : 'left', shelves: 2 })])];
      break;
    case 'flap':
      u.bays = [bay(1, [sec({ front: 'door', opening: 'up', shelves: 1 })])];
      break;
    case 'open':
      u.bays = [bay(1, [sec({ front: 'open', shelves: 1 })])];
      break;
  }
  return u;
}

function makeTall(tpl: TallTemplate, width: number, run: Run): Unit {
  const u = baseUnit('kitchen_tall', { name: `Tall – ${TALL_TEMPLATES[tpl]}`, width, installType: run.installType });
  switch (tpl) {
    case 'pantry':
      u.bays = [bay(1, [sec({ front: 'door', opening: 'right', insertId: 'in-pantry', size: 4 }), sec({ front: 'door', opening: 'up', size: 1 })])];
      break;
    case 'ovenTower':
      u.bays = [bay(1, [sec({ front: 'drawer', drawerCount: 2, size: 1 }), sec({ front: 'appliance', applianceId: 'ap-oven-elec', size: 1.15 }), sec({ front: 'appliance', applianceId: 'ap-mw-built', size: 0.8 }), sec({ front: 'door', opening: 'up', size: 1 })])];
      break;
    case 'fridge':
      u.bays = [bay(1, [sec({ front: 'appliance', applianceId: 'ap-fr-int', size: 5 }), sec({ front: 'door', opening: 'up', size: 0.6 })])];
      break;
    case 'broom':
      u.bays = [bay(1, [sec({ front: 'door', opening: 'left', size: 4 }), sec({ front: 'door', opening: 'up', size: 1 })])];
      break;
  }
  return u;
}

export function baseModule(tpl: BaseTemplate, run: Run, wallTpl: WallTemplate = 'doors', width = DEFAULT_WIDTH[tpl]): RunModule {
  return { id: uid('m'), kind: 'base', width, base: makeBase(tpl, width, run), wall: makeWall(wallTpl, width, run), hoodId: wallTpl === 'hood' ? 'ap-hood-chimney' : null, gapApplianceId: null, gapLabel: '', cornerB: tpl === 'cornerL' || tpl === 'cornerDiag' ? width : null };
}
export function tallModule(tpl: TallTemplate, run: Run, width = 600): RunModule {
  return { id: uid('m'), kind: 'tall', width, base: makeTall(tpl, width, run), wall: null, hoodId: null, gapApplianceId: null, gapLabel: '' };
}
export function gapModule(tpl: GapTemplate, run: Run): RunModule {
  void run;
  const appliance = tpl === 'fridge' ? 'ap-fr-topfreezer' : tpl === 'stove' ? 'ap-cooker-gas' : tpl === 'dishwasher' ? 'ap-dw-free' : null;
  const width = tpl === 'fridge' ? 750 : 600;
  return { id: uid('m'), kind: 'gap', width, base: null, wall: null, hoodId: tpl === 'stove' ? 'ap-hood-chimney' : null, gapApplianceId: appliance, gapLabel: GAP_TEMPLATES[tpl] };
}
export type CustomKind = 'base' | 'tall' | 'wall' | 'space' | 'filler' | 'appliance';
export const CUSTOM_KINDS: Record<CustomKind, string> = {
  base: 'Base cabinet (any size)',
  tall: 'Tall cabinet (any size)',
  wall: 'Wall cabinet only (space below)',
  space: 'Open space / gap',
  filler: 'Filler panel',
  appliance: 'Free-standing appliance space',
};

export interface CustomSpec {
  kind: CustomKind;
  width: number;
  height: number | null;
  depth: number | null;
  /** Wall cabinet height / underside (wall kind or above a base / space). */
  wallHeight?: number | null;
  wallBottom?: number | null;
  front?: 'doors' | 'door' | 'drawers' | 'open';
  label?: string;
  applianceId?: string | null;
}

/** A cabinet, space or filler of any size, for slotting in anywhere along a wall. */
export function customModule(spec: CustomSpec, run: Run): RunModule {
  const w = Math.max(1, Math.round(spec.width));
  const front = spec.front ?? 'doors';
  const base: RunModule = { id: uid('m'), kind: 'gap', width: w, base: null, wall: null, hoodId: null, gapApplianceId: null, gapLabel: spec.label || '', height: spec.height || null, depth: spec.depth || null, wallHeight: spec.wallHeight || null, wallBottom: spec.wallBottom ?? null };
  const bays = front === 'drawers' ? [bay(1, [sec({ front: 'drawer', drawerCount: 3 })])] : front === 'open' ? [bay(1, [sec({ front: 'open', shelves: 1 })])] : [bay(1, [sec({ front: 'door', opening: front === 'door' ? 'left' : 'pair', shelves: 1 })])];
  switch (spec.kind) {
    case 'base': {
      const u = baseUnit('kitchen_base', { name: spec.label || `Base – custom ${w}mm`, width: w, installType: run.installType });
      u.bays = bays;
      return { ...base, kind: 'base', base: u, gapLabel: '' };
    }
    case 'tall': {
      const u = baseUnit('kitchen_tall', { name: spec.label || `Tall – custom ${w}mm`, width: w, installType: run.installType });
      u.bays = front === 'open' ? bays : [bay(1, [sec({ front: 'door', opening: front === 'door' ? 'left' : 'pair', shelves: 4, size: 4 }), sec({ front: 'door', opening: 'up', size: 1 })])];
      return { ...base, kind: 'tall', base: u, gapLabel: '' };
    }
    case 'wall': {
      const m: RunModule = { ...base, gapLabel: spec.label || 'Space under wall cabinet' };
      m.wall = makeWall(front === 'open' ? 'open' : front === 'door' ? 'door' : 'doors', w, run);
      if (m.wall && spec.label) m.wall.name = `Wall – ${spec.label}`;
      return m;
    }
    case 'filler':
      return { ...base, kind: 'filler', gapLabel: spec.label || 'Filler' };
    case 'appliance':
      return { ...base, gapApplianceId: spec.applianceId ?? null, gapLabel: spec.label || 'Appliance space' };
    default:
      return { ...base, gapLabel: spec.label || 'Open space' };
  }
}

/** Mm still free on each leg when a target length was measured (negative = too long). */
export const legRemaining = (run: Run, leg: number): number | null => {
  const t = run.targets?.[leg];
  return t ? t - legLength(run.legs[leg]) : null;
};

export function setWallTemplate(m: RunModule, tpl: WallTemplate, run: Run) {
  m.wall = makeWall(tpl, m.width, run);
  m.hoodId = tpl === 'hood' ? 'ap-hood-chimney' : null;
}

export function createRun(shape: RunShape): Run {
  const run: Run = {
    id: uid('r'),
    name: shape === 'straight' ? 'Kitchen – straight run' : shape === 'L' ? 'Kitchen – L-shape' : 'Kitchen – U-shape',
    qty: 1,
    shape,
    legs: [[], [], []],
    counterHeight: 900,
    baseDepth: 560,
    plinthHeight: 120,
    wallBottom: 1450,
    wallHeight: 720,
    wallDepth: 320,
    tallHeight: 2200,
    countertopId: 'c-granite',
    counterOverhang: 20,
    installType: 'builtIn',
    notes: '',
  };
  run.legs[0] = [tallModule('fridge', run), baseModule('drawers', run), baseModule('hob', run, 'hood'), baseModule('doors', run), baseModule('sink', run, 'glass'), baseModule('dishwasher', run)];
  if (shape !== 'straight') {
    run.legs[0][run.legs[0].length - 1] = baseModule('cornerL', run, 'doors');
    run.legs[1] = [baseModule('dishwasher', run, 'doors'), baseModule('bin', run, 'door'), baseModule('drawers', run, 'doors'), tallModule('pantry', run)];
  }
  if (shape === 'U') {
    run.legs[0][0] = baseModule('cornerL', run, 'doors');
    run.legs[2] = [baseModule('doors', run, 'doors'), baseModule('spice', run, 'door'), baseModule('drawers', run, 'open'), gapModule('fridge', run)];
  }
  syncRun(run);
  return run;
}

/** Fill walls that a new shape needs but that are still empty. */
export function ensureLegs(run: Run) {
  const isCorner = (m?: RunModule) => !!m?.base?.corner;
  if (run.shape !== 'straight' && !run.legs[1].length) {
    if (!isCorner(run.legs[0][run.legs[0].length - 1])) run.legs[0].push(baseModule('cornerL', run, 'doors'));
    run.legs[1] = [baseModule('drawers', run, 'doors'), tallModule('pantry', run)];
  }
  if (run.shape === 'U' && !run.legs[2].length) {
    if (!isCorner(run.legs[0][0])) run.legs[0].unshift(baseModule('cornerL', run, 'doors'));
    run.legs[2] = [baseModule('doors', run, 'doors'), baseModule('drawers', run, 'open'), gapModule('fridge', run)];
  }
}

/** Where a side wall's cabinets start, measured from the back wall: after the corner cupboard's Width B. */
export function legStart(run: Run, leg: 1 | 2): number {
  const m = leg === 1 ? run.legs[0][run.legs[0].length - 1] : run.legs[0][0];
  return m?.base?.corner ? Math.max(run.baseDepth, m.cornerB || m.base.corner.widthB) : run.baseDepth;
}

/** Height of a filler panel: custom, else up to the worktop underside. */
export const fillerHeight = (m: RunModule, run: Run, counterT: number) => m.height || run.counterHeight - counterT;

export const activeLegs = (run: Run): number => (run.shape === 'straight' ? 1 : run.shape === 'L' ? 2 : 3);
export const legLength = (mods: RunModule[]) => sum(mods.map((m) => m.width));

/** Push run-wide sizes down into every module unit. */
export function syncRun(run: Run, cat?: Catalog) {
  const counterT = cat ? cat.countertops.find((c) => c.id === run.countertopId)?.thickness ?? 0 : 30;
  for (const leg of run.legs)
    for (const m of leg) {
      if (m.base) {
        const b = m.base;
        b.width = m.width;
        b.mount = 'floor';
        b.base = run.plinthHeight > 0 ? 'plinth' : 'none';
        b.baseHeight = run.plinthHeight;
        b.installType = run.installType;
        b.countertopId = null;
        b.topBoardId = null;
        b.overhang = { front: 0, back: 0, left: 0, right: 0 };
        b.depth = m.depth || run.baseDepth;
        b.height = m.height || (m.kind === 'tall' ? run.tallHeight : run.counterHeight - counterT);
        b.qty = 1;
      }
      // corner cupboards: Width B and which way the return goes
      const corner = m.base?.corner;
      if (m.base && corner) {
        corner.widthB = Math.max(1, m.cornerB || corner.widthB);
        m.cornerB = corner.widthB;
        const li = run.legs.indexOf(leg);
        if (li === 0 && run.shape !== 'straight' && m === leg[leg.length - 1]) corner.hand = 'right';
        else if (li === 0 && run.shape === 'U' && m === leg[0]) corner.hand = 'left';
        m.base.type = 'corner_base';
      }
      if (m.wall) {
        if (corner) m.wall.corner = { widthB: corner.widthB, style: m.wall.corner?.style ?? corner.style, hand: corner.hand, shelves: m.wall.corner?.shelves ?? 2, carousel: false };
        else if (m.wall.corner) m.wall.corner = null;
        const w = m.wall;
        w.width = m.width;
        w.depth = m.wallDepth || run.wallDepth;
        w.height = m.wallHeight || run.wallHeight;
        w.mount = 'wall';
        w.mountHeight = m.wallBottom ?? run.wallBottom;
        w.base = 'none';
        w.installType = run.installType;
        w.countertopId = null;
        w.qty = 1;
      }
      // a wall cabinet can sit above a base cabinet or an open space
      if (m.kind === 'tall' || m.kind === 'filler') m.wall = null;
    }
}

/* -------------------------------------------------------------- layout */

export interface Placement {
  leg: number;
  s: number; // distance along the leg from its start
  w: number;
}

/** World transform for something spanning [s, s+w] along a leg (local x 0..w, z 0 = wall). */
export function legTransform(run: Run, p: Placement): { x: number; z: number; rotY: number } {
  const LA = legLength(run.legs[0]);
  if (p.leg === 0) return { x: p.s, z: 0, rotY: 0 };
  if (p.leg === 1) return { x: LA, z: legStart(run, 1) + p.s, rotY: -Math.PI / 2 };
  return { x: 0, z: legStart(run, 2) + p.s + p.w, rotY: Math.PI / 2 };
}

export interface RunPiece {
  module: RunModule;
  place: Placement;
  unit: Unit;
  role: 'base' | 'tall' | 'wall';
  build: UnitBuild;
}

export interface RunBuild {
  pieces: RunPiece[];
  extra: UnitBuild; // worktop, free-standing appliances, hoods (leg-local boxes)
  extraPlacements: { place: Placement; box: Box3; kind: 'counter' | 'appliance' | 'panel'; applianceId?: string; materialId?: string }[];
  size: { w: number; d: number; h: number };
}

const emptyBuild = (): UnitBuild => ({ parts: [], hardware: [], aluminium: [], rails: [], lights: [], appliances: [], inserts: [], applianceList: [], warnings: [] });

export function buildRun(run: Run, cat: Catalog, pricing: PricingSettings): RunBuild {
  const counter = cat.countertops.find((c) => c.id === run.countertopId) ?? null;
  const ctx: BuildContext = { topY: run.counterHeight, topFront: run.baseDepth + run.counterOverhang };
  const pieces: RunPiece[] = [];
  const extra = emptyBuild();
  const extraPlacements: RunBuild['extraPlacements'] = [];
  const counterParts = new Map<string, Part>();
  const applCount = new Map<string, number>();
  const nLegs = activeLegs(run);

  for (let li = 0; li < nLegs; li++) {
    let s = 0;
    let segStart: number | null = null;
    const closeSeg = (end: number) => {
      if (segStart == null || !counter) return;
      const len = end - segStart;
      const depth = run.baseDepth + run.counterOverhang;
      const place = { leg: li, s: segStart, w: len };
      const box: Box3 = { x: 0, y: run.counterHeight - counter.thickness, z: 0, w: len, h: counter.thickness, d: depth };
      const key = `${counter.id}|${Math.round(len)}|${depth}`;
      const p = counterParts.get(key);
      if (p) p.qty++;
      else counterParts.set(key, { key, name: `Worktop (${LEG_LABELS[li].toLowerCase()})`, role: 'counter', kind: 'counter', materialId: counter.id, length: Math.round(len), width: depth, thickness: counter.thickness, qty: 1, edgeLength: 0, edgingId: null, boxes: [] });
      extraPlacements.push({ place, box, kind: 'counter' });
      segStart = null;
    };
    for (const m of run.legs[li]) {
      const place = { leg: li, s, w: m.width };
      // custom-height cabinets and tall fillers break the worktop; base fillers sit under it
      const underTop = (m.kind === 'base' && !m.height) || (m.kind === 'filler' && fillerHeight(m, run, counter?.thickness ?? 0) <= run.counterHeight);
      if (underTop) {
        if (segStart == null) segStart = s;
      } else closeSeg(s);
      if (m.kind === 'base' && m.base) pieces.push({ module: m, place, unit: m.base, role: 'base', build: buildUnit(m.base, cat, pricing, m.height ? undefined : ctx) });
      if (m.kind === 'filler') {
        const h = fillerHeight(m, run, counter?.thickness ?? 0);
        const mat = runUnits(run)[0]?.frontMaterialId ?? cat.boards[0]?.id ?? null;
        const t = cat.boards.find((b) => b.id === mat)?.thickness ?? 18;
        const box: Box3 = { x: 0, y: run.plinthHeight > 0 && h <= run.counterHeight ? run.plinthHeight : 0, z: (m.depth || run.baseDepth) - t, w: m.width, h: h - (run.plinthHeight > 0 && h <= run.counterHeight ? run.plinthHeight : 0), d: t };
        extra.parts.push({ key: `filler-${m.id}`, name: `Filler panel ${m.width}mm`, role: 'finish', kind: 'board', materialId: mat, length: Math.round(box.h), width: m.width, thickness: t, qty: 1, edgeLength: (2 * (box.h + m.width)) / 1000, edgingId: null, boxes: [] });
        extraPlacements.push({ place, box, kind: 'panel', materialId: mat ?? undefined });
      }
      if (m.kind === 'tall' && m.base) pieces.push({ module: m, place, unit: m.base, role: 'tall', build: buildUnit(m.base, cat, pricing) });
      if (m.wall) pieces.push({ module: m, place, unit: m.wall, role: 'wall', build: buildUnit(m.wall, cat, pricing) });
      if (m.kind === 'gap' && m.gapApplianceId) {
        const a = cat.appliances.find((x) => x.id === m.gapApplianceId);
        if (a) {
          applCount.set(a.id, (applCount.get(a.id) ?? 0) + 1);
          extraPlacements.push({ place, box: { x: (m.width - a.width) / 2, y: 0, z: 20, w: Math.min(a.width, m.width), h: a.height, d: a.depth }, kind: 'appliance', applianceId: a.id });
          if (a.width > m.width + 5) extra.warnings.push(`${a.name} (${a.width}mm) is wider than its ${m.width}mm space.`);
        }
      }
      if (m.hoodId) {
        const a = cat.appliances.find((x) => x.id === m.hoodId);
        if (a) {
          applCount.set(a.id, (applCount.get(a.id) ?? 0) + 1);
          const y = (m.wallBottom ?? run.wallBottom) + (m.wall ? 0 : (m.wallHeight || run.wallHeight) - a.height);
          extraPlacements.push({ place, box: { x: (m.width - a.width) / 2, y: Math.max(run.counterHeight + 550, y), z: 0, w: Math.min(a.width, m.width), h: a.height, d: a.depth }, kind: 'appliance', applianceId: a.id });
        }
      }
      s += m.width;
    }
    closeSeg(s);
  }
  // worktop over the side arm of each corner cupboard (between the back-wall worktop and the side wall's)
  if (counter && nLegs > 1) {
    const depth = run.baseDepth + run.counterOverhang;
    for (const leg of [1, 2] as const) {
      if (leg === 2 && nLegs < 3) continue;
      const len = legStart(run, leg) - depth;
      const m = leg === 1 ? run.legs[0][run.legs[0].length - 1] : run.legs[0][0];
      if (!m?.base?.corner || m.height || len <= 0) continue;
      const box: Box3 = { x: 0, y: run.counterHeight - counter.thickness, z: 0, w: len, h: counter.thickness, d: depth };
      extraPlacements.push({ place: { leg, s: -len, w: len }, box, kind: 'counter' });
      const key = `${counter.id}|${Math.round(len)}|${depth}|corner`;
      const p = counterParts.get(key);
      if (p) p.qty++;
      else counterParts.set(key, { key, name: 'Worktop (corner return)', role: 'counter', kind: 'counter', materialId: counter.id, length: Math.round(len), width: depth, thickness: counter.thickness, qty: 1, edgeLength: 0, edgingId: null, boxes: [] });
    }
  }
  extra.parts = [...extra.parts, ...counterParts.values()];
  extra.applianceList = [...applCount.entries()].map(([applianceId, qty]) => ({ applianceId, qty }));
  if (!counter) extra.warnings.push('No worktop selected for this kitchen.');
  const LA = legLength(run.legs[0]);
  const LB = nLegs > 1 ? legLength(run.legs[1]) : 0;
  const LC = nLegs > 2 ? legLength(run.legs[2]) : 0;
  const d = Math.max(run.baseDepth + run.counterOverhang, nLegs > 1 ? legStart(run, 1) + LB : 0, nLegs > 2 ? legStart(run, 2) + LC : 0);
  const tops = run.legs.slice(0, nLegs).flat().map((m) => Math.max(m.height ?? 0, m.wall ? (m.wallBottom ?? run.wallBottom) + (m.wallHeight || run.wallHeight) : 0));
  return { pieces, extra, extraPlacements, size: { w: LA, d, h: Math.max(run.tallHeight, run.wallBottom + run.wallHeight, ...tops) } };
}

/** All units in a run (for lookups by id). */
export const runUnits = (run: Run): Unit[] => run.legs.flatMap((l) => l.flatMap((m) => [m.base, m.wall].filter(Boolean) as Unit[]));

export function describeRun(run: Run, cat: Catalog): string[] {
  const nLegs = activeLegs(run);
  const lens = run.legs.slice(0, nLegs).map((l, i) => `${LEG_LABELS[i]} ${legLength(l)}mm`);
  const mods = run.legs.slice(0, nLegs).flat();
  const base = mods.filter((m) => m.kind === 'base').length;
  const wall = mods.filter((m) => m.wall).length;
  const tall = mods.filter((m) => m.kind === 'tall').length;
  const counter = cat.countertops.find((c) => c.id === run.countertopId);
  const appliances = new Map<string, number>();
  for (const m of mods) {
    for (const u of [m.base, m.wall]) {
      if (!u) continue;
      for (const ta of u.topAppliances) appliances.set(ta.applianceId, (appliances.get(ta.applianceId) ?? 0) + 1);
      for (const s of leafSections(u)) if (s.front === 'appliance' && s.applianceId) appliances.set(s.applianceId, (appliances.get(s.applianceId) ?? 0) + 1);
    }
    for (const id of [m.gapApplianceId, m.hoodId]) if (id) appliances.set(id, (appliances.get(id) ?? 0) + 1);
  }
  const lines = [
    `${RUN_SHAPE_LABELS[run.shape]}: ${lens.join(', ')}`,
    `${base} base, ${wall} wall and ${tall} tall unit(s) · worktop height ${run.counterHeight}mm`,
  ];
  if (counter) lines.push(`Worktop: ${counter.name}`);
  const first = runUnits(run)[0];
  if (first) {
    const car = cat.boards.find((b) => b.id === first.carcassMaterialId)?.name;
    const fr = cat.boards.find((b) => b.id === first.frontMaterialId)?.name;
    lines.push(`Carcass: ${car ?? '-'} · Fronts: ${fr ?? '-'}`);
  }
  if (appliances.size) lines.push(`Appliance spaces: ${[...appliances.entries()].map(([id, n]) => `${n > 1 ? `${n}× ` : ''}${cat.appliances.find((a) => a.id === id)?.name ?? id}`).join(', ')}`);
  if (run.notes) lines.push(run.notes);
  return lines;
}

/** Apply the same materials to every unit in the run. */
export function applyRunMaterials(run: Run, patch: Partial<Pick<Unit, 'carcassMaterialId' | 'frontMaterialId' | 'handleId' | 'hingeId' | 'runnerId' | 'edgingId' | 'frontEdgingId'>>) {
  for (const u of runUnits(run)) Object.assign(u, patch);
}

export { topThickness };

/** Deep copy with fresh ids (so copies can be edited independently). */
export function cloneRun(run: Run): Run {
  const c = JSON.parse(JSON.stringify(run)) as Run;
  c.id = uid('r');
  for (const leg of c.legs)
    for (const m of leg) {
      m.id = uid('m');
      if (m.base) m.base.id = uid('u');
      if (m.wall) m.wall.id = uid('u');
    }
  return c;
}
