import { describe, expect, it } from 'vitest';
import { defaultCatalog, defaultSettings } from '../defaults';
import { buildUnit, unitExtents } from '../generate';
import { calculateQuote } from '../pricing';
import { createUnit } from '../presets';
import { buildRun, createRun, legStart, legTransform, syncRun } from '../runs';
import type { Quote } from '../types';

const cat = defaultCatalog();
const settings = defaultSettings();
const pr = settings.pricing;
const quote = (over: Partial<Quote>): Quote => ({
  id: 'q', number: 'Q', title: 't', date: '2026-01-01', status: 'draft', client: { name: '', phone: '', email: '', address: '' }, units: [], runs: [], attachments: [], includeAppliances: true, room: null, extras: [],
  transportId: null, transportCustom: 0, installation: false, markupPercent: 30, discountType: 'percent', discountValue: 0, applyTax: false, notes: '', sourceImage: null, createdAt: 0, updatedAt: 0, ...over,
});

describe('corner cupboards', () => {
  it('builds an L-shaped base corner with its own width on each wall', () => {
    const u = createUnit('corner_base');
    u.width = 1000;
    u.corner!.widthB = 800;
    const b = buildUnit(u, cat, pr);
    const doors = b.parts.filter((p) => p.role === 'door');
    expect(doors.reduce((a, p) => a + p.qty, 0)).toBe(2);
    const t = cat.boards.find((x) => x.id === u.carcassMaterialId)!.thickness;
    const backT = cat.boards.find((x) => x.id === u.backMaterialId)!.thickness;
    expect(b.parts.find((p) => p.name === 'Bottom (main wall)')!.length).toBe(1000 - t - backT);
    expect(b.parts.some((p) => p.name === 'Worktop (side wall)')).toBe(true);
    expect(b.parts.some((p) => p.name === 'Back panel (side wall)' && p.width === 800 - backT)).toBe(true);
    const e = unitExtents(u, cat);
    expect(e.z1).toBe(800);
    expect(b.warnings).toEqual([]);
  });

  it('builds a diagonal corner with one angled door and five-sided shelves', () => {
    const u = createUnit('corner_base');
    u.corner!.style = 'diagonal';
    const b = buildUnit(u, cat, pr);
    const door = b.parts.find((p) => p.role === 'door')!;
    expect(door.qty).toBe(1);
    expect(door.boxes[0].meta?.frame).toBeTruthy();
    expect(b.parts.find((p) => p.name.startsWith('Shelf'))!.boxes[0].meta?.shape).toHaveLength(5);
  });

  it('mirrors for a left-hand corner and hangs wall corners at their height', () => {
    const r = createUnit('corner_wall');
    const l = createUnit('corner_wall');
    l.corner!.hand = 'left';
    const br = buildUnit(r, cat, pr);
    const bl = buildUnit(l, cat, pr);
    const hinges = (b: typeof br) => b.parts.filter((p) => p.role === 'door').map((p) => p.boxes[0].meta?.hinge).sort();
    expect(hinges(br)).toEqual(hinges(bl));
    const ys = br.parts.flatMap((p) => p.boxes.map((x) => x.y));
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(r.mountHeight);
    expect(br.hardware.some((h) => h.accessoryId === 'fx-hanger')).toBe(true);
  });

  it('a kitchen corner sets where the next wall starts, with a matching wall corner and worktop return', () => {
    const run = createRun('L');
    const corner = run.legs[0][run.legs[0].length - 1];
    corner.width = 1000;
    corner.cornerB = 950;
    syncRun(run, cat);
    expect(corner.base!.corner!.hand).toBe('right');
    expect(corner.wall?.corner?.widthB).toBe(950);
    expect(legStart(run, 1)).toBe(950);
    expect(legTransform(run, { leg: 1, s: 0, w: 600 }).z).toBe(950);
    const rb = buildRun(run, cat, pr);
    expect(rb.extra.parts.some((p) => p.name === 'Worktop (corner return)')).toBe(true);
    const c = calculateQuote(quote({ runs: [run] }), cat, settings);
    expect(c.total).toBeGreaterThan(0);
  });

  it('U kitchens get a left-hand corner at the start of the back wall', () => {
    const run = createRun('U');
    syncRun(run, cat);
    expect(run.legs[0][0].base!.corner!.hand).toBe('left');
    expect(legStart(run, 2)).toBe(run.legs[0][0].cornerB);
  });
});
