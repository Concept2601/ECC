// Finish library: which finish a panel shows, and the standard finishes.
import type { BoardMaterial, Catalog, Finish, Part, Unit } from './types';

/** Doors, drawer fronts, visible end / back panels and kick boards take the front finish. */
export const FRONT_ROLES = new Set<Part['role']>(['door', 'drawerFront', 'finish', 'plinth']);
/** Carcass sides, shelves, backs and drawer boxes take the carcass finish. */
export const CARCASS_ROLES = new Set<Part['role']>(['carcass', 'shelf', 'back', 'drawerBox']);

export const finishOf = (cat: Catalog, id: string | null | undefined): Finish | undefined => (id ? (cat.finishes ?? []).find((f) => f.id === id) : undefined);

/** The finish a part shows: the cabinet's front / carcass choice, else the board's own. */
export function partFinish(cat: Catalog, unit: Unit | null | undefined, role: Part['role'], board: BoardMaterial | undefined): Finish | undefined {
  if (unit && FRONT_ROLES.has(role) && unit.frontFinishId) return finishOf(cat, unit.frontFinishId) ?? finishOf(cat, board?.finishId);
  if (unit && CARCASS_ROLES.has(role) && unit.carcassFinishId) return finishOf(cat, unit.carcassFinishId) ?? finishOf(cat, board?.finishId);
  return finishOf(cat, board?.finishId);
}

/** Colour to draw a board in 2D (finish colour when it has one). */
export const boardColour = (cat: Catalog, board: BoardMaterial | undefined, finishId?: string | null) => finishOf(cat, finishId)?.color ?? finishOf(cat, board?.finishId)?.color ?? board?.color ?? '#cccccc';

const f = (id: string, name: string, color: string, finish: Finish['finish'], category: string, surcharge = 0): Finish => ({ id, name, color, finish, textureId: null, thumb: null, textureSize: 600, grain: 'length', surcharge, category });

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
    f('fin-sat-white', 'Satin white (spray painted)', '#f4f2ee', 'satin', 'Spray painted', 12),
    f('fin-sat-forest', 'Satin forest green (spray painted)', '#2f4a3a', 'satin', 'Spray painted', 12),
    f('fin-hgs-red', 'High gloss solid wood – red (lacquered)', '#9e1b22', 'gloss', 'Lacquered solid wood', 18),
    f('fin-hgs-cream', 'High gloss solid wood – cream (lacquered)', '#ecdfc4', 'gloss', 'Lacquered solid wood', 18),
    f('fin-hgs-blue', 'High gloss solid wood – blue (lacquered)', '#23466e', 'gloss', 'Lacquered solid wood', 18),
    f('fin-met-champagne', 'Metallic champagne', '#c8b28a', 'metallic', 'Metallic'),
    f('fin-met-graphite', 'Metallic graphite', '#4a4c50', 'metallic', 'Metallic'),
  ];
}
