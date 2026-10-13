import { describe, expect, it } from 'vitest';
import { defaultCatalog, defaultSettings } from '../defaults';
import { buildUnit, hingesForDoor } from '../generate';
import { packBars, packSheets, priceBoardPlan } from '../optimizer';
import { balanceAfterPayment, calculateInvoice, calculateQuote } from '../pricing';
import { createUnit, PRODUCT_ORDER } from '../presets';
import type { Invoice, Quote } from '../types';
import { sum } from '../util';

const cat = defaultCatalog();
const settings = defaultSettings();

const quote = (units = [createUnit('wardrobe')]): Quote => ({
  id: 'q', number: 'QUO-1', title: 't', date: '2026-01-01', status: 'draft',
  client: { name: 'A', phone: '', email: '', address: '' }, units, extras: [{ id: 'e', description: 'x', qty: 2, unitPrice: 10 }],
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
    const hinge = b.hardware.find((h) => h.accessoryId === 'h-softclose');
    expect(hinge).toBeTruthy();
    // 3 tall doors (4 hinges each @ >1600mm), 3 small top doors (2), 1 mid door (3)
    expect(hinge!.qty).toBeGreaterThanOrEqual(12);
    expect(b.hardware.some((h) => h.accessoryId.startsWith('r-bb'))).toBe(true);
    expect(b.hardware.some((h) => h.accessoryId === 'rl-oval')).toBe(true);
  });

  it('auto sizes runners to depth', () => {
    const u = createUnit('vanity'); // depth 480
    const b = buildUnit(u, cat, settings.pricing);
    const runner = b.hardware.find((h) => h.accessoryId.startsWith('r-bb'));
    expect(runner!.accessoryId).toBe('r-bb400');
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
    const k = b0.hardware.find((h) => h.accessoryId === 'h-softclose')!.key;
    u.hardwareOverrides[k] = 9;
    expect(buildUnit(u, cat, settings.pricing).hardware.find((h) => h.key === k)!.qty).toBe(9);
  });
});

describe('optimizer', () => {
  it('fits 5 panels on one sheet and reports waste', () => {
    const pieces = Array.from({ length: 5 }, (_, i) => ({ id: `${i}`, label: 'p', length: 1200, width: 450, canRotate: true }));
    const plan = packSheets(pieces, 2440, 1220, { kerf: 4, trim: 10, minOffcut: 200, mode: 'guillotine' });
    expect(plan.sheets.length).toBe(1);
    const priced = priceBoardPlan(cat.boards[2], plan, 'fullSheets');
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
    expect(sum(c.units.map((u) => u.sell))).toBeCloseTo(c.unitsSell, 4);
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
