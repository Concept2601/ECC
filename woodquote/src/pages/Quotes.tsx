import { FilePlus2, FileText, Search } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Empty, PageHeader } from '../components/ui';
import { STATUS_STYLE, useMoney } from '../hooks';
import { quoteTotal } from '../app/totals';
import { TRADES, tradeMeta } from '../app/brand';
import { usePrefs } from '../app/prefs';
import { newQuoteFor } from '../components/Sidebar';
import type { Quote, Trade } from '../lib/types';
import { fmtDate } from '../lib/util';
import { useStore } from '../store';

export default function Quotes() {
  const { quotes } = useStore();
  const trade = usePrefs((s) => s.trade);
  const nav = useNavigate();
  const fmt = useMoney();
  const [q, setQ] = useState('');
  const [only, setOnly] = useState<Trade | 'all'>('all');
  const list = quotes.filter((x) => `${x.title} ${x.number} ${x.client.name}`.toLowerCase().includes(q.toLowerCase()) && (only === 'all' || hasTrade(x, only)));
  const create = () => newQuoteFor(trade, nav);
  return (
    <div>
      <PageHeader
        title="Quotations"
        actions={
          <button className="btn-primary" onClick={create} style={{ background: tradeMeta(trade).accent }}>
            <FilePlus2 size={18} /> New {tradeMeta(trade).label.toLowerCase()}
          </button>
        }
      />
      <div className="mx-auto max-w-5xl space-y-3 p-3">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
          <input className="input pl-9" placeholder="Search by title, number or client" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
          {[{ id: 'all' as const, label: 'All', accent: '#44403c' }, ...TRADES].map((t) => (
            <button key={t.id} onClick={() => setOnly(t.id)} className={`rounded-full border px-3 py-1 text-xs font-semibold ${only === t.id ? 'border-transparent text-white' : 'border-stone-300 bg-white text-stone-600'}`} style={only === t.id ? { background: t.accent } : undefined}>
              {t.label}
            </button>
          ))}
        </div>
        {!quotes.length ? (
          <Empty icon={<FileText />} title="No quotations yet" text="Create a quotation, add units like TV stands, kitchens or wardrobes, and get an instant price, render and cut plan." action={<button className="btn-primary" onClick={create}>Create quotation</button>} />
        ) : (
          <div className="card divide-y divide-stone-100">
            {list.map((x) => (
              <Link key={x.id} to={`/quotes/${x.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-stone-50">
                <div className="min-w-0">
                  <div className="truncate font-semibold">{x.title}</div>
                  <div className="flex items-center gap-1.5 truncate text-xs text-stone-500">
                    {TRADES.filter((t) => hasTrade(x, t.id)).map((t) => (
                      <span key={t.id} className="rounded-full px-1.5 py-px text-[10px] font-semibold" style={{ background: t.soft, color: t.ink }}>
                        {t.label}
                      </span>
                    ))}
                    {x.number} · {x.client.name || 'No client'} · {fmtDate(x.date)}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="font-bold tabular-nums">{fmt(quoteTotal(x))}</span>
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

/** Does a quotation have anything in this trade? */
export function hasTrade(q: Quote, t: Trade) {
  if (t === 'ceilings') return (q.ceilings?.areas.length ?? 0) + (q.ceilings?.extras.length ?? 0) > 0;
  if (t === 'tiling') return (q.tiling?.areas.length ?? 0) + (q.tiling?.extras.length ?? 0) > 0;
  return q.units.length + q.runs.length + (q.assemblies?.length ?? 0) > 0;
}
