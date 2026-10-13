import { Box, Columns2, Eye, EyeOff, Minus, PanelTop, Plus, RotateCcw, Rows2, Trash2 } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import ElevationEditor, { type Sel } from '../components/ElevationEditor';
import { Card, Field, NumInput, PageHeader, Select, Tabs, TextInput, Toggle } from '../components/ui';
import Viewer3D from '../components/Viewer3D';
import { useMoney, useQuoteCalc } from '../hooks';
import { elevation } from '../lib/generate';
import { PRODUCT_LABELS, PRODUCT_ORDER, sec } from '../lib/presets';
import { ACCESSORY_LABELS, type AccessoryCategory, type FrontKind, type ProductType, type Unit } from '../lib/types';
import { uid } from '../lib/util';
import { accessoryPacksLabel } from '../pdf/pdf';
import { useStore } from '../store';

type Tab = 'layout' | 'size' | 'materials' | 'hardware' | 'parts';

function Stepper({ value, onChange, min = 0, max = 20 }: { value: number; onChange: (v: number) => void; min?: number; max?: number }) {
  return (
    <div className="flex items-center rounded-xl border border-stone-300 bg-white">
      <button className="px-3 py-2" onClick={() => onChange(Math.max(min, value - 1))} aria-label="decrease">
        <Minus size={14} />
      </button>
      <span className="w-8 text-center font-semibold">{value}</span>
      <button className="px-3 py-2" onClick={() => onChange(Math.min(max, value + 1))} aria-label="increase">
        <Plus size={14} />
      </button>
    </div>
  );
}

function Swatch({ color }: { color?: string }) {
  return <span className="inline-block h-9 w-9 shrink-0 rounded-lg border border-stone-300" style={{ background: color ?? 'transparent' }} />;
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button onClick={onClick} className={`rounded-xl border px-3 py-2 text-sm font-semibold ${active ? 'border-brand-600 bg-brand-600 text-white' : 'border-stone-300 bg-white text-stone-700'}`}>
      {children}
    </button>
  );
}

