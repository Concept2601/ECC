// Measure a space: type in the width, height and depth of an opening or wall
// and see what fits, sized and priced, then turn it into a quote in one tap.
import { Check, CookingPot, Plus, Ruler, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Field, NumInput, PageHeader, TextInput } from '../components/ui';
import UnitThumb from '../components/UnitThumb';
import { useMoney } from '../hooks';
import { APPLIANCE_LABELS } from '../lib/types';
import { appliancesThatFit, fitAll, fitKitchen, usable, type Space } from '../lib/fit';
import { buildUnit } from '../lib/generate';
import { buildRun } from '../lib/runs';
import { calculateQuote } from '../lib/pricing';
import { PRODUCT_LABELS, PRODUCT_ORDER } from '../lib/presets';
import type { ProductType, Quote, Run, Unit } from '../lib/types';
import { useStore } from '../store';

type Want = ProductType | 'any' | 'kitchen';

export default function SpaceFit() {
  const nav = useNavigate();
  const { catalog, settings, quotes, createQuote, updateQuote } = useStore();
  const fmt = useMoney();
  const [sp, setSp] = useState<Space>({ width: 2400, height: 2400, depth: 600, sideGap: 5, topGap: 10 });
  const [want, setWant] = useState<Want>('any');
  const [target, setTarget] = useState<string>('new');
  const [client, setClient] = useState('');
  const set = (p: Partial<Space>) => setSp({ ...sp, ...p });
  const u = usable(sp);

  const fits = useMemo(() => (want === 'kitchen' ? [] : fitAll(sp, want)), [sp, want]);
  const kitchen = useMemo(() => (want === 'kitchen' || want === 'any' ? fitKitchen(sp) : null), [sp, want]);
  const appliances = useMemo(() => appliancesThatFit(catalog, sp), [catalog, sp]);
  // price each suggestion as if it were alone on a quote
  const price = useMemo(() => {
    const blank = { id: 'tmp', number: '', title: '', date: '', status: 'draft', client: { name: '', phone: '', email: '', address: '' }, extras: [], attachments: [], includeAppliances: true, room: null, transportId: null, transportCustom: 0, installation: false, markupPercent: settings.pricing.markupPercent, discountType: 'percent', discountValue: 0, applyTax: false, notes: '', sourceImage: null, createdAt: 0, updatedAt: 0 } as unknown as Quote;
    const one = (units: Unit[], runs: Run[]) => calculateQuote({ ...blank, units, runs }, catalog, settings).subtotal;
    return { unit: (x: Unit) => one([x], []), run: (r: Run) => one([], [r]) };
  }, [catalog, settings]);

  const addTo = (units: Unit[], runs: Run[], open?: string) => {
    let qid = target;
    if (target === 'new') qid = createQuote({ title: `Quick quote – ${sp.width} × ${sp.height} × ${sp.depth} mm`, client: { name: client, phone: '', email: '', address: '' } });
    updateQuote(qid, (q) => {
      q.units.push(...units);
      q.runs.push(...runs);
    });
    nav(open ? `/quotes/${qid}${open}` : `/quotes/${qid}`);
  };

  return (
    <div>
      <PageHeader title="Measure a space" subtitle="Quick quote: what fits and what to make" back />
      <div className="mx-auto max-w-5xl space-y-3 p-3">
        <Card title="The space">
          <div className="grid grid-cols-3 gap-3">
            <Field label="Width (wall length)">
              <NumInput value={sp.width} min={1} suffix="mm" onChange={(v) => set({ width: v })} />
            </Field>
            <Field label="Height">
              <NumInput value={sp.height} min={1} suffix="mm" onChange={(v) => set({ height: v })} />
            </Field>
            <Field label="Depth available">
              <NumInput value={sp.depth} min={1} suffix="mm" onChange={(v) => set({ depth: v })} />
            </Field>
            <Field label="Fitting gap each side">
              <NumInput value={sp.sideGap} min={0} suffix="mm" onChange={(v) => set({ sideGap: v })} />
            </Field>
            <Field label="Gap at the top">
              <NumInput value={sp.topGap} min={0} suffix="mm" onChange={(v) => set({ topGap: v })} />
            </Field>
            <Field label="What goes here">
              <select className="input" value={want} onChange={(e) => setWant(e.target.value as Want)}>
                <option value="any">Show everything that fits</option>
                <option value="kitchen">Kitchen along this wall</option>
                {PRODUCT_ORDER.map((t) => (
                  <option key={t} value={t}>
                    {PRODUCT_LABELS[t]}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="mt-3 rounded-xl bg-brand-50 p-3 text-sm text-brand-900">
            <Ruler size={14} className="mr-1 inline" /> Make it <b>{u.w} × {u.h} mm</b> (W × H), up to <b>{u.d} mm</b> deep. That leaves {sp.sideGap} mm each side and {sp.topGap} mm at the top for scribing and fitting{sp.sideGap ? '; cover the gaps with scribe strips or fillers' : ''}.
          </div>
        </Card>

        <Card title="Put it on">
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Quotation">
              <select className="input" value={target} onChange={(e) => setTarget(e.target.value)}>
                <option value="new">New quick quote</option>
                {quotes.slice(0, 30).map((q) => (
                  <option key={q.id} value={q.id}>
                    {q.number} · {q.title}
                  </option>
                ))}
              </select>
            </Field>
            {target === 'new' && (
              <Field label="Client name (optional)">
                <TextInput value={client} onChange={setClient} />
              </Field>
            )}
          </div>
        </Card>

        {kitchen && (
          <Card title="Kitchen that fills the wall">
            <div className="flex flex-col gap-3 md:flex-row md:items-center">
              <UnitThumb run={kitchen} runBuild={buildRun(kitchen, catalog, settings.pricing)} catalog={catalog} className="h-28 w-full md:w-56" />
              <div className="min-w-0 flex-1 text-sm">
                <div className="font-semibold">
                  {kitchen.legs[0].length} positions · {kitchen.legs[0].map((m) => m.width).join(' + ')} = {kitchen.legs[0].reduce((a, m) => a + m.width, 0)} mm
                </div>
                <div className="text-xs text-stone-500">Worktop height {kitchen.counterHeight} mm · base depth {kitchen.baseDepth} mm · tall {kitchen.tallHeight} mm. Every cabinet can be changed afterwards; the wall length is kept so the designer shows what is left.</div>
              </div>
              <div className="text-right">
                <div className="font-bold tabular-nums">{fmt(price.run(kitchen))}</div>
                <button className="btn-primary mt-1" onClick={() => addTo([], [kitchen], `/runs/${kitchen.id}`)}>
                  <CookingPot size={16} /> Use this kitchen
                </button>
              </div>
            </div>
          </Card>
        )}

        {fits.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {fits.map((f) => (
              <div key={f.type} className={`card flex flex-col gap-2 p-3 ${f.unit ? '' : 'opacity-60'}`}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-bold">{f.label}</div>
                    <div className="text-xs text-stone-500">{f.note}</div>
                  </div>
                  {f.unit && <div className="text-sm font-bold tabular-nums">{fmt(price.unit(f.unit))}</div>}
                </div>
                {f.unit && <UnitThumb unit={f.unit} build={buildUnit(f.unit, catalog, settings.pricing)} catalog={catalog} className="h-28 w-full" />}
                {f.unit && (
                  <div className="text-xs">
                    Sized to fit: <b>{f.unit.width} × {f.unit.height} × {f.unit.depth}</b> mm · {f.unit.bays.length} bay{f.unit.bays.length === 1 ? '' : 's'}
                  </div>
                )}
                <div className="flex items-center gap-1 text-xs text-stone-600">
                  {f.standard.fits ? <Check size={14} className="text-emerald-600" /> : <X size={14} className="text-red-500" />}
                  Standard {f.standard.w}×{f.standard.h}×{f.standard.d}
                  {f.standard.fits && f.standard.sideBySide > 1 ? ` · ${f.standard.sideBySide} side by side, ${f.standard.leftover} mm left` : ''}
                </div>
                {f.unit && (
                  <button className="btn-secondary mt-auto" onClick={() => addTo([f.unit!], [], `/units/${f.unit!.id}`)}>
                    <Plus size={16} /> Quote this size
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        <Card title={`Appliances that fit (${appliances.length})`}>
          {appliances.length ? (
            <div className="grid gap-1 text-sm sm:grid-cols-2">
              {appliances.map((a) => (
                <div key={a.id} className="flex justify-between gap-2 rounded-lg border border-stone-100 px-2 py-1">
                  <span className="truncate">
                    <span className="text-xs text-stone-500">{APPLIANCE_LABELS[a.category] ?? a.category} · </span>
                    {a.name}
                  </span>
                  <span className="shrink-0 text-xs tabular-nums text-stone-500">
                    {a.width}×{a.height}×{a.depth}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-stone-500">No appliance in the price library fits this space.</p>
          )}
        </Card>
      </div>
    </div>
  );
}
