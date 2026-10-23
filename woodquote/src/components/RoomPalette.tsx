// "Add to room": start a quotation from the room itself. Every button drops
// the real thing into the middle of the room (a priced item, or an opening in
// the wall) ready to drag into place.
import { useState } from 'react';
import { applianceGroup, assemblyBounds, islandGroup, newAssembly, syncAssembly, type IslandSides } from '../lib/assembly';
import { unitExtents } from '../lib/generate';
import { createUnit } from '../lib/presets';
import { footprints, newOpening, roomExtents, wallName } from '../lib/room';
import type { ItemPrice } from '../lib/pricing';
import { createRun } from '../lib/runs';
import type { Appliance, ApplianceCategory, Catalog, ProductType, Quote, Room, RoomOpening, RunShape, WallSide } from '../lib/types';
import { Card } from './ui';

type Entry = { label: string; hint?: string; act: () => void };

export default function RoomPalette({ quote, room, catalog, items, up, onAdded }: { quote: Quote; room: Room; catalog: Catalog; items: ItemPrice[]; up: (fn: (q: Quote) => void) => void; onAdded: (itemId: string | null, tab?: 'openings' | 'items') => void }) {
  const [wall, setWall] = useState<WallSide>(0);
  const ext = roomExtents(room);
  const cx = (ext.x0 + ext.x1) / 2;
  const cz = (ext.z0 + ext.z1) / 2;
  void quote;

  /** First free spot, searching outwards from the middle of the room, so new items never land on each other. */
  const place = (q: Quote, itemId: string, x0: number, x1: number, z0: number, z1: number) => {
    if (!q.room) return;
    const taken = room.placements.flatMap((p) => {
      const it = items.find((i) => i.id === p.itemId);
      if (!it) return [];
      return footprints(it, catalog, p).map((poly) => ({ x0: Math.min(...poly.map((v) => v[0])), x1: Math.max(...poly.map((v) => v[0])), z0: Math.min(...poly.map((v) => v[1])), z1: Math.max(...poly.map((v) => v[1])) }));
    });
    const w = x1 - x0;
    const d = z1 - z0;
    const fits = (ax: number, az: number) =>
      ax >= ext.x0 && az >= ext.z0 && ax + w <= ext.x1 && az + d <= ext.z1 && !taken.some((t) => ax < t.x1 + 50 && ax + w + 50 > t.x0 && az < t.z1 + 50 && az + d + 50 > t.z0);
    let best: [number, number] = [cx - w / 2, cz - d / 2];
    search: for (let r = 0; r <= 6000; r += 150)
      for (let a = 0; a < 360; a += r ? Math.max(10, 3000 / r) : 360) {
        const ax = cx - w / 2 + r * Math.cos((a * Math.PI) / 180);
        const az = cz - d / 2 + r * Math.sin((a * Math.PI) / 180);
        if (fits(ax, az)) {
          best = [ax, az];
          break search;
        }
      }
    q.room.placements.push({ itemId, x: Math.round(best[0] - x0), z: Math.round(best[1] - z0), rot: 0 });
  };
  const addUnit = (t: ProductType, name?: string) => {
    const u = createUnit(t);
    if (name) u.name = name;
    up((q) => {
      q.units.push(u);
      const e = unitExtents(u, catalog);
      place(q, u.id, e.x0, e.x1, e.z0, e.z1);
    });
    onAdded(u.id);
  };
  const addGroup = (g: ReturnType<typeof newAssembly>) => {
    syncAssembly(g, catalog);
    up((q) => {
      (q.assemblies ??= []).push(g);
      const b = assemblyBounds(g, catalog);
      place(q, g.id, b.x0, b.x1, b.z0, b.z1);
    });
    onAdded(g.id);
  };
  const pickAppliance = (cats: ApplianceCategory[], match?: RegExp): Appliance | undefined => {
    const list = catalog.appliances.filter((a) => cats.includes(a.category) && a.placement !== 'top');
    return (match && list.find((a) => match.test(a.name))) ?? list.find((a) => a.placement === 'freestanding') ?? list[0];
  };
  const addAppliance = (cats: ApplianceCategory[], match?: RegExp) => {
    const a = pickAppliance(cats, match);
    if (a) addGroup(applianceGroup(a));
  };
  const addOpening = (kind: RoomOpening['kind']) => {
    up((q) => q.room && q.room.openings.push(newOpening(kind, wall, q.room)));
    onAdded(null, 'openings');
  };
  const addKitchen = (shape: RunShape) => {
    const r = createRun(shape);
    // a kitchen goes into the room's first corner; the room plan does that when it has no position yet
    up((q) => q.runs.push(r));
    onAdded(r.id);
  };
  const island = (sides: IslandSides) => addGroup(islandGroup({ width: 2400, depth: sides === 1 ? 900 : 1000, height: 900, sides, countertopId: catalog.countertops[0]?.id ?? null, seatingOverhang: 300 }));

  const groups: { title: string; entries: Entry[] }[] = [
    {
      title: `In the wall – ${wallName(room, wall)}`,
      entries: [
        { label: 'Door', act: () => addOpening('door') },
        { label: 'Window', act: () => addOpening('window') },
        { label: 'Opening / arch', hint: 'open plan, with or without a beam', act: () => addOpening('opening') },
      ],
    },
    {
      title: 'Appliances',
      entries: [
        { label: 'Fridge', act: () => addAppliance(['fridge'], /top freezer|double/i) },
        { label: 'Chest freezer', act: () => addAppliance(['fridge'], /chest/i) },
        { label: 'Stove / cooker', act: () => addAppliance(['cooker']) },
        { label: 'Microwave', act: () => addAppliance(['microwave'], /counter/i) },
        { label: 'Dishwasher', act: () => addAppliance(['dishwasher'], /free/i) },
        { label: 'Washing machine', act: () => addAppliance(['washer'], /front/i) },
        { label: 'Top-loader', act: () => addAppliance(['washer'], /top/i) },
        { label: 'Tumble dryer', act: () => addAppliance(['washer'], /dryer/i) },
        { label: 'Bin', act: () => addAppliance(['other'], /bin/i) },
        { label: 'TV', act: () => addAppliance(['other'], /tv/i) },
      ],
    },
    {
      title: 'Kitchen',
      entries: [
        { label: 'Straight kitchen', act: () => addKitchen('straight') },
        { label: 'L-shape kitchen', act: () => addKitchen('L') },
        { label: 'U-shape kitchen', act: () => addKitchen('U') },
        { label: 'Island – 4 sides', act: () => island(4) },
        { label: 'Island – 2 sides', act: () => island(2) },
        { label: 'Island – 1 side', act: () => island(1) },
        { label: 'Base cabinet', act: () => addUnit('kitchen_base') },
        { label: 'Wall cabinet', act: () => addUnit('kitchen_wall') },
        { label: 'Tall / pantry', act: () => addUnit('kitchen_tall') },
        { label: 'Corner base', act: () => addUnit('corner_base') },
        { label: 'Corner wall', act: () => addUnit('corner_wall') },
      ],
    },
    {
      title: 'Bedroom, lounge & more',
      entries: [
        { label: 'Wardrobe', act: () => addUnit('wardrobe') },
        { label: 'Sliding wardrobe', act: () => addUnit('sliding_wardrobe') },
        { label: 'BIC (built-in cupboard)', act: () => addUnit('built_in') },
        { label: 'TV stand', act: () => addUnit('tv_stand') },
        { label: 'Display / bookshelf', act: () => addUnit('bookshelf') },
        { label: 'Vanity', act: () => addUnit('vanity') },
        { label: 'Custom unit', act: () => addUnit('custom') },
        { label: 'Custom group (several cabinets)', act: () => addGroup(newAssembly('Custom unit (several cabinets)')) },
      ],
    },
  ];

  return (
    <Card title="Add to the room">
      <div className="space-y-3">
        <p className="text-xs text-stone-500">Each item lands in the middle of the room and is added to the quotation. Drag it into place on the plan, turn it, or push it against a wall below.</p>
        <label className="flex items-center gap-2 text-xs">
          <span className="font-semibold text-stone-600">Doors & windows go in</span>
          <select className="input w-auto py-1 text-xs" value={wall} onChange={(e) => setWall(Number(e.target.value) as WallSide)}>
            {room.walls.map((_, i) => (
              <option key={i} value={i}>
                {wallName(room, i)}
              </option>
            ))}
          </select>
        </label>
        {groups.map((g) => (
          <div key={g.title}>
            <div className="label">{g.title}</div>
            <div className="flex flex-wrap gap-1.5">
              {g.entries.map((e) => (
                <button key={e.label} title={e.hint} className="rounded-xl border border-stone-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-stone-700 hover:border-brand-500 hover:text-brand-700" onClick={e.act}>
                  + {e.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
