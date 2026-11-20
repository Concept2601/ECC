import { describe, expect, it } from 'vitest';
import { defaultCatalog, defaultSettings } from '../defaults';
import { buildUnit } from '../generate';
import { createUnit } from '../presets';

const cat = defaultCatalog();
const pr = defaultSettings().pricing;

describe('cabinet interiors', () => {
  it('inner drawers behind a door: boxes, runners and push units, no fronts', () => {
    const u = createUnit('wardrobe');
    const s = u.bays[0].sections[0];
    s.innerDrawers = 2;
    s.innerPull = 'push';
    const b = buildUnit(u, cat, pr);
    expect(b.parts.filter((p) => p.name === 'Inner drawer side').reduce((a, p) => a + p.qty, 0)).toBe(4);
    expect(b.hardware.find((h) => h.accessoryId === 'r-push')?.qty).toBe(2);
    const fronts = b.parts.filter((p) => p.role === 'drawerFront').reduce((a, p) => a + p.qty, 0);
    const before = buildUnit(createUnit('wardrobe'), cat, pr).parts.filter((p) => p.role === 'drawerFront').reduce((a, p) => a + p.qty, 0);
    expect(fronts).toBe(before);
  });
  it('several rails in one compartment share the height', () => {
    const u = createUnit('wardrobe');
    const s = u.bays[0].sections[0];
    s.hangingRail = true;
    s.railCount = 2;
    const b = buildUnit(u, cat, pr);
    const ys = b.rails.filter((r) => r.box.meta?.ref?.bay === 0).map((r) => r.box.y);
    expect(ys).toHaveLength(2);
    expect(b.parts.some((p) => p.name === 'Shelf (above hanging rail)')).toBe(true);
    s.railOffsets = [0, -100];
    const ys2 = buildUnit(u, cat, pr).rails.filter((r) => r.box.meta?.ref?.bay === 0).map((r) => r.box.y);
    expect(ys2[1]).toBe(ys[1] - 100);
  });
});

import { buildRun, createRun } from '../runs';
import { buildSlats, wallPanelPiece } from '../assembly';

describe('splashes and fillers', () => {
  it('kitchen backsplash along the worktop, priced per m²', () => {
    const run = createRun('L');
    run.splash = { source: 'counter', materialId: 'c-tile-subway', height: null };
    const rb = buildRun(run, cat, pr);
    const sp = rb.extra.parts.filter((p) => p.name.startsWith('Backsplash'));
    expect(sp.length).toBeGreaterThan(0);
    expect(sp.every((p) => p.width === run.wallBottom - run.counterHeight)).toBe(true);
  });
  it('panels above the units up to the ceiling', () => {
    const run = createRun('straight');
    run.topFill = { ceiling: 2600, materialId: null, style: 'flat' };
    const rb = buildRun(run, cat, pr);
    const tf = rb.extra.parts.filter((p) => p.key.startsWith('topfill-'));
    expect(tf.length).toBeGreaterThan(0);
    expect(tf.some((p) => p.width === 2600 - run.tallHeight || p.width === 2600 - (run.wallBottom + run.wallHeight))).toBe(true);
  });
  it('wall panel behind a TV in stone or tiles', () => {
    const p = wallPanelPiece(1800, 1200, 600, cat);
    const b = buildSlats(p.slats!, cat);
    expect(b.parts).toHaveLength(1);
    expect(b.parts[0].role).toBe('counter');
  });
});
