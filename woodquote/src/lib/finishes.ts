// Finish library: which finish a panel shows, and the standard finishes.
import type { BoardMaterial, Catalog, Finish, Part, Unit } from './types';

/** Doors, drawer fronts, visible end / back panels and kick boards take the front finish. */
export const FRONT_ROLES = new Set<Part['role']>(['door', 'drawerFront', 'finish', 'plinth']);
/** Carcass sides, shelves, backs and drawer boxes take the carcass finish. */
export const CARCASS_ROLES = new Set<Part['role']>(['carcass', 'shelf', 'back', 'drawerBox']);

export const finishOf = (cat: Catalog, id: string | null | undefined): Finish | undefined => (id ? (cat.finishes ?? []).find((f) => f.id === id) : undefined);

/** The finish a part shows: the cabinet's front / carcass choice, else the board's own. */
export function partFinish(cat: Catalog, unit: Unit | null | undefined, role: Part['role'], board: BoardMaterial | undefined): Finish | undefined {
  // a board keeps its manufacturer's finish; only a cabinet-level look changes how it shows
  void board;
  if (unit && FRONT_ROLES.has(role) && unit.frontFinishId) return finishOf(cat, unit.frontFinishId);
  if (unit && CARCASS_ROLES.has(role) && unit.carcassFinishId) return finishOf(cat, unit.carcassFinishId);
  return undefined;
}

/** Finishes that were painted onto boards in 3.1.0; boards are not painted, so they are removed. */
export const PAINTED_FINISH_IDS = ['fin-sat-white', 'fin-sat-forest'];

/** Colour to draw a board in 2D (finish colour when it has one). */
export const boardColour = (cat: Catalog, board: BoardMaterial | undefined, finishId?: string | null) => finishOf(cat, finishId)?.color ?? board?.color ?? '#cccccc';

const f = (id: string, name: string, color: string, finish: Finish['finish'], category: string, surcharge = 0): Finish => ({ id, name, color, finish, textureId: null, thumb: null, textureSize: 600, grain: 'length', surcharge, category });


/** PG Bison ranges (names from PG Bison's published MelaWood and SupaGloss lists; colours approximate — add the swatch photo for the exact look). */
const pg = (id: string, name: string, color: string, range: 'MelaWood' | 'SupaGloss', kind: Finish['kind']): Finish => ({
  id: `pgb-${id}`,
  name: `${name}${range === 'SupaGloss' ? ' (SupaGloss)' : ''}`,
  color,
  finish: range === 'SupaGloss' ? 'gloss' : kind === 'woodgrain' ? 'textured' : 'matte',
  textureId: null,
  thumb: null,
  textureSize: 1200,
  grain: kind === 'woodgrain' ? 'length' : 'vertical',
  surcharge: 0,
  category: range === 'SupaGloss' ? 'PG Bison SupaGloss' : kind === 'woodgrain' ? 'PG Bison MelaWood – woodgrains' : 'PG Bison MelaWood – solid colours',
  supplier: 'PG Bison',
  range,
  kind,
  boardIds: [],
});

