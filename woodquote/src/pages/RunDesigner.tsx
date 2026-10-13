import { ArrowLeft, ArrowRight, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Card, confirmAction, Field, NumInput, PageHeader, Select, Tabs, TextInput } from '../components/ui';
import Viewer3D from '../components/Viewer3D';
import ApplianceSelect from '../components/ApplianceSelect';
import { useMoney, useQuoteCalc } from '../hooks';
import { activeLegs, applyRunMaterials, ensureLegs, BASE_TEMPLATES, baseModule, GAP_TEMPLATES, gapModule, LEG_LABELS, legLength, RUN_SHAPE_LABELS, runUnits, setWallTemplate, syncRun, TALL_TEMPLATES, tallModule, WALL_TEMPLATES, type BaseTemplate, type GapTemplate, type TallTemplate, type WallTemplate } from '../lib/runs';
import type { Catalog, Run, RunModule, RunShape } from '../lib/types';
import { useStore } from '../store';

type Tab = 'layout' | 'module' | 'settings';

/** Front elevation strip of one wall of the kitchen. */
function LegStrip({ run, leg, catalog, selected, onSelect }: { run: Run; leg: number; catalog: Catalog; selected: string | null; onSelect: (id: string) => void }) {
  const mods = run.legs[leg];
  const L = Math.max(600, legLength(mods));
  const H = Math.max(run.tallHeight, run.wallBottom + run.wallHeight) + 100;
  const Y = (y: number) => H - y;
  const front = (id: string | null | undefined) => catalog.boards.find((b) => b.id === id)?.color ?? '#ddd';
  const fs = 70;
  const starts = mods.map((_, i) => mods.slice(0, i).reduce((a, m) => a + m.width, 0));
  return (
    <svg viewBox={`-40 -40 ${L + 80} ${H + 160}`} className="h-40 w-full">
      <line x1={-40} x2={L + 40} y1={Y(0)} y2={Y(0)} stroke="#a8a29e" strokeWidth={8} />
      {mods.map((m, mi) => {
        const x0 = starts[mi];
        const sel = selected === m.id;
        const stroke = sel ? '#ea580c' : '#444';
        const sw = sel ? 18 : 5;
        return (
          <g key={m.id} onClick={() => onSelect(m.id)} className="cursor-pointer">
            {m.kind === 'base' && m.base && (
              <>
                <rect x={x0} y={Y(run.counterHeight)} width={m.width} height={run.counterHeight - run.plinthHeight} fill={front(m.base.frontMaterialId)} stroke={stroke} strokeWidth={sw} />
                <rect x={x0} y={Y(run.plinthHeight)} width={m.width} height={run.plinthHeight} fill="#8f8a83" />
              </>
            )}
            {m.kind === 'tall' && m.base && <rect x={x0} y={Y(run.tallHeight)} width={m.width} height={run.tallHeight} fill={front(m.base.frontMaterialId)} stroke={stroke} strokeWidth={sw} />}
            {m.kind === 'gap' && <rect x={x0} y={Y(run.counterHeight + 900)} width={m.width} height={run.counterHeight + 900} fill="#f5f5f4" stroke={stroke} strokeWidth={sw} strokeDasharray="40 20" />}
            {m.wall && <rect x={x0} y={Y(run.wallBottom + run.wallHeight)} width={m.width} height={run.wallHeight} fill={front(m.wall.frontMaterialId)} stroke={stroke} strokeWidth={sw} />}
            {m.hoodId && <path d={`M${x0 + m.width * 0.15} ${Y(run.wallBottom + 100)} h${m.width * 0.7} l-${m.width * 0.2} -${300} h-${m.width * 0.3} z`} fill="#b5b9be" stroke="#555" strokeWidth={4} />}
            <text x={x0 + m.width / 2} y={Y(0) + fs * 1.4} fontSize={fs} textAnchor="middle" fill="#57534e">
              {m.width}
            </text>
            <text x={x0 + m.width / 2} y={Y(m.kind === 'tall' ? run.tallHeight / 2 : run.counterHeight / 2)} fontSize={fs * 0.9} textAnchor="middle" fill="#1c1917" fontWeight={700}>
              {m.kind === 'gap' ? (m.gapLabel || 'Gap').split(' ').slice(-1)[0] : (m.base?.name ?? '').replace(/^(Base|Tall) – /, '').split(' ')[0]}
            </text>
          </g>
        );
      })}
      {mods.length > 0 && <line x1={0} x2={L} y1={Y(run.counterHeight)} y2={Y(run.counterHeight)} stroke="#26262a" strokeWidth={14} />}
    </svg>
  );
}

