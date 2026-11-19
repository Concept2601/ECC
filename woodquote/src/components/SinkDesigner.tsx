// Design a sink: width, depth, bowls and drainers, material, colour, mounting
// and tap. The preview is drawn from the same layout the 3D view and the
// drawings use. Saved to the appliance library so it can be reused and priced.
import { useState } from 'react';
import { SINK_LAYOUTS, SINK_MATERIALS, sinkSpec, sinkZones, tapX } from '../lib/sinks';
import type { Appliance, SinkSpec } from '../lib/types';
import { uid } from '../lib/util';
import { useStore } from '../store';
import { Field, Modal, NumInput, TextInput } from './ui';

export function SinkPreview({ spec, w, d }: { spec: SinkSpec; w: number; d: number }) {
  const base = spec.material === 'stainless' ? '#c9cdd2' : spec.color;
  const back = spec.mount === 'undermount' ? 10 : 35;
  const hh = d - back - (spec.mount === 'undermount' ? 10 : 30);
  const tx = tapX(spec, w);
  return (
    <svg viewBox={`-20 -60 ${w + 40} ${d + 80}`} className="h-40 w-full rounded-xl bg-stone-100">
      {spec.mount === 'undermount' ? <rect x={-15} y={-15} width={w + 30} height={d + 30} fill="#57534e" opacity={0.25} /> : <rect x={0} y={0} width={w} height={d} rx={18} fill={base} stroke="#6b7280" strokeWidth={3} />}
      {sinkZones(spec, w).map((z, k) =>
        z.kind === 'drainer' ? (
          <g key={k}>
            <rect x={z.x} y={back} width={z.w} height={hh} rx={14} fill="none" stroke="#6b7280" strokeWidth={3} />
            {Array.from({ length: Math.max(2, Math.floor(hh / 40)) }, (_, j) => (
              <line key={j} x1={z.x + 18} x2={z.x + z.w - 18} y1={back + ((j + 1) * hh) / (Math.max(2, Math.floor(hh / 40)) + 1)} y2={back + ((j + 1) * hh) / (Math.max(2, Math.floor(hh / 40)) + 1)} stroke="#9ca3af" strokeWidth={3} />
            ))}
          </g>
        ) : (
          <g key={k}>
            <rect x={z.x} y={back} width={z.w} height={hh} rx={30} fill={spec.material === 'stainless' ? '#8d949c' : base} stroke="#374151" strokeWidth={4} style={{ filter: 'brightness(0.8)' }} />
            <circle cx={z.x + z.w / 2} cy={back + hh * 0.55} r={Math.min(z.w, hh) * 0.08} fill="#1f2937" />
          </g>
        ),
      )}
      {tx != null && <circle cx={tx} cy={18} r={16} fill="#e5e7eb" stroke="#374151" strokeWidth={4} />}
      <text x={w / 2} y={-22} textAnchor="middle" fontSize={34} fill="#57534e">
        {w} × {d} mm
      </text>
    </svg>
  );
}

/** Edit an existing sink, or (base = null) make a new one. Returns the saved appliance id. */
export default function SinkDesigner({ open, onClose, base, onSaved }: { open: boolean; onClose: () => void; base: Appliance | null; onSaved?: (id: string) => void }) {
  const updateCatalog = useStore((s) => s.updateCatalog);
  const start = base ?? { id: '', category: 'sink' as const, name: 'Custom sink', variant: 'Custom', width: 1000, height: 200, depth: 500, price: 150, color: '#c9cdd2', placement: 'top' as const };
  const [a, setA] = useState<Appliance>({ ...start, sink: sinkSpec(start) });
  const spec = a.sink!;
  const setSpec = (p: Partial<SinkSpec>) => setA((x) => ({ ...x, sink: { ...x.sink!, ...p } }));
  const save = () => {
    const id = a.id || uid('ap-sink-');
    updateCatalog((c) => {
      const i = c.appliances.findIndex((x) => x.id === id);
      const next = { ...a, id, variant: SINK_LAYOUTS.find((l) => l.value === spec.layout)?.label ?? 'Custom' };
      if (i >= 0) c.appliances[i] = next;
      else c.appliances.push(next);
    });
    onSaved?.(id);
    onClose();
  };
  return (
    <Modal open={open} onClose={onClose} title={base ? `Edit ${base.name}` : 'Custom sink'}>
      <div className="space-y-3">
        <SinkPreview spec={spec} w={a.width} d={a.depth} />
        <Field label="Name">
          <TextInput value={a.name} onChange={(v) => setA({ ...a, name: v })} />
        </Field>
        <div className="grid grid-cols-3 gap-2">
          <Field label="Width">
            <NumInput value={a.width} min={300} max={3000} suffix="mm" onChange={(v) => setA({ ...a, width: v })} />
          </Field>
          <Field label="Depth">
            <NumInput value={a.depth} min={300} max={1000} suffix="mm" onChange={(v) => setA({ ...a, depth: v })} />
          </Field>
          <Field label="Price">
            <NumInput value={a.price} min={0} onChange={(v) => setA({ ...a, price: v })} />
          </Field>
        </div>
        <Field label="Bowls and drainers (left to right)">
          <select className="input" value={spec.layout} onChange={(e) => setSpec({ layout: e.target.value })}>
            {SINK_LAYOUTS.map((l) => (
              <option key={l.value} value={l.value}>
                {l.label}
              </option>
            ))}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Material">
            <select className="input" value={spec.material} onChange={(e) => setSpec({ material: e.target.value as SinkSpec['material'], color: e.target.value === 'stainless' ? '#c9cdd2' : e.target.value === 'ceramic' ? '#f5f5f4' : '#2b2b2d' })}>
              {Object.entries(SINK_MATERIALS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </Field>
          {spec.material !== 'stainless' ? (
            <Field label="Colour">
              <input type="color" className="h-10 w-full rounded-xl border border-stone-300" value={spec.color} onChange={(e) => setSpec({ color: e.target.value })} />
            </Field>
          ) : (
            <div />
          )}
          <Field label="Fitting">
            <select className="input" value={spec.mount} onChange={(e) => setSpec({ mount: e.target.value as SinkSpec['mount'] })}>
              <option value="inset">Inset (sits on the worktop)</option>
              <option value="undermount">Undermount (under the worktop)</option>
            </select>
          </Field>
          <Field label="Tap">
            <select className="input" value={spec.tap} onChange={(e) => setSpec({ tap: e.target.value as SinkSpec['tap'] })}>
              <option value="centre">Behind the bowl</option>
              <option value="left">Left</option>
              <option value="right">Right</option>
              <option value="none">No tap</option>
            </select>
          </Field>
        </div>
        <p className="text-xs text-stone-500">Two sinks opposite each other (e.g. on both sides of an island): give each cabinet its own sink. On one wide cabinet, add a second sink in the cabinet designer’s Appliances tab and set its distance from the front.</p>
        <button className="btn-primary w-full" onClick={save}>
          {base ? 'Save sink' : 'Add sink'}
        </button>
      </div>
    </Modal>
  );
}
