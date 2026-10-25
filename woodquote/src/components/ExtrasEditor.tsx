// Priced add-ons for a section: pick from a saved list (pendants, chandeliers,
// transport, rubble removal…) or type your own. Charged as entered.
import { Plus, Trash2 } from 'lucide-react';
import { useMoney } from '../hooks';
import type { ExtraLine, PresetItem } from '../lib/types';
import { uid } from '../lib/util';
import { Card, NumInput } from './ui';

export default function ExtrasEditor({ title, hint, lines, presets, onChange, accent }: { title: string; hint: string; lines: ExtraLine[]; presets: PresetItem[]; onChange: (fn: (l: ExtraLine[]) => void) => void; accent?: string }) {
  const fmt = useMoney();
  const total = lines.reduce((s, e) => s + e.qty * e.unitPrice, 0);
  return (
    <Card title={title} actions={<span className="text-sm font-bold tabular-nums">{fmt(total)}</span>}>
      <div className="space-y-2">
        {!lines.length && <p className="text-sm text-stone-500">{hint}</p>}
        {lines.map((e, i) => (
          <div key={e.id} className="grid grid-cols-[1fr_72px_60px_96px_auto] items-center gap-2">
            <input className="input" placeholder="Description" value={e.description} onChange={(ev) => onChange((l) => (l[i].description = ev.target.value))} />
            <NumInput value={e.qty} min={0} onChange={(v) => onChange((l) => (l[i].qty = v))} />
            <input className="input px-2 text-xs" placeholder="unit" value={e.unit ?? ''} onChange={(ev) => onChange((l) => (l[i].unit = ev.target.value))} />
            <NumInput value={e.unitPrice} min={0} onChange={(v) => onChange((l) => (l[i].unitPrice = v))} />
            <button className="btn-ghost px-2 text-red-600" onClick={() => onChange((l) => l.splice(i, 1))} aria-label="Remove">
              <Trash2 size={16} />
            </button>
          </div>
        ))}
        <div className="flex flex-wrap gap-2 pt-1">
          <select
            className="input w-auto flex-1 py-1.5 text-sm"
            value=""
            aria-label={`Add to ${title}`}
            onChange={(ev) => {
              const p = presets.find((x) => x.id === ev.target.value);
              if (p) onChange((l) => l.push({ id: uid('x'), description: p.name, qty: 1, unitPrice: p.price, unit: p.unit }));
            }}
          >
            <option value="">+ Add from your list…</option>
            {presets.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} – {fmt(p.price)} per {p.unit}
              </option>
            ))}
          </select>
          <button className="btn-secondary px-3 py-1.5 text-sm" style={accent ? { color: accent } : undefined} onClick={() => onChange((l) => l.push({ id: uid('x'), description: '', qty: 1, unitPrice: 0, unit: 'item' }))}>
            <Plus size={14} /> Custom item
          </button>
        </div>
      </div>
    </Card>
  );
}
