import { AlertTriangle, Copy, FileDown, Hammer, Minus, MoreVertical, Pencil, Plus, Receipt, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import AddUnitModal from '../components/AddUnitModal';
import { BarPlanCard, BoardPlanCard } from '../components/CutPlanView';
import { Card, confirmAction, Field, Modal, NumInput, PageHeader, Row, Select, Tabs, TextInput, Toggle } from '../components/ui';
import UnitThumb from '../components/UnitThumb';
import { STATUS_STYLE, useMoney, useQuoteCalc } from '../hooks';
import { describeUnit } from '../lib/describe';
import type { CostGroup } from '../lib/pricing';
import type { Quote, QuoteStatus } from '../lib/types';
import { deepClone, uid } from '../lib/util';
import { quotePdf, saveOrShare, workshopPdf } from '../pdf/pdf';
import { useStore } from '../store';

type Tab = 'units' | 'client' | 'pricing' | 'cut' | 'materials';

export default function QuoteEditor() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const quote = useStore((s) => s.quotes.find((q) => q.id === id));
  const { updateQuote, deleteQuote, duplicateQuote, createInvoiceFromQuote, catalog, settings } = useStore();
  const calc = useQuoteCalc(quote);
  const fmt = useMoney();
  const [tab, setTab] = useState<Tab>('units');
  const [adding, setAdding] = useState(false);
  const [menu, setMenu] = useState(false);
  const [busy, setBusy] = useState('');

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
            { value: 'units', label: `Units (${quote.units.length})` },
            { value: 'client', label: 'Client & details' },
            { value: 'pricing', label: 'Pricing' },
            { value: 'cut', label: 'Cut plan' },
            { value: 'materials', label: 'Materials list' },
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

        {tab === 'units' && (
          <div className="space-y-3">
            {quote.units.map((u, i) => {
              const up2 = calc.units[i];
              return (
                <div key={u.id} className="card flex flex-col gap-3 p-3 sm:flex-row">
                  <Link to={`/quotes/${quote.id}/units/${u.id}`} className="shrink-0">
                    <UnitThumb unit={u} build={up2.build} catalog={catalog} className="h-40 w-full sm:h-32 sm:w-40" />
                  </Link>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <Link to={`/quotes/${quote.id}/units/${u.id}`} className="font-bold hover:text-brand-700">
                        {u.name}
                      </Link>
                      <div className="text-right">
                        <div className="font-bold tabular-nums">{fmt(up2.sell)}</div>
                        {u.qty > 1 && <div className="text-xs text-stone-500">{fmt(up2.sellEach)} each</div>}
                      </div>
                    </div>
                    <ul className="mt-1 space-y-0.5 text-xs text-stone-600">
                      {describeUnit(u, catalog).slice(0, 4).map((l) => (
                        <li key={l} className="truncate">
                          {l}
                        </li>
                      ))}
                    </ul>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <div className="flex items-center rounded-xl border border-stone-300">
                        <button className="px-2 py-1.5" aria-label="Less" onClick={() => up((q) => (q.units[i].qty = Math.max(1, q.units[i].qty - 1)))}>
                          <Minus size={14} />
                        </button>
                        <span className="w-8 text-center text-sm font-semibold">{u.qty}</span>
                        <button className="px-2 py-1.5" aria-label="More" onClick={() => up((q) => (q.units[i].qty += 1))}>
                          <Plus size={14} />
                        </button>
                      </div>
                      <Link className="btn-secondary px-3 py-1.5" to={`/quotes/${quote.id}/units/${u.id}`}>
                        <Pencil size={14} /> Design
                      </Link>
                      <button className="btn-ghost px-2 py-1.5" aria-label="Duplicate" onClick={() => up((q) => q.units.splice(i + 1, 0, { ...deepClone(u), id: uid('u'), name: `${u.name} (copy)` }))}>
                        <Copy size={16} />
                      </button>
                      <button className="btn-ghost px-2 py-1.5 text-red-600" aria-label="Delete" onClick={() => confirmAction(`Remove ${u.name}?`) && up((q) => q.units.splice(i, 1))}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
            <button className="card flex w-full items-center justify-center gap-2 border-dashed p-5 font-semibold text-brand-700 hover:border-brand-400" onClick={() => setAdding(true)}>
              <Plus size={18} /> Add unit (TV stand, kitchen, wardrobe…)
            </button>
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

        {tab === 'pricing' && (
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
              </div>
            </Card>
            <Card title="Summary">
              <Row label="Materials & hardware (cost)" value={fmt(calc.materialsCost)} />
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

        {tab === 'cut' && (
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
            {calc.boardPlans.map((p) => (
              <BoardPlanCard key={p.material.id} plan={p} />
            ))}
            {calc.barPlans.map((p) => (
              <BarPlanCard key={p.profile.id} plan={p} />
            ))}
            {!calc.boardPlans.length && <p className="p-6 text-center text-sm text-stone-500">Add units to see the cutting plan.</p>}
            <button className="btn-secondary w-full" disabled={!!busy || !quote.units.length} onClick={() => exportPdf('workshop')}>
              <Hammer size={16} /> {busy === 'workshop' ? 'Building…' : 'Workshop cut list PDF'}
            </button>
          </div>
        )}

        {tab === 'materials' && (
          <div className="space-y-3">
            {(['Boards', 'Edge banding', 'Glass', 'Aluminium', 'Countertops', 'Hardware'] as CostGroup[]).map((g) => {
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
            disabled={!quote.units.length}
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

      <AddUnitModal open={adding} onClose={() => setAdding(false)} onAdd={(u) => up((q) => q.units.push(u))} />
      <Modal open={menu} onClose={() => setMenu(false)} title="Quotation actions">
        <div className="grid gap-2">
          <button className="btn-secondary justify-start" onClick={() => { setMenu(false); exportPdf('quote'); }}>
            <FileDown size={16} /> Quotation PDF (share / save)
          </button>
          <button className="btn-secondary justify-start" disabled={!quote.units.length} onClick={() => { setMenu(false); exportPdf('workshop'); }}>
            <Hammer size={16} /> Workshop cut list & materials PDF
          </button>
          <button className="btn-secondary justify-start" disabled={!quote.units.length} onClick={() => { const iid = createInvoiceFromQuote(quote.id); if (iid) nav(`/invoices/${iid}`); }}>
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
