import { AlertTriangle, Boxes, Camera, Home, Copy, FileDown, Hammer, ImagePlus, LayoutPanelTop, Minus, MoreVertical, Pencil, Plus, Receipt, Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import AddUnitModal from '../components/AddUnitModal';
import AddGroupModal from '../components/AddGroupModal';
import { cloneAssembly } from '../lib/assembly';
import { BarPlanCard, BoardPlanCard } from '../components/CutPlanView';
import { Card, confirmAction, Field, Modal, NumInput, PageHeader, Row, Select, Tabs, TextInput, Toggle } from '../components/ui';
import UnitThumb from '../components/UnitThumb';
import { imageFileToJpeg } from '../lib/images';
import { STATUS_STYLE, useMoney, useQuoteCalc } from '../hooks';
import { cloneRun, createRun, RUN_SHAPE_LABELS, syncRun } from '../lib/runs';
import type { RunShape } from '../lib/types';
import { renderAssemblyImage, renderRunImage, renderUnitImage } from '../render/scene';
import { COST_GROUPS } from '../lib/pricing';
import type { Quote, QuoteStatus } from '../lib/types';
import { deepClone, uid } from '../lib/util';
import { quotePdf, saveOrShare, workshopPdf } from '../pdf/pdf';
import MaterialHub from '../components/MaterialHub';
import { usePageShortcuts } from '../app/shortcuts';
import { useStore } from '../store';

type Tab = 'client' | 'design' | 'hub' | 'costing' | 'schedule' | 'report';

export default function QuoteEditor() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const quote = useStore((s) => s.quotes.find((q) => q.id === id));
  const { updateQuote, deleteQuote, duplicateQuote, createInvoiceFromQuote, catalog, settings } = useStore();
  const calc = useQuoteCalc(quote);
  const fmt = useMoney();
  const [tab, setTab] = useState<Tab>('design');
  const [adding, setAdding] = useState(false);
  const [addingRun, setAddingRun] = useState(false);
  const [addingGroup, setAddingGroup] = useState(false);
  const attachRef = useRef<HTMLInputElement>(null);
  const [menu, setMenu] = useState(false);
  const [busy, setBusy] = useState('');
  const keys = usePageShortcuts();

  if (!quote || !calc) return <PageHeader title="Quotation not found" back="/quotes" />;
  const up = (fn: (q: Quote) => void) => updateQuote(quote.id, fn);

  const exportPdf = async (kind: 'quote' | 'workshop') => {
    setBusy(kind);
    try {
      await new Promise((r) => setTimeout(r, 30));
      const doc = kind === 'quote' ? quotePdf(quote, calc, settings, catalog) : workshopPdf(quote, calc, settings, catalog);
      await saveOrShare(doc, `${quote.number}-${kind === 'quote' ? 'quotation' : 'cutlist'}.pdf`);
    } finally {
      setBusy('');
    }
  };

  keys.current = {
    pdf: () => void exportPdf('quote'),
    duplicate: () => {
      const nid = duplicateQuote(quote.id);
      if (nid) nav(`/quotes/${nid}`);
    },
    addUnit: () => setAdding(true),
    addKitchen: () => setAddingRun(true),
    room: () => nav(`/quotes/${quote.id}/room`),
  };

  const captureViews = async () => {
    setBusy('capture');
    await new Promise((r) => setTimeout(r, 30));
    const shots: { name: string; dataUrl: string }[] = [];
    for (const it of calc.items) {
      const views = it.kind === 'unit' ? (['3d', 'front', 'left'] as const) : it.kind === 'assembly' ? (['3d', 'front', 'back', 'top'] as const) : (['3d', 'front'] as const);
      for (const v of views) {
        const img = it.kind === 'assembly' && it.assembly && it.assemblyBuild ? renderAssemblyImage(it.assembly, it.assemblyBuild, catalog, 1400, 900, 'image/jpeg', v) : it.kind === 'run' && it.run && it.runBuild ? renderRunImage(it.run, it.runBuild, catalog, 1400, 800, 'image/jpeg', v) : it.unit && it.build ? renderUnitImage(it.unit, it.build, catalog, 1100, 850, 'image/jpeg', v) : null;
        if (img) shots.push({ name: `${it.name} – ${v === '3d' ? '3D view' : `${v} view`}`, dataUrl: img });
      }
      const hasLights = it.entries.some((e) => e.build.lights.length > 0);
      if (hasLights) {
        const img = it.kind === 'assembly' && it.assembly && it.assemblyBuild ? renderAssemblyImage(it.assembly, it.assemblyBuild, catalog, 1400, 900, 'image/jpeg', '3d', true) : it.kind === 'run' && it.run && it.runBuild ? renderRunImage(it.run, it.runBuild, catalog, 1400, 800, 'image/jpeg', '3d', true) : it.unit && it.build ? renderUnitImage(it.unit, it.build, catalog, 1100, 850, 'image/jpeg', '3d', true) : null;
        if (img) shots.push({ name: `${it.name} – lighting`, dataUrl: img });
      }
    }
    up((q) => q.attachments.push(...shots.map((x) => ({ id: uid('at'), name: x.name, dataUrl: x.dataUrl, caption: x.name, includeInPdf: true }))));
    setBusy('');
  };

  return (
    <div>
      <PageHeader
        title={quote.title || 'Quotation'}
        subtitle={`${quote.number} · ${quote.client.name || 'No client yet'}`}
        back="/quotes"
        actions={
          <>
            <button className="btn-primary px-3" aria-label="Quotation PDF" disabled={!!busy} onClick={() => exportPdf('quote')}>
              <FileDown size={18} /> <span className="hidden sm:inline">{busy === 'quote' ? 'Building…' : 'Quotation PDF'}</span>
            </button>
            <button className="btn-ghost px-2" aria-label="More" onClick={() => setMenu(true)}>
              <MoreVertical size={20} />
            </button>
          </>
        }
      />

      <div className="mx-auto max-w-5xl space-y-3 p-3">
        <Tabs<Tab>
          value={tab}
          onChange={setTab}
          tabs={[
            { value: 'client', label: 'Client details' },
            { value: 'design', label: `Design (${calc.items.length})` },
            { value: 'hub', label: 'Material hub' },
            { value: 'costing', label: 'Costing' },
            { value: 'schedule', label: 'Material schedule' },
            { value: 'report', label: 'Reporting' },
          ]}
        />

        {calc.warnings.length > 0 && (
          <div className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
            <AlertTriangle size={16} className="shrink-0" />
            <ul className="space-y-0.5">
              {calc.warnings.slice(0, 5).map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </div>
        )}

        {tab === 'design' && (
          <div className="space-y-3">
            {calc.items.map((it) => {
              const link = it.kind === 'run' ? `/quotes/${quote.id}/runs/${it.id}` : it.kind === 'assembly' ? `/quotes/${quote.id}/groups/${it.id}` : `/quotes/${quote.id}/units/${it.id}`;
              const isRun = it.kind === 'run';
              const isGroup = it.kind === 'assembly';
              const wide = isRun || isGroup;
              const setQty = (d: number) =>
                up((q) => {
                  const target = isRun ? q.runs.find((r) => r.id === it.id) : isGroup ? q.assemblies?.find((a) => a.id === it.id) : q.units.find((u) => u.id === it.id);
                  if (target) target.qty = Math.max(1, target.qty + d);
                });
              return (
                <div key={it.id} className="card flex flex-col gap-3 p-3 sm:flex-row">
                  <Link to={link} className="shrink-0">
                    <UnitThumb unit={it.unit} build={it.build} run={it.run} runBuild={it.runBuild} assembly={it.assembly} assemblyBuild={it.assemblyBuild} catalog={catalog} className={`h-40 w-full ${wide ? 'sm:h-32 sm:w-56' : 'sm:h-32 sm:w-40'}`} />
                  </Link>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <Link to={link} className="font-bold hover:text-brand-700">
                        {isRun && <span className="chip mr-1 bg-violet-100 text-violet-800">Kitchen</span>}
                        {isGroup && <span className="chip mr-1 bg-sky-100 text-sky-800">{it.assembly!.pieces.some((p) => p.unit) ? 'Group' : 'Appliance'}</span>}
                        {it.name}
                      </Link>
                      <div className="text-right">
                        <div className="font-bold tabular-nums">{fmt(it.sell)}</div>
                        {it.qty > 1 && <div className="text-xs text-stone-500">{fmt(it.sellEach)} each</div>}
                      </div>
                    </div>
                    <ul className="mt-1 space-y-0.5 text-xs text-stone-600">
                      {it.lines.slice(0, 4).map((l) => (
                        <li key={l} className="truncate">
                          {l}
                        </li>
                      ))}
                    </ul>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <div className="flex items-center rounded-xl border border-stone-300">
                        <button className="px-2 py-1.5" aria-label="Less" onClick={() => setQty(-1)}>
                          <Minus size={14} />
                        </button>
                        <span className="w-8 text-center text-sm font-semibold">{it.qty}</span>
                        <button className="px-2 py-1.5" aria-label="More" onClick={() => setQty(1)}>
                          <Plus size={14} />
                        </button>
                      </div>
                      <Link className="btn-secondary px-3 py-1.5" to={link}>
                        <Pencil size={14} /> Design
                      </Link>
                      <button
                        className="btn-ghost px-2 py-1.5"
                        aria-label="Duplicate"
                        onClick={() =>
                          up((q) => {
                            if (isRun) {
                              const i = q.runs.findIndex((r) => r.id === it.id);
                              q.runs.splice(i + 1, 0, { ...cloneRun(q.runs[i]), name: `${q.runs[i].name} (copy)` });
                            } else if (isGroup) {
                              const list = (q.assemblies ??= []);
                              const i = list.findIndex((a) => a.id === it.id);
                              list.splice(i + 1, 0, { ...cloneAssembly(list[i]), name: `${list[i].name} (copy)` });
                            } else {
                              const i = q.units.findIndex((u) => u.id === it.id);
                              q.units.splice(i + 1, 0, { ...deepClone(q.units[i]), id: uid('u'), name: `${q.units[i].name} (copy)` });
                            }
                          })
                        }
                      >
                        <Copy size={16} />
                      </button>
                      <button
                        className="btn-ghost px-2 py-1.5 text-red-600"
                        aria-label="Delete"
                        onClick={() => confirmAction(`Remove ${it.name}?`) && up((q) => (isRun ? (q.runs = q.runs.filter((r) => r.id !== it.id)) : isGroup ? (q.assemblies = (q.assemblies ?? []).filter((a) => a.id !== it.id)) : (q.units = q.units.filter((u) => u.id !== it.id))))}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
            {calc.items.length > 0 && (
              <Link to={`/quotes/${quote.id}/room`} className="card flex items-center gap-3 border-emerald-200 bg-emerald-50 p-4 hover:border-emerald-400">
                <Home size={22} className="text-emerald-700" />
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-emerald-900">{quote.room ? 'Room layout' : 'Show in a room layout'}</div>
                  <div className="text-xs text-emerald-800">{quote.room ? `${quote.room.walls.length} walls · ${quote.room.openings.length} opening(s) · included in the quotation PDF` : 'Walls, windows, doors and open-plan beams so the client sees the design in their space'}</div>
                </div>
              </Link>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <button className="card flex w-full items-center justify-center gap-2 border-dashed p-5 font-semibold text-brand-700 hover:border-brand-400" onClick={() => setAdding(true)}>
                <Plus size={18} /> Add unit (TV stand, wardrobe, island…)
              </button>
              <button className="card flex w-full items-center justify-center gap-2 border-dashed p-5 font-semibold text-violet-700 hover:border-violet-400" onClick={() => setAddingRun(true)}>
                <LayoutPanelTop size={18} /> Add whole kitchen (straight / L / U)
              </button>
              <button className="card flex w-full items-center justify-center gap-2 border-dashed p-5 font-semibold text-sky-700 hover:border-sky-400 sm:col-span-2" onClick={() => setAddingGroup(true)}>
                <Boxes size={18} /> Add island, custom multi-cabinet unit or loose appliance
              </button>
            </div>
          </div>
        )}

        {tab === 'design' && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <button className="btn-primary" onClick={() => attachRef.current?.click()}>
                <ImagePlus size={16} /> Attach design / photo
              </button>
              <button className="btn-secondary" disabled={!calc.items.length || !!busy} onClick={captureViews}>
                <Camera size={16} /> {busy === 'capture' ? 'Rendering…' : 'Capture render views'}
              </button>
              <input
                ref={attachRef}
                type="file"
                accept="image/*"
                multiple
                hidden
                onChange={async (e) => {
                  const files = [...(e.target.files ?? [])];
                  e.target.value = '';
                  for (const f of files) {
                    const dataUrl = await imageFileToJpeg(f);
                    up((q) => q.attachments.push({ id: uid('at'), name: f.name, dataUrl, caption: f.name.replace(/\.[^.]+$/, ''), includeInPdf: true }));
                  }
                }}
              />
            </div>
            {!quote.attachments.length && <p className="rounded-xl bg-white p-4 text-sm text-stone-500">Attach sketches, mood boards, site photos or design drawings. They are added to the quotation PDF on their own pages. “Capture render views” adds 3D, front and side renders of every item.</p>}
            <div className="grid gap-3 sm:grid-cols-2">
              {quote.attachments.map((a, i) => (
                <div key={a.id} className="card overflow-hidden">
                  <img src={a.dataUrl} alt={a.caption} className="h-48 w-full bg-stone-50 object-contain" />
                  <div className="space-y-2 p-3">
                    <input className="input" value={a.caption} placeholder="Caption" onChange={(e) => up((q) => (q.attachments[i].caption = e.target.value))} />
                    <div className="flex items-center justify-between">
                      <Toggle label="Include in PDF" checked={a.includeInPdf} onChange={(v) => up((q) => (q.attachments[i].includeInPdf = v))} />
                      <button className="btn-ghost px-2 text-red-600" aria-label="Remove attachment" onClick={() => up((q) => q.attachments.splice(i, 1))}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'client' && (
          <div className="grid gap-3 md:grid-cols-2">
            <Card title="Quotation">
              <div className="space-y-3">
                <Field label="Project title">
                  <TextInput value={quote.title} onChange={(v) => up((q) => (q.title = v))} />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Number">
                    <TextInput value={quote.number} onChange={(v) => up((q) => (q.number = v))} />
                  </Field>
                  <Field label="Date">
                    <input type="date" className="input" value={quote.date} onChange={(e) => up((q) => (q.date = e.target.value))} />
                  </Field>
                </div>
                <Field label="Status">
                  <Select<QuoteStatus>
                    value={quote.status}
                    onChange={(v) => v && up((q) => (q.status = v))}
                    options={(['draft', 'sent', 'accepted', 'rejected', 'invoiced'] as QuoteStatus[]).map((s) => ({ value: s, label: s }))}
                  />
                </Field>
                <Field label="Notes shown on quotation">
                  <TextInput multiline value={quote.notes} onChange={(v) => up((q) => (q.notes = v))} />
                </Field>
              </div>
            </Card>
            <Card title="Client">
              <div className="space-y-3">
                <Field label="Name">
                  <TextInput value={quote.client.name} onChange={(v) => up((q) => (q.client.name = v))} />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Phone">
                    <TextInput value={quote.client.phone} onChange={(v) => up((q) => (q.client.phone = v))} />
                  </Field>
                  <Field label="Email">
                    <TextInput value={quote.client.email} onChange={(v) => up((q) => (q.client.email = v))} />
                  </Field>
                </div>
                <Field label="Address / site">
                  <TextInput multiline value={quote.client.address} onChange={(v) => up((q) => (q.client.address = v))} />
                </Field>
              </div>
            </Card>
            {quote.sourceImage && (
              <Card title="Source diagram" className="md:col-span-2">
                <img src={quote.sourceImage} className="max-h-96 rounded-lg object-contain" />
              </Card>
            )}
          </div>
        )}

        {tab === 'costing' && (
          <div className="grid gap-3 md:grid-cols-2">
            <Card title="Adjustments">
              <div className="space-y-3">
                <Field label="Markup / profit on materials & labour">
                  <NumInput value={quote.markupPercent} suffix="%" onChange={(v) => up((q) => (q.markupPercent = v))} />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Discount type">
                    <Select value={quote.discountType} onChange={(v) => v && up((q) => (q.discountType = v))} options={[{ value: 'percent', label: 'Percent %' }, { value: 'amount', label: 'Fixed amount' }]} />
                  </Field>
                  <Field label="Discount">
                    <NumInput value={quote.discountValue} min={0} onChange={(v) => up((q) => (q.discountValue = v))} />
                  </Field>
                </div>
                <Field label="Transport">
                  <Select
                    value={quote.transportId}
                    allowNone="No transport"
                    onChange={(v) => up((q) => (q.transportId = v))}
                    options={settings.pricing.transportOptions.map((t) => ({ value: t.id, label: `${t.name} (${fmt(t.price)})` }))}
                  />
                </Field>
                <Field label="Extra transport / distance charge">
                  <NumInput value={quote.transportCustom} min={0} onChange={(v) => up((q) => (q.transportCustom = v))} />
                </Field>
                <Toggle label={`Include installation (${settings.pricing.installationPercent}% of materials)`} checked={quote.installation} onChange={(v) => up((q) => (q.installation = v))} />
                <Toggle label={`Charge ${settings.pricing.taxLabel} (${settings.pricing.taxRate}%)`} checked={quote.applyTax} onChange={(v) => up((q) => (q.applyTax = v))} />
                <Toggle label="Appliances supplied by us (include prices)" checked={quote.includeAppliances} onChange={(v) => up((q) => (q.includeAppliances = v))} />
              </div>
            </Card>
            <Card title="Summary">
              <Row label="Materials & hardware (cost)" value={fmt(calc.materialsCost - calc.appliancesCost)} />
              {calc.appliancesCost > 0 && <Row label="Appliances (cost)" value={fmt(calc.appliancesCost)} />}
              <Row label={`Labour (${settings.pricing.labourMode === 'percent' ? `${settings.pricing.labourPercent}%` : 'per unit'})`} value={fmt(calc.labour)} />
              {calc.installation > 0 && <Row label="Installation" value={fmt(calc.installation)} />}
              <Row label={`Markup (${quote.markupPercent}%)`} value={fmt(calc.markup)} />
              <div className="my-2 border-t" />
              <Row label="Units" value={fmt(calc.unitsSell)} />
              {calc.transport > 0 && <Row label="Transport" value={fmt(calc.transport)} />}
              {calc.extras > 0 && <Row label="Extras" value={fmt(calc.extras)} />}
              <Row label="Subtotal" value={fmt(calc.subtotal)} />
              {calc.discount > 0 && <Row label="Discount" value={`-${fmt(calc.discount)}`} />}
              {quote.applyTax && <Row label={settings.pricing.taxLabel} value={fmt(calc.tax)} />}
              <div className="my-2 border-t" />
              <Row strong label="Total" value={fmt(calc.total)} />
              <p className="mt-2 rounded-lg bg-emerald-50 p-2 text-xs text-emerald-800">
                Estimated gross profit: <b>{fmt(calc.total - calc.tax - calc.materialsCost - calc.transport)}</b> (labour + markup − discount)
              </p>
            </Card>
            <Card
              title="Extra items"
              className="md:col-span-2"
              actions={
                <button className="btn-secondary px-3 py-1.5" onClick={() => up((q) => q.extras.push({ id: uid('x'), description: '', qty: 1, unitPrice: 0 }))}>
                  <Plus size={14} /> Add line
                </button>
              }
            >
              {!quote.extras.length && <p className="text-sm text-stone-500">Add anything not covered by the units — e.g. removal of old cabinets, LED lighting, appliances, site visit.</p>}
              <div className="space-y-2">
                {quote.extras.map((e, i) => (
                  <div key={e.id} className="grid grid-cols-[1fr_70px_110px_auto] items-center gap-2">
                    <input className="input" placeholder="Description" value={e.description} onChange={(ev) => up((q) => (q.extras[i].description = ev.target.value))} />
                    <NumInput value={e.qty} min={0} onChange={(v) => up((q) => (q.extras[i].qty = v))} />
                    <NumInput value={e.unitPrice} min={0} onChange={(v) => up((q) => (q.extras[i].unitPrice = v))} />
                    <button className="btn-ghost px-2 text-red-600" onClick={() => up((q) => q.extras.splice(i, 1))} aria-label="Remove">
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}

        {tab === 'schedule' && (
          <div className="space-y-3">
            {COST_GROUPS.map((g) => {
              const lines = calc.costLines.filter((l) => l.group === g);
              if (!lines.length) return null;
              return (
                <Card key={g} title={g} actions={<span className="text-sm font-bold">{fmt(lines.reduce((a, l) => a + l.total, 0))}</span>}>
                  <div className="divide-y divide-stone-100">
                    {lines.map((l) => (
                      <div key={l.key} className="flex items-center justify-between gap-3 py-2 text-sm">
                        <div className="min-w-0">
                          <div className="truncate font-medium">{l.description}</div>
                          <div className="text-xs text-stone-500">
                            {l.qty} {l.unit} × {fmt(l.unitPrice)}
                            {l.note ? ` · ${l.note}` : ''}
                          </div>
                        </div>
                        <span className="font-semibold tabular-nums">{fmt(l.total)}</span>
                      </div>
                    ))}
                  </div>
                </Card>
              );
            })}
            {!calc.costLines.length && <p className="p-6 text-center text-sm text-stone-500">No materials yet.</p>}
          </div>
        )}
        {tab === 'schedule' && (
          <div className="space-y-3">
            <div className="card grid grid-cols-2 gap-x-6 p-4 md:grid-cols-4">
              <Row label="Sheets" value={calc.boardPlans.reduce((a, p) => a + p.sheets.length, 0)} />
              <Row label="Board cost" value={fmt(calc.boardPlans.reduce((a, p) => a + p.fullSheetsCost, 0))} />
              <Row label={<span className="text-amber-700">Reusable offcuts</span>} value={fmt(calc.boardPlans.reduce((a, p) => a + p.offcutValue, 0))} />
              <Row label={<span className="text-red-700">Lost to waste</span>} value={fmt(calc.boardPlans.reduce((a, p) => a + p.wasteCost, 0))} />
            </div>
            <p className="px-1 text-xs text-stone-500">
              Mode: <b>{settings.pricing.cutMode === 'guillotine' ? 'Guillotine (panel saw)' : 'Nested (CNC)'}</b> · kerf {settings.pricing.kerf}mm · trim {settings.pricing.sheetTrim}mm · offcuts under {settings.pricing.minOffcut}mm are waste · charging{' '}
              <b>{settings.pricing.boardCharging === 'fullSheets' ? 'full sheets' : 'full sheets minus reusable offcuts'}</b>. Change in Settings → Pricing.
            </p>
            {calc.joins.length > 0 && (
              <div className="card space-y-2 p-4">
                <h3 className="text-sm font-bold uppercase tracking-wide text-stone-600">Joined parts ({calc.joins.length})</h3>
                <p className="text-xs text-stone-500">These parts are bigger than the board or plank, so they are cut in equal pieces (joins in the middle, not at the ends) and joined. Fixings and cleats are already in the cut list and costs.</p>
                {calc.joins.map((j, k) => (
                  <div key={k} className="rounded-xl border border-stone-200 p-2 text-xs">
                    <div className="font-semibold">
                      {j.qty > 1 ? `${j.qty}× ` : ''}
                      {j.item} – {j.part}: {j.original.length} × {j.original.width} mm in {j.material}
                    </div>
                    <div className="text-stone-600">
                      → {j.pieces.length} pieces ({j.pieces.map((p) => `${p.length}×${p.width}`).join(' + ')}) · {j.joints} joint{j.joints === 1 ? '' : 's'}
                      {j.cleats.length ? ` · ${j.cleats.length} cleat/batten${j.cleats.length === 1 ? '' : 's'}` : ''}
                    </div>
                    <div className="text-stone-500">{j.method}</div>
                  </div>
                ))}
              </div>
            )}
            {calc.boardPlans.map((p) => (
              <BoardPlanCard key={p.material.id} plan={p} />
            ))}
            {calc.barPlans.map((p) => (
              <BarPlanCard key={p.profile.id} plan={p} />
            ))}
            {!calc.boardPlans.length && <p className="p-6 text-center text-sm text-stone-500">Add units to see the cutting plan.</p>}
            <button className="btn-secondary w-full" disabled={!!busy || !calc.items.length} onClick={() => exportPdf('workshop')}>
              <Hammer size={16} /> {busy === 'workshop' ? 'Building…' : 'Workshop cut list PDF'}
            </button>
          </div>
        )}

        {tab === 'hub' && <MaterialHub quote={quote} calc={calc} catalog={catalog} up={up} />}

        {tab === 'report' && (
          <div className="grid gap-3 md:grid-cols-2">
            <Card title="Export">
              <div className="grid gap-2">
                <button className="btn-primary justify-start" disabled={!!busy} onClick={() => exportPdf('quote')}>
                  <FileDown size={16} /> {busy === 'quote' ? 'Building…' : 'Quotation PDF (client)'}
                </button>
                <button className="btn-secondary justify-start" disabled={!!busy || !calc.items.length} onClick={() => exportPdf('workshop')}>
                  <Hammer size={16} /> {busy === 'workshop' ? 'Building…' : 'Workshop cut list & material schedule PDF'}
                </button>
                <button className="btn-secondary justify-start" disabled={!calc.items.length || !!busy} onClick={captureViews}>
                  <Camera size={16} /> {busy === 'capture' ? 'Rendering…' : 'Add 3D render views to the PDF'}
                </button>
                <button className="btn-secondary justify-start" disabled={!calc.items.length} onClick={() => { const iid = createInvoiceFromQuote(quote.id); if (iid) nav(`/invoices/${iid}`); }}>
                  <Receipt size={16} /> Create invoice from this quotation
                </button>
                <button className="btn-secondary justify-start" onClick={() => nav(`/quotes/${quote.id}/room`)}>
                  <Home size={16} /> Room layout {quote.room ? '(included in PDF)' : ''}
                </button>
              </div>
              <p className="mt-2 text-xs text-stone-500">Shortcut: Ctrl+P makes the quotation PDF.</p>
            </Card>
            <Card title="Summary">
              <div className="space-y-1 text-sm">
                <Row label="Items" value={calc.items.length} />
                <Row label="Board sheets" value={calc.boardPlans.reduce((a, p) => a + p.sheets.length, 0)} />
                <Row label="Joined parts" value={calc.joins.length} />
                <Row label="Materials & fittings" value={fmt(calc.materialsCost - calc.appliancesCost)} />
                <Row label="Appliances" value={fmt(calc.appliancesCost)} />
                <Row label="Labour" value={fmt(calc.labour)} />
                <Row label="Installation" value={fmt(calc.installation)} />
                <Row label="Mark-up" value={fmt(calc.markup)} />
                <Row label="Transport" value={fmt(calc.transport)} />
                <Row label="Extras" value={fmt(calc.extras)} />
                <Row label="Discount" value={`− ${fmt(calc.discount)}`} />
                <Row label="Tax" value={fmt(calc.tax)} />
                <Row label={<b>Total</b>} value={<b>{fmt(calc.total)}</b>} />
              </div>
            </Card>
          </div>
        )}
      </div>

      <div className="safe-bottom fixed inset-x-0 bottom-[60px] z-30 border-t border-stone-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-2">
          <div>
            <div className="text-[11px] font-semibold uppercase text-stone-500">Quotation total</div>
            <div className="text-xl font-bold tabular-nums">{fmt(calc.total)}</div>
          </div>
          <span className={`chip ${STATUS_STYLE[quote.status]}`}>{quote.status}</span>
          <button
            className="btn-secondary"
            disabled={!calc.items.length}
            onClick={() => {
              const iid = createInvoiceFromQuote(quote.id);
              if (iid) nav(`/invoices/${iid}`);
            }}
          >
            <Receipt size={16} /> Invoice
          </button>
        </div>
      </div>
      <div className="h-16" />

      <AddGroupModal
        open={addingGroup}
        onClose={() => setAddingGroup(false)}
        onAdd={(g) => {
          up((q) => (q.assemblies ??= []).push(g));
          nav(`/quotes/${quote.id}/groups/${g.id}`);
        }}
      />
      <AddUnitModal open={adding} onClose={() => setAdding(false)} onAdd={(u) => up((q) => q.units.push(u))} />
      <Modal open={addingRun} onClose={() => setAddingRun(false)} title="Add a whole kitchen">
        <div className="grid gap-2">
          {(Object.keys(RUN_SHAPE_LABELS) as RunShape[]).map((shape) => (
            <button
              key={shape}
              className="card flex items-center gap-3 p-3 text-left hover:border-violet-400"
              onClick={() => {
                const r = createRun(shape);
                syncRun(r, catalog);
                up((q) => q.runs.push(r));
                setAddingRun(false);
                nav(`/quotes/${quote.id}/runs/${r.id}`);
              }}
            >
              <svg viewBox="0 0 60 40" className="h-12 w-16 shrink-0 text-violet-700" fill="none" stroke="currentColor" strokeWidth={5} strokeLinecap="round">
                <path d={shape === 'straight' ? 'M6 8h48' : shape === 'L' ? 'M6 8h48v26' : 'M6 34V8h48v26'} />
              </svg>
              <div>
                <div className="font-bold">{RUN_SHAPE_LABELS[shape]}</div>
                <div className="text-xs text-stone-500">Linked base, wall and tall cabinets with sink, hob, oven, fridge and continuous worktop — priced as one item.</div>
              </div>
            </button>
          ))}
        </div>
      </Modal>
      <Modal open={menu} onClose={() => setMenu(false)} title="Quotation actions">
        <div className="grid gap-2">
          <button className="btn-secondary justify-start" onClick={() => { setMenu(false); exportPdf('quote'); }}>
            <FileDown size={16} /> Quotation PDF (share / save)
          </button>
          <button className="btn-secondary justify-start" disabled={!calc.items.length} onClick={() => { setMenu(false); exportPdf('workshop'); }}>
            <Hammer size={16} /> Workshop cut list & materials PDF
          </button>
          <button className="btn-secondary justify-start" disabled={!calc.items.length} onClick={() => { const iid = createInvoiceFromQuote(quote.id); if (iid) nav(`/invoices/${iid}`); }}>
            <Receipt size={16} /> Create invoice from this quotation
          </button>
          <button className="btn-secondary justify-start" onClick={() => { const nid = duplicateQuote(quote.id); setMenu(false); if (nid) nav(`/quotes/${nid}`); }}>
            <Copy size={16} /> Duplicate quotation
          </button>
          <button className="btn-danger justify-start" onClick={() => { if (confirmAction('Delete this quotation?')) { deleteQuote(quote.id); nav('/quotes'); } }}>
            <Trash2 size={16} /> Delete quotation
          </button>
        </div>
      </Modal>
    </div>
  );
}