export default function RunDesigner() {
  const { id = '', rid = '' } = useParams();
  const nav = useNavigate();
  const quote = useStore((s) => s.quotes.find((q) => q.id === id));
  const { updateQuote, catalog } = useStore();
  const calc = useQuoteCalc(quote);
  const fmt = useMoney();
  const [tab, setTab] = useState<Tab>('layout');
  const [selected, setSelected] = useState<string | null>(null);
  const [addKind, setAddKind] = useState<Record<number, string>>({});

  const run = quote?.runs.find((r) => r.id === rid);
  const item = calc?.items.find((i) => i.id === rid);
  if (!quote || !run || !item?.runBuild) return <PageHeader title="Kitchen not found" back />;

  const up = (fn: (r: Run) => void) =>
    updateQuote(quote.id, (q) => {
      const r = q.runs.find((x) => x.id === rid);
      if (!r) return;
      fn(r);
      syncRun(r, catalog);
    });
  const findMod = (r: Run, mid: string | null): { leg: number; i: number; m: RunModule } | null => {
    for (let leg = 0; leg < r.legs.length; leg++) {
      const i = r.legs[leg].findIndex((m) => m.id === mid);
      if (i >= 0) return { leg, i, m: r.legs[leg][i] };
    }
    return null;
  };
  const sel = findMod(run, selected);
  const selectUnit = (unitId: string | null) => {
    for (const leg of run.legs) for (const m of leg) if (m.base?.id === unitId || m.wall?.id === unitId) return setSelected(m.id);
  };
  const nLegs = activeLegs(run);
  const first = runUnits(run)[0];

  return (
    <div className="flex h-[100dvh] flex-col">
      <PageHeader
        title={run.name}
        subtitle={`${RUN_SHAPE_LABELS[run.shape]} · ${run.legs.slice(0, nLegs).map((l) => legLength(l)).join(' + ')} mm`}
        back={`/quotes/${quote.id}`}
        actions={
          <div className="text-right">
            <div className="text-sm font-bold tabular-nums">{fmt(item.sell)}</div>
            <div className="text-[11px] text-stone-500">cost {fmt(item.cost)}</div>
          </div>
        }
      />
      <div className="shrink-0 border-b border-stone-200 bg-stone-200">
        <Viewer3D catalog={catalog} run={run} runBuild={item.runBuild} selectedUnitId={sel?.m.base?.id ?? null} onPick={(p) => (selectUnit(p.unitId), setTab('module'))} className="h-[38vh] min-h-[240px] w-full md:h-[46vh]" />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {[...item.runBuild.extra.warnings, ...item.runBuild.pieces.flatMap((p) => p.build.warnings.map((w) => `${p.unit.name}: ${w}`))].slice(0, 4).map((w) => (
          <div key={w} className="bg-amber-50 px-4 py-1.5 text-xs text-amber-900">
            {w}
          </div>
        ))}
        <div className="sticky top-0 z-10 border-b border-stone-200 bg-stone-100/95 px-3 backdrop-blur">
          <div className="mx-auto max-w-5xl">
            <Tabs<Tab>
              value={tab}
              onChange={setTab}
              tabs={[
                { value: 'layout', label: 'Walls & cabinets' },
                { value: 'module', label: sel ? `Selected: ${(sel.m.base?.name ?? sel.m.gapLabel).replace(/^(Base|Tall) – /, '')}` : 'Selected cabinet' },
                { value: 'settings', label: 'Kitchen settings' },
              ]}
            />
          </div>
        </div>
        <div className="mx-auto max-w-5xl space-y-3 p-3">
          {tab === 'layout' &&
            run.legs.slice(0, nLegs).map((mods, leg) => (
              <Card key={leg} title={`${LEG_LABELS[leg]} · ${legLength(mods)} mm`}>
                <LegStrip run={run} leg={leg} catalog={catalog} selected={selected} onSelect={(mid) => setSelected(mid)} />
                <div className="no-scrollbar mt-2 flex gap-2 overflow-x-auto pb-1">
                  {mods.map((m, i) => (
                    <button key={m.id} onClick={() => (setSelected(m.id), setTab('module'))} className={`shrink-0 rounded-xl border px-3 py-2 text-left text-xs ${selected === m.id ? 'border-brand-600 bg-brand-50' : 'border-stone-300 bg-white'}`}>
                      <div className="font-bold">
                        {i + 1}. {m.kind === 'gap' ? m.gapLabel || 'Gap' : (m.base?.name ?? '').replace(/^(Base|Tall) – /, '')}
                      </div>
                      <div className="text-stone-500">
                        {m.width}mm · {m.kind}
                        {m.wall ? ' + wall' : ''}
                        {m.hoodId ? ' + hood' : ''}
                      </div>
                    </button>
                  ))}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2 border-t pt-2">
                  <select className="input w-auto flex-1" value={addKind[leg] ?? 'base:doors'} onChange={(e) => setAddKind({ ...addKind, [leg]: e.target.value })}>
                    <optgroup label="Base cabinet (floor + worktop)">
                      {(Object.keys(BASE_TEMPLATES) as BaseTemplate[]).map((k) => (
                        <option key={k} value={`base:${k}`}>
                          {BASE_TEMPLATES[k]}
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="Tall cabinet">
                      {(Object.keys(TALL_TEMPLATES) as TallTemplate[]).map((k) => (
                        <option key={k} value={`tall:${k}`}>
                          {TALL_TEMPLATES[k]}
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="Space / free-standing appliance">
                      {(Object.keys(GAP_TEMPLATES) as GapTemplate[]).map((k) => (
                        <option key={k} value={`gap:${k}`}>
                          {GAP_TEMPLATES[k]}
                        </option>
                      ))}
                    </optgroup>
                  </select>
                  <button
                    className="btn-primary"
                    onClick={() =>
                      up((r) => {
                        const [kind, tpl] = (addKind[leg] ?? 'base:doors').split(':');
                        const m = kind === 'base' ? baseModule(tpl as BaseTemplate, r) : kind === 'tall' ? tallModule(tpl as TallTemplate, r) : gapModule(tpl as GapTemplate, r);
                        const at = sel && sel.leg === leg ? sel.i + 1 : r.legs[leg].length;
                        r.legs[leg].splice(at, 0, m);
                        setSelected(m.id);
                      })
                    }
                  >
                    <Plus size={16} /> Add
                  </button>
                </div>
              </Card>
            ))}

          {tab === 'module' &&
            (sel ? (
              <div className="grid gap-3 md:grid-cols-2">
                <Card
                  title={`${LEG_LABELS[sel.leg]} – position ${sel.i + 1}`}
                  actions={
                    <div className="flex gap-1">
                      <button className="btn-secondary px-2 py-1.5" disabled={sel.i === 0} aria-label="Move left" onClick={() => up((r) => { const l = r.legs[sel.leg]; [l[sel.i - 1], l[sel.i]] = [l[sel.i], l[sel.i - 1]]; })}>
                        <ArrowLeft size={14} />
                      </button>
                      <button className="btn-secondary px-2 py-1.5" disabled={sel.i === run.legs[sel.leg].length - 1} aria-label="Move right" onClick={() => up((r) => { const l = r.legs[sel.leg]; [l[sel.i + 1], l[sel.i]] = [l[sel.i], l[sel.i + 1]]; })}>
                        <ArrowRight size={14} />
                      </button>
                      <button className="btn-danger px-2 py-1.5" aria-label="Remove" onClick={() => confirmAction('Remove this cabinet from the kitchen?') && (up((r) => r.legs[sel.leg].splice(sel.i, 1)), setSelected(null))}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  }
                >
                  <div className="space-y-3">
                    <Field label="Width">
                      <NumInput value={sel.m.width} min={150} suffix="mm" onChange={(v) => up((r) => (findMod(r, sel.m.id)!.m.width = v))} />
                    </Field>
                    {sel.m.kind === 'base' && (
                      <>
                        <Field label="Base design (replaces the cabinet)">
                          <select className="input" value="" onChange={(e) => e.target.value && up((r) => { const f = findMod(r, sel.m.id)!; const nm = baseModule(e.target.value as BaseTemplate, r, 'none', f.m.width); f.m.base = nm.base; })}>
                            <option value="">Choose a new layout…</option>
                            {(Object.keys(BASE_TEMPLATES) as BaseTemplate[]).map((k) => (
                              <option key={k} value={k}>
                                {BASE_TEMPLATES[k]}
                              </option>
                            ))}
                          </select>
                        </Field>
                        <Field label="Above (wall mounted)">
                          <select className="input" value={sel.m.hoodId && !sel.m.wall ? 'hood' : sel.m.wall ? '' : 'none'} onChange={(e) => e.target.value && up((r) => setWallTemplate(findMod(r, sel.m.id)!.m, e.target.value as WallTemplate, r))}>
                            <option value="">{sel.m.wall ? `Current: ${sel.m.wall.name.replace('Wall – ', '')}` : 'Choose…'}</option>
                            {(Object.keys(WALL_TEMPLATES) as WallTemplate[]).map((k) => (
                              <option key={k} value={k}>
                                {WALL_TEMPLATES[k]}
                              </option>
                            ))}
                          </select>
                        </Field>
                      </>
                    )}
                    {sel.m.kind === 'tall' && (
                      <Field label="Tall design (replaces the cabinet)">
                        <select className="input" value="" onChange={(e) => e.target.value && up((r) => { const f = findMod(r, sel.m.id)!; f.m.base = tallModule(e.target.value as TallTemplate, r, f.m.width).base; })}>
                          <option value="">Choose a new layout…</option>
                          {(Object.keys(TALL_TEMPLATES) as TallTemplate[]).map((k) => (
                            <option key={k} value={k}>
                              {TALL_TEMPLATES[k]}
                            </option>
                          ))}
                        </select>
                      </Field>
                    )}
                    {sel.m.kind === 'gap' && (
                      <>
                        <Field label="Label">
                          <TextInput value={sel.m.gapLabel} onChange={(v) => up((r) => (findMod(r, sel.m.id)!.m.gapLabel = v))} />
                        </Field>
                        <Field label="Free-standing appliance">
                          <ApplianceSelect value={sel.m.gapApplianceId} none="Empty space" onChange={(v) => up((r) => (findMod(r, sel.m.id)!.m.gapApplianceId = v))} filter={(a) => a.placement === 'freestanding' && a.category !== 'hood'} />
                        </Field>
                      </>
                    )}
                    {sel.m.kind !== 'tall' && (
                      <Field label="Extractor hood above">
                        <ApplianceSelect value={sel.m.hoodId} none="No hood" onChange={(v) => up((r) => (findMod(r, sel.m.id)!.m.hoodId = v))} filter={(a) => a.category === 'hood'} />
                      </Field>
                    )}
                  </div>
                </Card>
                <Card title="Design in detail">
                  <div className="space-y-2">
                    {sel.m.base && (
                      <button className="btn-primary w-full justify-start" onClick={() => nav(`/quotes/${quote.id}/units/${sel.m.base!.id}`)}>
                        <Pencil size={16} /> Design {sel.m.kind === 'tall' ? 'tall' : 'base'} cabinet – fronts, hinges, drawers, sink / hob, lights
                      </button>
                    )}
                    {sel.m.wall && (
                      <button className="btn-secondary w-full justify-start" onClick={() => nav(`/quotes/${quote.id}/units/${sel.m.wall!.id}`)}>
                        <Pencil size={16} /> Design wall cabinet above
                      </button>
                    )}
                    <p className="text-xs text-stone-500">Each cabinet opens in the full designer: fronts, opening directions, inset or overlay, glass, pull-outs, appliances and lighting.</p>
                  </div>
                </Card>
              </div>
            ) : (
              <p className="p-6 text-center text-sm text-stone-500">Tap a cabinet on the 3D render or in “Walls & cabinets” to edit it.</p>
            ))}

          {tab === 'settings' && (
            <div className="grid gap-3 md:grid-cols-2">
              <Card title="Kitchen">
                <div className="space-y-3">
                  <Field label="Name on quotation">
                    <TextInput value={run.name} onChange={(v) => up((r) => (r.name = v))} />
                  </Field>
                  <Field label="Layout">
                    <Select<RunShape> value={run.shape} onChange={(v) => v && up((r) => ((r.shape = v), ensureLegs(r)))} options={(Object.keys(RUN_SHAPE_LABELS) as RunShape[]).map((k) => ({ value: k, label: RUN_SHAPE_LABELS[k] }))} />
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Quantity">
                      <NumInput value={run.qty} min={1} onChange={(v) => up((r) => (r.qty = Math.max(1, Math.round(v))))} />
                    </Field>
                    <Field label="Installation">
                      <Select value={run.installType} onChange={(v) => v && up((r) => (r.installType = v))} options={[{ value: 'builtIn', label: 'Built-in' }, { value: 'standalone', label: 'Standalone' }]} />
                    </Field>
                  </div>
                  <Field label="Worktop">
                    <Select value={run.countertopId} allowNone="No worktop" onChange={(v) => up((r) => (r.countertopId = v))} options={catalog.countertops.map((c) => ({ value: c.id, label: `${c.name} – ${fmt(c.pricePerSqm)}/m²` }))} />
                  </Field>
                  <Field label="Notes (shown on quotation)">
                    <TextInput multiline value={run.notes} onChange={(v) => up((r) => (r.notes = v))} />
                  </Field>
                </div>
              </Card>
              <Card title="Heights & depths">
                <div className="grid grid-cols-2 gap-3">
                  {(
                    [
                      ['counterHeight', 'Worktop height'],
                      ['counterOverhang', 'Worktop front overhang'],
                      ['baseDepth', 'Base depth'],
                      ['plinthHeight', 'Kick board height (0 = none)'],
                      ['wallBottom', 'Wall units – underside height'],
                      ['wallHeight', 'Wall unit height'],
                      ['wallDepth', 'Wall unit depth'],
                      ['tallHeight', 'Tall unit height'],
                    ] as const
                  ).map(([k, label]) => (
                    <Field key={k} label={label}>
                      <NumInput value={run[k]} min={0} suffix="mm" onChange={(v) => up((r) => (r[k] = v))} />
                    </Field>
                  ))}
                </div>
              </Card>
              <Card title="Apply to every cabinet" className="md:col-span-2">
                <div className="grid gap-3 md:grid-cols-2">
                  {(
                    [
                      ['carcassMaterialId', 'Carcass board', catalog.boards.map((b) => ({ value: b.id, label: b.name }))],
                      ['frontMaterialId', 'Door & drawer fronts', catalog.boards.map((b) => ({ value: b.id, label: `${b.name} (${b.finish})` }))],
                      ['handleId', 'Handles', catalog.accessories.filter((a) => a.category === 'handle').map((a) => ({ value: a.id, label: `${a.name} ${a.size}` }))],
                      ['hingeId', 'Hinges', catalog.accessories.filter((a) => a.category === 'hinge').map((a) => ({ value: a.id, label: `${a.name} ${a.size}` }))],
                      ['runnerId', 'Drawer runners', catalog.accessories.filter((a) => a.category === 'runner').map((a) => ({ value: a.id, label: `${a.family}: ${a.size}` }))],
                    ] as const
                  ).map(([key, label, options]) => (
                    <Field key={key} label={label}>
                      <Select value={first?.[key] ?? null} onChange={(v) => v && up((r) => applyRunMaterials(r, { [key]: v }))} options={options as { value: string; label: string }[]} />
                    </Field>
                  ))}
                </div>
              </Card>
              <div className="md:col-span-2">
                <Link to={`/quotes/${quote.id}`} className="btn-secondary w-full">
                  Back to quotation
                </Link>
              </div>
            </div>
          )}
          <div className="h-6" />
        </div>
      </div>
    </div>
  );
}
