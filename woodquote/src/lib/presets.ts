import type { Bay, FinishPanel, Section, Sides, Unit, ProductType } from './types';
import { uid } from './util';

export const PRODUCT_LABELS: Record<ProductType, string> = {
  tv_stand: 'TV Stand',
  kitchen_base: 'Kitchen Base Cabinet',
  kitchen_wall: 'Kitchen Wall Cabinet',
  kitchen_tall: 'Kitchen Tall / Pantry',
  island: 'Kitchen Centre Island',
  built_in: 'Built-in Cabinet',
  wardrobe: 'Fitted Wardrobe (hinged)',
  sliding_wardrobe: 'Fitted Wardrobe (sliding)',
  bookshelf: 'Bookshelf / Display',
  vanity: 'Bathroom Vanity',
  corner_base: 'Corner Base Cupboard',
  corner_wall: 'Corner Wall Cupboard',
  custom: 'Custom Unit',
};

export const PRODUCT_ORDER: ProductType[] = ['tv_stand', 'kitchen_base', 'kitchen_wall', 'kitchen_tall', 'island', 'built_in', 'wardrobe', 'sliding_wardrobe', 'bookshelf', 'vanity', 'corner_base', 'corner_wall', 'custom'];

export const sec = (spec: Partial<Omit<Section, 'id'>> = {}): Section => ({
  id: uid('s'),
  size: 1,
  front: 'open',
  doorMaterial: 'wood',
  fit: 'overlay',
  opening: 'left',
  slide: 'left',
  drawerCount: 1,
  shelves: 0,
  hangingRail: false,
  applianceId: null,
  insertId: null,
  ...spec,
});

export const bay = (size: number, sections: Section[]): Bay => ({ id: uid('b'), size, sections });

const sides = <T,>(front: T, back: T, left: T, right: T): Sides<T> => ({ front, back, left, right });
const panel = (materialId = 'b-mdf18-walnut'): FinishPanel => ({ enabled: false, materialId, style: 'flat', toFloor: false });

export function baseUnit(type: ProductType, over: Partial<Unit> = {}): Unit {
  return {
    id: uid('u'),
    name: PRODUCT_LABELS[type],
    type,
    qty: 1,
    width: 600,
    height: 720,
    depth: 560,
    installType: 'standalone',
    mount: 'floor',
    mountHeight: 1400,
    base: 'none',
    baseHeight: 0,
    plinthSides: sides(true, false, false, false),
    plinthRecess: 50,
    carcassMaterialId: 'b-mel16-white',
    frontMaterialId: 'b-mdf18-gloss',
    backMaterialId: 'b-hb3',
    edgingId: 'e-white',
    frontEdgingId: 'e-grey',
    countertopId: null,
    topBoardId: null,
    overhang: sides(20, 0, 0, 0),
    finishPanels: { left: panel(), right: panel(), back: panel() },
    glassId: 'g-clear4',
    aluminiumId: 'a-frame-silver',
    hingeId: 'h-soft-overlay',
    glassHingeId: 'h-glass',
    runnerId: 'r-sc450',
    handleId: 'hd-bar128',
    legId: 'l-adj100',
    rollerId: 'ro-std',
    trackId: 't-std',
    screwId: 's-4x35',
    connectorId: 'cn-cam',
    shelfPinId: 'sp-std',
    railId: 'rl-oval',
    stayId: 'st-flap',
    sliding: { enabled: false, panels: 2, style: 'board' },
    bays: [bay(1, [sec({ front: 'door' })])],
    lights: [],
    topAppliances: [],
    extraParts: [],
    extraHardware: [],
    hardwareOverrides: {},
    notes: '',
    labourOverride: null,
    ...over,
  };
}

