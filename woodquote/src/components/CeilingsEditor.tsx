// Ceilings section of a quotation: one card per room (rhinoboard or PVC),
// designs, lights and renovation work, add-ons, and what to buy.
import { ChevronDown, Copy, Layers, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { tradeMeta } from '../app/brand';
import { useMoney } from '../hooks';
import { CEILING_SYSTEMS, ceilingArea, ceilingChoices, ceilingPerimeter, newCeilingArea, newCeilingJob, setCeilingSystem } from '../lib/ceilings';
import type { QuoteCalc } from '../lib/pricing';
import type { CeilingArea, CeilingJob, CeilingSystem, Quote } from '../lib/types';
import { deepClone, round2, uid } from '../lib/util';
import { useStore } from '../store';
import ExtrasEditor from './ExtrasEditor';
import TradeSummary from './TradeSummary';
import { Card, confirmAction, Field, NumInput, OptNumInput, Select, TextInput, Toggle } from './ui';

const meta = tradeMeta('ceilings');

function AreaCard({ a, i, open, onToggle, up, sell }: { a: CeilingArea; i: number; open: boolean; onToggle: () => void; up: (fn: (a: CeilingArea, job: CeilingJob) => void) => void; sell: number }) {
  const catalog = useStore((s) => s.catalog);
  const designs = useStore((s) => s.settings.ceilingDesigns ?? []);
  const fmt = useMoney();
  const opt = (kind: Parameters<typeof ceilingChoices>[1]) => ceilingChoices(catalog, kind, a.system).map((p) => ({ value: p.id, label: `${p.name} – ${fmt(p.price)}/${p.unit}` }));
  const A = round2(ceilingArea(a));
  return (
    <div className="card overflow-hidden">
      <button className="flex w-full items-center gap-3 p-3 text-left" onClick={onToggle}>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold" style={{ background: meta.soft, color: meta.ink }}>
          {i + 1}
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold">{a.name || 'Room'}</div>
          <div className="truncate text-xs text-stone-500">
            {a.system === 'rhino' ? 'Rhinoboard' : 'PVC'} · {A} m² · {round2(ceilingPerimeter(a))} m perimeter
          </div>
        </div>
        <span className="font-bold tabular-nums">{fmt(sell)}</span>
        <ChevronDown size={18} className={`text-stone-400 transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="space-y-3 border-t border-stone-100 p-3">
          <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
            <Field label="Room">
              <TextInput value={a.name} onChange={(v) => up((x) => (x.name = v))} />
            </Field>
            <div>
              <span className="label">Ceiling type</span>
              <div className="flex gap-1 rounded-xl bg-stone-100 p-1">
                {(Object.keys(CEILING_SYSTEMS) as CeilingSystem[]).map((s) => (
                  <button key={s} className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${a.system === s ? 'bg-white shadow' : 'text-stone-600'}`} onClick={() => up((x) => setCeilingSystem(x, s, catalog))}>
                    {s === 'rhino' ? 'Rhinoboard' : 'PVC'}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Field label="Length">
              <NumInput value={a.length} min={100} suffix="mm" onChange={(v) => up((x) => (x.length = v))} />
            </Field>
            <Field label="Width">
              <NumInput value={a.width} min={100} suffix="mm" onChange={(v) => up((x) => (x.width = v))} />
            </Field>
            <Field label="Area (odd shapes)">
              <OptNumInput value={a.area} min={0} suffix="m²" placeholder={String(round2((a.length * a.width) / 1e6))} onChange={(v) => up((x) => (x.area = v))} />
            </Field>
            <Field label="Perimeter">
              <OptNumInput value={a.perimeter} min={0} suffix="m" placeholder={String(round2((2 * (a.length + a.width)) / 1000))} onChange={(v) => up((x) => (x.perimeter = v))} />
            </Field>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <Field label={a.system === 'rhino' ? 'Board' : 'PVC strip (colour)'}>
              <Select value={a.boardId} onChange={(v) => up((x) => (x.boardId = v))} options={opt(a.system === 'rhino' ? 'board' : 'pvc')} />
            </Field>
            <Field label={a.system === 'rhino' ? 'Cornice' : 'Wall trim / cornice'}>
              <Select value={a.corniceId} allowNone="None" onChange={(v) => up((x) => (x.corniceId = v))} options={opt(['cornice', 'trim'])} />
            </Field>
            <Field label="Brandering">
              <Select value={a.branderingId} allowNone="None (existing)" onChange={(v) => up((x) => (x.branderingId = v))} options={opt('brandering')} />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Brandering centres">
                <NumInput value={a.branderingSpacing} min={200} max={1200} step={50} suffix="mm" onChange={(v) => up((x) => (x.branderingSpacing = v))} />
              </Field>
              <Field label="Truss centres">
                <NumInput value={a.trussSpacing} min={300} max={2000} step={10} suffix="mm" onChange={(v) => up((x) => (x.trussSpacing = v))} />
              </Field>
            </div>
            {a.system === 'rhino' && (
              <>
                <Field label="Paint">
                  <Select value={a.paintId} allowNone="Not painted" onChange={(v) => up((x) => (x.paintId = v))} options={opt('paint')} />
                </Field>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Colour">
                    <TextInput value={a.colour} onChange={(v) => up((x) => (x.colour = v))} />
                  </Field>
                  <Field label="Coats">
                    <NumInput value={a.coats} min={0} max={5} step={1} onChange={(v) => up((x) => (x.coats = Math.round(v)))} />
                  </Field>
                </div>
              </>
            )}
            <Field label="Insulation">
              <Select value={a.insulationId} allowNone="None" onChange={(v) => up((x) => (x.insulationId = v))} options={opt('insulation')} />
            </Field>
            <Field label="Light cut-outs (downlights)">
              <NumInput value={a.downlights} min={0} step={1} onChange={(v) => up((x) => (x.downlights = Math.round(v)))} />
            </Field>
          </div>
          <Toggle label="Renovation – remove the old ceiling first" checked={a.demolish} onChange={(v) => up((x) => (x.demolish = v))} />

          <div>
            <span className="label">Designs (bulkheads, trays, shadow lines, LED coves…)</span>
            <div className="space-y-2">
              {a.designs.map((d, k) => (
                <div key={d.id} className="grid grid-cols-[1fr_72px_56px_92px_auto] items-center gap-2">
                  <input className="input" value={d.name} onChange={(e) => up((x) => (x.designs[k].name = e.target.value))} />
                  <NumInput value={d.qty} min={0} onChange={(v) => up((x) => (x.designs[k].qty = v))} />
                  <input className="input px-2 text-xs" value={d.unit} onChange={(e) => up((x) => (x.designs[k].unit = e.target.value))} />
                  <NumInput value={d.price} min={0} onChange={(v) => up((x) => (x.designs[k].price = v))} />
                  <button className="btn-ghost px-2 text-red-600" aria-label="Remove design" onClick={() => up((x) => x.designs.splice(k, 1))}>
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
              <select
                className="input py-1.5 text-sm"
                value=""
                aria-label="Add a design"
                onChange={(e) => {
                  const d = designs.find((x) => x.id === e.target.value);
                  if (d) up((x) => x.designs.push({ id: uid('cd'), name: d.name, qty: d.unit === 'item' ? 1 : round2(d.unit === 'm²' ? ceilingArea(x) : ceilingPerimeter(x)), unit: d.unit, price: d.price }));
                }}
              >
                <option value="">+ Add a design feature…</option>
                {designs.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} – {fmt(d.price)} per {d.unit}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <Field label="Notes (shown on the quotation)">
            <TextInput value={a.notes} onChange={(v) => up((x) => (x.notes = v))} />
          </Field>
          <div className="flex justify-end gap-2">
            <button className="btn-secondary px-3 py-1.5 text-sm" onClick={() => up((_x, job) => job.areas.splice(i + 1, 0, { ...deepClone(a), id: uid('ca'), name: `${a.name} (copy)` }))}>
              <Copy size={14} /> Copy room
            </button>
            <button className="btn-danger px-3 py-1.5 text-sm" onClick={() => confirmAction(`Remove ${a.name}?`) && up((_x, job) => job.areas.splice(i, 1))}>
              <Trash2 size={14} /> Remove
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function CeilingsEditor({ quote, calc, up }: { quote: Quote; calc: QuoteCalc; up: (fn: (q: Quote) => void) => void }) {
  const settings = useStore((s) => s.settings);
  const catalog = useStore((s) => s.catalog);
  const [open, setOpen] = useState<string | null>(quote.ceilings?.areas[0]?.id ?? null);
  const job = quote.ceilings;
  const upJob = (fn: (j: CeilingJob) => void) =>
    up((q) => {
      q.ceilings ??= newCeilingJob(settings);
      fn(q.ceilings);
    });
  const add = (system: CeilingSystem) => {
    const a = newCeilingArea(catalog, system, `Room ${(job?.areas.length ?? 0) + 1}`);
    upJob((j) => j.areas.push(a));
    setOpen(a.id);
  };
  const c = calc.ceilings;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="mr-auto flex items-center gap-2 text-lg font-semibold">
          <Layers size={20} style={{ color: meta.accent }} /> Ceilings
        </h2>
        <button className="btn-primary" style={{ background: meta.accent }} onClick={() => add('rhino')}>
          <Plus size={16} /> Rhinoboard room
        </button>
        <button className="btn-secondary" onClick={() => add('pvc')}>
          <Plus size={16} /> PVC room
        </button>
      </div>
      {!job?.areas.length && (
        <div className="card p-6 text-center text-sm text-stone-500">Add a room to quote its ceiling: size, rhinoboard or PVC, brandering, cornice, paint, designs and lights. Everything to buy is worked out for you.</div>
      )}
      {job?.areas.map((a, i) => (
        <AreaCard
          key={a.id}
          a={a}
          i={i}
          open={open === a.id}
          onToggle={() => setOpen(open === a.id ? null : a.id)}
          sell={c?.areas.find((x) => x.id === a.id)?.sell ?? 0}
          up={(fn) =>
            upJob((j) => {
              const x = j.areas.find((y) => y.id === a.id);
              if (x) fn(x, j);
            })
          }
        />
      ))}
      {job && (
        <div className="grid grid-cols-2 gap-2 sm:max-w-sm">
          <Field label="Markup (ceilings)">
            <NumInput value={job.markupPercent} min={0} suffix="%" onChange={(v) => upJob((j) => (j.markupPercent = v))} />
          </Field>
          <Field label="Waste allowance">
            <NumInput value={job.wastePercent} min={0} max={50} suffix="%" onChange={(v) => upJob((j) => (j.wastePercent = v))} />
          </Field>
        </div>
      )}
      <ExtrasEditor
        title="Ceiling add-ons & services"
        hint="Pendants, chandeliers, downlights, fans, transport, rubble removal, scaffolding or anything else."
        lines={job?.extras ?? []}
        presets={settings.ceilingExtras ?? []}
        accent={meta.accent}
        onChange={(fn) => upJob((j) => fn(j.extras))}
      />
      {c && <TradeSummary calc={c} accent={meta.accent} />}
      {!c && job && <Card title="Ceilings total">Add a room or an add-on to price the ceilings.</Card>}
    </div>
  );
}
