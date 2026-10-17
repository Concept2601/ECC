// Parts bigger than the stock sheet / plank are split automatically, the way a
// workshop would do it: equal pieces so the join lands in the middle (over a
// divider where there is one) instead of a full sheet plus a sliver at the end,
// and a joint chosen for where the part goes, with its fixings and backing
// cleat added to the cut list and costs.
import type { BoardMaterial, PartRole, PricingSettings } from './types';

export interface JoinPlan {
  part: string;
  item: string;
  material: string;
  original: { length: number; width: number };
  pieces: { length: number; width: number }[];
  direction: 'length' | 'width';
  joints: number;
  method: string;
  /** accessory id → quantity for all joints of one copy of the part */
  fixings: Record<string, number>;
  /** extra backing pieces (cleats / battens) cut from the same board */
  cleats: { length: number; width: number; label: string }[];
}

export const JOIN_ACCESSORIES = { dowel: 'jn-dowel', biscuit: 'jn-biscuit', connector: 'jn-connector', domino: 'jn-domino' } as const;

/** How a joint is made, from real workshop practice. */
function method(role: PartRole | string, name: string, dir: 'length' | 'width', narrowStock: boolean): { text: string; perJoint: Record<string, number>; cleat: boolean } {
  const n = name.toLowerCase();
  if (dir === 'width') {
    if (narrowStock || /slat|plank|cladding/.test(n))
      return { text: 'Laid as planks / slats side by side — tongue & groove or a 5–10 mm shadow gap, glued and pinned to battens behind', perJoint: { [JOIN_ACCESSORIES.biscuit]: 0 }, cleat: true };
    return { text: 'Edge-jointed: biscuits (or Domino) every 200 mm, glued and clamped flat', perJoint: { [JOIN_ACCESSORIES.biscuit]: 6 }, cleat: false };
  }
  if (role === 'door' || role === 'drawerFront' || role === 'finish')
    return { text: 'Visible face: split into equal halves with a 3 mm V-groove (shadow line) at the join so it reads as a design line; dowelled and backed with a cleat', perJoint: { [JOIN_ACCESSORIES.dowel]: 4 }, cleat: true };
  if (role === 'back') return { text: 'Back panel: join centred on a fixed rail (mullion) and pinned to it', perJoint: {}, cleat: true };
  if (role === 'plinth') return { text: 'Kick board: butt joint centred behind a plinth leg, backed with a block', perJoint: {}, cleat: true };
  if (role === 'shelf') return { text: 'Shelf: split so the join sits on a partition / divider — add a divider or a centre support at the join', perJoint: { [JOIN_ACCESSORIES.dowel]: 2 }, cleat: false };
  if (role === 'counter') return { text: 'Worktop: mason’s mitre / butt joint with worktop connector bolts, sealed', perJoint: { [JOIN_ACCESSORIES.connector]: 3 }, cleat: false };
  if (/top|bottom|base|floor/.test(n)) return { text: 'Carcass top / bottom: join centred over a partition; dowels + 2 connector bolts, glued', perJoint: { [JOIN_ACCESSORIES.dowel]: 4, [JOIN_ACCESSORIES.connector]: 2 }, cleat: false };
  if (/side|gable|partition/.test(n)) return { text: 'Tall side: horizontal join hidden behind a fixed shelf; dowels + connector bolts', perJoint: { [JOIN_ACCESSORIES.dowel]: 4, [JOIN_ACCESSORIES.connector]: 2 }, cleat: false };
  return { text: 'Butt joint with dowels and glue, backed with a cleat', perJoint: { [JOIN_ACCESSORIES.dowel]: 4 }, cleat: true };
}

/** Equal pieces (the join lands in the middle, not a sliver at the end). */
const splitEven = (total: number, n: number): number[] => {
  const each = Math.floor(total / n);
  const out = Array.from({ length: n }, () => each);
  out[n - 1] += total - each * n;
  return out;
};

/**
 * Pieces to cut for one part. Returns null when the part fits the stock as it is.
 * Length runs along the grain; parts may turn when the board has no grain.
 */
export function splitForStock(p: { name: string; role: PartRole | string; length: number; width: number }, mat: BoardMaterial, pr: Pick<PricingSettings, 'sheetTrim' | 'kerf'>, item = ''): JoinPlan | null {
  const L = Math.max(1, mat.sheetLength - 2 * pr.sheetTrim);
  const W = Math.max(1, mat.sheetWidth - 2 * pr.sheetTrim);
  const fits = (l: number, w: number) => l <= L && w <= W;
  if (fits(p.length, p.width) || (!mat.grain && fits(p.width, p.length))) return null;

  // choose the orientation with the fewest pieces (grain boards keep their direction)
  const options = [{ l: p.length, w: p.width, rot: false }];
  if (!mat.grain) options.push({ l: p.width, w: p.length, rot: true });
  let best: { l: number; w: number; nL: number; nW: number; rot: boolean } | null = null;
  for (const o of options) {
    const nL = Math.ceil(o.l / L);
    const nW = Math.ceil(o.w / W);
    if (!best || nL * nW < best.nL * best.nW || (nL * nW === best.nL * best.nW && nW < best.nW)) best = { ...o, nL, nW };
  }
  const b = best!;
  const ls = splitEven(b.l, b.nL);
  const ws = splitEven(b.w, b.nW);
  const pieces: { length: number; width: number }[] = [];
  for (const l of ls) for (const w of ws) pieces.push(b.rot ? { length: w, width: l } : { length: l, width: w });
  const direction: 'length' | 'width' = b.nL > 1 ? 'length' : 'width';
  const narrow = W < 250;
  const m = method(p.role, p.name, direction, narrow);
  const jointsL = (b.nL - 1) * b.nW;
  const jointsW = (b.nW - 1) * b.nL;
  const joints = jointsL + jointsW;
  const fixings: Record<string, number> = {};
  const add = (id: string, q: number) => q > 0 && (fixings[id] = (fixings[id] ?? 0) + q);
  const mL = method(p.role, p.name, 'length', narrow);
  const mW = method(p.role, p.name, 'width', narrow);
  for (const [id, q] of Object.entries(mL.perJoint)) add(id, q * jointsL);
  for (const [id, q] of Object.entries(mW.perJoint)) add(id, Math.max(q, Math.ceil(b.l / 200)) * jointsW * (q > 0 ? 1 : 0));
  const cleats: JoinPlan['cleats'] = [];
  if (mL.cleat && jointsL) for (let k = 0; k < jointsL; k++) cleats.push({ length: Math.min(W, b.w / b.nW), width: 100, label: 'Joining cleat' });
  if (mW.cleat && jointsW && narrow) {
    // battens across the back of plank / slat panels every ~600 mm
    const battens = Math.max(2, Math.ceil(b.l / 600) + 1);
    for (let k = 0; k < battens; k++) cleats.push({ length: Math.min(L, b.w), width: 40, label: 'Batten behind planks' });
  }
  return {
    part: p.name,
    item,
    material: mat.name,
    original: { length: p.length, width: p.width },
    pieces,
    direction,
    joints,
    method: b.nL > 1 && b.nW > 1 ? `${mL.text}. Across the width: ${mW.text}` : m.text,
    fixings,
    cleats,
  };
}
