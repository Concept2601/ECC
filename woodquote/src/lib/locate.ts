import type { Quote, Run, RunModule, Unit } from './types';

export interface UnitLocation {
  unit: Unit;
  run?: Run;
  module?: RunModule;
  role?: 'base' | 'tall' | 'wall';
}

/** Find a unit by id, whether it is a stand-alone quote unit or part of a kitchen run. */
export function locateUnit(q: Quote, unitId: string): UnitLocation | null {
  const u = q.units.find((x) => x.id === unitId);
  if (u) return { unit: u };
  for (const run of q.runs ?? [])
    for (const leg of run.legs)
      for (const m of leg) {
        if (m.base?.id === unitId) return { unit: m.base, run, module: m, role: m.kind === 'tall' ? 'tall' : 'base' };
        if (m.wall?.id === unitId) return { unit: m.wall, run, module: m, role: 'wall' };
      }
  return null;
}