export default function UnitDesigner() {
  const { id = '', uid: unitId = '' } = useParams();
  const quote = useStore((s) => s.quotes.find((q) => q.id === id));
  const { updateQuote, catalog } = useStore();
  const calc = useQuoteCalc(quote);
  const fmt = useMoney();
  const [tab, setTab] = useState<Tab>('layout');
  const [sel, setSel] = useState<Sel | null>({ bay: 0, section: 0 });
  const [view, setView] = useState<'3d' | '2d' | 'both'>(typeof window !== 'undefined' && window.innerWidth >= 900 ? 'both' : '3d');
  const [fronts, setFronts] = useState(true);
  const [extraAcc, setExtraAcc] = useState('');
  const [trace, setTrace] = useState(false);

  const ui = quote?.units.findIndex((u) => u.id === unitId) ?? -1;
  const unit = ui >= 0 ? quote!.units[ui] : undefined;
  const priced = calc?.units[ui];
  const elev = useMemo(() => (unit ? elevation(unit, catalog) : null), [unit, catalog]);

  if (!quote || !unit || !priced || !elev) return <PageHeader title="Unit not found" back />;

  const up = (fn: (u: Unit) => void) =>
    updateQuote(quote.id, (q) => {
      const u = q.units.find((x) => x.id === unitId);
      if (u) fn(u);
    });

  const s = sel && unit.bays[sel.bay]?.sections[sel.section] ? sel : null;
  const curBay = s ? unit.bays[s.bay] : null;
  const curSec = s ? unit.bays[s.bay].sections[s.section] : null;
  const bayMm = s ? Math.round(elev.bays[s.bay].w) : 0;
  const secMm = s ? Math.round(elev.bays[s.bay].sections[s.section].h) : 0;

  const setBayMm = (v: number) =>
    up((u) => {
      if (!s) return;
      elev.bays.forEach((b, i) => (u.bays[i].size = b.w));
      const n = s.bay < u.bays.length - 1 ? s.bay + 1 : s.bay - 1;
      if (n < 0) return;
      const total = elev.bays[s.bay].w + elev.bays[n].w;
      const nv = Math.min(total - 80, Math.max(80, v));
      u.bays[s.bay].size = nv;
      u.bays[n].size = total - nv;
    });
  const setSecMm = (v: number) =>
    up((u) => {
      if (!s) return;
      const eb = elev.bays[s.bay];
      eb.sections.forEach((x, j) => (u.bays[s.bay].sections[j].size = x.h));
      const n = s.section < eb.sections.length - 1 ? s.section + 1 : s.section - 1;
      if (n < 0) return;
      const total = eb.sections[s.section].h + eb.sections[n].h;
      const nv = Math.min(total - 80, Math.max(80, v));
      u.bays[s.bay].sections[s.section].size = nv;
      u.bays[s.bay].sections[n].size = total - nv;
    });
  const setFront = (front: FrontKind, doorCount: 1 | 2 = 1) =>
    up((u) => {
      if (!s) return;
      const x = u.bays[s.bay].sections[s.section];
      x.front = front;
      x.doorCount = doorCount;
      if (front === 'drawer' && x.drawerCount < 1) x.drawerCount = 1;
    });

  const accOptions = (cat: AccessoryCategory) => catalog.accessories.filter((a) => a.category === cat).map((a) => ({ value: a.id, label: `${a.name} ${a.size} – ${fmt(a.price)}` }));
  const boardOptions = catalog.boards.map((b) => ({ value: b.id, label: `${b.name} – ${fmt(b.pricePerSheet)}` }));

  const viewer = <Viewer3D unit={unit} build={priced.build} catalog={catalog} showFronts={fronts} className="h-full w-full" />;
  const editor = (
    <div className="h-full w-full bg-[#f7f5f2]">
      <ElevationEditor unit={unit} catalog={catalog} sel={s} onSelect={setSel} onChange={up} background={trace ? quote.sourceImage : null} />
    </div>
  );

  return (
    <div className="flex min-h-screen flex-col">
      <PageHeader
        title={unit.name}
        subtitle={`${PRODUCT_LABELS[unit.type]} · ${unit.width}×${unit.height}×${unit.depth}mm`}
        back={`/quotes/${quote.id}`}
        actions={
          <div className="text-right">
            <div className="text-sm font-bold tabular-nums">{fmt(priced.sell)}</div>
            <div className="text-[11px] text-stone-500">cost {fmt(priced.cost)}</div>
          </div>
        }
      />

      <div className="relative border-b border-stone-200 bg-stone-200">
        <div className={`grid ${view === 'both' ? 'md:grid-cols-2' : ''} h-[42vh] min-h-[260px] md:h-[50vh]`}>
          {(view === '3d' || view === 'both') && <div className={`${view === 'both' ? 'hidden md:block' : ''} h-full min-w-0`}>{viewer}</div>}
          {(view === '2d' || view === 'both') && <div className="h-full min-w-0">{editor}</div>}
        </div>
        <div className="absolute left-2 top-2 flex gap-1 rounded-xl bg-white/90 p-1 shadow">
          <Chip active={view === '3d'} onClick={() => setView('3d')}>
            <Box size={14} className="inline" /> 3D
          </Chip>
          <Chip active={view === '2d'} onClick={() => setView('2d')}>
            <PanelTop size={14} className="inline" /> Edit
          </Chip>
          <Chip active={view === 'both'} onClick={() => setView('both')}>
            <Columns2 size={14} className="inline" /> Both
          </Chip>
        </div>
        {quote.sourceImage && view !== '3d' && (
          <button className="btn-secondary absolute bottom-2 right-2 px-3 py-1.5 text-xs" onClick={() => setTrace(!trace)}>
            {trace ? 'Hide diagram' : 'Trace over diagram'}
          </button>
        )}
        {view !== '2d' && (
          <button className="btn-secondary absolute right-2 top-2 px-3 py-1.5 text-xs" onClick={() => setFronts(!fronts)}>
            {fronts ? <EyeOff size={14} /> : <Eye size={14} />} {fronts ? 'Hide doors' : 'Show doors'}
          </button>
        )}
      </div>

      {priced.build.warnings.length > 0 && <div className="bg-amber-50 px-4 py-2 text-xs text-amber-900">{priced.build.warnings.join(' ')}</div>}

      <div className="mx-auto w-full max-w-5xl flex-1 space-y-3 p-3">
        <Tabs<Tab>
          value={tab}
          onChange={setTab}
          tabs={[
            { value: 'layout', label: 'Layout' },
            { value: 'size', label: 'Size & type' },
            { value: 'materials', label: 'Materials' },
            { value: 'hardware', label: 'Hardware' },
            { value: 'parts', label: `Cut list (${priced.build.parts.reduce((a, p) => a + p.qty, 0)})` },
          ]}
        />

        {tab === 'layout' && (
          <div className="space-y-3">
            {view === '3d' && <p className="rounded-xl bg-sky-50 p-3 text-xs text-sky-900">Tip: switch to <b>Edit</b> to tap compartments and drag the blue / orange handles to resize bays and shelves.</p>}
            <Card
              title={s ? `Bay ${s.bay + 1} · compartment ${s.section + 1}` : 'Select a compartment'}
              actions={
                <div className="flex gap-1">
                  <button
                    className="btn-secondary px-2.5 py-1.5 text-xs"
                    onClick={() =>
                      up((u) => {
                        const i = s ? s.bay : u.bays.length - 1;
                        elev.bays.forEach((b, k) => (u.bays[k].size = b.w));
                        const half = u.bays[i].size / 2;
                        u.bays[i].size = half;
                        u.bays.splice(i + 1, 0, { id: uid('b'), size: half, sections: [sec({ front: 'door' })] });
                      })
                    }
                  >
                    <Columns2 size={14} /> Split bay
                  </button>
                  <button
                    className="btn-secondary px-2.5 py-1.5 text-xs"
                    disabled={!s}
                    onClick={() =>
                      up((u) => {
                        if (!s) return;
                        const b = u.bays[s.bay];
                        elev.bays[s.bay].sections.forEach((x, k) => (b.sections[k].size = x.h));
                        const half = b.sections[s.section].size / 2;
                        b.sections[s.section].size = half;
                        b.sections.splice(s.section + 1, 0, { ...sec({ front: b.sections[s.section].front }), size: half });
                      })
                    }
                  >
                    <Rows2 size={14} /> Split
                  </button>
                </div>
              }
            >
              {s && curSec && curBay ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Bay width (clear)">
                      <NumInput value={bayMm} suffix="mm" onChange={setBayMm} />
                    </Field>
                    <Field label="Compartment height">
                      <NumInput value={secMm} suffix="mm" onChange={setSecMm} />
                    </Field>
                  </div>
                  <div>
                    <span className="label">Front</span>
                    <div className="flex flex-wrap gap-2">
                      <Chip active={curSec.front === 'open'} onClick={() => setFront('open')}>Open</Chip>
                      <Chip active={curSec.front === 'door' && curSec.doorCount === 1} onClick={() => setFront('door', 1)}>Door</Chip>
                      <Chip active={curSec.front === 'door' && curSec.doorCount === 2} onClick={() => setFront('door', 2)}>2 doors</Chip>
                      <Chip active={curSec.front === 'glassDoor' && curSec.doorCount === 1} onClick={() => setFront('glassDoor', 1)}>Glass door</Chip>
                      <Chip active={curSec.front === 'glassDoor' && curSec.doorCount === 2} onClick={() => setFront('glassDoor', 2)}>2 glass doors</Chip>
                      <Chip active={curSec.front === 'drawer'} onClick={() => setFront('drawer')}>Drawers</Chip>
                      <Chip active={curSec.front === 'flap'} onClick={() => setFront('flap')}>Lift-up flap</Chip>
                    </div>
                    {unit.sliding.enabled && curSec.front !== 'drawer' && curSec.front !== 'open' && <p className="mt-1 text-xs text-amber-700">Sliding doors are on — hinged fronts in this unit are ignored.</p>}
                  </div>
                  <div className="flex flex-wrap items-center gap-6">
                    {curSec.front === 'drawer' && (
                      <Field label="Drawers">
                        <Stepper value={curSec.drawerCount} min={1} max={8} onChange={(v) => up((u) => (u.bays[s.bay].sections[s.section].drawerCount = v))} />
                      </Field>
                    )}
                    {curSec.front !== 'drawer' && (
                      <Field label="Adjustable shelves">
                        <Stepper value={curSec.shelves} max={12} onChange={(v) => up((u) => (u.bays[s.bay].sections[s.section].shelves = v))} />
                      </Field>
                    )}
                    {curSec.front !== 'drawer' && (
                      <div className="min-w-[180px]">
                        <Toggle label="Hanging rail" checked={curSec.hangingRail} onChange={(v) => up((u) => (u.bays[s.bay].sections[s.section].hangingRail = v))} />
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2 border-t pt-3">
                    <button
                      className="btn-danger px-3 py-1.5 text-xs"
                      disabled={curBay.sections.length < 2}
                      onClick={() => {
                        up((u) => {
                          const b = u.bays[s.bay];
                          const removed = b.sections.splice(s.section, 1)[0];
                          const n = Math.min(s.section, b.sections.length - 1);
                          b.sections[n].size += removed.size;
                        });
                        setSel({ bay: s.bay, section: Math.max(0, s.section - 1) });
                      }}
                    >
                      <Trash2 size={14} /> Merge compartment
                    </button>
                    <button
                      className="btn-danger px-3 py-1.5 text-xs"
                      disabled={unit.bays.length < 2}
                      onClick={() => {
                        up((u) => {
                          elev.bays.forEach((b, k) => (u.bays[k].size = b.w));
                          const removed = u.bays.splice(s.bay, 1)[0];
                          u.bays[Math.min(s.bay, u.bays.length - 1)].size += removed.size;
                        });
                        setSel({ bay: Math.max(0, s.bay - 1), section: 0 });
                      }}
                    >
                      <Trash2 size={14} /> Remove bay
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-stone-500">Tap a compartment in the editor to change its front, shelves and size.</p>
              )}
            </Card>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Width">
                <NumInput value={unit.width} min={200} suffix="mm" onChange={(v) => up((u) => (u.width = v))} />
              </Field>
              <Field label="Height">
                <NumInput value={unit.height} min={200} suffix="mm" onChange={(v) => up((u) => (u.height = v))} />
              </Field>
              <Field label="Depth">
                <NumInput value={unit.depth} min={100} suffix="mm" onChange={(v) => up((u) => (u.depth = v))} />
              </Field>
            </div>
          </div>
        )}

        {tab === 'size' && (
          <div className="grid gap-3 md:grid-cols-2">
            <Card title="Unit">
              <div className="space-y-3">
                <Field label="Name on quotation">
                  <TextInput value={unit.name} onChange={(v) => up((u) => (u.name = v))} />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Type">
                    <Select<ProductType> value={unit.type} onChange={(v) => v && up((u) => (u.type = v))} options={PRODUCT_ORDER.map((t) => ({ value: t, label: PRODUCT_LABELS[t] }))} />
                  </Field>
                  <Field label="Quantity">
                    <NumInput value={unit.qty} min={1} onChange={(v) => up((u) => (u.qty = Math.max(1, Math.round(v))))} />
                  </Field>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <Field label="Width">
                    <NumInput value={unit.width} min={200} suffix="mm" onChange={(v) => up((u) => (u.width = v))} />
                  </Field>
                  <Field label="Height">
                    <NumInput value={unit.height} min={200} suffix="mm" onChange={(v) => up((u) => (u.height = v))} />
                  </Field>
                  <Field label="Depth">
                    <NumInput value={unit.depth} min={100} suffix="mm" onChange={(v) => up((u) => (u.depth = v))} />
                  </Field>
                </div>
                <Field label="Notes (shown on quotation)">
                  <TextInput multiline value={unit.notes} onChange={(v) => up((u) => (u.notes = v))} />
                </Field>
                <Field label="Fixed labour price per unit (blank = use settings)">
                  <input
                    className="input"
                    inputMode="decimal"
                    value={unit.labourOverride ?? ''}
                    placeholder="Auto"
                    onChange={(e) => up((u) => (u.labourOverride = e.target.value === '' ? null : Number(e.target.value) || 0))}
                  />
                </Field>
              </div>
            </Card>
            <Card title="Base, top & doors">
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Base">
                    <Select value={unit.base} onChange={(v) => v && up((u) => { u.base = v; if (v !== 'none' && !u.baseHeight) u.baseHeight = 100; })} options={[{ value: 'none', label: 'None (wall hung / on floor)' }, { value: 'plinth', label: 'Plinth / kick board' }, { value: 'legs', label: 'Legs' }]} />
                  </Field>
                  <Field label="Base height">
                    <NumInput value={unit.baseHeight} min={0} suffix="mm" onChange={(v) => up((u) => (u.baseHeight = v))} />
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Countertop">
                    <Select value={unit.countertopId} allowNone="No countertop" onChange={(v) => up((u) => (u.countertopId = v))} options={catalog.countertops.map((c) => ({ value: c.id, label: `${c.name} – ${fmt(c.pricePerSqm)}/m²` }))} />
                  </Field>
                  <Field label={unit.type === 'island' ? 'Seating overhang (back)' : 'Front overhang'}>
                    <NumInput value={unit.countertopOverhang} min={0} suffix="mm" onChange={(v) => up((u) => (u.countertopOverhang = v))} />
                  </Field>
                </div>
                <Toggle label="Sliding doors" checked={unit.sliding.enabled} onChange={(v) => up((u) => (u.sliding.enabled = v))} />
                {unit.sliding.enabled && (
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Door panels">
                      <Stepper value={unit.sliding.panels} min={2} max={6} onChange={(v) => up((u) => (u.sliding.panels = v))} />
                    </Field>
                    <Field label="Door style">
                      <Select value={unit.sliding.style} onChange={(v) => v && up((u) => (u.sliding.style = v))} options={[{ value: 'board', label: 'Board (front material)' }, { value: 'glass', label: 'Aluminium + glass' }, { value: 'mirror', label: 'Aluminium + mirror' }]} />
                    </Field>
                  </div>
                )}
              </div>
            </Card>
          </div>
        )}

        {tab === 'materials' && (
          <div className="grid gap-3 md:grid-cols-2">
            <Card title="Boards">
              <div className="space-y-3">
                {(
                  [
                    ['Carcass (sides, shelves, drawer boxes)', 'carcassMaterialId'],
                    ['Fronts (doors & drawer fronts)', 'frontMaterialId'],
                  ] as const
                ).map(([label, key]) => (
                  <Field key={key} label={label}>
                    <div className="flex gap-2">
                      <Swatch color={catalog.boards.find((b) => b.id === unit[key])?.color} />
                      <Select value={unit[key]} onChange={(v) => v && up((u) => (u[key] = v))} options={boardOptions} />
                    </div>
                  </Field>
                ))}
                <Field label="Back panel & drawer bottoms">
                  <Select value={unit.backMaterialId} allowNone="No back panel" onChange={(v) => up((u) => (u.backMaterialId = v))} options={boardOptions} />
                </Field>
              </div>
            </Card>
            <Card title="Edging, glass & aluminium">
              <div className="space-y-3">
                <Field label="Carcass edge banding">
                  <Select value={unit.edgingId} allowNone="No edging" onChange={(v) => up((u) => (u.edgingId = v))} options={catalog.edging.map((e) => ({ value: e.id, label: `${e.name} – ${fmt(e.pricePerMeter)}/m` }))} />
                </Field>
                <Field label="Front edge banding">
                  <Select value={unit.frontEdgingId} allowNone="No edging (painted / wrapped)" onChange={(v) => up((u) => (u.frontEdgingId = v))} options={catalog.edging.map((e) => ({ value: e.id, label: `${e.name} – ${fmt(e.pricePerMeter)}/m` }))} />
                </Field>
                <Field label="Glass (glass doors / sliding glass)">
                  <Select value={unit.glassId} onChange={(v) => up((u) => (u.glassId = v))} options={catalog.glass.map((g) => ({ value: g.id, label: `${g.name} – ${fmt(g.pricePerSqm)}/m²` }))} />
                </Field>
                <Field label="Aluminium frame profile">
                  <Select value={unit.aluminiumId} onChange={(v) => up((u) => (u.aluminiumId = v))} options={catalog.aluminium.map((a) => ({ value: a.id, label: `${a.name} – ${fmt(a.pricePerLength)}/${a.stockLength / 1000}m` }))} />
                </Field>
              </div>
            </Card>
          </div>
        )}

        {tab === 'hardware' && (
          <div className="grid gap-3 md:grid-cols-2">
            <Card title="Choose fittings">
              <div className="space-y-3">
                {(
                  [
                    ['hinge', 'hingeId'],
                    ['runner', 'runnerId'],
                    ['handle', 'handleId'],
                    ['leg', 'legId'],
                    ['roller', 'rollerId'],
                    ['track', 'trackId'],
                    ['rail', 'railId'],
                    ['stay', 'stayId'],
                    ['screw', 'screwId'],
                    ['connector', 'connectorId'],
                    ['shelfPin', 'shelfPinId'],
                  ] as const
                ).map(([cat, key]) => (
                  <Field key={key} label={`${ACCESSORY_LABELS[cat]}${cat === 'runner' ? ' (auto-sized to depth)' : ''}`}>
                    <Select value={unit[key]} allowNone="None" onChange={(v) => up((u) => (u[key] = v))} options={accOptions(cat)} />
                  </Field>
                ))}
              </div>
            </Card>
            <Card title="Hardware list (per unit)">
              <div className="divide-y divide-stone-100">
                {priced.build.hardware.map((h) => {
                  const a = catalog.accessories.find((x) => x.id === h.accessoryId);
                  const overridden = unit.hardwareOverrides[h.key] !== undefined;
                  const isExtra = h.key.startsWith('x:');
                  return (
                    <div key={h.key} className="flex items-center gap-2 py-2">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{a ? `${a.name} ${a.size}` : h.accessoryId}</div>
                        <div className="text-xs text-stone-500">
                          {h.reason} · {accessoryPacksLabel(catalog, h.accessoryId, h.qty * unit.qty)}
                        </div>
                      </div>
                      <div className="w-20">
                        <NumInput
                          value={h.qty}
                          min={0}
                          onChange={(v) =>
                            up((u) => {
                              if (isExtra) {
                                const e = u.extraHardware.find((x) => `x:${x.id}` === h.key);
                                if (e) e.qty = v;
                              } else u.hardwareOverrides[h.key] = v;
                            })
                          }
                        />
                      </div>
                      {overridden && (
                        <button className="btn-ghost px-1.5" title="Reset to automatic" onClick={() => up((u) => delete u.hardwareOverrides[h.key])}>
                          <RotateCcw size={14} />
                        </button>
                      )}
                      {isExtra && (
                        <button className="btn-ghost px-1.5 text-red-600" onClick={() => up((u) => (u.extraHardware = u.extraHardware.filter((x) => `x:${x.id}` !== h.key)))}>
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="mt-3 flex gap-2 border-t pt-3">
                <select className="input" value={extraAcc} onChange={(e) => setExtraAcc(e.target.value)}>
                  <option value="">Add accessory…</option>
                  {catalog.accessories.map((a) => (
                    <option key={a.id} value={a.id}>
                      {ACCESSORY_LABELS[a.category]}: {a.name} {a.size}
                    </option>
                  ))}
                </select>
                <button className="btn-primary px-3" disabled={!extraAcc} onClick={() => { up((u) => u.extraHardware.push({ id: uid('h'), accessoryId: extraAcc, qty: 1 })); setExtraAcc(''); }}>
                  <Plus size={16} />
                </button>
              </div>
            </Card>
          </div>
        )}

        {tab === 'parts' && (
          <div className="space-y-3">
            <div className="card overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-stone-50 text-xs uppercase text-stone-500">
                  <tr>
                    <th className="px-3 py-2">Part</th>
                    <th className="px-2 py-2 text-right">L</th>
                    <th className="px-2 py-2 text-right">W</th>
                    <th className="px-2 py-2 text-right">T</th>
                    <th className="px-2 py-2 text-right">Qty</th>
                    <th className="px-3 py-2">Material</th>
                    <th className="px-2 py-2 text-right">Edge m</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {priced.build.parts.map((p) => (
                    <tr key={p.key}>
                      <td className="px-3 py-1.5 font-medium">{p.name}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{p.length}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{p.width}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{p.thickness}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{p.qty}</td>
                      <td className="max-w-[180px] truncate px-3 py-1.5 text-xs text-stone-600">
                        {p.kind === 'board' ? catalog.boards.find((b) => b.id === p.materialId)?.name : p.kind === 'glass' ? catalog.glass.find((g) => g.id === p.materialId)?.name : catalog.countertops.find((c) => c.id === p.materialId)?.name}
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{p.edgeLength ? (p.edgeLength * p.qty).toFixed(2) : ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {priced.build.aluminium.map((a) => (
              <p key={a.profileId} className="px-1 text-xs text-stone-600">
                Aluminium ({catalog.aluminium.find((x) => x.id === a.profileId)?.name}): {a.pieces.join(', ')} mm
              </p>
            ))}
            <Card
              title="Extra parts"
              actions={
                <button className="btn-secondary px-3 py-1.5" onClick={() => up((u) => u.extraParts.push({ id: uid('p'), name: 'Extra panel', materialId: u.carcassMaterialId, length: 600, width: 300, qty: 1, edgeLength: 0.6 }))}>
                  <Plus size={14} /> Add part
                </button>
              }
            >
              {!unit.extraParts.length && <p className="text-sm text-stone-500">Add filler panels, scribes, end panels, cornices or anything else to include in the cut plan.</p>}
              <div className="space-y-3">
                {unit.extraParts.map((p, i) => (
                  <div key={p.id} className="grid grid-cols-2 gap-2 rounded-xl border border-stone-200 p-2 sm:grid-cols-6">
                    <input className="input col-span-2" value={p.name} onChange={(e) => up((u) => (u.extraParts[i].name = e.target.value))} />
                    <select className="input col-span-2" value={p.materialId} onChange={(e) => up((u) => (u.extraParts[i].materialId = e.target.value))}>
                      {catalog.boards.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                    <NumInput value={p.length} suffix="L" onChange={(v) => up((u) => (u.extraParts[i].length = v))} />
                    <NumInput value={p.width} suffix="W" onChange={(v) => up((u) => (u.extraParts[i].width = v))} />
                    <NumInput value={p.qty} suffix="qty" min={1} onChange={(v) => up((u) => (u.extraParts[i].qty = v))} />
                    <NumInput value={p.edgeLength} suffix="edge m" min={0} onChange={(v) => up((u) => (u.extraParts[i].edgeLength = v))} />
                    <button className="btn-ghost text-red-600" onClick={() => up((u) => u.extraParts.splice(i, 1))}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}
        <div className="h-6" />
      </div>
    </div>
  );
}
