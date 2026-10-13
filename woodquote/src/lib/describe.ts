import type { Catalog, Unit } from './types';

export function unitCounts(u: Unit) {
  let doors = 0;
  let drawers = 0;
  let shelves = 0;
  let glassDoors = 0;
  let rails = 0;
  let flaps = 0;
  for (const b of u.bays)
    for (const s of b.sections) {
      shelves += s.shelves;
      if (s.hangingRail) rails++;
      if (u.sliding.enabled && s.front !== 'drawer') continue;
      if (s.front === 'door') doors += s.doorCount;
      if (s.front === 'glassDoor') glassDoors += s.doorCount;
      if (s.front === 'drawer') drawers += s.drawerCount;
      if (s.front === 'flap') flaps++;
    }
  return { doors, drawers, shelves, glassDoors, rails, flaps, sliding: u.sliding.enabled ? u.sliding.panels : 0 };
}

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;

/** Human readable spec lines used on quotations and in the app. */
export function describeUnit(u: Unit, cat: Catalog): string[] {
  const name = (list: { id: string; name: string }[], id: string | null) => list.find((x) => x.id === id)?.name;
  const acc = (id: string | null) => {
    const a = cat.accessories.find((x) => x.id === id);
    return a ? `${a.name} ${a.size}`.trim() : undefined;
  };
  const c = unitCounts(u);
  const feats: string[] = [];
  if (c.sliding) feats.push(`${c.sliding} sliding ${u.sliding.style === 'board' ? '' : u.sliding.style + ' '}doors`);
  if (c.doors) feats.push(plural(c.doors, 'door'));
  if (c.glassDoors) feats.push(plural(c.glassDoors, 'glass door'));
  if (c.flaps) feats.push(plural(c.flaps, 'lift-up flap'));
  if (c.drawers) feats.push(plural(c.drawers, 'drawer'));
  if (c.shelves) feats.push(plural(c.shelves, 'adjustable shelf').replace('shelfs', 'shelves'));
  if (c.rails) feats.push(plural(c.rails, 'hanging rail'));
  const lines = [
    `Size: ${u.width} W × ${u.height} H × ${u.depth} D mm`,
    `Carcass: ${name(cat.boards, u.carcassMaterialId) ?? '-'}`,
  ];
  if (c.doors + c.drawers + c.flaps + c.sliding > 0) lines.push(`Fronts: ${name(cat.boards, u.frontMaterialId) ?? '-'}`);
  if (feats.length) lines.push(`Features: ${feats.join(', ')}`);
  if (u.countertopId) lines.push(`Top: ${name(cat.countertops, u.countertopId)}`);
  const hw: string[] = [];
  if (c.doors + c.glassDoors + c.flaps > 0 && u.hingeId) hw.push(acc(u.hingeId)!);
  if (c.drawers > 0 && u.runnerId) hw.push(cat.accessories.find((a) => a.id === u.runnerId)?.family ?? acc(u.runnerId)!);
  if (c.sliding && u.rollerId) hw.push(acc(u.rollerId)!);
  if (u.handleId) hw.push(acc(u.handleId)!);
  if (hw.filter(Boolean).length) lines.push(`Hardware: ${hw.filter(Boolean).join(', ')}`);
  if (u.base === 'legs') lines.push(`Base: ${acc(u.legId) ?? 'legs'} (${u.baseHeight}mm)`);
  if (u.base === 'plinth') lines.push(`Base: plinth ${u.baseHeight}mm`);
  if (u.notes) lines.push(u.notes);
  return lines;
}