export function createUnit(type: ProductType): Unit {
  switch (type) {
    case 'tv_stand':
      return baseUnit(type, {
        width: 1800,
        height: 500,
        depth: 420,
        base: 'legs',
        baseHeight: 120,
        carcassMaterialId: 'b-mdf18-walnut',
        frontMaterialId: 'b-mdf18-walnut',
        topBoardId: 'b-pine32',
        overhang: sides(20, 0, 30, 30),
        edgingId: 'e-walnut',
        frontEdgingId: 'e-walnut',
        legId: 'l-hairpin',
        handleId: 'hd-push',
        bays: [
          bay(1, [sec({ front: 'drawer', drawerCount: 2 })]),
          bay(1.2, [sec({ front: 'sliding', doorMaterial: 'glass', slide: 'bypass', shelves: 1 })]),
          bay(1, [sec({ front: 'door', opening: 'down' })]),
        ],
      });
    case 'kitchen_base':
      return baseUnit(type, {
        width: 800,
        height: 900,
        depth: 560,
        installType: 'builtIn',
        base: 'plinth',
        baseHeight: 120,
        countertopId: 'c-granite',
        carcassMaterialId: 'b-hmr18',
        bays: [bay(1, [sec({ front: 'door', opening: 'pair', shelves: 1, size: 3 }), sec({ front: 'drawer', size: 1 })])],
      });
    case 'kitchen_wall':
      return baseUnit(type, {
        width: 800,
        height: 720,
        depth: 320,
        installType: 'builtIn',
        mount: 'wall',
        mountHeight: 1450,
        overhang: sides(0, 0, 0, 0),
        bays: [bay(1, [sec({ front: 'door', opening: 'pair', shelves: 2 })])],
      });
    case 'kitchen_tall':
      return baseUnit(type, {
        width: 600,
        height: 2200,
        depth: 560,
        installType: 'builtIn',
        base: 'plinth',
        baseHeight: 120,
        carcassMaterialId: 'b-hmr18',
        bays: [bay(1, [sec({ front: 'drawer', drawerCount: 2, size: 1 }), sec({ front: 'appliance', applianceId: 'ap-oven-elec', size: 1.15 }), sec({ front: 'appliance', applianceId: 'ap-mw-built', size: 0.8 }), sec({ front: 'door', opening: 'up', size: 1 })])],
      });
    case 'island':
      return baseUnit(type, {
        width: 2000,
        height: 900,
        depth: 900,
        base: 'plinth',
        baseHeight: 120,
        plinthSides: sides(true, true, true, true),
        countertopId: 'c-quartz',
        overhang: sides(20, 300, 20, 20),
        carcassMaterialId: 'b-hmr18',
        finishPanels: { left: { ...panel('b-mdf18-gloss'), enabled: true }, right: { ...panel('b-mdf18-gloss'), enabled: true }, back: { ...panel('b-mdf18-gloss'), enabled: true, style: 'fluted' } },
        topAppliances: [{ id: uid('ta'), applianceId: 'ap-hob-ind4', bay: 1 }],
        bays: [
          bay(1, [sec({ front: 'drawer', drawerCount: 3 })]),
          bay(1.4, [sec({ front: 'appliance', applianceId: 'ap-oven-elec', size: 2 }), sec({ front: 'drawer', size: 0.6 })]),
          bay(1, [sec({ front: 'door', opening: 'right', insertId: 'in-bin' })]),
        ],
      });
    case 'built_in':
      return baseUnit(type, {
        width: 1200,
        height: 2400,
        depth: 600,
        installType: 'builtIn',
        base: 'plinth',
        baseHeight: 100,
        carcassMaterialId: 'b-mel16-white',
        frontMaterialId: 'b-mel16-oak',
        frontEdgingId: 'e-oak',
        overhang: sides(0, 0, 0, 0),
        bays: [
          bay(1, [sec({ front: 'door', opening: 'left', shelves: 4, size: 4 }), sec({ front: 'door', opening: 'up', size: 1 })]),
          bay(1, [sec({ front: 'door', opening: 'right', shelves: 4, size: 4 }), sec({ front: 'door', opening: 'up', size: 1 })]),
        ],
      });
    case 'wardrobe':
      return baseUnit(type, {
        width: 1800,
        height: 2400,
        depth: 600,
        installType: 'builtIn',
        base: 'plinth',
        baseHeight: 100,
        carcassMaterialId: 'b-mel16-white',
        frontMaterialId: 'b-mel16-oak',
        frontEdgingId: 'e-oak',
        handleId: 'hd-bar320',
        overhang: sides(0, 0, 0, 0),
        lights: [{ id: uid('lt'), accessoryId: 'lt-profile', location: 'insideTop', temperature: 4000, color: '#ffffff', bays: [], sensorId: 'lt-sensor-door' }],
        bays: [
          bay(1, [sec({ front: 'door', opening: 'left', hangingRail: true, size: 4 }), sec({ front: 'door', opening: 'left', size: 1 })]),
          bay(1, [sec({ front: 'drawer', drawerCount: 3, size: 1.4 }), sec({ front: 'door', doorMaterial: 'glass', opening: 'right', shelves: 3, size: 2.6 }), sec({ front: 'door', opening: 'right', size: 1 })]),
          bay(1, [sec({ front: 'door', opening: 'right', hangingRail: true, shelves: 1, size: 4 }), sec({ front: 'door', opening: 'right', size: 1 })]),
        ],
      });
    case 'sliding_wardrobe':
      return baseUnit(type, {
        width: 2400,
        height: 2400,
        depth: 650,
        installType: 'builtIn',
        base: 'plinth',
        baseHeight: 80,
        carcassMaterialId: 'b-mel16-white',
        frontMaterialId: 'b-mel16-oak',
        frontEdgingId: 'e-oak',
        handleId: null,
        overhang: sides(0, 0, 0, 0),
        sliding: { enabled: true, panels: 2, style: 'board' },
        bays: [
          bay(1, [sec({ hangingRail: true, size: 4 }), sec({ size: 1 })]),
          bay(1, [sec({ front: 'drawer', drawerCount: 3, size: 1.4 }), sec({ shelves: 3, size: 3.6 })]),
          bay(1, [sec({ hangingRail: true, shelves: 1, size: 5 })]),
        ],
      });
    case 'bookshelf':
      return baseUnit(type, {
        width: 1200,
        height: 2000,
        depth: 350,
        base: 'plinth',
        baseHeight: 80,
        carcassMaterialId: 'b-ply18',
        frontMaterialId: 'b-ply18',
        edgingId: 'e-oak',
        overhang: sides(0, 0, 0, 0),
        lights: [{ id: uid('lt'), accessoryId: 'lt-strip', location: 'shelves', temperature: 3000, color: '#ffffff', bays: [], sensorId: 'lt-sensor-touch' }],
        bays: [
          bay(1, [sec({ front: 'door', opening: 'left', size: 1.2 }), sec({ shelves: 3, size: 3 })]),
          bay(1, [sec({ front: 'door', opening: 'right', size: 1.2 }), sec({ front: 'door', doorMaterial: 'glass', opening: 'right', shelves: 3, size: 3 })]),
        ],
      });
    case 'vanity':
      return baseUnit(type, {
        width: 900,
        height: 850,
        depth: 480,
        installType: 'builtIn',
        mount: 'wall',
        mountHeight: 150,
        countertopId: 'c-quartz',
        carcassMaterialId: 'b-hmr18',
        topAppliances: [{ id: uid('ta'), applianceId: 'ap-sink-undermount', bay: 0 }],
        bays: [bay(1, [sec({ front: 'drawer', drawerCount: 2 })])],
      });
    case 'corner_base':
      return baseUnit(type, {
        name: 'Corner base cupboard',
        width: 900,
        height: 900,
        depth: 560,
        installType: 'builtIn',
        base: 'plinth',
        baseHeight: 120,
        countertopId: 'c-granite',
        carcassMaterialId: 'b-hmr18',
        hingeId: 'h-corner',
        corner: { widthB: 900, style: 'L', hand: 'right', shelves: 1, carousel: false },
        bays: [bay(1, [sec({ front: 'door', opening: 'left', shelves: 1 })])],
      });
    case 'corner_wall':
      return baseUnit(type, {
        name: 'Corner wall cupboard',
        width: 600,
        height: 720,
        depth: 320,
        installType: 'builtIn',
        mount: 'wall',
        mountHeight: 1450,
        overhang: sides(0, 0, 0, 0),
        hingeId: 'h-corner',
        corner: { widthB: 600, style: 'L', hand: 'right', shelves: 2, carousel: false },
        bays: [bay(1, [sec({ front: 'door', opening: 'left', shelves: 2 })])],
      });
    case 'custom':
    default:
      return baseUnit('custom', {
        width: 1000,
        height: 1000,
        depth: 450,
        bays: [bay(1, [sec({ front: 'door', opening: 'pair', shelves: 1 })])],
      });
  }
}

