import type { Bay, FrontKind, ProductType, Section, Unit } from './types';
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
  custom: 'Custom Unit',
};

export const PRODUCT_ORDER: ProductType[] = [
  'tv_stand',
  'kitchen_base',
  'kitchen_wall',
  'kitchen_tall',
  'island',
  'built_in',
  'wardrobe',
  'sliding_wardrobe',
  'bookshelf',
  'vanity',
  'custom',
];

type SecSpec = Partial<Omit<Section, 'id'>> & { front?: FrontKind };

export const sec = (spec: SecSpec = {}): Section => ({
  id: uid('s'),
  size: spec.size ?? 1,
  front: spec.front ?? 'open',
  doorCount: spec.doorCount ?? 1,
  drawerCount: spec.drawerCount ?? 1,
  shelves: spec.shelves ?? 0,
  hangingRail: spec.hangingRail ?? false,
});

export const bay = (size: number, sections: Section[]): Bay => ({ id: uid('b'), size, sections });

const base = (type: ProductType, over: Partial<Unit>): Unit => ({
  id: uid('u'),
  name: PRODUCT_LABELS[type],
  type,
  qty: 1,
  width: 600,
  height: 720,
  depth: 560,
  base: 'none',
  baseHeight: 0,
  carcassMaterialId: 'b-mel16-white',
  frontMaterialId: 'b-mdf18-gloss',
  backMaterialId: 'b-hb3',
  edgingId: 'e-white',
  frontEdgingId: 'e-grey',
  countertopId: null,
  countertopOverhang: 20,
  glassId: 'g-clear4',
  aluminiumId: 'a-frame-silver',
  hingeId: 'h-softclose',
  runnerId: 'r-bb450',
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
  extraParts: [],
  extraHardware: [],
  hardwareOverrides: {},
  notes: '',
  labourOverride: null,
  ...over,
});

export function createUnit(type: ProductType): Unit {
  switch (type) {
    case 'tv_stand':
      return base(type, {
        width: 1800,
        height: 500,
        depth: 420,
        base: 'legs',
        baseHeight: 120,
        carcassMaterialId: 'b-mdf18-walnut',
        frontMaterialId: 'b-mdf18-walnut',
        edgingId: 'e-walnut',
        frontEdgingId: 'e-walnut',
        legId: 'l-hairpin',
        handleId: 'hd-push',
        bays: [
          bay(1, [sec({ front: 'drawer', drawerCount: 2 })]),
          bay(1.2, [sec({ front: 'open', shelves: 1 })]),
          bay(1, [sec({ front: 'door' })]),
        ],
      });
    case 'kitchen_base':
      return base(type, {
        width: 800,
        height: 900,
        depth: 560,
        base: 'plinth',
        baseHeight: 120,
        countertopId: 'c-granite',
        carcassMaterialId: 'b-hmr18',
        bays: [bay(1, [sec({ front: 'door', doorCount: 2, shelves: 1, size: 3 }), sec({ front: 'drawer', size: 1 })])],
      });
    case 'kitchen_wall':
      return base(type, {
        width: 800,
        height: 720,
        depth: 320,
        backMaterialId: 'b-hb3',
        bays: [bay(1, [sec({ front: 'door', doorCount: 2, shelves: 2 })])],
      });
    case 'kitchen_tall':
      return base(type, {
        width: 600,
        height: 2200,
        depth: 560,
        base: 'plinth',
        baseHeight: 120,
        carcassMaterialId: 'b-hmr18',
        bays: [bay(1, [sec({ front: 'drawer', drawerCount: 2, size: 1 }), sec({ front: 'door', shelves: 3, size: 2.6 }), sec({ front: 'door', shelves: 1, size: 1 })])],
      });
    case 'island':
      return base(type, {
        width: 2000,
        height: 900,
        depth: 900,
        base: 'plinth',
        baseHeight: 120,
        countertopId: 'c-quartz',
        countertopOverhang: 300,
        carcassMaterialId: 'b-hmr18',
        bays: [
          bay(1, [sec({ front: 'drawer', drawerCount: 3 })]),
          bay(1.4, [sec({ front: 'door', doorCount: 2, shelves: 1 })]),
          bay(1, [sec({ front: 'drawer', drawerCount: 3 })]),
        ],
      });
    case 'built_in':
      return base(type, {
        width: 1200,
        height: 2400,
        depth: 600,
        base: 'plinth',
        baseHeight: 100,
        carcassMaterialId: 'b-mel16-white',
        frontMaterialId: 'b-mel16-oak',
        frontEdgingId: 'e-oak',
        bays: [
          bay(1, [sec({ front: 'door', shelves: 4, size: 4 }), sec({ front: 'door', size: 1 })]),
          bay(1, [sec({ front: 'door', shelves: 4, size: 4 }), sec({ front: 'door', size: 1 })]),
        ],
      });
    case 'wardrobe':
      return base(type, {
        width: 1800,
        height: 2400,
        depth: 600,
        base: 'plinth',
        baseHeight: 100,
        carcassMaterialId: 'b-mel16-white',
        frontMaterialId: 'b-mel16-oak',
        frontEdgingId: 'e-oak',
        handleId: 'hd-bar320',
        bays: [
          bay(1, [sec({ front: 'door', hangingRail: true, size: 4 }), sec({ front: 'door', size: 1 })]),
          bay(1, [sec({ front: 'drawer', drawerCount: 3, size: 1.4 }), sec({ front: 'door', shelves: 3, size: 2.6 }), sec({ front: 'door', size: 1 })]),
          bay(1, [sec({ front: 'door', hangingRail: true, shelves: 1, size: 4 }), sec({ front: 'door', size: 1 })]),
        ],
      });
    case 'sliding_wardrobe':
      return base(type, {
        width: 2400,
        height: 2400,
        depth: 650,
        base: 'plinth',
        baseHeight: 80,
        carcassMaterialId: 'b-mel16-white',
        frontMaterialId: 'b-mel16-oak',
        frontEdgingId: 'e-oak',
        handleId: null,
        sliding: { enabled: true, panels: 2, style: 'board' },
        bays: [
          bay(1, [sec({ hangingRail: true, size: 4 }), sec({ size: 1 })]),
          bay(1, [sec({ front: 'drawer', drawerCount: 3, size: 1.4 }), sec({ shelves: 3, size: 3.6 })]),
          bay(1, [sec({ hangingRail: true, shelves: 1, size: 5 })]),
        ],
      });
    case 'bookshelf':
      return base(type, {
        width: 1200,
        height: 2000,
        depth: 350,
        base: 'plinth',
        baseHeight: 80,
        carcassMaterialId: 'b-ply18',
        frontMaterialId: 'b-ply18',
        edgingId: 'e-oak',
        bays: [
          bay(1, [sec({ front: 'door', doorCount: 1, size: 1.2 }), sec({ shelves: 3, size: 3 })]),
          bay(1, [sec({ front: 'door', doorCount: 1, size: 1.2 }), sec({ front: 'glassDoor', shelves: 3, size: 3 })]),
        ],
      });
    case 'vanity':
      return base(type, {
        width: 900,
        height: 850,
        depth: 480,
        base: 'legs',
        baseHeight: 150,
        countertopId: 'c-quartz',
        carcassMaterialId: 'b-hmr18',
        legId: 'l-chrome150',
        bays: [bay(1, [sec({ front: 'drawer', drawerCount: 2 })])],
      });
    case 'custom':
    default:
      return base('custom', {
        width: 1000,
        height: 1000,
        depth: 450,
        bays: [bay(1, [sec({ front: 'door', doorCount: 2, shelves: 1 })])],
      });
  }
}
