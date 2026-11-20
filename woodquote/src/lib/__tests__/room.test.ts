import { describe, expect, it } from 'vitest';
import { defaultRoom, newWall, wallMitres } from '../room';

describe('wall joints', () => {
  it('outside corners of a closed rectangle run on by the wall thickness', () => {
    const r = defaultRoom();
    const T = r.wallThickness;
    const m = wallMitres(r);
    for (const w of m) {
      expect(Math.abs(Math.abs(w.start) - T)).toBeLessThan(0.5);
      expect(Math.abs(Math.abs(w.end) - T)).toBeLessThan(0.5);
      // both ends of a wall in a convex room push outwards
      expect(w.start).toBeLessThan(0);
      expect(w.end).toBeGreaterThan(0);
    }
  });
  it('an open run of walls has flat free ends', () => {
    const r = { ...defaultRoom(), walls: [newWall(3000, 0), newWall(2000, 90), newWall(3000, 180)] };
    const m = wallMitres(r);
    expect(m[0].start).toBe(0);
    expect(m[2].end).toBe(0);
    expect(m[0].end).not.toBe(0);
  });
});

import { assemblyBounds, buildAssembly, rowGroup, syncAssembly } from '../assembly';
import { defaultCatalog, defaultSettings } from '../defaults';
import { placeOnWall, placeXZ } from '../room';

describe('kitchen row on any wall', () => {
  const cat = defaultCatalog();
  it('base cupboards under one worktop with wall cupboards above', () => {
    const g = rowGroup('kitchen', 3000);
    syncAssembly(g, cat);
    const ab = buildAssembly(g, cat, defaultSettings().pricing);
    const floor = g.pieces.filter((p) => p.unit?.mount === 'floor');
    const wall = g.pieces.filter((p) => p.unit?.mount === 'wall');
    expect(floor.length).toBe(5);
    expect(wall.length).toBe(5);
    expect(ab.extra.parts.some((p) => p.role === 'counter')).toBe(true);
    const b = assemblyBounds(g, cat);
    expect(Math.round(b.x1 - b.x0)).toBeGreaterThanOrEqual(3000);
  });
  it('stands with its back on the chosen wall', () => {
    const r = { ...defaultRoom(), walls: [newWall(4000, 0), newWall(3000, 90), newWall(4000, 180), newWall(3000, 270)] };
    const p = placeOnWall(r, 'x', 1, { x0: 0, x1: 2000, z0: 0 }, 0);
    // wall 1 runs from (4000, 0) towards the front: the row's back-left corner sits at its start
    const [x, z] = placeXZ(0, 0, p);
    expect(Math.round(x)).toBe(4000);
    expect(Math.round(z)).toBe(0);
  });
});
