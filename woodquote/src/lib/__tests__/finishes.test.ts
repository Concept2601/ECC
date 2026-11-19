import { describe, expect, it } from 'vitest';
import { defaultCatalog, defaultSettings } from '../defaults';
import { boardColour, partFinish } from '../finishes';
import { calculateQuote } from '../pricing';
import { createUnit } from '../presets';
import { sinkSpec, sinkZones, tapX } from '../sinks';
import type { Appliance, Quote } from '../types';

const cat = defaultCatalog();
const s = defaultSettings();

describe('finish library', () => {
  it('fronts and carcass take their own finish; the board look is the fallback', () => {
    const u = createUnit('kitchen_base');
    u.frontFinishId = 'fin-hgs-red';
    u.carcassFinishId = 'fin-hg-white';
    const board = cat.boards[0];
    expect(partFinish(cat, u, 'door', board)?.name).toMatch(/red/);
    expect(partFinish(cat, u, 'drawerFront', board)?.name).toMatch(/red/);
    expect(partFinish(cat, u, 'shelf', board)?.name).toMatch(/white/);
    u.frontFinishId = null;
    expect(partFinish(cat, u, 'door', { ...board, finishId: 'fin-hg-blue' })?.name).toMatch(/blue/);
    expect(boardColour(cat, board, 'fin-hg-red')).toBe('#a3161c');
  });
  it('a finishing price per m² is added for the finished area', () => {
    const u = createUnit('kitchen_base');
    const q = { id: 'q', number: 'Q', title: '', date: '2026-01-01', status: 'draft', client: { name: '', phone: '', email: '', address: '' }, units: [u], runs: [], extras: [], attachments: [], includeAppliances: true, transportId: null, transportCustom: 0, installation: false, markupPercent: 0, discountType: 'percent', discountValue: 0, applyTax: false, notes: '', sourceImage: null, room: null, createdAt: 0, updatedAt: 0 } as Quote;
    const plain = calculateQuote(q, cat, s);
    u.frontFinishId = 'fin-hgs-cream'; // 18 per m²
    const c = calculateQuote(q, cat, s);
    const line = c.costLines.find((l) => l.group === 'Finishes')!;
    expect(line.unitPrice).toBe(18);
    expect(line.qty).toBeGreaterThan(0.2);
    expect(c.materialsCost - plain.materialsCost).toBeCloseTo(line.total, 1);
  });
});

describe('custom sinks', () => {
  const sink = (layout: string, width = 1200): Appliance => ({ id: 'x', category: 'sink', name: 'Custom', variant: '', width, height: 200, depth: 500, price: 1, color: '#ccc', placement: 'top', sink: { layout, material: 'stainless', color: '#ccc', mount: 'inset', tap: 'centre' } });
  it('two drainers with a bowl: drainer – bowl – drainer filling the width', () => {
    const z = sinkZones(sinkSpec(sink('DBD')), 1200);
    expect(z.map((x) => x.kind)).toEqual(['drainer', 'bowl', 'drainer']);
    expect(Math.round(z[2].x + z[2].w)).toBe(1200 - 25);
    // tap centred behind the bowl
    expect(Math.round(tapX(sinkSpec(sink('DBD')), 1200)!)).toBe(600);
  });
  it('older sinks get a layout from their name', () => {
    expect(sinkSpec({ ...sink('B'), sink: undefined, name: 'Stainless sink double bowl', variant: '' }).layout).toBe('BB');
    expect(sinkSpec({ ...sink('B'), sink: undefined, name: 'Stainless sink single bowl + drainer', variant: '' }).layout).toBe('BD');
  });
  it('half bowls are narrower than bowls', () => {
    const z = sinkZones(sinkSpec(sink('BHD')), 1160);
    expect(z[1].w).toBeLessThan(z[0].w);
  });
});
