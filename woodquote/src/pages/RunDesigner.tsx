import { ArrowLeft, ArrowRight, Copy, Pencil, Plus, Ruler, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { uid } from '../lib/util';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Card, confirmAction, Field, Modal, NumInput, PageHeader, Select, Tabs, TextInput } from '../components/ui';
import { usePageShortcuts } from '../app/shortcuts';
import Viewer3D from '../components/Viewer3D';
import ApplianceSelect from '../components/ApplianceSelect';
import { useMoney, useQuoteCalc } from '../hooks';
import { activeLegs, retypeModule, cornerOwner, setCornerOwner, applyRunMaterials, CUSTOM_KINDS, customModule, ensureLegs, fillerHeight, legRemaining, BASE_TEMPLATES, type CustomKind, type CustomSpec, baseModule, GAP_TEMPLATES, gapModule, LEG_LABELS, legLength, RUN_SHAPE_LABELS, runUnits, setWallTemplate, syncRun, TALL_TEMPLATES, tallModule, WALL_TEMPLATES, type BaseTemplate, type GapTemplate, type TallTemplate, type WallTemplate } from '../lib/runs';
import type { Catalog, Run, RunModule, RunShape } from '../lib/types';
import { useStore } from '../store';

type Tab = 'layout' | 'module' | 'settings';

/** Front elevation strip of one wall of the kitchen. */
function LegStrip({ run, leg, catalog, selected, onSelect }: { run: Run; leg: number; catalog: Catalog; selected: string | null; onSelect: (id: string) => void }) {
  const mods = run.legs[leg];
  const target = run.targets?.[leg] ?? 0;
  const L = Math.max(600, legLength(mods), target);
  const H = Math.max(run.tallHeight, run.wallBottom + run.wallHeight, ...mods.map((m) => Math.max(m.height ?? 0, m.wall ? (m.wallBottom ?? run.wallBottom) + (m.wallHeight || run.wallHeight) : 0))) + 100;
  const firstFront = run.legs.flat().find((m) => m.base)?.base?.frontMaterialId;
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
                <rect x={x0} y={Y(m.height || run.counterHeight)} width={m.width} height={(m.height || run.counterHeight) - run.plinthHeight} fill={front(m.base.frontMaterialId)} stroke={stroke} strokeWidth={sw} />
                <rect x={x0} y={Y(run.plinthHeight)} width={m.width} height={run.plinthHeight} fill="#8f8a83" />
              </>
            )}
            {m.kind === 'tall' && m.base && <rect x={x0} y={Y(m.height || run.tallHeight)} width={m.width} height={m.height || run.tallHeight} fill={front(m.base.frontMaterialId)} stroke={stroke} strokeWidth={sw} />}
            {m.kind === 'gap' && <rect x={x0} y={Y(m.height || run.counterHeight + 900)} width={m.width} height={m.height || run.counterHeight + 900} fill="#f5f5f4" stroke={stroke} strokeWidth={sw} strokeDasharray="40 20" />}
            {m.kind === 'filler' && <rect x={x0} y={Y(fillerHeight(m, run, 30))} width={m.width} height={fillerHeight(m, run, 30)} fill={front(firstFront)} stroke={stroke} strokeWidth={sw} />}
            {m.wall && <rect x={x0} y={Y((m.wallBottom ?? run.wallBottom) + (m.wallHeight || run.wallHeight))} width={m.width} height={m.wallHeight || run.wallHeight} fill={front(m.wall.frontMaterialId)} stroke={stroke} strokeWidth={sw} />}
            {m.hoodId && <path d={`M${x0 + m.width * 0.15} ${Y((m.wallBottom ?? run.wallBottom) + 100)} h${m.width * 0.7} l-${m.width * 0.2} -${300} h-${m.width * 0.3} z`} fill="#b5b9be" stroke="#555" strokeWidth={4} />}
            <text x={x0 + m.width / 2} y={Y(0) + fs * 1.4} fontSize={fs} textAnchor="middle" fill="#57534e">
              {m.width}
            </text>
            <text x={x0 + m.width / 2} y={Y(m.kind === 'tall' ? run.tallHeight / 2 : run.counterHeight / 2)} fontSize={fs * 0.9} textAnchor="middle" fill="#1c1917" fontWeight={700}>
              {m.kind === 'gap' || m.kind === 'filler' ? (m.gapLabel || 'Gap').split(' ').slice(-1)[0] : (m.base?.name ?? '').replace(/^(Base|Tall) – /, '').split(' ')[0]}
            </text>
          </g>
        );
      })}
      {mods.length > 0 && <line x1={0} x2={legLength(mods)} y1={Y(run.counterHeight)} y2={Y(run.counterHeight)} stroke="#26262a" strokeWidth={14} />}
      {target > 0 && (
        <g>
          <rect x={0} y={Y(H - 100)} width={target} height={H - 100} fill="none" stroke={legLength(mods) > target ? '#dc2626' : '#16a34a'} strokeWidth={10} strokeDasharray="60 30" />
          <text x={target} y={Y(H - 100) - 15} fontSize={fs} textAnchor="end" fill={legLength(mods) > target ? '#dc2626' : '#16a34a'} fontWeight={700}>
            space {target} mm
          </text>
        </g>
      )}
    </svg>
  );
}

