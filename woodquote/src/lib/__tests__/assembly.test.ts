import { describe, expect, it } from 'vitest';
import { buildAssembly, coreBounds, rowGroup, rowLength, slatCount, cloneAssembly, islandGroup, pieceFootprint, syncAssembly, turn } from '../assembly';
import { defaultCatalog, defaultSettings } from '../defaults';
import { createUnit, retypeUnit } from '../presets';
import { baseModule, retypeModule } from '../runs';
import type { Run } from '../types';

const cat = defaultCatalog();
const pr = defaultSettings().pricing;
const ct = cat.countertops[0];

describe('islands', () => {
  for (const sides of [4, 2, 1] as const) {
    it(`${sides}-sided island fills its footprint without overlaps`, () => {
      const g = islandGroup({ width: 2400, depth: 1000, height: 900, sides, countertopId: ct.id, seatingOverhang: 300 });
      syncAssembly(g, cat);
      const b = buildAssembly(g, cat, pr);
      expect(b.extra.warnings.filter((w) => /overlaps/.test(w))).toEqual([]);
      const bb = coreBounds(g, cat)!;
      // exposed ends (and the back of one-sided islands) are single boards across the whole island
      if (sides !== 4) expect(b.panels.map((p) => p.side).sort()).toEqual(sides === 1 ? ['back', 'left', 'right'] : ['left', 'right']);
      for (const p of b.panels) if (p.side === 'left' || p.side === 'right') expect(Math.round(p.box.d)).toBe(1000);
      expect(Math.round(bb.x0)).toBe(0);
      expect(Math.round(bb.x1)).toBe(2400);
      expect(Math.round(bb.z0)).toBe(0);
      expect(Math.round(bb.z1)).toBe(1000);
      const facing = new Set(g.pieces.map((p) => p.rot));
      expect(facing).toEqual(new Set(sides === 4 ? [0, 180, 90, 270] : sides === 2 ? [0, 180] : [0]));
      expect(b.top).not.toBeNull();
      // shared worktop at the island height, cabinet tops removed
      expect(b.top!.y + b.top!.h).toBe(900);
      expect(g.pieces.every((p) => p.unit!.countertopId === null)).toBe(true);
      if (sides === 1) expect(b.top!.d).toBe(1000 + 20 + 300);
    });
  }
  it('back cabinets really face the back and end cabinets face out', () => {
    const g = islandGroup({ width: 2400, depth: 1000, height: 900, sides: 4, countertopId: ct.id, seatingOverhang: 0 });
    for (const p of g.pieces) {
      const u = p.unit!;
      // the front-centre of each cabinet (local z = depth) must sit on the island's outer edge
      const [fx, fz] = turn(u.width / 2, u.depth, p);
      if (p.rot === 0) expect(Math.round(fz)).toBe(1000);
      if (p.rot === 180) expect(Math.round(fz)).toBe(0);
      if (p.rot === 90) expect(Math.round(fx)).toBe(0);
      if (p.rot === 270) expect(Math.round(fx)).toBe(2400);
      expect(pieceFootprint(p, cat)).toHaveLength(4);
    }
  });
  it('copies get new ids', () => {
    const g = islandGroup({ width: 1800, depth: 900, height: 900, sides: 2, countertopId: null, seatingOverhang: 0 });
    const c = cloneAssembly(g);
    expect(c.id).not.toBe(g.id);
    expect(c.pieces[0].unit!.id).not.toBe(g.pieces[0].unit!.id);
  });
});

describe('switching cabinet type', () => {
  it('base → tall keeps width, materials and quantity', () => {
    const u = createUnit('kitchen_base');
    u.width = 450;
    u.qty = 3;
    u.frontMaterialId = cat.boards[3].id;
    const t = retypeUnit(u, 'kitchen_tall');
    expect(t.type).toBe('kitchen_tall');
    expect(t.id).toBe(u.id);
    expect(t.width).toBe(450);
    expect(t.qty).toBe(3);
    expect(t.frontMaterialId).toBe(cat.boards[3].id);
    expect(t.height).toBeGreaterThan(u.height);
  });
  it('kitchen slot base → tall → space', () => {
    const run = { installType: 'builtIn' } as unknown as Run;
    const m = baseModule('doors', run, 'doors', 500);
    const id = m.id;
    retypeModule(m, 'tall', run);
    expect(m.kind).toBe('tall');
    expect(m.id).toBe(id);
    expect(m.width).toBe(500);
    expect(m.wall).toBeNull();
    retypeModule(m, 'gap', run);
    expect(m.kind).toBe('gap');
    expect(m.base).toBeNull();
  });
});

