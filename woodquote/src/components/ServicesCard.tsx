// Services and other non-design items on a quotation: installation, delivery,
// site measure, plumbing… picked from your saved price list or typed in.
import { Plus, Trash2 } from 'lucide-react';
import { useMoney } from '../hooks';
import type { Quote } from '../lib/types';
import { uid } from '../lib/util';
import { useStore } from '../store';
import { Card, NumInput } from './ui';

export default function ServicesCard({ quote, up, className }: { quote: Quote; up: (fn: (q: Quote) => void) => void; className?: string }) {
  const services = useStore((s) => s.settings.services ?? []);
  const fmt = useMoney();
  const total = quote.extras.reduce((s, e) => s + e.qty * e.unitPrice, 0);
  return (
    <Card title="Services & other items" className={className} actions={<span className="text-sm font-bold tabular-nums">{fmt(total)}</span>}>
      <div className="space-y-2">
        {!quote.extras.length && <p className="text-sm text-stone-500">Charge for anything that is not designed: installation, delivery, site measure, plumbing or electrical connections, removal of old cabinets, painting…</p>}
        {quote.extras.map((e, i) => (
          <div key={e.id} className="grid grid-cols-[1fr_76px_64px_100px_auto] items-center gap-2">
            <input className="input" placeholder="Description" value={e.description} onChange={(ev) => up((q) => (q.extras[i].description = ev.target.value))} />
            <NumInput value={e.qty} min={0} onChange={(v) => up((q) => (q.extras[i].qty = v))} />
            <input className="input px-2 text-xs" placeholder="unit" value={e.unit ?? ''} onChange={(ev) => up((q) => (q.extras[i].unit = ev.target.value))} />
            <NumInput value={e.unitPrice} min={0} onChange={(v) => up((q) => (q.extras[i].unitPrice = v))} />
            <button className="btn-ghost px-2 text-red-600" onClick={() => up((q) => q.extras.splice(i, 1))} aria-label="Remove">
              <Trash2 size={16} />
            </button>
          </div>
        ))}
        <div className="flex flex-wrap gap-2 pt-1">
          <select
            className="input w-auto flex-1 py-1.5 text-sm"
            value=""
            aria-label="Add a service"
            onChange={(ev) => {
              const s = services.find((x) => x.id === ev.target.value);
              if (s) up((q) => q.extras.push({ id: uid('x'), description: s.name, qty: 1, unitPrice: s.price, unit: s.unit }));
            }}
          >
            <option value="">+ Add a service from your price list…</option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} – {fmt(s.price)} per {s.unit}
              </option>
            ))}
          </select>
          <button className="btn-secondary px-3 py-1.5 text-sm" onClick={() => up((q) => q.extras.push({ id: uid('x'), description: '', qty: 1, unitPrice: 0, unit: '' }))}>
            <Plus size={14} /> Other item
          </button>
        </div>
        <p className="text-[11px] text-stone-500">Prices here are charged as entered (no markup). Edit your saved services in Settings › Material pricing hub › Services.</p>
      </div>
    </Card>
  );
}