const modName = (m: RunModule) => (m.kind === 'gap' || m.kind === 'filler' ? m.gapLabel || (m.kind === 'filler' ? 'Filler' : 'Gap') : (m.base?.name ?? '').replace(/^(Base|Tall) – /, ''));

/** Insert a cabinet, space or filler of any size at any position along a wall. */
function InsertDialog({ run, leg, at, onClose, onInsert }: { run: Run; leg: number; at: number; onClose: () => void; onInsert: (leg: number, at: number, spec: CustomSpec) => void }) {
  const remaining = legRemaining(run, leg);
  const [spec, setSpec] = useState<CustomSpec>({ kind: 'base', width: remaining && remaining > 0 ? remaining : 600, height: null, depth: null, front: 'doors', label: '', wallHeight: null, wallBottom: null });
  const [pos, setPos] = useState(at);
  const [wallAbove, setWallAbove] = useState(false);
  const mods = run.legs[leg];
  const hDefault = spec.kind === 'tall' ? run.tallHeight : spec.kind === 'base' ? run.counterHeight : spec.kind === 'wall' ? run.wallHeight : run.counterHeight;
  const set = (p: Partial<CustomSpec>) => setSpec({ ...spec, ...p });
  return (
    <Modal
      open
      onClose={onClose}
      title="Insert a custom cabinet or space"
      footer={
        <button
          className="btn-primary w-full"
          onClick={() => {
            onInsert(leg, pos, { ...spec, wallHeight: spec.kind === 'wall' ? spec.height : wallAbove ? spec.wallHeight || run.wallHeight : null, height: spec.kind === 'wall' ? null : spec.height, wallAbove } as CustomSpec & { wallAbove: boolean });
            onClose();
          }}
        >
          <Plus size={16} /> Insert {spec.width} mm {CUSTOM_KINDS[spec.kind].split(' (')[0].toLowerCase()}
        </button>
      }
    >
      <div className="space-y-3">
        <Field label="What goes here">
          <select className="input" value={spec.kind} onChange={(e) => set({ kind: e.target.value as CustomKind })}>
            {(Object.keys(CUSTOM_KINDS) as CustomKind[]).map((k) => (
              <option key={k} value={k}>
                {CUSTOM_KINDS[k]}
              </option>
            ))}
          </select>
        </Field>
        <div className="grid grid-cols-3 gap-2">
          <Field label="Width">
            <NumInput value={spec.width} min={1} suffix="mm" onChange={(v) => set({ width: v })} />
          </Field>
          <Field label={spec.kind === 'wall' ? 'Cabinet height' : 'Height'}>
            <NumInput value={spec.height ?? hDefault} min={1} suffix="mm" onChange={(v) => set({ height: v === hDefault ? null : v })} />
          </Field>
          {spec.kind !== 'wall' && spec.kind !== 'space' && spec.kind !== 'appliance' && (
            <Field label="Depth">
              <NumInput value={spec.depth ?? run.baseDepth} min={1} suffix="mm" onChange={(v) => set({ depth: v === run.baseDepth ? null : v })} />
            </Field>
          )}
          {spec.kind === 'wall' && (
            <Field label="Underside height">
              <NumInput value={spec.wallBottom ?? run.wallBottom} min={0} suffix="mm" onChange={(v) => set({ wallBottom: v })} />
            </Field>
          )}
        </div>
        {remaining != null && (
          <button className="btn-secondary w-full text-xs" disabled={remaining <= 0} onClick={() => set({ width: Math.max(1, remaining) })}>
            <Ruler size={14} /> Use the space left on this wall ({remaining} mm)
          </button>
        )}
        {(spec.kind === 'base' || spec.kind === 'tall' || spec.kind === 'wall') && (
          <Field label="Fronts">
            <select className="input" value={spec.front} onChange={(e) => set({ front: e.target.value as CustomSpec['front'] })}>
              <option value="doors">Double door</option>
              <option value="door">Single door</option>
              {spec.kind === 'base' && <option value="drawers">Drawers</option>}
              <option value="open">Open shelves</option>
            </select>
          </Field>
        )}
        {(spec.kind === 'base' || spec.kind === 'space' || spec.kind === 'appliance') && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={wallAbove} onChange={(e) => setWallAbove(e.target.checked)} /> Wall cabinet above
          </label>
        )}
        {spec.kind === 'appliance' && (
          <Field label="Appliance">
            <ApplianceSelect value={spec.applianceId ?? null} none="Choose later" onChange={(v) => set({ applianceId: v })} filter={(a) => a.placement === 'freestanding' && a.category !== 'hood'} />
          </Field>
        )}
        <Field label="Label (optional)">
          <TextInput value={spec.label ?? ''} onChange={(v) => set({ label: v })} />
        </Field>
        <Field label="Position">
          <select className="input" value={pos} onChange={(e) => setPos(Number(e.target.value))}>
            <option value={0}>At the start of the {LEG_LABELS[leg].toLowerCase()}</option>
            {mods.map((m, i) => (
              <option key={m.id} value={i + 1}>
                After {i + 1}. {modName(m)} ({m.width} mm)
              </option>
            ))}
          </select>
        </Field>
        <p className="text-xs text-stone-500">Any size is allowed. A base cabinet with a different height gets its own top instead of the shared worktop; a filler panel up to worktop height sits under the worktop.</p>
      </div>
    </Modal>
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
  const [inserting, setInserting] = useState<{ leg: number; at: number } | null>(null);
  const keys = usePageShortcuts();

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
  const insertCustom = (leg: number, at: number, spec: CustomSpec & { wallAbove?: boolean }) =>
    up((r) => {
      const m = customModule(spec, r);
      if (spec.wallAbove && m.kind !== 'tall' && m.kind !== 'filler' && !m.wall) setWallTemplate(m, spec.front === 'open' ? 'open' : 'doors', r);
      r.legs[leg].splice(Math.min(at, r.legs[leg].length), 0, m);
      setSelected(m.id);
    });
  const flat = run.legs.slice(0, nLegs).flatMap((l, leg) => l.map((m, i) => ({ leg, i, m })));
  const step = (d: number) => {
    const k = flat.findIndex((f) => f.m.id === selected);
    const n = flat[Math.max(0, Math.min(flat.length - 1, k < 0 ? 0 : k + d))];
    if (n) setSelected(n.m.id);
  };
  const move = (d: number) => {
    if (!sel) return false;
    const j = sel.i + d;
    if (j < 0 || j >= run.legs[sel.leg].length) return;
    up((r) => {
      const l = r.legs[sel.leg];
      [l[j], l[sel.i]] = [l[sel.i], l[j]];
    });
  };
  keys.current = {
    prev: () => step(-1),
    next: () => step(1),
    moveLeft: () => move(-1),
    moveRight: () => move(1),
    delete: () => sel && confirmAction('Remove this cabinet from the kitchen?') && (up((r) => r.legs[sel.leg].splice(sel.i, 1)), setSelected(null)),
    insert: () => setInserting({ leg: sel?.leg ?? 0, at: sel ? sel.i + 1 : run.legs[0].length }),
    duplicate: () =>
      sel &&
      up((r) => {
        const c = JSON.parse(JSON.stringify(r.legs[sel.leg][sel.i])) as RunModule;
        c.id = uid('m');
        if (c.base) c.base.id = uid('u');
        if (c.wall) c.wall.id = uid('u');
        r.legs[sel.leg].splice(sel.i + 1, 0, c);
        setSelected(c.id);
      }),
    edit: () => (sel?.m.base ? nav(`/quotes/${quote.id}/units/${sel.m.base.id}`) : sel ? setTab('module') : false),
  };

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
          {tab === 'layout' && nLegs > 1 && (
            <Card title="Corners – which wall runs into the corner">
              <div className="grid gap-3 md:grid-cols-2">
                {(nLegs > 2 ? (['left', 'right'] as const) : (['right'] as const)).map((side) => {
                  const owner = cornerOwner(run, side);
                  const sideName = side === 'right' ? 'Right wall' : 'Left wall';
                  const chip = (o: 'back' | 'side', label: string) => (
                    <button className={`flex-1 rounded-xl border px-3 py-2 text-xs font-semibold ${owner === o ? 'border-brand-600 bg-brand-600 text-white' : 'border-stone-300 bg-white text-stone-700'}`} onClick={() => up((r) => setCornerOwner(r, side, o))}>
                      {label}
                    </button>
                  );
                  return (
                    <div key={side} className="rounded-xl border border-stone-200 p-2">
                      <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                        <svg viewBox="0 0 40 40" className="h-8 w-8">
                          {side === 'right' ? (
                            <>
                              <path d={owner === 'back' ? 'M4 8h32' : 'M4 8h22'} stroke="#7c2d12" strokeWidth={5} />
                              <path d={owner === 'back' ? 'M32 14v22' : 'M32 6v30'} stroke="#a8a29e" strokeWidth={5} />
                            </>
                          ) : (
                            <>
                              <path d={owner === 'back' ? 'M4 8h32' : 'M14 8h22'} stroke="#7c2d12" strokeWidth={5} />
                              <path d={owner === 'back' ? 'M8 14v22' : 'M8 6v30'} stroke="#a8a29e" strokeWidth={5} />
                            </>
                          )}
                        </svg>
                        {side === 'right' ? 'Back-right corner' : 'Back-left corner'}
                      </div>
                      <div className="flex gap-2">
                        {chip('back', 'Back wall goes in')}
                        {chip('side', `${sideName} goes in`)}
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="mt-2 text-xs text-stone-500">The wall that goes into the corner runs right up to it; the other wall starts after the corner. A corner cupboard moves with it and turns to suit.</p>
            </Card>
          )}
          {tab === 'layout' &&
            run.legs.slice(0, nLegs).map((mods, leg) => (
              <Card
                key={leg}
                title={`${LEG_LABELS[leg]} · ${legLength(mods)} mm`}
                actions={
                  <div className="flex items-center gap-1 text-xs">
                    <span className="text-stone-500">Measured space</span>
                    <NumInput className="w-28" value={run.targets?.[leg] ?? 0} min={0} suffix="mm" onChange={(v) => up((r) => { r.targets = [...(r.targets ?? [null, null, null])]; r.targets[leg] = v > 0 ? v : null; })} />
                  </div>
                }
              >
                {legRemaining(run, leg) != null && (
                  <div className={`mb-2 flex items-center justify-between rounded-xl px-3 py-1.5 text-xs font-semibold ${legRemaining(run, leg)! < 0 ? 'bg-red-50 text-red-700' : legRemaining(run, leg) === 0 ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-900'}`}>
                    <span>{legRemaining(run, leg)! < 0 ? `${-legRemaining(run, leg)!} mm too long for the space` : legRemaining(run, leg) === 0 ? 'Fills the space exactly' : `${legRemaining(run, leg)} mm left to fill`}</span>
                    {legRemaining(run, leg)! > 0 && (
                      <span className="flex gap-1">
                        <button className="btn-secondary px-2 py-1 text-[11px]" onClick={() => setInserting({ leg, at: mods.length })}>
                          Fill with…
                        </button>
                        <button className="btn-secondary px-2 py-1 text-[11px]" onClick={() => insertCustom(leg, mods.length, { kind: legRemaining(run, leg)! < 150 ? 'filler' : 'base', width: legRemaining(run, leg)!, height: null, depth: null, front: legRemaining(run, leg)! > 500 ? 'doors' : 'door' })}>
                          Auto-fill
                        </button>
                      </span>
                    )}
                  </div>
                )}
                <LegStrip run={run} leg={leg} catalog={catalog} selected={selected} onSelect={(mid) => setSelected(mid)} />
                <div className="no-scrollbar mt-2 flex gap-2 overflow-x-auto pb-1">
                  {mods.map((m, i) => (
                    <div key={m.id} className="flex shrink-0 items-stretch gap-1">
                      <button className="rounded-lg border border-dashed border-stone-300 px-1 text-stone-400 hover:border-brand-500 hover:text-brand-700" title="Insert a custom cabinet or space here" aria-label={`Insert before ${i + 1}`} onClick={() => setInserting({ leg, at: i })}>
                        <Plus size={12} />
                      </button>
                      <button onClick={() => (setSelected(m.id), setTab('module'))} className={`rounded-xl border px-3 py-2 text-left text-xs ${selected === m.id ? 'border-brand-600 bg-brand-50' : 'border-stone-300 bg-white'}`}>
                        <div className="font-bold">
                          {i + 1}. {modName(m)}
                        </div>
                        <div className="text-stone-500">
                          {m.width}mm{m.height ? ` × ${m.height}h` : ''} · {m.kind === 'gap' ? 'space' : m.kind}
                          {m.wall ? ' + wall' : ''}
                          {m.hoodId ? ' + hood' : ''}
                        </div>
                      </button>
                    </div>
                  ))}
                  <button className="shrink-0 rounded-xl border border-dashed border-stone-300 px-3 text-xs font-semibold text-stone-500 hover:border-brand-500 hover:text-brand-700" onClick={() => setInserting({ leg, at: mods.length })}>
                    <Plus size={14} className="inline" /> Custom
                  </button>
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
                      <button className="btn-secondary px-2 py-1.5" aria-label="Duplicate" title="Duplicate (Ctrl+D)" onClick={() => keys.current.duplicate?.()}>
                        <Copy size={14} />
                      </button>
                      <button className="btn-danger px-2 py-1.5" aria-label="Remove" onClick={() => confirmAction('Remove this cabinet from the kitchen?') && (up((r) => r.legs[sel.leg].splice(sel.i, 1)), setSelected(null))}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  }
                >
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-1">
                      <span className="text-[11px] font-semibold text-stone-500">Switch to:</span>
                      {(
                        [
                          ['base', 'Base cabinet'],
                          ['tall', 'Tall cabinet'],
                          ['gap', 'Open space'],
                          ['filler', 'Filler'],
                        ] as const
                      ).map(([k, label]) => (
                        <button key={k} className={`rounded-full px-2.5 py-1 text-xs font-semibold ${sel.m.kind === k ? 'bg-brand-600 text-white' : 'bg-stone-100 text-stone-700 hover:bg-stone-200'}`} onClick={() => up((r) => retypeModule(findMod(r, sel.m.id)!.m, k, r))}>
                          {label}
                        </button>
                      ))}
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <Field label="Width">
                        <NumInput value={sel.m.width} min={1} suffix="mm" onChange={(v) => up((r) => (findMod(r, sel.m.id)!.m.width = Math.max(1, v)))} />
                      </Field>
                      <Field label={sel.m.kind === 'gap' ? 'Space height' : 'Height'}>
                        <NumInput value={sel.m.height || (sel.m.kind === 'tall' ? run.tallHeight : sel.m.kind === 'gap' ? run.counterHeight + 900 : sel.m.kind === 'filler' ? fillerHeight(sel.m, run, 30) : run.counterHeight)} min={1} suffix="mm" onChange={(v) => up((r) => (findMod(r, sel.m.id)!.m.height = v))} />
                      </Field>
                      {(sel.m.kind === 'base' || sel.m.kind === 'tall' || sel.m.kind === 'filler') && (
                        <Field label="Depth">
                          <NumInput value={sel.m.depth || run.baseDepth} min={1} suffix="mm" onChange={(v) => up((r) => (findMod(r, sel.m.id)!.m.depth = v === r.baseDepth ? null : v))} />
                        </Field>
                      )}
                    </div>
                    {sel.m.wall && (
                      <div className="grid grid-cols-3 gap-2">
                        <Field label="Wall unit height">
                          <NumInput value={sel.m.wallHeight || run.wallHeight} min={1} suffix="mm" onChange={(v) => up((r) => (findMod(r, sel.m.id)!.m.wallHeight = v === r.wallHeight ? null : v))} />
                        </Field>
                        <Field label="Wall unit underside">
                          <NumInput value={sel.m.wallBottom ?? run.wallBottom} min={0} suffix="mm" onChange={(v) => up((r) => (findMod(r, sel.m.id)!.m.wallBottom = v === r.wallBottom ? null : v))} />
                        </Field>
                        <Field label="Wall unit depth">
                          <NumInput value={sel.m.wallDepth || run.wallDepth} min={1} suffix="mm" onChange={(v) => up((r) => (findMod(r, sel.m.id)!.m.wallDepth = v === r.wallDepth ? null : v))} />
                        </Field>
                      </div>
                    )}
                    {(sel.m.height || sel.m.depth || sel.m.wallHeight || sel.m.wallBottom != null || sel.m.wallDepth) && (
                      <button className="btn-ghost px-2 py-1 text-xs" onClick={() => up((r) => Object.assign(findMod(r, sel.m.id)!.m, { height: null, depth: null, wallHeight: null, wallBottom: null, wallDepth: null }))}>
                        Use the kitchen's standard sizes again
                      </button>
                    )}
                    {sel.m.kind === 'gap' && !sel.m.wall && (
                      <button className="btn-secondary w-full text-xs" onClick={() => up((r) => setWallTemplate(findMod(r, sel.m.id)!.m, 'doors', r))}>
                        <Plus size={14} /> Add a wall cabinet above this space
                      </button>
                    )}
                    {sel.m.base?.corner && (
                      <div className="grid grid-cols-2 gap-2 rounded-xl bg-brand-50 p-2">
                        <Field label="Width B (along the next wall)">
                          <NumInput value={sel.m.cornerB || sel.m.base.corner.widthB} min={1} suffix="mm" onChange={(v) => up((r) => (findMod(r, sel.m.id)!.m.cornerB = Math.max(1, v)))} />
                        </Field>
                        <Field label="Corner style">
                          <select className="input" value={sel.m.base.corner.style} onChange={(e) => up((r) => { const m = findMod(r, sel.m.id)!.m; m.base!.corner!.style = e.target.value as 'L' | 'diagonal'; if (m.wall?.corner) m.wall.corner.style = m.base!.corner!.style; })}>
                            <option value="L">L – two doors</option>
                            <option value="diagonal">Diagonal – one door</option>
                          </select>
                        </Field>
                        <p className="col-span-2 text-xs text-stone-600">Width above is Width A along this wall. The cupboard above becomes a matching corner wall cupboard.</p>
                      </div>
                    )}
                    {sel.m.kind === 'base' && (
                      <>
                        <Field label="Base design (replaces the cabinet)">
                          <select className="input" value="" onChange={(e) => e.target.value && up((r) => { const f = findMod(r, sel.m.id)!; const nm = baseModule(e.target.value as BaseTemplate, r, 'none', f.m.width); f.m.base = nm.base; f.m.cornerB = nm.cornerB; })}>
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
                    {sel.m.kind === 'filler' && (
                      <Field label="Label">
                        <TextInput value={sel.m.gapLabel} onChange={(v) => up((r) => (findMod(r, sel.m.id)!.m.gapLabel = v))} />
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
                    {sel.m.kind !== 'tall' && sel.m.kind !== 'filler' && (
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
      {inserting && <InsertDialog run={run} leg={inserting.leg} at={inserting.at} onClose={() => setInserting(null)} onInsert={insertCustom} />}
    </div>
  );
}
