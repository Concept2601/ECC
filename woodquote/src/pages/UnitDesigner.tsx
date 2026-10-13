import { Box, Columns2, Minus, PanelTop, Plus, RotateCcw, Rows2, Trash2 } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import ElevationEditor, { type EditorView, type Sel, type SidePick } from '../components/ElevationEditor';
import { choices, FIT_ICONS, FIT_LABELS, FRONT_ICONS, FRONT_LABELS, IconChoice, MATERIAL_ICONS, MATERIAL_LABELS, OPENING_ICONS, OPENING_LABELS, PANEL_ICONS, PANEL_LABELS, SLIDE_ICONS, SLIDE_LABELS } from '../components/OptionIcons';
import { Card, Field, NumInput, PageHeader, Select, Tabs, TextInput, Toggle } from '../components/ui';
import Viewer3D from '../components/Viewer3D';
import { useMoney, useQuoteCalc } from '../hooks';
import { elevation } from '../lib/generate';
import { locateUnit } from '../lib/locate';
import { PRODUCT_LABELS, PRODUCT_ORDER, sec } from '../lib/presets';
import { syncRun } from '../lib/runs';
import { ACCESSORY_LABELS, APPLIANCE_LABELS, type AccessoryCategory, type FrontKind, type LightLocation, type ProductType, type Unit } from '../lib/types';
import { kelvinToHex, LIGHT_TEMPS, uid } from '../lib/util';
import { accessoryPacksLabel } from '../pdf/pdf';
import { useStore } from '../store';

type Tab = 'layout' | 'size' | 'top' | 'sides' | 'materials' | 'hardware' | 'lights' | 'appliances' | 'parts';

function Stepper({ value, onChange, min = 0, max = 20 }: { value: number; onChange: (v: number) => void; min?: number; max?: number }) {
  return (
    <div className="flex w-fit items-center rounded-xl border border-stone-300 bg-white">
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

const Swatch = ({ color }: { color?: string }) => <span className="inline-block h-10 w-10 shrink-0 rounded-lg border border-stone-300" style={{ background: color ?? 'transparent' }} />;

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button onClick={onClick} className={`rounded-xl border px-3 py-1.5 text-xs font-semibold ${active ? 'border-brand-600 bg-brand-600 text-white' : 'border-stone-300 bg-white text-stone-700'}`}>
      {children}
    </button>
  );
}

const LOCATION_LABELS: Record<LightLocation, string> = {
  underCabinet: 'Under the cabinet (task light)',
  insideTop: 'Inside, top of each bay',
  shelves: 'Under every shelf',
  plinth: 'Plinth / kick board (floor wash)',
  top: 'On top (cornice up-light)',
  backPanel: 'Back panel (accent)',
};

