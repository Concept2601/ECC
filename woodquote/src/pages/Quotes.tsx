import { FilePlus2, FileText, Search } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Empty, PageHeader } from '../components/ui';
import { STATUS_STYLE, useMoney } from '../hooks';
import { calculateQuote } from '../lib/pricing';
import { fmtDate } from '../lib/util';
import { useStore } from '../store';

export default function Quotes() {
  const { quotes, createQuote, catalog, settings } = useStore();
  const nav = useNavigate();
  const fmt = useMoney();
  const [q, setQ] = useState('');
  const list = quotes.filter((x) => `${x.title} ${x.number} ${x.client.name}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <div>
      <PageHeader
        title="Quotations"
        actions={
          <button className="btn-primary" onClick={() => nav(`/quotes/${createQuote()}`)}>
            <FilePlus2 size={18} /> New
          </button>
        }
      />
      <div className="mx-auto max-w-5xl space-y-3 p-3">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
          <input className="input pl-9" placeholder="Search by title, number or client" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        {!quotes.length ? (
          <Empty icon={<FileText />} title="No quotations yet" text="Create a quotation, add units like TV stands, kitchens or wardrobes, and get an instant price, render and cut plan." action={<button className="btn-primary" onClick={() => nav(`/quotes/${createQuote()}`)}>Create quotation</button>} />
        ) : (
          <div className="card divide-y divide-stone-100">
            {list.map((x) => (
              <Link key={x.id} to={`/quotes/${x.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-stone-50">
                <div className="min-w-0">
                  <div className="truncate font-semibold">{x.title}</div>
                  <div className="truncate text-xs text-stone-500">
                    {x.number} · {x.client.name || 'No client'} · {fmtDate(x.date)} · {x.units.length} unit(s)
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="font-bold tabular-nums">{fmt(calculateQuote(x, catalog, settings).total)}</span>
                  <span className={`chip ${STATUS_STYLE[x.status]}`}>{x.status}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
