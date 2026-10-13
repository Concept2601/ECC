import type { Catalog, Unit } from './types';

export function unitCounts(u: Unit) {
  let doors = 0;
  let drawers = 0;
  let shelves = 0;
  let glassDoors = 0;
  let rails = 0;
  let flaps = 0;
  let slidingFronts = 0;
  let appliances = 0;
  let inserts = 0;
  for (const b of u.bays)
    for (const s of b.sections) {
      shelves += s.shelves;
      if (s.hangingRail) rails++;
      if (s.insertId) inserts++;
      if (u.sliding.enabled && s.front !== 'drawer') continue;
      const n = s.opening === 'pair' ? 2 : 1;
      if (s.front === 'door' && (s.opening === 'up' || s.opening === 'down')) flaps++;
      else if (s.front === 'door' && s.doorMaterial === 'wood') doors += n;
      else if (s.front === 'door') glassDoors += n;
      if (s.front === 'sliding') slidingFronts += s.slide === 'bypass' ? 2 : 1;
      if (s.front === 'drawer') drawers += s.drawerCount;
      if (s.front === 'appliance') appliances++;
    }
  return { doors, drawers, shelves, glassDoors, rails, flaps, slidingFronts, appliances, inserts, sliding: u.sliding.enabled ? u.sliding.panels : 0 };
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
  if (c.flaps) feats.push(plural(c.flaps, 'flap'));
  if (c.slidingFronts) feats.push(plural(c.slidingFronts, 'sliding front'));
  if (c.drawers) feats.push(plural(c.drawers, 'drawer'));
  if (c.shelves) feats.push(`${c.shelves} adjustable shel${c.shelves === 1 ? 'f' : 'ves'}`);
  if (c.rails) feats.push(plural(c.rails, 'hanging rail'));
  const lines = [`Size: ${u.width} W × ${u.height} H × ${u.depth} D mm · ${u.installType === 'builtIn' ? 'built-in' : 'standalone'}${u.mount === 'wall' ? `, wall hung at ${u.mountHeight}mm` : ''}`, `Carcass: ${name(cat.boards, u.carcassMaterialId) ?? '-'}`];
  if (c.doors + c.drawers + c.flaps + c.sliding + c.slidingFronts > 0) lines.push(`Fronts: ${name(cat.boards, u.frontMaterialId) ?? '-'}`);
  if (feats.length) lines.push(`Features: ${feats.join(', ')}`);
  if (u.countertopId) lines.push(`Top: ${name(cat.countertops, u.countertopId)}`);
  else if (u.topBoardId) lines.push(`Top: ${name(cat.boards, u.topBoardId)}`);
  const panels = (['left', 'right', 'back'] as const).filter((s) => u.finishPanels[s].enabled);
  if (panels.length) lines.push(`Exposed finish panels: ${panels.map((s) => `${s} (${u.finishPanels[s].style})`).join(', ')} – ${name(cat.boards, u.finishPanels[panels[0]].materialId)}`);
  const hw: string[] = [];
  if (c.doors + c.glassDoors + c.flaps > 0 && u.hingeId) hw.push(cat.accessories.find((a) => a.id === u.hingeId)?.family ? `${cat.accessories.find((a) => a.id === u.hingeId)!.family} hinges` : acc(u.hingeId)!);
  if (c.drawers > 0 && u.runnerId) hw.push(cat.accessories.find((a) => a.id === u.runnerId)?.family ?? acc(u.runnerId)!);
  if (c.sliding && u.rollerId) hw.push(acc(u.rollerId)!);
  if (u.handleId) hw.push(acc(u.handleId)!);
  if (hw.filter(Boolean).length) lines.push(`Hardware: ${hw.filter(Boolean).join(', ')}`);
  const extras: string[] = [];
  for (const b of u.bays) for (const s of b.sections) if (s.insertId) extras.push(name(cat.accessories, s.insertId) ?? '');
  if (extras.length) lines.push(`Organisers: ${extras.join(', ')}`);
  const appl: string[] = [...u.topAppliances.map((t) => name(cat.appliances, t.applianceId) ?? ''), ...u.bays.flatMap((b) => b.sections.filter((s) => s.front === 'appliance' && s.applianceId).map((s) => name(cat.appliances, s.applianceId) ?? ''))];
  if (appl.length) lines.push(`Appliances: ${appl.join(', ')}`);
  if (u.lights.length) lines.push(`Lighting: ${u.lights.map((l) => `${name(cat.accessories, l.accessoryId) ?? 'LED'} ${l.temperature ? `${l.temperature}K` : 'RGB'} (${l.location.replace(/([A-Z])/g, ' $1').toLowerCase()})`).join(', ')}`);
  if (u.mount === 'floor' && u.base === 'legs') lines.push(`Base: ${acc(u.legId) ?? 'legs'} (${u.baseHeight}mm)`);
  if (u.mount === 'floor' && u.base === 'plinth') lines.push(`Base: kick board ${u.baseHeight}mm`);
  if (u.mount === 'floor' && u.base === 'none') lines.push('Base: sits directly on the floor');
  if (u.notes) lines.push(u.notes);
  return lines;
}
