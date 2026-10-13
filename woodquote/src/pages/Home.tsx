import { FilePlus2, FileText, Receipt, ScanLine } from 'lucide-react';
import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { STATUS_STYLE, useMoney } from '../hooks';
import { calculateInvoice, calculateQuote } from '../lib/pricing';
import { fmtDate } from '../lib/util';
import { useStore } from '../store';
import { Stat } from '../components/ui';

export default function Home() {
  const { quotes, invoices, settings, catalog, createQuote } = useStore();
  const nav = useNavigate();
  const fmt = useMoney();
  const stats = useMemo(() => {
    const inv = invoices.map((i) => calculateInvoice(i, settings));
    const open = quotes.filter((q) => q.status === 'draft' || q.status === 'sent');
    return {
      pipeline: open.reduce((a, q) => a + calculateQuote(q, catalog, settings).total, 0),
      invoiced: inv.reduce((a, c) => a + c.total, 0),
      received: inv.reduce((a, c) => a + c.paid, 0),
      outstanding: inv.reduce((a, c) => a + Math.max(0, c.balance), 0),
    };
  }, [quotes, invoices, settings, catalog]);

  return (
    <div>
      <div className="safe-top bg-gradient-to-br from-brand-700 via-brand-600 to-brand-500 px-4 pb-16 pt-6 text-white">
        <div className="mx-auto max-w-5xl">
          <div className="flex items-center gap-3">
            {settings.company.logo ? <img src={settings.company.logo} className="h-10 w-10 rounded-xl bg-white object-contain p-1" /> : <img src="./favicon.svg" className="h-10 w-10" />}
            <div>
              <div className="text-xs uppercase tracking-widest text-brand-100">WoodQuote by 2601</div>
              <div className="text-xl font-bold">{settings.company.name}</div>
            </div>
          </div>
        </div>
      </div>
      <div className="mx-auto -mt-12 max-w-5xl space-y-4 px-3">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Open quotes" value={fmt(stats.pipeline)} />
          <Stat label="Invoiced" value={fmt(stats.invoiced)} />
          <Stat label="Received" value={fmt(stats.received)} tone="good" />
          <Stat label="Outstanding" value={fmt(stats.outstanding)} tone={stats.outstanding > 0 ? 'warn' : undefined} />
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <button className="card flex flex-col items-start gap-2 p-4 text-left hover:border-brand-300" onClick={() => nav(`/quotes/${createQuote()}`)}>
            <FilePlus2 className="text-brand-600" />
            <span className="font-bold">New quotation</span>
            <span className="text-xs text-stone-500">Design units & price them</span>
          </button>
          <Link to="/reader" className="card flex flex-col items-start gap-2 p-4 hover:border-brand-300">
            <ScanLine className="text-brand-600" />
            <span className="font-bold">Diagram reader</span>
            <span className="text-xs text-stone-500">Plan, sketch or 3D → quote</span>
          </Link>
          <Link to="/quotes" className="card flex flex-col items-start gap-2 p-4 hover:border-brand-300">
            <FileText className="text-brand-600" />
            <span className="font-bold">Quotations</span>
            <span className="text-xs text-stone-500">{quotes.length} saved</span>
          </Link>
          <Link to="/invoices" className="card flex flex-col items-start gap-2 p-4 hover:border-brand-300">
            <Receipt className="text-brand-600" />
            <span className="font-bold">Invoices & receipts</span>
            <span className="text-xs text-stone-500">{invoices.length} invoices</span>
          </Link>
        </div>

        <section className="card divide-y divide-stone-100">
          <div className="flex items-center justify-between p-4">
            <h2 className="text-sm font-bold uppercase tracking-wide text-stone-600">Recent quotations</h2>
            <Link to="/quotes" className="text-sm font-semibold text-brand-700">See all</Link>
          </div>
          {quotes.slice(0, 5).map((q) => (
            <Link key={q.id} to={`/quotes/${q.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-stone-50">
              <div className="min-w-0">
                <div className="truncate font-semibold">{q.title}</div>
                <div className="text-xs text-stone-500">{q.number} · {q.client.name || 'No client'} · {fmtDate(q.date)}</div>
              </div>
              <span className={`chip ${STATUS_STYLE[q.status]}`}>{q.status}</span>
            </Link>
          ))}
          {!quotes.length && <p className="p-4 text-sm text-stone-500">No quotations yet — start one above.</p>}
        </section>
      </div>
    </div>
  );
}
