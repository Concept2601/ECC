import type { Assembly, AssemblyPiece, Quote, Run, RunModule, Unit } from './types';

export interface UnitLocation {
  unit: Unit;
  run?: Run;
  module?: RunModule;
  role?: 'base' | 'tall' | 'wall';
  assembly?: Assembly;
  piece?: AssemblyPiece;
}

/** Find a unit by id: a stand-alone quote unit, part of a kitchen run or part of a cabinet group. */
export function locateUnit(q: Quote, unitId: string): UnitLocation | null {
  const u = q.units.find((x) => x.id === unitId);
  if (u) return { unit: u };
  for (const run of q.runs ?? [])
    for (const leg of run.legs)
      for (const m of leg) {
        if (m.base?.id === unitId) return { unit: m.base, run, module: m, role: m.kind === 'tall' ? 'tall' : 'base' };
        if (m.wall?.id === unitId) return { unit: m.wall, run, module: m, role: 'wall' };
      }
  for (const a of q.assemblies ?? [])
    for (const p of a.pieces) if (p.unit?.id === unitId) return { unit: p.unit, assembly: a, piece: p };
  return null;
}

/** Put a new version of a stand-alone or grouped unit in place of the old one (same id). */
export function replaceUnit(q: Quote, next: Unit): boolean {
  const i = q.units.findIndex((x) => x.id === next.id);
  if (i >= 0) {
    q.units[i] = next;
    return true;
  }
  const l = locateUnit(q, next.id);
  if (l?.piece) {
    l.piece.unit = next;
    return true;
  }
  return false;
}
