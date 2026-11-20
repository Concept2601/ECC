// Exposed (finish) side and back panels: by default they run down to the floor
// and use the same board as the fronts, so changing the fronts changes them too.
// Each panel can be made shorter (stops at the plinth / legs) or given its own board.
import type { FinishPanel, Unit } from './types';

/** The board an exposed panel is made of. */
export const panelMaterialId = (u: Unit, p: FinishPanel): string => (p.ownMaterial ? p.materialId : u.frontMaterialId || p.materialId);

/** Whether the panel runs down to the floor (only floor-standing cabinets). */
export const panelToFloor = (u: Unit, p: FinishPanel): boolean => u.mount !== 'wall' && !p.short;
