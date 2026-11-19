import { describe, expect, it } from 'vitest';
import { packSheets } from '../optimizer';

describe('very big jobs', () => {
  it('nests thousands of parts quickly with a sensible sheet count', () => {
    const sizes = [
      [720, 560],
      [720, 300],
      [564, 560],
      [400, 560],
      [2100, 600],
      [870, 100],
    ];
    const pieces = Array.from({ length: 6000 }, (_, i) => ({ id: `p${i}`, label: 'part', length: sizes[i % 6][0], width: sizes[i % 6][1], canRotate: false }));
    const t = Date.now();
    const plan = packSheets(pieces, 2750, 1830, { kerf: 4, trim: 10, minOffcut: 200, mode: 'guillotine' });
    expect(Date.now() - t).toBeLessThan(5000);
    expect(plan.oversize.length).toBe(0);
    expect(plan.sheets.reduce((a, s) => a + s.placements.length, 0)).toBe(6000);
    expect(plan.utilisation).toBeGreaterThan(0.7);
  });
});
