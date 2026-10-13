import { FilePlus2, Receipt } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { Empty, PageHeader } from '../components/ui';
import { STATUS_STYLE, useMoney } from '../hooks';
import { calculateInvoice } from '../lib/pricing';
import { fmtDate } from '../lib/util';
import { useStore } from '../store';

export default function Invoices() {
  const { invoices, settings, createInvoice } = useStore();
  const nav = useNavigate();
  const fmt = useMoney();
  return (
    <div>
      <PageHeader
        title="Invoices & receipts"
        actions={
          <button className="btn-primary" onClick={() => nav(`/invoices/${createInvoice()}`)}>
            <FilePlus2 size={18} /> New
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
    </div>
  );
}
