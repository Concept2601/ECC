import { FilePlus2, FileText, Receipt } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Empty, Modal, PageHeader } from '../components/ui';
import { STATUS_STYLE, useMoney } from '../hooks';
import { calculateInvoice, calculateQuote } from '../lib/pricing';
import { fmtDate } from '../lib/util';
import { useStore } from '../store';

export default function Invoices() {
  const { invoices, settings, catalog, quotes, createInvoice, createInvoiceFromQuote } = useStore();
  const nav = useNavigate();
  const fmt = useMoney();
  const [params, setParams] = useSearchParams();
  const [pickState, setPicking] = useState(false);
  const picking = pickState || params.get('new') === '1';
  const closePick = () => (setPicking(false), setParams({}));
  const invoiced = new Set(invoices.map((i) => i.quoteId).filter(Boolean));
  return (
    <div>
      <PageHeader
        title="Invoices & receipts"
        actions={
          <button className="btn-primary" onClick={() => setPicking(true)}>
            <FilePlus2 size={18} /> New invoice
          </button>
        }
      />
      <div className="mx-auto max-w-5xl space-y-3 p-3">
        {!invoices.length ? (
          <Empty icon={<Receipt />} title="No invoices yet" text="Open a quotation and tap “Invoice” to convert it, or create a blank invoice. Record deposits and payments to issue receipts." />
        ) : (
          <div className="card divide-y divide-stone-100">
            {invoices.map((i) => {
              const c = calculateInvoice(i, settings);
              return (
                <Link key={i.id} to={`/invoices/${i.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-stone-50">
                  <div className="min-w-0">
                    <div className="truncate font-semibold">{i.client.name || 'No client'}</div>
                    <div className="text-xs text-stone-500">
                      {i.number}
                      {i.quoteNumber ? ` · from ${i.quoteNumber}` : ''} · {fmtDate(i.date)} · {i.payments.length} payment(s)
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="font-bold tabular-nums">{fmt(c.total)}</span>
                    <span className="text-xs text-stone-500">bal. {fmt(Math.max(0, c.balance))}</span>
                    <span className={`chip ${STATUS_STYLE[c.status]}`}>{c.status}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
      <Modal open={picking} onClose={closePick} title="New invoice">
        <div className="space-y-3">
          <p className="text-sm text-stone-600">Pick the quotation to invoice. Its items, transport, extras and discount are copied in; you can edit everything and add deviations afterwards.</p>
          <div className="max-h-[50vh] divide-y divide-stone-100 overflow-y-auto rounded-xl border border-stone-200">
            {quotes.map((q) => (
              <button
                key={q.id}
                className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-stone-50 disabled:opacity-40"
                disabled={!q.units.length && !q.runs.length && !q.assemblies?.length && !q.extras.length}
                onClick={() => {
                  const id = createInvoiceFromQuote(q.id);
                  closePick();
                  if (id) nav(`/invoices/${id}`);
                }}
              >
                <span className="min-w-0">
                  <span className="block truncate font-semibold">
                    <FileText size={14} className="mr-1 inline" />
                    {q.title}
                  </span>
                  <span className="block text-xs text-stone-500">
                    {q.number} · {q.client.name || 'No client'} · {fmtDate(q.date)}
                    {invoiced.has(q.id) ? ' · already invoiced' : ''}
                  </span>
                </span>
                <span className="shrink-0 text-sm font-bold tabular-nums">{fmt(calculateQuote(q, catalog, settings).total)}</span>
              </button>
            ))}
            {!quotes.length && <p className="p-4 text-sm text-stone-500">No quotations yet.</p>}
          </div>
          <button className="btn-secondary w-full" onClick={() => nav(`/invoices/${createInvoice()}`)}>
            Blank invoice (not from a quotation)
          </button>
        </div>
      </Modal>
    </div>
  );
}
