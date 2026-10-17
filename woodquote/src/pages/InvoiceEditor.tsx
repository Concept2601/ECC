import { FileDown, Plus, ReceiptText, Trash2, Wallet } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Card, confirmAction, Field, Modal, NumInput, PageHeader, Row, Select, TextInput, Toggle } from '../components/ui';
import { STATUS_STYLE, useInvoiceCalc, useMoney } from '../hooks';
import type { Invoice } from '../lib/types';
import { fmtDate, round2, todayISO, uid } from '../lib/util';
import { invoicePdf, receiptPdf, saveOrShare } from '../pdf/pdf';
import { usePageShortcuts } from '../app/shortcuts';
import { useStore } from '../store';

const METHODS = ['Cash', 'Bank transfer', 'EcoCash', 'Card', 'Cheque', 'Other'];

export default function InvoiceEditor() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const inv = useStore((s) => s.invoices.find((i) => i.id === id));
  const { updateInvoice, deleteInvoice, addPayment, settings } = useStore();
  const calc = useInvoiceCalc(inv);
  const fmt = useMoney();
  const [payOpen, setPayOpen] = useState(false);
  const [pay, setPay] = useState({ date: todayISO(), amount: 0, method: 'Cash', reference: '' });
  const keys = usePageShortcuts();

  if (!inv || !calc) return <PageHeader title="Invoice not found" back="/invoices" />;
  keys.current = { pdf: () => saveOrShare(invoicePdf(inv, settings), `${inv.number}-invoice.pdf`) };
  const up = (fn: (i: Invoice) => void) => updateInvoice(inv.id, fn);

  const openPayment = (amount: number) => {
    setPay({ date: todayISO(), amount: round2(Math.max(0, amount)), method: 'Cash', reference: '' });
    setPayOpen(true);
  };

  return (
    <div>
      <PageHeader
        title={inv.number}
        subtitle={inv.client.name || 'Invoice'}
        back="/invoices"
        actions={
          <button className="btn-primary px-3" aria-label="Invoice PDF" onClick={() => saveOrShare(invoicePdf(inv, settings), `${inv.number}-invoice.pdf`)}>
            <FileDown size={18} /> <span className="hidden sm:inline">Invoice PDF</span>
          </button>
        }
      />
      <div className="mx-auto grid max-w-5xl gap-3 p-3 md:grid-cols-[1fr_340px]">
        <div className="space-y-3">
          <Card title="Line items" actions={<button className="btn-secondary px-3 py-1.5" onClick={() => up((i) => i.lines.push({ id: uid('l'), description: '', qty: 1, unitPrice: 0 }))}><Plus size={14} /> Line</button>}>
            <div className="space-y-2">
              {inv.lines.map((l, k) => (
                <div key={l.id} className="grid grid-cols-[1fr_auto] gap-2 rounded-xl border border-stone-200 p-2">
                  <input className="input" placeholder="Description" value={l.description} onChange={(e) => up((i) => (i.lines[k].description = e.target.value))} />
                  <button className="btn-ghost px-2 text-red-600" onClick={() => up((i) => i.lines.splice(k, 1))} aria-label="Remove">
                    <Trash2 size={16} />
                  </button>
                  <div className="col-span-2 grid grid-cols-3 items-center gap-2">
                    <NumInput value={l.qty} min={0} suffix="qty" onChange={(v) => up((i) => (i.lines[k].qty = v))} />
                    <NumInput value={l.unitPrice} min={0} suffix="each" onChange={(v) => up((i) => (i.lines[k].unitPrice = v))} />
                    <div className="text-right font-semibold tabular-nums">{fmt(l.qty * l.unitPrice)}</div>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card title="Adjustments, deposit & tax">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Discount type">
                <Select value={inv.discountType} onChange={(v) => v && up((i) => (i.discountType = v))} options={[{ value: 'percent', label: 'Percent %' }, { value: 'amount', label: 'Fixed amount' }]} />
              </Field>
              <Field label="Discount">
                <NumInput value={inv.discountValue} min={0} onChange={(v) => up((i) => (i.discountValue = v))} />
              </Field>
              <Field label="Deposit type">
                <Select value={inv.depositType} onChange={(v) => v && up((i) => (i.depositType = v))} options={[{ value: 'percent', label: 'Percent %' }, { value: 'amount', label: 'Fixed amount' }]} />
              </Field>
              <Field label="Deposit required">
                <NumInput value={inv.depositValue} min={0} onChange={(v) => up((i) => (i.depositValue = v))} />
              </Field>
            </div>
            <div className="mt-2">
              <Toggle label={`Charge ${settings.pricing.taxLabel} (${settings.pricing.taxRate}%)`} checked={inv.applyTax} onChange={(v) => up((i) => (i.applyTax = v))} />
            </div>
          </Card>

          <Card title="Client & dates">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Invoice no." className="col-span-2 sm:col-span-1">
                <TextInput value={inv.number} onChange={(v) => up((i) => (i.number = v))} />
              </Field>
              <Field label="Quote ref." className="col-span-2 sm:col-span-1">
                <div className="flex items-center gap-2">
                  <TextInput value={inv.quoteNumber} onChange={(v) => up((i) => (i.quoteNumber = v))} />
                  {inv.quoteId && <Link className="text-xs font-semibold text-brand-700" to={`/quotes/${inv.quoteId}`}>open</Link>}
                </div>
              </Field>
              <Field label="Date">
                <input type="date" className="input" value={inv.date} onChange={(e) => up((i) => (i.date = e.target.value))} />
              </Field>
              <Field label="Due date">
                <input type="date" className="input" value={inv.dueDate} onChange={(e) => up((i) => (i.dueDate = e.target.value))} />
              </Field>
              <Field label="Client name" className="col-span-2">
                <TextInput value={inv.client.name} onChange={(v) => up((i) => (i.client.name = v))} />
              </Field>
              <Field label="Phone">
                <TextInput value={inv.client.phone} onChange={(v) => up((i) => (i.client.phone = v))} />
              </Field>
              <Field label="Email">
                <TextInput value={inv.client.email} onChange={(v) => up((i) => (i.client.email = v))} />
              </Field>
              <Field label="Address" className="col-span-2">
                <TextInput multiline value={inv.client.address} onChange={(v) => up((i) => (i.client.address = v))} />
              </Field>
              <Field label="Notes on invoice" className="col-span-2">
                <TextInput multiline value={inv.notes} onChange={(v) => up((i) => (i.notes = v))} />
              </Field>
            </div>
          </Card>
          <button className="btn-danger w-full" onClick={() => { if (confirmAction('Delete this invoice and its payments?')) { deleteInvoice(inv.id); nav('/invoices'); } }}>
            <Trash2 size={16} /> Delete invoice
          </button>
        </div>

        <div className="order-first space-y-3 md:order-none md:sticky md:top-20 md:self-start">
          <Card title="Balance" actions={<span className={`chip ${STATUS_STYLE[calc.status]}`}>{calc.status}</span>}>
            <Row label="Subtotal" value={fmt(calc.subtotal)} />
            {calc.discount > 0 && <Row label="Discount" value={`-${fmt(calc.discount)}`} />}
            {inv.applyTax && <Row label={settings.pricing.taxLabel} value={fmt(calc.tax)} />}
            <Row strong label="Total" value={fmt(calc.total)} />
            <div className="my-2 border-t" />
            <Row label="Deposit required" value={fmt(calc.depositDue)} />
            <Row label="Paid to date" value={<span className="text-emerald-700">{fmt(calc.paid)}</span>} />
            <Row strong label="Balance due" value={<span className={calc.balance > 0 ? 'text-red-700' : 'text-emerald-700'}>{fmt(Math.max(0, calc.balance))}</span>} />
            {calc.balance < 0 && <p className="mt-1 text-xs text-amber-700">Overpaid by {fmt(-calc.balance)}.</p>}
            <div className="mt-3 grid gap-2">
              {calc.paid < calc.depositDue && (
                <button className="btn-primary" onClick={() => openPayment(calc.depositDue - calc.paid)}>
                  <Wallet size={16} /> Record deposit ({fmt(calc.depositDue - calc.paid)})
                </button>
              )}
              <button className={calc.paid < calc.depositDue ? 'btn-secondary' : 'btn-primary'} disabled={calc.balance <= 0} onClick={() => openPayment(calc.balance)}>
                <Wallet size={16} /> Record payment
              </button>
            </div>
          </Card>
          <Card title="Payments & receipts">
            {!inv.payments.length && <p className="text-sm text-stone-500">No payments yet.</p>}
            <div className="divide-y divide-stone-100">
              {[...inv.payments].sort((a, b) => a.date.localeCompare(b.date)).map((p) => (
                <div key={p.id} className="flex items-center gap-2 py-2">
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold tabular-nums">{fmt(p.amount)}</div>
                    <div className="truncate text-xs text-stone-500">
                      {p.receiptNumber} · {fmtDate(p.date)} · {p.method}
                      {p.reference ? ` · ${p.reference}` : ''}
                    </div>
                  </div>
                  <button className="btn-secondary px-2.5 py-1.5 text-xs" onClick={() => saveOrShare(receiptPdf(inv, p, settings), `${p.receiptNumber}-receipt.pdf`)}>
                    <ReceiptText size={14} /> Receipt
                  </button>
                  <button className="btn-ghost px-1.5 text-red-600" aria-label="Delete payment" onClick={() => confirmAction('Delete this payment?') && up((i) => (i.payments = i.payments.filter((x) => x.id !== p.id)))}>
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      <Modal
        open={payOpen}
        onClose={() => setPayOpen(false)}
        title="Record payment"
        footer={
          <button
            className="btn-primary w-full"
            disabled={pay.amount <= 0}
            onClick={() => {
              const pid = addPayment(inv.id, pay);
              setPayOpen(false);
              const fresh = useStore.getState().invoices.find((i) => i.id === inv.id)!;
              const p = fresh.payments.find((x) => x.id === pid)!;
              if (confirmAction('Payment saved. Generate the receipt PDF now?')) saveOrShare(receiptPdf(fresh, p, settings), `${p.receiptNumber}-receipt.pdf`);
            }}
          >
            Save payment & issue receipt
          </button>
        }
      >
        <div className="space-y-3">
          <Field label="Amount">
            <NumInput value={pay.amount} min={0} onChange={(v) => setPay({ ...pay, amount: v })} />
          </Field>
          <div className="flex flex-wrap gap-2">
            {calc.depositDue - calc.paid > 0 && <button className="btn-secondary px-3 py-1.5 text-xs" onClick={() => setPay({ ...pay, amount: round2(calc.depositDue - calc.paid) })}>Deposit {fmt(calc.depositDue - calc.paid)}</button>}
            <button className="btn-secondary px-3 py-1.5 text-xs" onClick={() => setPay({ ...pay, amount: round2(calc.balance) })}>Full balance {fmt(calc.balance)}</button>
          </div>
          <Field label="Date">
            <input type="date" className="input" value={pay.date} onChange={(e) => setPay({ ...pay, date: e.target.value })} />
          </Field>
          <Field label="Method">
            <Select value={pay.method} onChange={(v) => setPay({ ...pay, method: v ?? 'Cash' })} options={METHODS.map((m) => ({ value: m, label: m }))} />
          </Field>
          <Field label="Reference">
            <TextInput value={pay.reference} placeholder="Transaction ID, cheque no…" onChange={(v) => setPay({ ...pay, reference: v })} />
          </Field>
          <p className="text-xs text-stone-500">Balance after this payment: <b>{fmt(Math.max(0, calc.balance - pay.amount))}</b></p>
        </div>
      </Modal>
    </div>
  );
}
