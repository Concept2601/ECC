import { describe, expect, it } from 'vitest';
import { defaultCatalog, defaultSettings } from '../defaults';
import { fitAll, fitKitchen, splitWidths } from '../fit';
import { splitForStock } from '../joinery';
import { calculateQuote } from '../pricing';
import { createUnit } from '../presets';
import { buildRun, createRun, customModule, legLength, legRemaining, syncRun } from '../runs';
import type { Quote } from '../types';

const settings = defaultSettings();
const pr = settings.pricing;

const quote = (over: Partial<Quote>): Quote => ({
  id: 'q', number: 'Q', title: 't', date: '2026-01-01', status: 'draft', client: { name: '', phone: '', email: '', address: '' }, units: [], runs: [], attachments: [], includeAppliances: true, room: null, extras: [],
  transportId: null, transportCustom: 0, installation: false, markupPercent: 30, discountType: 'percent', discountValue: 0, applyTax: false, notes: '', sourceImage: null, createdAt: 0, updatedAt: 0, ...over,
});

describe('parts bigger than the stock are split and joined', () => {
  it('splits a 3 m part on 2.9 m melamine into equal halves, join in the middle', () => {
    const cat = defaultCatalog();
    const mat = { ...cat.boards[0], sheetLength: 2900, sheetWidth: 1830, grain: true };
    const j = splitForStock({ name: 'Top', role: 'carcass', length: 3000, width: 560 }, mat, pr)!;
    expect(j.pieces).toHaveLength(2);
    expect(j.pieces[0].length).toBe(1500);
    expect(j.joints).toBe(1);
    expect(j.method).toMatch(/partition/);
    expect(Object.keys(j.fixings).length).toBeGreaterThan(0);
  });

  it('lays narrow 150 mm planks / slats side by side with battens', () => {
    const cat = defaultCatalog();
    const slat = { ...cat.boards[0], name: 'Pine slat 150', sheetLength: 2400, sheetWidth: 150, grain: true };
    const j = splitForStock({ name: 'Finish panel (left)', role: 'finish', length: 2000, width: 560 }, slat, pr)!;
    const usableW = 150 - 2 * pr.sheetTrim;
    expect(j.pieces.every((p) => p.width <= usableW && p.length <= 2400)).toBe(true);
    expect(j.direction).toBe('width');
    expect(j.cleats.some((c) => /Batten/.test(c.label))).toBe(true);
  });

  it('a 3 m wardrobe on 2.9 m boards prices with no oversize parts', () => {
    const cat = defaultCatalog();
    cat.boards = cat.boards.map((b) => ({ ...b, sheetLength: 2900 }));
    const u = createUnit('wardrobe');
    u.width = 3000;
    const c = calculateQuote(quote({ units: [u] }), cat, settings);
    expect(c.boardPlans.every((p) => p.oversize.length === 0)).toBe(true);
    expect(c.joins.length).toBeGreaterThan(0);
    expect(c.warnings.some((w) => /could not be placed/.test(w))).toBe(false);
  });

  it('slat width and gap set the number of slats', () => {
    const cat = defaultCatalog();
    const u = createUnit('kitchen_base');
    u.finishPanels.left = { ...u.finishPanels.left, enabled: true, style: 'slatted', slatWidth: 150, slatGap: 10 };
    const c = calculateQuote(quote({ units: [u] }), cat, settings);
    const part = c.entries[0].build.parts.find((p) => /Slat 150mm/.test(p.name));
    expect(part).toBeTruthy();
    expect(part!.qty).toBe(Math.floor((u.depth + 10) / 160));
  });
});

describe('measure a space', () => {
  it('sizes units to fill the opening minus fitting gaps', () => {
    const r = fitAll({ width: 2400, height: 2400, depth: 600, sideGap: 5, topGap: 10 }, 'wardrobe')[0];
    expect(r.unit!.width).toBe(2390);
    expect(r.unit!.height).toBe(2390);
    expect(r.unit!.bays.length).toBe(4);
  });
  it('lays out a kitchen that uses the wall exactly', () => {
    for (const w of [1800, 2437, 3000, 4125]) {
      const k = fitKitchen({ width: w, height: 2600, depth: 650, sideGap: 0, topGap: 0 })!;
      expect(legLength(k.legs[0])).toBe(w);
      expect(legRemaining(k, 0)).toBe(0);
    }
  });
  it('splits leftover wall into cabinet widths with a filler under 150', () => {
    const s = splitWidths(1930);
    expect(s.widths.reduce((a, b) => a + b, 0) + s.filler).toBe(1930);
    expect(s.filler).toBeLessThan(150);
  });
});

describe('custom cabinets anywhere in a kitchen', () => {
  it('inserts any size and keeps the worktop over base fillers', () => {
    const cat = defaultCatalog();
    const run = createRun('straight');
    run.legs[0].splice(2, 0, customModule({ kind: 'base', width: 237, height: 760, depth: 300, front: 'door' }, run));
    run.legs[0].splice(1, 0, customModule({ kind: 'filler', width: 40, height: null, depth: null }, run));
    run.legs[0].push(customModule({ kind: 'wall', width: 600, height: 400, depth: null, wallBottom: 1800 }, run));
    syncRun(run, cat);
    const rb = buildRun(run, cat, pr);
    const custom = rb.pieces.find((p) => p.unit.width === 237)!;
    expect(custom.unit.height).toBe(760);
    expect(custom.unit.depth).toBe(300);
    expect(rb.extra.parts.some((p) => /Filler panel 40mm/.test(p.name))).toBe(true);
    const wallOnly = rb.pieces.find((p) => p.role === 'wall' && p.unit.width === 600 && p.unit.mountHeight === 1800);
    expect(wallOnly).toBeTruthy();
  });
});

