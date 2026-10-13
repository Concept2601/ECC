import { describe, expect, it } from 'vitest';
import { itemToUnit, ReadingZ, type ReadingItem } from '../../ai/vision';
import { defaultCatalog, defaultSettings } from '../defaults';
import { buildUnit } from '../generate';

const item: ReadingItem = {
  name: 'Bedroom wardrobe', productType: 'sliding_wardrobe', quantity: 1, width: 2700, height: 2400, depth: 650,
  base: 'plinth', baseHeight: 80, countertop: false, countertopOverhang: 0, slidingDoors: true, slidingPanels: 3, slidingStyle: 'mirror',
  carcassFinish: 'white melamine', frontFinish: 'oak', notes: '', confidence: 'medium',
  bays: [
    { widthRatio: 900, sections: [{ heightRatio: 1, front: 'drawer', doorCount: 1, drawerCount: 3, shelves: 0, hangingRail: false }, { heightRatio: 3, front: 'open', doorCount: 1, drawerCount: 1, shelves: 0, hangingRail: true }] },
    { widthRatio: 900, sections: [{ heightRatio: 1, front: 'open', doorCount: 1, drawerCount: 1, shelves: 5, hangingRail: false }] },
  ],
};

describe('diagram reader mapping', () => {
  it('schema accepts a typical reading', () => {
    expect(ReadingZ.safeParse({ summary: 's', scaleSource: 'written', assumptions: [], items: [item] }).success).toBe(true);
  });
  it('maps an AI item to a buildable unit with matched materials', () => {
    const cat = defaultCatalog();
    const u = itemToUnit(item, cat);
    expect(u.width).toBe(2700);
    expect(u.sliding).toEqual({ enabled: true, panels: 3, style: 'mirror' });
    expect(u.carcassMaterialId).toBe('b-mel16-white');
    expect(u.frontMaterialId).toBe('b-mel16-oak');
    expect(u.bays).toHaveLength(2);
    const b = buildUnit(u, cat, defaultSettings().pricing);
    expect(b.parts.some((p) => p.name === 'Mirror panel')).toBe(true);
    expect(b.hardware.find((h) => h.accessoryId === 'ro-std')?.qty).toBe(3);
  });
});
