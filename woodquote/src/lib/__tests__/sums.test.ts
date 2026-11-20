import { describe, expect, it } from 'vitest';
import { evalSum, isSum } from '../util';

describe('sums in measurement boxes', () => {
  it('works out + − × ÷ and brackets', () => {
    expect(evalSum('600+18')).toBe(618);
    expect(evalSum('2400-2*18')).toBe(2364);
    expect(evalSum('(3000-60)/3')).toBe(980);
    expect(evalSum('1200x2')).toBe(2400);
    expect(evalSum('1200 × 2')).toBe(2400);
    expect(evalSum('900÷2')).toBe(450);
    expect(evalSum('450,5+0,5')).toBe(451);
    expect(evalSum('-18+600')).toBe(582);
  });
  it('rejects anything else', () => {
    expect(evalSum('600+')).toBeNull();
    expect(evalSum('alert(1)')).toBeNull();
    expect(evalSum('5/0')).toBeNull();
    expect(evalSum('(5')).toBeNull();
  });
  it('knows when a sum is being typed', () => {
    expect(isSum('600+')).toBe(true);
    expect(isSum('600')).toBe(false);
    expect(isSum('-600')).toBe(false);
  });
});

import { createUnit } from '../presets';
import { splitSection } from '../sections';

describe('dividing a compartment', () => {
  it('gives equal parts when divided twice', () => {
    const u = createUnit('kitchen_base');
    u.bays = [u.bays[0]];
    u.bays[0].sections = [u.bays[0].sections[0]];
    const r1 = splitSection(u, { bay: 0, section: 0 }, 'cols')!;
    splitSection(u, r1, 'cols');
    const parts = u.bays[0].sections[0].split!.parts;
    expect(parts).toHaveLength(3);
    expect(new Set(parts.map((p) => p.size.toFixed(6))).size).toBe(1);
  });
  it('keeps a size set by hand', () => {
    const u = createUnit('kitchen_base');
    u.bays = [u.bays[0]];
    u.bays[0].sections = [{ ...u.bays[0].sections[0], size: 1 }];
    const r1 = splitSection(u, { bay: 0, section: 0 }, 'cols')!;
    const parts = u.bays[0].sections[0].split!.parts;
    parts[0].size = 0.5;
    parts[1].size = 1.5;
    parts[1].custom = true;
    splitSection(u, { ...r1, path: [0] }, 'cols');
    expect(parts.map((p) => p.size)).toEqual([0.25, 0.25, 1.5]);
  });
});

import { makeEqual, resizeShared } from '../sections';
describe('custom size after an equal split', () => {
  it('the others keep sharing equally, and equal puts it back', () => {
    const list = [{ size: 1 }, { size: 1 }, { size: 1 }] as { size: number; custom?: boolean }[];
    resizeShared(list, [600, 600, 600], 0, 800);
    expect(list.map((x) => x.size)).toEqual([800, 500, 500]);
    resizeShared(list, [800, 500, 500], 2, 400);
    expect(list.map((x) => x.size)).toEqual([800, 600, 400]);
    makeEqual(list);
    expect(list.map((x) => x.size)).toEqual([600, 600, 600]);
    expect(list.some((x) => x.custom)).toBe(false);
  });
});
