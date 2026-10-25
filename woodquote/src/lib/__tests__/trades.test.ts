import { describe, expect, it } from 'vitest';
import { calculateCeilings, newCeilingArea, newCeilingJob, setCeilingSystem } from '../ceilings';
import { defaultCatalog, defaultSettings } from '../defaults';
import { calculateQuote } from '../pricing';
import { calculateTiling, groutRate, newTileArea, newTilingJob, tileProduct } from '../tiling';
import type { Quote } from '../types';
import type { TradeLine } from '../trades';

const cat = defaultCatalog();
const s = defaultSettings();
const find = (lines: TradeLine[], re: RegExp) => lines.find((l) => re.test(l.description));

describe('ceilings', () => {
  it('rhinoboard room 4 × 3.5 m', () => {
    const job = newCeilingJob(s);
    const a = newCeilingArea(cat, 'rhino', 'Lounge');
    job.areas.push(a);
    const c = calculateCeilings(job, cat, s)!;
    // 14 m² + 10% = 15.4 m² / 3.6 m² sheets → 5 sheets
    expect(find(c.lines, /Rhinoboard 6.4mm 3000/)!.qty).toBe(5);
    // brandering: 3.5 m / 0.4 + 1 = 9 rows × 4 m = 36 m (+5%) / 6.6 m → 6 lengths
    expect(find(c.lines, /Brandering/)!.qty).toBe(6);
    // cornice 15 m perimeter +10% / 3.66 → 5
    expect(find(c.lines, /cornice/i)!.qty).toBe(5);
    expect(find(c.lines, /paint/i)!.qty).toBeGreaterThanOrEqual(1);
    expect(c.sell).toBeCloseTo((c.materials + c.labour) * 1.25, 1);
    expect(c.areas[0].summary).toMatch(/14 m²/);
  });
  it('PVC room uses strips, trims and clips; extras (pendants, chandeliers, transport) charged as entered', () => {
    const job = newCeilingJob(s);
    const a = newCeilingArea(cat, 'rhino', 'Bedroom');
    setCeilingSystem(a, 'pvc', cat);
    a.demolish = true;
    a.designs.push({ id: 'd', name: 'Bulkhead', qty: 3, unit: 'm', price: 18 });
    job.areas.push(a);
    job.extras.push({ id: 'x', description: 'Chandelier – install', qty: 1, unitPrice: 40, unit: 'item' }, { id: 'y', description: 'Transport', qty: 1, unitPrice: 30, unit: 'trip' });
    const c = calculateCeilings(job, cat, s)!;
    // 15.4 m² / 1.5 m² per strip → 11 strips
    expect(find(c.lines, /PVC ceiling strip/)!.qty).toBe(11);
    expect(find(c.lines, /wall angle/)).toBeTruthy();
    expect(find(c.lines, /Remove old ceiling/)!.total).toBe(28);
    expect(find(c.lines, /Bulkhead/)!.total).toBe(54);
    expect(c.services).toBe(70);
    expect(c.sell).toBeCloseTo((c.materials + c.labour) * 1.25 + 70, 1);
  });
});

describe('tiling', () => {
  it('floor 4 × 3.5 m in 600 × 600 porcelain', () => {
    const job = newTilingJob(s);
    const a = newTileArea(cat, 'floor', 'Kitchen');
    a.skirting = false;
    job.areas.push(a);
    const t = calculateTiling(job, cat, s)!;
    // 14 m² + 10% = 15.4 / 0.36 → 43 tiles → 11 boxes of 4
    const tiles = find(t.lines, /Porcelain 600 × 600 grey/)!;
    expect(tiles.qty).toBe(11);
    expect(tiles.unit).toBe('box');
    // flexible adhesive at 5 kg/m² → 73.5 kg → 4 bags
    expect(find(t.lines, /Flexible adhesive/)!.qty).toBe(4);
    expect(find(t.lines, /Grout/)!.qty).toBeGreaterThanOrEqual(1);
    expect(find(t.lines, /levelling/i)!.qty).toBeGreaterThanOrEqual(1);
    expect(find(t.lines, /Lay floor tiles/)!.unitPrice).toBeCloseTo(6 * 1.15, 2);
  });
  it('grout rate follows the standard formula', () => {
    const tile = tileProduct(cat, 't-cer-400-beige');
    // (400+400)/(400×400) × 3 × 8 × 1.6 = 0.192 kg/m²
    expect(groutRate(tile, 3)).toBeCloseTo(0.192, 3);
  });
  it('herringbone adds waste and labour; skirting adds tiles', () => {
    const job = newTilingJob(s);
    const a = newTileArea(cat, 'floor', 'Hall');
    a.tileId = 't-plank-wood';
    a.pattern = 'herringbone';
    job.areas.push(a);
    const t = calculateTiling(job, cat, s)!;
    expect(t.areas[0].summary).toMatch(/Herringbone/);
    expect(find(t.lines, /skirting/)).toBeTruthy();
    expect(find(t.lines, /Lay floor tiles/)!.unitPrice).toBeCloseTo(6 * 1.45, 2);
  });
});

describe('one quotation, three trades', () => {
  it('adds ceilings and tiling to the quotation total', () => {
    const q = { id: 'q', number: 'Q1', title: '', date: '2026-01-01', status: 'draft', client: { name: '', phone: '', email: '', address: '' }, units: [], runs: [], extras: [], attachments: [], includeAppliances: true, transportId: null, transportCustom: 0, installation: false, markupPercent: 30, discountType: 'percent', discountValue: 0, applyTax: false, notes: '', sourceImage: null, room: null, createdAt: 0, updatedAt: 0 } as Quote;
    q.ceilings = newCeilingJob(s);
    q.ceilings.areas.push(newCeilingArea(cat, 'rhino'));
    q.tiling = newTilingJob(s);
    q.tiling.areas.push(newTileArea(cat, 'floor'));
    const c = calculateQuote(q, cat, s);
    expect(c.ceilings!.sell).toBeGreaterThan(0);
    expect(c.tiling!.sell).toBeGreaterThan(0);
    expect(c.subtotal).toBeCloseTo(c.ceilings!.sell + c.tiling!.sell, 1);
  });
});