/* ------------------------------------------------------------- migration */

const HINGE_RENAMES: Record<string, string> = { 'h-softclose': 'h-soft-overlay', 'h-standard': 'h-ord-overlay', 'h-halfov': 'h-soft-half' };

/** Bring a unit saved by an older version of the app up to the current shape. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normalizeUnit(raw: any): Unit {
  const d = baseUnit(raw?.type ?? 'custom');
  const u = { ...d, ...raw } as Unit & { countertopOverhang?: number };
  if (raw && raw.overhang === undefined) {
    const o = typeof raw.countertopOverhang === 'number' ? raw.countertopOverhang : 20;
    u.overhang = raw.type === 'island' ? sides(20, o, 0, 0) : sides(o, 0, 0, 0);
  }
  delete u.countertopOverhang;
  u.plinthSides = { ...d.plinthSides, ...(raw?.plinthSides ?? {}) };
  u.finishPanels = { left: { ...d.finishPanels.left, ...(raw?.finishPanels?.left ?? {}) }, right: { ...d.finishPanels.right, ...(raw?.finishPanels?.right ?? {}) }, back: { ...d.finishPanels.back, ...(raw?.finishPanels?.back ?? {}) } };
  if (!raw?.mount) u.mount = raw?.type === 'kitchen_wall' ? 'wall' : 'floor';
  if (!raw?.installType) u.installType = ['kitchen_base', 'kitchen_wall', 'kitchen_tall', 'built_in', 'wardrobe', 'sliding_wardrobe'].includes(u.type) ? 'builtIn' : 'standalone';
  if (u.hingeId && HINGE_RENAMES[u.hingeId]) u.hingeId = HINGE_RENAMES[u.hingeId];
  u.lights = raw?.lights ?? [];
  u.topAppliances = raw?.topAppliances ?? [];
  u.bays = (raw?.bays ?? d.bays).map((b: Bay) => ({
    ...b,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    sections: b.sections.map((s: any) => {
      if (s.doorMaterial) return { ...sec(), ...s } as Section;
      const old = s.front as string;
      const front = old === 'glassDoor' || old === 'flap' ? 'door' : (old as Section['front']);
      const { doorCount, ...rest } = s;
      return sec({
        ...rest,
        front,
        doorMaterial: old === 'glassDoor' ? 'glass' : 'wood',
        opening: old === 'flap' ? 'up' : doorCount === 2 ? 'pair' : 'left',
      } as Partial<Section>);
    }),
  }));
  return u;
}

/** The material and fitting choices that carry over when a cabinet changes type. */
const KEEP_ON_RETYPE = ['carcassMaterialId', 'frontMaterialId', 'backMaterialId', 'edgingId', 'frontEdgingId', 'glassId', 'aluminiumId', 'hingeId', 'glassHingeId', 'runnerId', 'handleId', 'screwId', 'connectorId', 'shelfPinId', 'installType'] as const;

