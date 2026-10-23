import { useState } from 'react';
import { applianceGroup, ISLAND_SIDES, islandGroup, newAssembly, syncAssembly, type IslandSides } from '../lib/assembly';
import type { Assembly } from '../lib/types';
import { useStore } from '../store';
import ApplianceSelect from './ApplianceSelect';
import { Field, Modal, NumInput, Select } from './ui';

type Mode = 'island' | 'custom' | 'appliance';

/** Islands (four, two or one side), empty custom groups and loose free-standing appliances. */
export default function AddGroupModal({ open, onClose, onAdd, initial = 'island' }: { open: boolean; onClose: () => void; onAdd: (g: Assembly) => void; initial?: Mode }) {
  const catalog = useStore((s) => s.catalog);
  const [mode, setMode] = useState<Mode>(initial);
  const [sides, setSides] = useState<IslandSides>(4);
  const [size, setSize] = useState({ width: 2400, depth: 1000, height: 900, seating: 300 });
  const [top, setTop] = useState<string | null>(catalog.countertops[0]?.id ?? null);
  const [appl, setAppl] = useState<string | null>(catalog.appliances.find((a) => a.placement !== 'top')?.id ?? null);
  const add = () => {
    let g: Assembly | null = null;
    if (mode === 'island') g = islandGroup({ width: size.width, depth: size.depth, height: size.height, sides, countertopId: top, seatingOverhang: sides === 1 ? size.seating : 0 });
    else if (mode === 'custom') g = newAssembly('Custom unit (several cabinets)');
    else {
      const a = catalog.appliances.find((x) => x.id === appl);
      if (a) g = applianceGroup(a);
    }
    if (!g) return;
    syncAssembly(g, catalog);
    onAdd(g);
    onClose();
  };
  const tab = (m: Mode, label: string) => (
    <button className={`flex-1 rounded-lg px-2 py-1.5 text-sm font-semibold ${mode === m ? 'bg-white shadow' : 'text-stone-600'}`} onClick={() => setMode(m)}>
      {label}
    </button>
  );
  return (
    <Modal open={open} onClose={onClose} title="Add island or cabinet group">
      <div className="space-y-3">
        <div className="flex gap-1 rounded-xl bg-stone-100 p-1">
          {tab('island', 'Island')}
          {tab('custom', 'Custom group')}
          {tab('appliance', 'Loose appliance')}
        </div>
        {mode === 'island' && (
          <>
            <div className="grid grid-cols-3 gap-2">
              {ISLAND_SIDES.map((o) => (
                <button key={o.sides} className={`card p-2 text-left ${sides === o.sides ? 'border-brand-500 ring-2 ring-brand-200' : ''}`} onClick={() => setSides(o.sides)}>
                  <IslandIcon sides={o.sides} />
                  <div className="mt-1 text-sm font-bold">{o.label}</div>
                  <div className="text-[11px] leading-tight text-stone-500">{o.hint}</div>
                </button>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Field label="Length">
                <NumInput value={size.width} min={600} suffix="mm" onChange={(v) => setSize({ ...size, width: v })} />
              </Field>
              <Field label="Depth">
                <NumInput value={size.depth} min={300} suffix="mm" onChange={(v) => setSize({ ...size, depth: v })} />
              </Field>
              <Field label="Worktop height">
                <NumInput value={size.height} min={400} suffix="mm" onChange={(v) => setSize({ ...size, height: v })} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Worktop">
                <Select value={top} allowNone="No shared worktop" onChange={setTop} options={catalog.countertops.map((c) => ({ value: c.id, label: c.name }))} />
              </Field>
              {sides === 1 && (
                <Field label="Seating overhang at the back">
                  <NumInput value={size.seating} min={0} suffix="mm" onChange={(v) => setSize({ ...size, seating: v })} />
                </Field>
              )}
            </div>
            <p className="text-xs text-stone-500">Every cabinet can be moved, resized, turned to face any way or swapped afterwards.</p>
          </>
        )}
        {mode === 'custom' && <p className="text-sm text-stone-600">Starts empty. Add cabinets and appliances, place each one anywhere and turn it to face front, back, left, right or any angle. It is quoted as one item, e.g. a peninsula, a back-to-back display unit, a reception desk or a wall of mixed cabinets.</p>}
        {mode === 'appliance' && (
          <Field label="Appliance (fridge, cooker, washing machine, microwave, bin…)">
            <ApplianceSelect value={appl} none="Choose…" onChange={setAppl} filter={(a) => a.placement !== 'top'} />
          </Field>
        )}
        <button className="btn-primary w-full" onClick={add}>
          Add
        </button>
      </div>
    </Modal>
  );
}

export function IslandIcon({ sides }: { sides: IslandSides }) {
  const on = '#c2410c';
  const off = '#d6d3d1';
  return (
    <svg viewBox="0 0 60 36" className="h-9 w-full">
      <rect x="8" y="6" width="44" height="24" rx="2" fill="#f5f5f4" stroke="#a8a29e" />
      <line x1="10" y1="30" x2="50" y2="30" stroke={on} strokeWidth="4" />
      <line x1="10" y1="6" x2="50" y2="6" stroke={sides >= 2 ? on : off} strokeWidth="4" />
      <line x1="8" y1="8" x2="8" y2="28" stroke={sides === 4 ? on : off} strokeWidth="4" />
      <line x1="52" y1="8" x2="52" y2="28" stroke={sides === 4 ? on : off} strokeWidth="4" />
    </svg>
  );
}