export default function UnitDesigner() {
  const { id = '', uid: unitId = '' } = useParams();
  const quote = useStore((s) => s.quotes.find((q) => q.id === id));
  const { updateQuote, catalog } = useStore();
  const calc = useQuoteCalc(quote);
  const fmt = useMoney();
  const [tab, setTab] = useState<Tab>('layout');
  const [sel, setSel] = useState<Sel | null>({ bay: 0, section: 0 });
  const [mode, setMode] = useState<'3d' | '2d' | 'both'>(typeof window !== 'undefined' && window.innerWidth >= 900 ? 'both' : '3d');
  const [view2d, setView2d] = useState<EditorView>('front');
  const [extraAcc, setExtraAcc] = useState('');
  const [trace, setTrace] = useState(false);

  const loc = quote ? locateUnit(quote, unitId) : null;
  const unit = loc?.unit;
  const item = calc?.items.find((it) => it.id === (loc?.run ? loc.run.id : unitId));
  const build = calc?.entries.find((e) => e.unit?.id === unitId)?.build;
  const elev = useMemo(() => (unit ? elevation(unit, catalog) : null), [unit, catalog]);
  const runRef = loc?.role === 'base' ? loc.run : undefined;
  const extraBoxes = useMemo(() => {
    const c = runRef ? catalog.countertops.find((x) => x.id === runRef.countertopId) : undefined;
    if (!runRef || !c || !unit) return undefined;
    return [{ box: { x: 0, y: runRef.counterHeight - c.thickness, z: 0, w: unit.width, h: c.thickness, d: unit.depth + runRef.counterOverhang }, color: c.color }];
  }, [runRef, unit, catalog]);

  if (!quote || !unit || !build || !elev || !item) return <PageHeader title="Unit not found" back />;
  const inRun = !!loc?.run;
  const backTo = inRun ? `/quotes/${quote.id}/runs/${loc!.run!.id}` : `/quotes/${quote.id}`;

  const up = (fn: (u: Unit) => void) =>
    updateQuote(quote.id, (q) => {
      const l = locateUnit(q, unitId);
      if (!l) return;
      fn(l.unit);
      if (l.run) syncRun(l.run, catalog);
    });

  const s = sel && unit.bays[sel.bay]?.sections[sel.section] ? sel : null;
  const curBay = s ? unit.bays[s.bay] : null;
  const curSec = s ? unit.bays[s.bay].sections[s.section] : null;
  const bayMm = s ? Math.round(elev.bays[s.bay].w) : 0;
  const secMm = s ? Math.round(elev.bays[s.bay].sections[s.section].h) : 0;
  const upSec = (fn: (x: NonNullable<typeof curSec>) => void) => up((u) => s && fn(u.bays[s.bay].sections[s.section]));

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
  const setWidth = (v: number) =>
    updateQuote(quote.id, (q) => {
      const l = locateUnit(q, unitId);
      if (!l) return;
      if (l.module && l.run) {
        l.module.width = v;
        syncRun(l.run, catalog);
      } else l.unit.width = v;
    });

  const accOptions = (cat: AccessoryCategory) => catalog.accessories.filter((a) => a.category === cat).map((a) => ({ value: a.id, label: `${a.family && cat !== 'runner' ? `${a.family}: ` : ''}${a.name} ${a.size} – ${fmt(a.price)}` }));
  const boardOptions = catalog.boards.map((b) => ({ value: b.id, label: `${b.name} (${b.finish}) – ${fmt(b.pricePerSheet)}` }));
  const onSidePick = (p: SidePick) => setTab(p === 'top' || p === 'base' ? 'top' : 'sides');

  const viewer = <Viewer3D unit={unit} build={build} catalog={catalog} extraBoxes={extraBoxes} highlight={s} onPick={(p) => p.ref && (setSel(p.ref), setTab('layout'))} className="h-full w-full" />;
  const editor = (
    <div className="relative h-full w-full bg-[#f7f5f2]">
      <ElevationEditor unit={unit} catalog={catalog} build={build} view={view2d} sel={s} onSelect={(x) => (setSel(x), x && setTab('layout'))} onChange={up} onSidePick={onSidePick} background={trace ? quote.sourceImage : null} />
      <div className="no-scrollbar absolute left-1.5 right-1.5 top-1.5 flex gap-1 overflow-x-auto">
        {(['front', 'left', 'right', 'back', 'top'] as EditorView[]).map((v) => (
          <button key={v} className={`rounded-lg px-2 py-1 text-[11px] font-semibold capitalize ${view2d === v ? 'bg-brand-600 text-white' : 'bg-white/90 text-stone-700'}`} onClick={() => setView2d(v)}>
            {v}
          </button>
        ))}
        {quote.sourceImage && view2d === 'front' && (
          <button className="rounded-lg bg-white/90 px-2 py-1 text-[11px] font-semibold text-stone-700" onClick={() => setTrace(!trace)}>
            {trace ? 'Hide diagram' : 'Trace diagram'}
          </button>
        )}
      </div>
    </div>
  );

  const frontKinds: FrontKind[] = ['open', 'door', 'drawer', 'sliding', 'appliance'];
  const inbuiltAppliances = catalog.appliances.filter((a) => a.placement !== 'top' && a.category !== 'hood');

  return (
    <div className="flex h-[100dvh] flex-col">
      <PageHeader
        title={unit.name}
        subtitle={inRun ? `Part of ${loc!.run!.name}` : `${PRODUCT_LABELS[unit.type]} · ${unit.width}×${unit.height}×${unit.depth}mm`}
        back={backTo}
        actions={
          <div className="text-right">
            <div className="text-sm font-bold tabular-nums">{fmt(item.sell)}</div>
            <div className="text-[11px] text-stone-500">{inRun ? 'whole kitchen' : `cost ${fmt(item.cost)}`}</div>
          </div>
        }
      />

      {/* fixed render area – settings scroll underneath without hiding it */}
      <div className="relative shrink-0 overflow-hidden border-b border-stone-200 bg-stone-200">
        <div className={`grid h-[38vh] min-h-[240px] grid-rows-[100%] md:h-[46vh] ${mode === 'both' ? 'md:grid-cols-2' : ''}`}>
          {(mode === '3d' || mode === 'both') && <div className={`${mode === 'both' ? 'hidden md:block' : ''} h-full min-h-0 min-w-0 overflow-hidden`}>{viewer}</div>}
          {(mode === '2d' || mode === 'both') && <div className="h-full min-h-0 min-w-0 overflow-hidden">{editor}</div>}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1 border-b border-stone-200 bg-white px-3 py-1.5">
        <Chip active={mode === '3d'} onClick={() => setMode('3d')}>
          <Box size={13} className="inline" /> 3D
        </Chip>
        <Chip active={mode === '2d'} onClick={() => setMode('2d')}>
          <PanelTop size={13} className="inline" /> 2D edit
        </Chip>
        <Chip active={mode === 'both'} onClick={() => setMode('both')}>
          <Columns2 size={13} className="inline" /> Both
        </Chip>
        <span className="ml-auto truncate text-[11px] text-stone-500">{mode === '3d' ? 'Tap a part to edit · drag to rotate' : 'Tap to select · drag handles to resize'}</span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {build.warnings.length > 0 && <div className="bg-amber-50 px-4 py-2 text-xs text-amber-900">{build.warnings.join(' ')}</div>}
        <div className="sticky top-0 z-10 border-b border-stone-200 bg-stone-100/95 px-3 backdrop-blur">
          <div className="mx-auto max-w-5xl">
            <Tabs<Tab>
              value={tab}
              onChange={setTab}
              tabs={[
                { value: 'layout', label: 'Layout & fronts' },
                { value: 'size', label: 'Size & mounting' },
                { value: 'top', label: 'Top & base' },
                { value: 'sides', label: 'Sides & back' },
                { value: 'materials', label: 'Materials' },
                { value: 'hardware', label: 'Hardware' },
                { value: 'lights', label: `Lighting${unit.lights.length ? ` (${unit.lights.length})` : ''}` },
                { value: 'appliances', label: 'Appliances' },
                { value: 'parts', label: `Cut list (${build.parts.reduce((a, p) => a + p.qty, 0)})` },
              ]}
            />
          </div>
        </div>

        <div className="mx-auto w-full max-w-5xl space-y-3 p-3">
          {tab === 'layout' && (
            <div className="space-y-3">
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
                          u.bays.splice(i + 1, 0, { id: uid('b'), size: half, sections: [sec({ front: 'door', opening: 'right' })] });
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
                          const src = b.sections[s.section];
                          b.sections.splice(s.section + 1, 0, sec({ front: src.front === 'appliance' ? 'door' : src.front, doorMaterial: src.doorMaterial, fit: src.fit, opening: src.opening, size: half }));
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
                      <span className="label">Front type</span>
                      <IconChoice<FrontKind> value={curSec.front} onChange={(v) => upSec((x) => (x.front = v))} options={choices(FRONT_ICONS, FRONT_LABELS, frontKinds)} />
                      {unit.sliding.enabled && curSec.front !== 'drawer' && curSec.front !== 'open' && <p className="mt-1 text-xs text-amber-700">Sliding wardrobe doors are on — compartment fronts are ignored.</p>}
                    </div>
                    {(curSec.front === 'door' || curSec.front === 'sliding') && (
                      <div>
                        <span className="label">Door material</span>
                        <IconChoice value={curSec.doorMaterial} onChange={(v) => upSec((x) => (x.doorMaterial = v))} options={choices(MATERIAL_ICONS, MATERIAL_LABELS)} />
                      </div>
                    )}
                    {curSec.front === 'door' && (
                      <div>
                        <span className="label">Opening direction</span>
                        <IconChoice value={curSec.opening} onChange={(v) => upSec((x) => (x.opening = v))} options={choices(OPENING_ICONS, OPENING_LABELS)} />
                      </div>
                    )}
                    {curSec.front === 'sliding' && (
                      <div>
                        <span className="label">Sliding direction</span>
                        <IconChoice value={curSec.slide} onChange={(v) => upSec((x) => (x.slide = v))} options={choices(SLIDE_ICONS, SLIDE_LABELS)} />
                      </div>
                    )}
                    {(curSec.front === 'door' || curSec.front === 'drawer') && (
                      <div>
                        <span className="label">Fitting</span>
                        <IconChoice value={curSec.fit} onChange={(v) => upSec((x) => (x.fit = v))} options={choices(FIT_ICONS, FIT_LABELS)} />
                      </div>
                    )}
                    {curSec.front === 'appliance' && (
                      <Field label="Appliance in this compartment">
                        <Select
                          value={curSec.applianceId}
                          allowNone="Choose appliance…"
                          onChange={(v) => upSec((x) => (x.applianceId = v))}
                          options={inbuiltAppliances.map((a) => ({ value: a.id, label: `${APPLIANCE_LABELS[a.category]}: ${a.name} (${a.width}×${a.height}) – ${fmt(a.price)}` }))}
                        />
                      </Field>
                    )}
                    <div className="flex flex-wrap items-end gap-6">
                      {curSec.front === 'drawer' && (
                        <Field label="Drawers">
                          <Stepper value={curSec.drawerCount} min={1} max={8} onChange={(v) => upSec((x) => (x.drawerCount = v))} />
                        </Field>
                      )}
                      {curSec.front !== 'drawer' && curSec.front !== 'appliance' && (
                        <Field label="Adjustable shelves">
                          <Stepper value={curSec.shelves} max={12} onChange={(v) => upSec((x) => (x.shelves = v))} />
                        </Field>
                      )}
                      {curSec.front !== 'drawer' && curSec.front !== 'appliance' && (
                        <div className="min-w-[160px]">
                          <Toggle label="Hanging rail" checked={curSec.hangingRail} onChange={(v) => upSec((x) => (x.hangingRail = v))} />
                        </div>
                      )}
                    </div>
                    {curSec.front !== 'appliance' && (
                      <Field label="Pull-out / organiser">
                        <Select value={curSec.insertId} allowNone="None" onChange={(v) => upSec((x) => (x.insertId = v))} options={accOptions('insert')} />
                      </Field>
                    )}
                    <div className="flex flex-wrap gap-2 border-t pt-3">
                      <button
                        className="btn-danger px-3 py-1.5 text-xs"
                        disabled={curBay.sections.length < 2}
                        onClick={() => {
                          up((u) => {
                            const b = u.bays[s.bay];
                            const removed = b.sections.splice(s.section, 1)[0];
                            b.sections[Math.min(s.section, b.sections.length - 1)].size += removed.size;
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
                  <p className="text-sm text-stone-500">Tap a compartment on the 3D render or in the 2D editor to change its front, opening direction, shelves and size.</p>
                )}
              </Card>
            </div>
          )}

          {tab === 'size' && (
            <div className="grid gap-3 md:grid-cols-2">
              <Card title="Unit">
                <div className="space-y-3">
                  <Field label="Name on quotation">
                    <TextInput value={unit.name} onChange={(v) => up((u) => (u.name = v))} />
                  </Field>
                  {!inRun && (
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Type">
                        <Select<ProductType> value={unit.type} onChange={(v) => v && up((u) => (u.type = v))} options={PRODUCT_ORDER.map((t) => ({ value: t, label: PRODUCT_LABELS[t] }))} />
                      </Field>
                      <Field label="Quantity">
                        <NumInput value={unit.qty} min={1} onChange={(v) => up((u) => (u.qty = Math.max(1, Math.round(v))))} />
                      </Field>
                    </div>
                  )}
                  <div className="grid grid-cols-3 gap-3">
                    <Field label="Width">
                      <NumInput value={unit.width} min={150} suffix="mm" onChange={setWidth} />
                    </Field>
                    <Field label="Height">
                      {inRun ? <div className="input bg-stone-50">{unit.height}</div> : <NumInput value={unit.height} min={200} suffix="mm" onChange={(v) => up((u) => (u.height = v))} />}
                    </Field>
                    <Field label="Depth">
                      {inRun ? <div className="input bg-stone-50">{unit.depth}</div> : <NumInput value={unit.depth} min={100} suffix="mm" onChange={(v) => up((u) => (u.depth = v))} />}
                    </Field>
                  </div>
                  {inRun && <p className="text-xs text-stone-500">Height, depth and mounting come from the kitchen settings so every cabinet lines up. Width changes this slot in the run.</p>}
                  <Field label="Notes (shown on quotation)">
                    <TextInput multiline value={unit.notes} onChange={(v) => up((u) => (u.notes = v))} />
                  </Field>
                  <Field label="Fixed labour price per unit (blank = use settings)">
                    <input className="input" inputMode="decimal" value={unit.labourOverride ?? ''} placeholder="Auto" onChange={(e) => up((u) => (u.labourOverride = e.target.value === '' ? null : Number(e.target.value) || 0))} />
                  </Field>
                </div>
              </Card>
              {!inRun && (
                <Card title="Installation & mounting">
                  <div className="space-y-3">
                    <span className="label">Unit type</span>
                    <div className="flex flex-wrap gap-2">
                      <Chip active={unit.installType === 'builtIn'} onClick={() => up((u) => (u.installType = 'builtIn'))}>
                        Built-in (fitted to walls)
                      </Chip>
                      <Chip active={unit.installType === 'standalone'} onClick={() => up((u) => (u.installType = 'standalone'))}>
                        Standalone (free-standing)
                      </Chip>
                    </div>
                    <span className="label">Mounting</span>
                    <div className="flex flex-wrap gap-2">
                      <Chip active={unit.mount === 'floor'} onClick={() => up((u) => (u.mount = 'floor'))}>
                        Floor standing
                      </Chip>
                      <Chip active={unit.mount === 'wall'} onClick={() => up((u) => (u.mount = 'wall'))}>
                        Wall hung
                      </Chip>
                    </div>
                    {unit.mount === 'wall' && (
                      <Field label="Height above floor (underside)">
                        <NumInput value={unit.mountHeight} min={0} suffix="mm" onChange={(v) => up((u) => (u.mountHeight = v))} />
                      </Field>
                    )}
                    <Toggle label="Sliding wardrobe doors across the whole unit" checked={unit.sliding.enabled} onChange={(v) => up((u) => (u.sliding.enabled = v))} />
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
              )}
            </div>
          )}

          {tab === 'top' && (
            <div className="grid gap-3 md:grid-cols-2">
              <Card title="Top">
                {inRun ? (
                  <p className="text-sm text-stone-500">The worktop is continuous across the kitchen — set it in the kitchen settings.</p>
                ) : (
                  <div className="space-y-3">
                    <Field label="Countertop (stone / laminate / timber)">
                      <Select value={unit.countertopId} allowNone="No countertop" onChange={(v) => up((u) => (u.countertopId = v))} options={catalog.countertops.map((c) => ({ value: c.id, label: `${c.name} – ${fmt(c.pricePerSqm)}/m²` }))} />
                    </Field>
                    {!unit.countertopId && (
                      <Field label="…or an overhanging board top">
                        <Select value={unit.topBoardId} allowNone="Carcass top only (no overhang)" onChange={(v) => up((u) => (u.topBoardId = v))} options={boardOptions} />
                      </Field>
                    )}
                    {(unit.countertopId || unit.topBoardId) && (
                      <>
                        <span className="label">Overhang per side</span>
                        <div className="grid grid-cols-2 gap-3">
                          {(['front', 'back', 'left', 'right'] as const).map((side) => (
                            <Field key={side} label={side === 'back' && unit.type === 'island' ? 'Back (seating)' : side}>
                              <NumInput value={unit.overhang[side]} min={0} suffix="mm" onChange={(v) => up((u) => (u.overhang[side] = v))} />
                            </Field>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </Card>
              <Card title="Base">
                {inRun || unit.mount === 'wall' ? (
                  <p className="text-sm text-stone-500">{inRun ? 'Kick board height comes from the kitchen settings.' : 'Wall-hung units have no base.'}</p>
                ) : (
                  <div className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                      <Chip active={unit.base === 'plinth'} onClick={() => up((u) => ((u.base = 'plinth'), !u.baseHeight && (u.baseHeight = 100)))}>
                        Kick board / plinth
                      </Chip>
                      <Chip active={unit.base === 'legs'} onClick={() => up((u) => ((u.base = 'legs'), !u.baseHeight && (u.baseHeight = 120)))}>
                        Legs
                      </Chip>
                      <Chip active={unit.base === 'none'} onClick={() => up((u) => (u.base = 'none'))}>
                        No legs – sits on floor
                      </Chip>
                    </div>
                    {unit.base !== 'none' && (
                      <Field label="Base height">
                        <NumInput value={unit.baseHeight} min={0} suffix="mm" onChange={(v) => up((u) => (u.baseHeight = v))} />
                      </Field>
                    )}
                    {unit.base === 'legs' && (
                      <Field label="Leg type">
                        <Select value={unit.legId} onChange={(v) => up((u) => (u.legId = v))} options={accOptions('leg')} />
                      </Field>
                    )}
                    {unit.base === 'plinth' && (
                      <>
                        <span className="label">Kick board on</span>
                        <div className="grid grid-cols-2 gap-x-6">
                          {(['front', 'back', 'left', 'right'] as const).map((side) => (
                            <Toggle key={side} label={side[0].toUpperCase() + side.slice(1)} checked={unit.plinthSides[side]} onChange={(v) => up((u) => (u.plinthSides[side] = v))} />
                          ))}
                        </div>
                        <Field label="Set back (recess)">
                          <NumInput value={unit.plinthRecess} min={0} suffix="mm" onChange={(v) => up((u) => (u.plinthRecess = v))} />
                        </Field>
                      </>
                    )}
                  </div>
                )}
              </Card>
            </div>
          )}

          {tab === 'sides' && (
            <div className="grid gap-3 md:grid-cols-3">
              {(['left', 'right', 'back'] as const).map((side) => {
                const p = unit.finishPanels[side];
                const color = catalog.boards.find((b) => b.id === p.materialId)?.color;
                return (
                  <Card key={side} title={`${side} ${side === 'back' ? 'face' : 'side'}`}>
                    <div className="space-y-3">
                      <Toggle label="Exposed finish panel" checked={p.enabled} onChange={(v) => up((u) => (u.finishPanels[side].enabled = v))} />
                      {p.enabled && (
                        <>
                          <Field label="Finish board">
                            <div className="flex gap-2">
                              <Swatch color={color} />
                              <Select value={p.materialId} onChange={(v) => v && up((u) => (u.finishPanels[side].materialId = v))} options={boardOptions} />
                            </div>
                          </Field>
                          <div>
                            <span className="label">Design</span>
                            <IconChoice value={p.style} onChange={(v) => up((u) => (u.finishPanels[side].style = v))} options={choices(PANEL_ICONS, PANEL_LABELS)} />
                          </div>
                          {unit.mount === 'floor' && <Toggle label="Run down to the floor (covers base)" checked={p.toFloor} onChange={(v) => up((u) => (u.finishPanels[side].toFloor = v))} />}
                        </>
                      )}
                      {!p.enabled && <p className="text-xs text-stone-500">{side === 'back' ? 'Add a finished back for islands and room dividers.' : 'Add a decorative end panel on an exposed side.'}</p>}
                    </div>
                  </Card>
                );
              })}
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
                  <p className="text-xs text-stone-500">Turn the lights on in the 3D view to compare matte, satin and gloss finishes.</p>
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
                  <Field label="Glass (glass doors / frameless / sliding)">
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
                      ['hinge', 'hingeId', 'Hinges for wood doors (auto-matched to overlay / inset)'],
                      ['hinge', 'glassHingeId', 'Hinges for glass doors'],
                      ['runner', 'runnerId', 'Drawer runners (auto-sized to depth)'],
                      ['handle', 'handleId', 'Handles / push-to-open'],
                      ['roller', 'rollerId', 'Sliding rollers'],
                      ['track', 'trackId', 'Sliding tracks'],
                      ['rail', 'railId', 'Hanging rails'],
                      ['stay', 'stayId', 'Lift-up flap stays'],
                      ['screw', 'screwId', 'Screws'],
                      ['connector', 'connectorId', 'Connectors'],
                      ['shelfPin', 'shelfPinId', 'Shelf pins'],
                    ] as const
                  ).map(([cat, key, label]) => (
                    <Field key={key} label={label}>
                      <Select value={unit[key]} allowNone="None" onChange={(v) => up((u) => (u[key] = v))} options={accOptions(cat)} />
                    </Field>
                  ))}
                </div>
              </Card>
              <Card title="Hardware list (per unit)">
                <div className="divide-y divide-stone-100">
                  {build.hardware.map((h) => {
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

          {tab === 'lights' && (
            <div className="space-y-3">
              {unit.lights.map((l, i) => (
                <Card
                  key={l.id}
                  title={`Light ${i + 1}`}
                  actions={
                    <button className="btn-ghost px-2 text-red-600" onClick={() => up((u) => u.lights.splice(i, 1))} aria-label="Remove light">
                      <Trash2 size={16} />
                    </button>
                  }
                >
                  <div className="grid gap-3 md:grid-cols-2">
                    <Field label="Light type">
                      <Select value={l.accessoryId} onChange={(v) => v && up((u) => (u.lights[i].accessoryId = v))} options={catalog.accessories.filter((a) => a.category === 'lighting' && ['strip', 'profile', 'spot', 'bar'].includes(a.lightKind ?? '')).map((a) => ({ value: a.id, label: `${a.name} – ${fmt(a.price)}${a.unit === 'm' ? '/m' : ''}` }))} />
                    </Field>
                    <Field label="Position">
                      <Select value={l.location} onChange={(v) => v && up((u) => (u.lights[i].location = v))} options={(Object.keys(LOCATION_LABELS) as LightLocation[]).map((k) => ({ value: k, label: LOCATION_LABELS[k] }))} />
                    </Field>
                    <div className="md:col-span-2">
                      <span className="label">Colour temperature / colour</span>
                      <div className="flex flex-wrap gap-2">
                        {LIGHT_TEMPS.map((t) => (
                          <button key={t.k} onClick={() => up((u) => (u.lights[i].temperature = t.k))} className={`flex items-center gap-2 rounded-xl border px-2.5 py-1.5 text-xs font-semibold ${l.temperature === t.k ? 'border-brand-600 ring-2 ring-brand-200' : 'border-stone-300'}`}>
                            <span className="h-4 w-4 rounded-full border border-stone-300" style={{ background: t.k ? kelvinToHex(t.k) : 'conic-gradient(red, yellow, lime, cyan, blue, magenta, red)' }} />
                            {t.label}
                          </button>
                        ))}
                      </div>
                      {l.temperature === 0 && (
                        <div className="mt-2 flex items-center gap-2">
                          <input type="color" className="h-10 w-16 rounded-lg border border-stone-300" value={l.color} onChange={(e) => up((u) => (u.lights[i].color = e.target.value))} />
                          <span className="text-xs text-stone-500">Pick the RGB colour shown in the render (use an RGB strip).</span>
                        </div>
                      )}
                    </div>
                    <Field label="Switch / sensor">
                      <Select value={l.sensorId} allowNone="None (wired to wall switch)" onChange={(v) => up((u) => (u.lights[i].sensorId = v))} options={catalog.accessories.filter((a) => a.lightKind === 'sensor').map((a) => ({ value: a.id, label: `${a.name} – ${fmt(a.price)}` }))} />
                    </Field>
                    <div>
                      <span className="label">Bays</span>
                      <div className="flex flex-wrap gap-1">
                        <Chip active={!l.bays.length} onClick={() => up((u) => (u.lights[i].bays = []))}>
                          All
                        </Chip>
                        {unit.bays.map((_, b) => (
                          <Chip key={b} active={l.bays.includes(b)} onClick={() => up((u) => (u.lights[i].bays = l.bays.includes(b) ? l.bays.filter((x) => x !== b) : [...l.bays, b]))}>
                            {b + 1}
                          </Chip>
                        ))}
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
              <button
                className="card flex w-full items-center justify-center gap-2 border-dashed p-4 font-semibold text-brand-700"
                onClick={() => up((u) => u.lights.push({ id: uid('lt'), accessoryId: 'lt-strip', location: u.mount === 'wall' ? 'underCabinet' : 'insideTop', temperature: 3000, color: '#ff7ad9', bays: [], sensorId: null }))}
              >
                <Plus size={18} /> Add lighting
              </button>
              <p className="px-1 text-xs text-stone-500">Tip: tap the bulb on the 3D view to switch to night mode and see the lights glow. A driver is added automatically.</p>
            </div>
          )}

          {tab === 'appliances' && (
            <div className="grid gap-3 md:grid-cols-2">
              <Card title="On the top (hob / sink)">
                <div className="space-y-2">
                  {unit.topAppliances.map((t, i) => (
                    <div key={t.id} className="grid grid-cols-[1fr_90px_auto] items-center gap-2">
                      <Select value={t.applianceId} onChange={(v) => v && up((u) => (u.topAppliances[i].applianceId = v))} options={catalog.appliances.filter((a) => a.placement === 'top').map((a) => ({ value: a.id, label: `${a.name} – ${fmt(a.price)}` }))} />
                      <select className="input" value={t.bay} onChange={(e) => up((u) => (u.topAppliances[i].bay = Number(e.target.value)))}>
                        {unit.bays.map((_, b) => (
                          <option key={b} value={b}>
                            Bay {b + 1}
                          </option>
                        ))}
                      </select>
                      <button className="btn-ghost px-2 text-red-600" onClick={() => up((u) => u.topAppliances.splice(i, 1))}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                  <div className="flex flex-wrap gap-2 pt-1">
                    <button className="btn-secondary px-3 py-1.5 text-xs" onClick={() => up((u) => u.topAppliances.push({ id: uid('ta'), applianceId: 'ap-hob-gas4', bay: 0 }))}>
                      <Plus size={14} /> Gas / electric hob
                    </button>
                    <button className="btn-secondary px-3 py-1.5 text-xs" onClick={() => up((u) => u.topAppliances.push({ id: uid('ta'), applianceId: 'ap-sink-single', bay: 0 }))}>
                      <Plus size={14} /> Sink
                    </button>
                  </div>
                  {!unit.countertopId && !inRun && unit.topAppliances.length > 0 && <p className="text-xs text-amber-700">Add a countertop in “Top & base” for hobs and sinks.</p>}
                </div>
              </Card>
              <Card title="In compartments">
                <p className="mb-2 text-sm text-stone-600">Ovens, microwaves, integrated fridges, dishwashers, washers and wine coolers go into a compartment: select it, then choose the <b>Appliance</b> front.</p>
                <ul className="space-y-1 text-sm">
                  {unit.bays.flatMap((b, bi) =>
                    b.sections
                      .map((x, si) => ({ x, si }))
                      .filter(({ x }) => x.front === 'appliance')
                      .map(({ x, si }) => (
                        <li key={x.id}>
                          <button className="text-left font-medium text-brand-700" onClick={() => (setSel({ bay: bi, section: si }), setTab('layout'))}>
                            Bay {bi + 1}, compartment {si + 1}: {catalog.appliances.find((a) => a.id === x.applianceId)?.name ?? 'not chosen'}
                          </button>
                        </li>
                      )),
                  )}
                </ul>
                <p className="mt-3 text-xs text-stone-500">Choose in the quotation's Pricing tab whether appliance prices are included (supplied by you) or supplied by the client.</p>
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
                    {build.parts.map((p) => (
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
              {build.aluminium.map((a) => (
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
                {!unit.extraParts.length && <p className="text-sm text-stone-500">Add filler panels, scribes, cornices or anything else to include in the cut plan.</p>}
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
    </div>
  );
}
