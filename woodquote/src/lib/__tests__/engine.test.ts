import { describe, expect, it } from 'vitest';
import { defaultCatalog, defaultSettings } from '../defaults';
import { buildUnit, hingesForDoor } from '../generate';
import { packBars, packSheets, priceBoardPlan } from '../optimizer';
import { balanceAfterPayment, calculateInvoice, calculateQuote } from '../pricing';
import { createUnit, normalizeUnit, PRODUCT_ORDER, sec } from '../presets';
import { createRun, syncRun } from '../runs';
import { autoPlace, defaultRoom, footprint, newOpening, roomWarnings, snapToWall, wallPieces } from '../room';
import type { Invoice, Quote } from '../types';
import { sum } from '../util';

const cat = defaultCatalog();
const settings = defaultSettings();

const quote = (units = [createUnit('wardrobe')]): Quote => ({
  id: 'q', number: 'QUO-1', title: 't', date: '2026-01-01', status: 'draft',
  client: { name: 'A', phone: '', email: '', address: '' }, units, runs: [], attachments: [], includeAppliances: true, room: null, extras: [{ id: 'e', description: 'x', qty: 2, unitPrice: 10 }],
  transportId: 'tr-local', transportCustom: 0, installation: true, markupPercent: 30,
  discountType: 'percent', discountValue: 10, applyTax: true, notes: '', sourceImage: null, createdAt: 0, updatedAt: 0,
});

describe('generator', () => {
  it('builds every preset without errors', () => {
    for (const t of PRODUCT_ORDER) {
      const b = buildUnit(createUnit(t), cat, settings.pricing);
      expect(b.parts.length).toBeGreaterThan(3);
      expect(b.parts.every((p) => p.length > 0 && p.width > 0 && p.qty > 0)).toBe(true);
    }
  });

  it('counts hinges, runners and rails for a wardrobe', () => {
    const b = buildUnit(createUnit('wardrobe'), cat, settings.pricing);
    const hinge = b.hardware.find((h) => h.accessoryId === 'h-soft-overlay');
    expect(hinge).toBeTruthy();
    // 3 tall doors (4 hinges each @ >1600mm), 3 small top doors (2), 1 mid door (3)
    expect(hinge!.qty).toBeGreaterThanOrEqual(12);
    expect(b.hardware.some((h) => h.accessoryId.startsWith('r-sc'))).toBe(true);
    expect(b.hardware.some((h) => h.accessoryId === 'rl-oval')).toBe(true);
  });

  it('auto sizes runners to depth', () => {
    const u = createUnit('vanity'); // depth 480
    const b = buildUnit(u, cat, settings.pricing);
    const runner = b.hardware.find((h) => h.accessoryId.startsWith('r-sc'));
    expect(runner!.accessoryId).toBe('r-sc400');
  });

  it('adds rollers and tracks for sliding doors', () => {
    const b = buildUnit(createUnit('sliding_wardrobe'), cat, settings.pricing);
    expect(b.hardware.find((h) => h.accessoryId === 'ro-std')!.qty).toBe(2);
    expect(b.hardware.find((h) => h.accessoryId === 't-std')!.qty).toBeCloseTo(2.4);
  });

  it('hinge rule', () => {
    expect(hingesForDoor(700)).toBe(2);
    expect(hingesForDoor(2200)).toBe(5);
  });

  it('applies hardware overrides', () => {
    const u = createUnit('kitchen_base');
    const b0 = buildUnit(u, cat, settings.pricing);
    const k = b0.hardware.find((h) => h.accessoryId === 'h-soft-overlay')!.key;
    u.hardwareOverrides[k] = 9;
    expect(buildUnit(u, cat, settings.pricing).hardware.find((h) => h.key === k)!.qty).toBe(9);
  });
});