export function pgBisonFinishes(): Finish[] {
  const solid: [string, string, string][] = [
    ['iceberg-white', 'Iceberg White', '#f3f3ef'], ['nata', 'Nata', '#ece5d8'], ['cappuccino', 'Cappuccino', '#b8a38b'], ['caraz', 'Caraz', '#cbbca6'], ['muidan', 'Muidan', '#8d7f6d'],
    ['folkstone-grey', 'Folkstone Grey', '#9b9b97'], ['dunblane-grey', 'Dunblane Grey', '#61656a'], ['storm-grey', 'Storm Grey', '#4b5056'], ['kalapana', 'Kalapana', '#303133'], ['super-black', 'Super Black', '#151515'],
    ['congo', 'Congo', '#6b5b4d'], ['naran', 'Naran', '#c4875a'], ['kara-blu', 'Kara Blu', '#2f4a6a'], ['petrol-blue', 'Petrol Blue', '#22505f'], ['rioverde', 'Rioverde', '#5d7a5b'], ['bellavista', 'Bellavista', '#8fa68b'],
  ];
  const wood: [string, string, string][] = [
    ['coimbra', 'Coimbra', '#c8a57a'], ['haven', 'Haven', '#d3c0a4'], ['alegria', 'Alegria', '#c59b6c'], ['esperanza-oak', 'Esperanza Oak', '#c3a178'], ['camden', 'Camden', '#b7936a'], ['arden', 'Arden', '#b39672'],
    ['pasadena', 'Pasadena', '#ae875f'], ['farasan', 'Farasan', '#a78a6a'], ['brookhill', 'Brookhill', '#9f7b59'], ['nosara', 'Nosara', '#a57b51'], ['monument-oak', 'Monument Oak', '#9a7a57'], ['lockeport', 'Lockeport', '#9b8977'],
    ['kirkwall', 'Kirkwall', '#9d9387'], ['shale-oak', 'Shale Oak', '#8e8478'], ['greythorne', 'Greythorne', '#8b8680'], ['stonetown', 'Stonetown', '#7c746b'], ['clydeshaw', 'Clydeshaw', '#896e54'], ['vardo', 'Vardo', '#6a4e39'],
    ['harvard-cherry', 'Harvard Cherry', '#8a4c33'], ['black-cherry', 'Black Cherry', '#4a2d26'], ['american-walnut', 'American Walnut', '#5c3e2b'], ['african-wenge', 'African Wenge', '#3c2b22'],
  ];
  const gloss: [string, string, string][] = [
    ['g-iceberg-white', 'Iceberg White', '#f6f6f3'], ['g-summer-white', 'Summer White', '#f5f1e8'], ['g-cappuccino', 'Cappuccino', '#b9a48c'], ['g-folkstone-grey', 'Folkstone Grey', '#9c9c98'],
    ['g-storm-grey', 'Storm Grey', '#4c5157'], ['g-super-black', 'Super Black', '#121212'], ['g-candy-red', 'Candy Red', '#b0192b'],
  ];
  return [...solid.map(([i, n, c]) => pg(i, n, c, 'MelaWood', 'solid')), ...wood.map(([i, n, c]) => pg(i, n, c, 'MelaWood', 'woodgrain')), ...gloss.map(([i, n, c]) => pg(i, n, c, 'SupaGloss', 'solid'))];
}

/** Colours offered for a board: those linked to it, plus those not tied to any board. */
export const finishesForBoard = (cat: Catalog, boardId: string | null | undefined) => (cat.finishes ?? []).filter((f) => !f.boardIds?.length || !boardId || f.boardIds.includes(boardId));

/** Starter finishes; add your own colours and photo textures in Price lists › Finishes. */
export function defaultFinishes(): Finish[] {
  return [
    f('fin-hg-white', 'High gloss white', '#f8f8f6', 'gloss', 'High gloss'),
    f('fin-hg-cream', 'High gloss cream', '#efe4cc', 'gloss', 'High gloss'),
    f('fin-hg-red', 'High gloss red', '#a3161c', 'gloss', 'High gloss'),
    f('fin-hg-blue', 'High gloss navy blue', '#1f3a5f', 'gloss', 'High gloss'),
    f('fin-hg-black', 'High gloss black', '#121214', 'gloss', 'High gloss'),
    f('fin-hg-grey', 'High gloss light grey', '#c9ccce', 'gloss', 'High gloss'),
    f('fin-sm-anthracite', 'Super matt anthracite', '#3a3d40', 'matte', 'Super matt'),
    f('fin-sm-sage', 'Super matt sage green', '#8f9e86', 'matte', 'Super matt'),
    f('fin-sm-cashmere', 'Super matt cashmere', '#cbbfae', 'matte', 'Super matt'),
    f('fin-hgs-red', 'High gloss solid wood – red (lacquered)', '#9e1b22', 'gloss', 'Lacquered solid wood', 18),
    f('fin-hgs-cream', 'High gloss solid wood – cream (lacquered)', '#ecdfc4', 'gloss', 'Lacquered solid wood', 18),
    f('fin-hgs-blue', 'High gloss solid wood – blue (lacquered)', '#23466e', 'gloss', 'Lacquered solid wood', 18),
    f('fin-met-champagne', 'Metallic champagne', '#c8b28a', 'metallic', 'Metallic'),
    f('fin-met-graphite', 'Metallic graphite', '#4a4c50', 'metallic', 'Metallic'),
    ...pgBisonFinishes(),
  ];
}