/**
 * Change a cabinet's type in one step (base → tall, wall → base, TV stand →
 * bookshelf…). Sizes, mounting, plinth, top and inside layout come from the new
 * type; its width, quantity, materials, handles, hinges, notes and labour price
 * stay. A name you typed yourself is kept.
 */
export function retypeUnit(u: Unit, type: ProductType): Unit {
  if (u.type === type) return u;
  const n = createUnit(type);
  const out: Unit = { ...n, id: u.id, qty: u.qty, notes: u.notes, labourOverride: u.labourOverride, extraParts: u.extraParts, extraHardware: u.extraHardware };
  for (const k of KEEP_ON_RETYPE) (out as unknown as Record<string, unknown>)[k] = u[k];
  const cornerNow = type === 'corner_base' || type === 'corner_wall';
  const cornerWas = u.type === 'corner_base' || u.type === 'corner_wall';
  if (!cornerNow && !cornerWas) {
    out.width = u.width;
  }
  const defaultName = (t: ProductType) => u.name === PRODUCT_LABELS[t] || u.name.startsWith(PRODUCT_LABELS[t]);
  out.name = defaultName(u.type) || !u.name.trim() ? n.name : u.name;
  return out;
}

/** Quick switch buttons shown at the top of the designer. */
export const QUICK_TYPES: { type: ProductType; short: string }[] = [
  { type: 'kitchen_base', short: 'Base' },
  { type: 'kitchen_wall', short: 'Wall' },
  { type: 'kitchen_tall', short: 'Tall' },
  { type: 'corner_base', short: 'Corner base' },
  { type: 'corner_wall', short: 'Corner wall' },
  { type: 'island', short: 'Island' },
  { type: 'wardrobe', short: 'Wardrobe' },
  { type: 'sliding_wardrobe', short: 'Sliding wardrobe' },
  { type: 'built_in', short: 'BIC' },
  { type: 'tv_stand', short: 'TV stand' },
  { type: 'bookshelf', short: 'Display' },
  { type: 'vanity', short: 'Vanity' },
  { type: 'custom', short: 'Custom' },
];