describe('optimizer', () => {
  it('fits 5 panels on one sheet and reports waste', () => {
    const pieces = Array.from({ length: 5 }, (_, i) => ({ id: `${i}`, label: 'p', length: 1200, width: 450, canRotate: true }));
    const plan = packSheets(pieces, 2440, 1220, { kerf: 4, trim: 10, minOffcut: 200, mode: 'guillotine' });
    expect(plan.sheets.length).toBe(1);
    const priced = priceBoardPlan(cat.boards.find((b) => b.id === 'b-mdf18')!, plan, 'fullSheets');
    expect(priced.fullSheetsCost).toBe(45);
    expect(priced.usedCost + priced.offcutValue + priced.wasteCost).toBeCloseTo(45);
    expect(priced.wasteCost).toBeGreaterThan(0);
  });

  it('respects grain (no rotation) and flags oversize', () => {
    const plan = packSheets([{ id: 'a', label: 'a', length: 1000, width: 2400, canRotate: false }], 2440, 1220, { kerf: 4, trim: 10, minOffcut: 200, mode: 'nested' });
    expect(plan.oversize.length).toBe(1);
    const plan2 = packSheets([{ id: 'a', label: 'a', length: 1000, width: 2400, canRotate: true }], 2440, 1220, { kerf: 4, trim: 10, minOffcut: 200, mode: 'nested' });
    expect(plan2.sheets[0].placements[0].rotated).toBe(true);
  });

  it('never overlaps placements', () => {
    for (const mode of ['guillotine', 'nested'] as const) {
      const pieces = Array.from({ length: 40 }, (_, i) => ({ id: `${i}`, label: 'p', length: 200 + ((i * 137) % 900), width: 100 + ((i * 71) % 500), canRotate: i % 3 !== 0 }));
      const plan = packSheets(pieces, 2440, 1220, { kerf: 4, trim: 10, minOffcut: 200, mode });
      expect(sum(plan.sheets.map((s) => s.placements.length))).toBe(40);
      for (const s of plan.sheets) {
        for (const p of s.placements) {
          expect(p.x + p.l).toBeLessThanOrEqual(2440 - 10 + 0.001);
          expect(p.y + p.w).toBeLessThanOrEqual(1220 - 10 + 0.001);
        }
        for (let i = 0; i < s.placements.length; i++)
          for (let j = i + 1; j < s.placements.length; j++) {
            const a = s.placements[i], b = s.placements[j];
            const overlap = a.x < b.x + b.l && a.x + a.l > b.x && a.y < b.y + b.w && a.y + a.w > b.y;
            expect(overlap).toBe(false);
          }
      }
    }
  });

  it('packs aluminium bars', () => {
    const plan = packBars(cat.aluminium[0], [2000, 2000, 2000, 500, 500], 4);
    expect(plan.bars.length).toBe(2);
  });
});

describe('pricing', () => {
  it('unit prices add up to the quote', () => {
    const q = quote([createUnit('wardrobe'), createUnit('kitchen_base'), createUnit('tv_stand')]);
    q.units[1].qty = 3;
    const c = calculateQuote(q, cat, settings);
    const linesTotal = sum(c.costLines.map((l) => l.total));
    expect(c.materialsCost).toBeCloseTo(linesTotal, 4);
    expect(sum(c.items.map((u) => u.sell))).toBeCloseTo(c.unitsSell, 4);
    expect(c.subtotal).toBeCloseTo(c.unitsSell + 30 + 20, 1);
    expect(c.discount).toBeCloseTo(c.subtotal * 0.1, 1);
    expect(c.total).toBeCloseTo((c.subtotal - c.discount) * 1.15, 1);
  });

  it('invoice deposit / balance / receipts', () => {
    const inv: Invoice = {
      id: 'i', number: 'INV-1', quoteId: null, quoteNumber: '', date: '2026-01-01', dueDate: '2026-01-15',
      client: { name: 'A', phone: '', email: '', address: '' }, lines: [{ id: 'l', description: 'x', qty: 2, unitPrice: 500 }],
      discountType: 'amount', discountValue: 100, applyTax: false, depositType: 'percent', depositValue: 60,
      payments: [
        { id: 'p1', date: '2026-01-02', amount: 540, method: 'Cash', reference: '', receiptNumber: 'R1' },
        { id: 'p2', date: '2026-01-10', amount: 200, method: 'Bank', reference: '', receiptNumber: 'R2' },
      ],
      notes: '', createdAt: 0, updatedAt: 0,
    };
    const c = calculateInvoice(inv, settings);
    expect(c.total).toBe(900);
    expect(c.depositDue).toBe(540);
    expect(c.balance).toBe(160);
    expect(c.status).toBe('deposit paid');
    expect(balanceAfterPayment(inv, settings, 'p1').balance).toBe(360);
  });
});