import { designChecks, parsePlanJson, PLAN_JSON_EXAMPLE, planRoomToRoom, roomMeasurements, scaleReading, toFixture } from '../../ai/plan';
import { isClosed, placeXZ } from '../room';

describe('plan reader', () => {
  it('reads a pasted ChatGPT reply (with extra text) into a room with measurements', () => {
    const text = `Here you go:\n\`\`\`json\n${JSON.stringify(PLAN_JSON_EXAMPLE)}\n\`\`\``;
    const r = parsePlanJson(text);
    const m = roomMeasurements(r.rooms[0]);
    expect(m.floorArea).toBeCloseTo(15.12);
    expect(m.walls).toEqual([4200, 3600, 4200, 3600]);
    const room = planRoomToRoom(r.rooms[0]);
    expect(isClosed(room)).toBe(true);
    expect(room.openings[0].wall).toBe(0);
    expect(room.fixtures).toHaveLength(3);
    expect(designChecks(r.rooms[0]).length).toBeGreaterThan(0);
  });
  it('turns plan rectangles against each wall into correctly rotated outlines', () => {
    const rect = { kind: 'bic' as const, label: 'BIC', x: 3600, y: 1000, width: 600, depth: 2000, against: 'right' as const };
    const f = toFixture(rect, 0, 0);
    const corners = [
      [0, 0],
      [f.w, 0],
      [f.w, f.d],
      [0, f.d],
    ].map(([a, b]) => placeXZ(a, b, { itemId: '', x: f.x, z: f.z, rot: f.rot }));
    const xs = corners.map((c) => Math.round(c[0]));
    const zs = corners.map((c) => Math.round(c[1]));
    expect([Math.min(...xs), Math.max(...xs)]).toEqual([3600, 4200]);
    expect([Math.min(...zs), Math.max(...zs)]).toEqual([1000, 3000]);
  });
  it('rescales from one known wall', () => {
    const r = scaleReading(parsePlanJson(JSON.stringify(PLAN_JSON_EXAMPLE)), 0.5);
    expect(roomMeasurements(r.rooms[0]).walls[0]).toBe(2100);
  });
  it('rejects text with no JSON', () => {
    expect(() => parsePlanJson('sorry I cannot')).toThrow(/No JSON/);
  });
});

import { normalizeData } from '../../store';

describe('restoring backups from earlier versions', () => {
  it('upgrades a first-version backup (no rooms walls, missing settings, no counters)', () => {
    const old = {
      settings: { company: { name: 'Old Joinery' }, pricing: { currency: 'USD' } },
      catalog: { boards: [] },
      quotes: [{ id: 'q1', number: 'QUO-0007', title: 'Old', date: '2025-01-01', status: 'draft', client: { name: 'A', phone: '', email: '', address: '' }, units: [createUnit('tv_stand')], extras: [], room: { width: 4000, depth: 3000, wallHeights: [2600, 2600, 2600, 2600], showWalls: [true, true, false, true], openings: [], placements: [] } }],
      invoices: [{ id: 'i1', number: 'INV-0003', payments: [{ id: 'p', amount: 10, date: '2025-01-02', method: 'Cash', reference: '', receiptNumber: 'RCT-0005' }] }],
    };
    for (const wrapped of [old, { app: 'WoodQuote', version: 1, data: old }]) {
      const d = normalizeData(wrapped);
      expect(d.settings.company.name).toBe('Old Joinery');
      expect(d.settings.pricing.kerf).toBeGreaterThan(0);
      expect(d.catalog.boards.length).toBeGreaterThan(0);
      expect(d.quotes[0].runs).toEqual([]);
      expect(d.quotes[0].room!.walls).toHaveLength(4);
      expect(d.counters).toEqual({ quote: 7, invoice: 3, receipt: 5 });
      expect(() => calculateQuote(d.quotes[0], d.catalog, d.settings)).not.toThrow();
    }
  });
});

import { mergeCatalog } from '../../store';

describe('price library is kept as you left it', () => {
  it('keeps deleted items deleted and edited prices after restarting', () => {
    const c = mergeCatalog(defaultCatalog());
    const gone = c.boards[0].id;
    c.boards.splice(0, 1);
    c.boards[0].pricePerSheet = 123.45;
    c.accessories = c.accessories.slice(3);
    const again = mergeCatalog(JSON.parse(JSON.stringify(c)));
    expect(again.boards.find((b) => b.id === gone)).toBeUndefined();
    expect(again.boards[0].pricePerSheet).toBe(123.45);
    expect(again.accessories).toHaveLength(c.accessories.length);
  });
  it('older libraries get the new built-in appliances once, then deleting them sticks', () => {
    const old = defaultCatalog();
    old.appliances = old.appliances.filter((x) => x.id !== 'ap-dryer' && x.id !== 'ap-bin-pedal');
    const a = mergeCatalog(old);
    expect(a.appliances.some((x) => x.id === 'ap-dryer')).toBe(true);
    a.appliances = a.appliances.filter((x) => x.id !== 'ap-dryer');
    expect(mergeCatalog(JSON.parse(JSON.stringify(a))).appliances.some((x) => x.id === 'ap-dryer')).toBe(false);
  });
  it('does not bring back items deleted before deletions were tracked', () => {
    const c = defaultCatalog();
    const gone = c.glass[0].id;
    c.glass.splice(0, 1);
    expect(mergeCatalog(c).glass.find((g) => g.id === gone)).toBeUndefined();
  });
});