describe('hobs and downdrafts', () => {
  it('island hob sits on the shared worktop with its downdraft and cut-outs', () => {
    const g = islandGroup({ width: 2400, depth: 1000, height: 900, sides: 2, countertopId: ct.id, seatingOverhang: 0 });
    const front = g.pieces.find((p) => p.rot === 0)!;
    front.unit!.topAppliances.push({ id: 'ta1', applianceId: 'ap-hob-gas4', bay: 0, frontGap: null, xOffset: null, downdraftId: 'ap-dd-600' });
    syncAssembly(g, cat);
    const b = buildAssembly(g, cat, pr);
    const pb = b.pieces.find((p) => p.piece === front)!.build!;
    const hob = pb.appliances.find((x) => x.applianceId === 'ap-hob-gas4')!;
    const dd = pb.appliances.find((x) => x.applianceId === 'ap-dd-600')!;
    expect(hob.box.y).toBe(900);
    expect(dd).toBeTruthy();
    expect(pb.warnings.filter((w) => /countertop|behind|front edge/.test(w))).toEqual([]);
    expect(pb.hardware.filter((h) => h.accessoryId === 'sv-cutout').reduce((s, h) => s + h.qty, 0)).toBe(2);
  });
  it('kitchen hob gets a downdraft', () => {
    const run = { installType: 'builtIn', counterHeight: 900 } as unknown as Run;
    const m = baseModule('hob', run, 'none', 600);
    expect(m.base!.topAppliances.length).toBeGreaterThan(0);
  });
});

describe('cabinet rows', () => {
  it('BIC wall fills the wall side by side', () => {
    const g = rowGroup('bic', 2400, 2400);
    syncAssembly(g, cat);
    const xs = g.pieces.map((p) => p.x);
    expect(xs[0]).toBe(0);
    for (let i = 1; i < g.pieces.length; i++) expect(xs[i]).toBe(xs[i - 1] + g.pieces[i - 1].unit!.width);
    expect(rowLength(g, cat)).toBe(2400);
    expect(buildAssembly(g, cat, pr).extra.warnings.filter((w) => /overlaps/.test(w))).toEqual([]);
  });
  it('TV wall: shelf hangs centred above the TV stand', () => {
    const g = rowGroup('tv', 3000, 2400);
    syncAssembly(g, cat);
    const stand = g.pieces.find((p) => p.unit!.type === 'tv_stand')!;
    const shelf = g.pieces.find((p) => p.unit!.mount === 'wall')!;
    expect(shelf.x).toBe(stand.x);
    expect(rowLength(g, cat)).toBe(3000);
  });
});

describe('wall slats', () => {
  it('slats are counted, cut, anchored and siliconed; cabinets stand in front of them', () => {
    const g = rowGroup('tv', 3000, 2400);
    syncAssembly(g, cat);
    const sp = g.pieces.find((p) => p.slats)!;
    const stand = g.pieces.find((p) => p.unit?.type === 'tv_stand')!;
    expect(sp.x).toBe(stand.x);
    const b = buildAssembly(g, cat, pr);
    const sb = b.pieces.find((p) => p.piece === sp)!.build!;
    const slat = sb.parts.find((p) => p.key === 'slat')!;
    expect(slat.qty).toBe(slatCount(sp.slats!));
    expect(sb.hardware.find((h) => h.accessoryId === 'fx-anchor')!.qty).toBeGreaterThan(slat.qty);
    expect(sb.hardware.find((h) => h.accessoryId === 'fx-silicone')!.qty).toBeGreaterThanOrEqual(1);
    expect(b.extra.warnings.filter((w) => /overlaps/.test(w))).toEqual([]);
  });
});