describe('new design features', () => {
  const pr = settings.pricing;
  it('door opening, fit and glass options drive hinges', () => {
    const u = createUnit('custom');
    u.bays[0].sections = [sec({ front: 'door', opening: 'pair', fit: 'inset', size: 1 }), sec({ front: 'door', doorMaterial: 'frameless', opening: 'up', size: 1 })];
    const b = buildUnit(u, cat, pr);
    expect(b.hardware.find((h) => h.accessoryId === 'h-soft-inset')?.qty).toBe(4);
    expect(b.hardware.some((h) => h.accessoryId === 'h-glass')).toBe(true);
    expect(b.hardware.some((h) => h.accessoryId === 'st-flap')).toBe(true);
    expect(b.parts.some((p) => p.name.includes('frameless'))).toBe(true);
    const doors = b.parts.filter((p) => p.role === 'door').flatMap((p) => p.boxes);
    expect(doors.map((d) => d.meta?.hinge).sort()).toEqual(['left', 'right']);
  });

  it('sliding fronts open left / right / bypass', () => {
    const u = createUnit('custom');
    u.bays[0].sections = [sec({ front: 'sliding', slide: 'bypass' })];
    const b = buildUnit(u, cat, pr);
    const panels = b.parts.filter((p) => p.name === 'Sliding door').flatMap((p) => p.boxes);
    expect(panels.map((p) => p.meta?.slide).sort()).toEqual(['left', 'right']);
  });

  it('adds overhang, kick boards on every side and finish panels', () => {
    const u = createUnit('island');
    const b = buildUnit(u, cat, pr);
    const top = b.parts.find((p) => p.name === 'Countertop')!;
    const fpT = 18;
    expect(top.length).toBe(u.width + 2 * fpT + u.overhang.left + u.overhang.right);
    expect(top.width).toBe(u.depth + fpT + u.overhang.front + u.overhang.back);
    expect(b.parts.filter((p) => p.name.startsWith('Kick board')).length).toBe(4);
    expect(b.parts.filter((p) => p.name.startsWith('Finish panel')).length).toBe(3);
    expect(b.applianceList.some((a) => a.applianceId === 'ap-hob-ind4')).toBe(true);
    expect(b.hardware.some((h) => h.accessoryId === 'sv-cutout')).toBe(true);
    expect(b.hardware.some((h) => h.accessoryId === 'in-bin')).toBe(true);
  });

  it('lighting adds strips, driver and sensors with colour temperature', () => {
    const u = createUnit('wardrobe');
    const b = buildUnit(u, cat, pr);
    expect(b.lights.length).toBe(3);
    expect(b.lights[0].color).toMatch(/^#/);
    expect(b.hardware.some((h) => h.accessoryId === 'lt-driver')).toBe(true);
    expect(b.hardware.find((h) => h.accessoryId === 'lt-profile')!.qty).toBeGreaterThan(1.5);
  });

  it('wall hung units are lifted, floor units can sit directly on the floor', () => {
    const w = buildUnit(createUnit('kitchen_wall'), cat, pr);
    expect(Math.min(...w.parts.flatMap((p) => p.boxes.map((b) => b.y)))).toBeGreaterThanOrEqual(1450);
    const f = createUnit('kitchen_base');
    f.base = 'none';
    const fb = buildUnit(f, cat, pr);
    expect(fb.parts.some((p) => p.role === 'plinth')).toBe(false);
    expect(fb.hardware.some((h) => h.accessoryId.startsWith('l-'))).toBe(false);
  });

  it('migrates units saved by the previous version', () => {
    const old = { ...createUnit('custom'), countertopOverhang: 40, overhang: undefined, bays: [{ id: 'b', size: 1, sections: [{ id: 's', size: 1, front: 'glassDoor', doorCount: 2, drawerCount: 1, shelves: 1, hangingRail: false }] }] };
    const u = normalizeUnit(old);
    expect(u.overhang.front).toBe(40);
    expect(u.bays[0].sections[0]).toMatchObject({ front: 'door', doorMaterial: 'glass', opening: 'pair' });
    expect(() => buildUnit(u, cat, pr)).not.toThrow();
  });
});

describe('kitchen runs', () => {
  for (const shape of ['straight', 'L', 'U'] as const) {
    it(`prices a ${shape} kitchen as one item`, () => {
      const run = createRun(shape);
      syncRun(run, cat);
      const q = quote([]);
      q.runs = [run];
      const c = calculateQuote(q, cat, settings);
      expect(c.items).toHaveLength(1);
      expect(c.items[0].kind).toBe('run');
      expect(c.items[0].sell).toBeGreaterThan(500);
      expect(c.costLines.some((l) => l.group === 'Countertops')).toBe(true);
      expect(c.costLines.some((l) => l.group === 'Appliances')).toBe(true);
      expect(sum(c.items.map((i) => i.sell))).toBeCloseTo(c.unitsSell, 4);
    });
  }
  it('keeps base and wall units in line with run sizes', () => {
    const run = createRun('L');
    run.counterHeight = 920;
    run.legs[0][1].width = 700;
    syncRun(run, cat);
    const m = run.legs[0][1];
    expect(m.base!.width).toBe(700);
    expect(m.wall!.width).toBe(700);
    expect(m.base!.height).toBe(890);
    expect(m.wall!.mountHeight).toBe(run.wallBottom);
  });
  it('excludes appliance prices when the client supplies them', () => {
    const run = createRun('straight');
    const q = quote([]);
    q.runs = [run];
    const a = calculateQuote(q, cat, settings);
    q.includeAppliances = false;
    const b = calculateQuote(q, cat, settings);
    expect(b.appliancesCost).toBe(0);
    expect(a.total).toBeGreaterThan(b.total);
  });
});

describe('hobs, lights and rooms', () => {
  const pr = settings.pricing;
  it('has every requested hob type', () => {
    const hobs = cat.appliances.filter((a) => a.category === 'hob');
    for (const [fuel, plates] of [['Gas', 2], ['Gas', 4], ['Gas', 5], ['Gas', 6], ['Electric', 4], ['Electric', 5], ['Electric', 6]] as const)
      expect(hobs.some((h) => h.variant === fuel && h.plates === plates)).toBe(true);
    expect(cat.appliances.filter((a) => a.category === 'downdraft').length).toBeGreaterThanOrEqual(3);
  });

  it('positions a hob by edge distances and adds a downdraft', () => {
    const u = createUnit('kitchen_base');
    u.topAppliances = [{ id: 't', applianceId: 'ap-hob-gas4', bay: 0, frontGap: 80, xOffset: 100, downdraftId: 'ap-dd-600' }];
    const b = buildUnit(u, cat, pr);
    const hob = b.appliances.find((a) => a.applianceId === 'ap-hob-gas4')!;
    expect(hob.box.x).toBe(100);
    expect(u.depth + u.overhang.front - (hob.box.z + hob.box.d)).toBe(80);
    const dd = b.appliances.find((a) => a.applianceId === 'ap-dd-600')!;
    expect(dd.box.z + dd.box.d).toBeLessThan(hob.box.z);
    expect(b.applianceList.some((a) => a.applianceId === 'ap-dd-600')).toBe(true);
    expect(b.hardware.find((h) => h.accessoryId === 'sv-cutout')!.qty).toBe(2);
    u.topAppliances[0].frontGap = 10;
    expect(buildUnit(u, cat, pr).warnings.some((w) => /front edge/.test(w))).toBe(true);
  });

  it('places custom lights anywhere', () => {
    const u = createUnit('bookshelf');
    u.lights = [{ id: 'l', accessoryId: 'lt-strip', location: 'custom', temperature: 2700, color: '#fff', bays: [], sensorId: null, custom: { x: 30, y: 400, z: 100, length: 1200, vertical: true, dir: 'front' } }];
    const b = buildUnit(u, cat, pr);
    expect(b.lights).toHaveLength(1);
    expect(b.lights[0].box).toMatchObject({ x: 30, y: 400, z: 100, h: 1200 });
    expect(b.hardware.find((h) => h.accessoryId === 'lt-strip')!.qty).toBeCloseTo(1.2);
  });

  it('builds walls around windows, doors and beams', () => {
    const room = defaultRoom();
    room.openings.push({ ...newOpening('opening', 1, room), beamDepth: 350 });
    const back = wallPieces(room, 0);
    const win = room.openings[0];
    expect(back.pieces.some((p) => p.y1 === win.sill && p.u0 === win.offset)).toBe(true);
    expect(back.pieces.some((p) => p.y0 === win.height)).toBe(true);
    const right = wallPieces(room, 1);
    expect(right.pieces.some((p) => p.kind === 'beam' && p.y0 === room.wallHeights[1] - 350)).toBe(true);
    expect(roomWarnings(room)).toEqual([]);
  });

  it('auto-places items and snaps them to walls', () => {
    const q = quote([createUnit('tv_stand'), createUnit('wardrobe')]);
    const c = calculateQuote(q, cat, settings);
    let room = autoPlace(defaultRoom(), c.items, cat);
    expect(room.placements).toHaveLength(2);
    const p = snapToWall(room, c.items[1], cat, room.placements[1], 3);
    expect(p.rot).toBe(90);
    const xs = footprint(c.items[1], cat, p).map((q2) => q2[0]);
    expect(Math.min(...xs)).toBeCloseTo(0);
    room = { ...room, placements: [room.placements[0], p] };
    expect(room.placements[1].rot).toBe(90);
  });
});
