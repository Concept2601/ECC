// Dashboard: where the business stands — open, draft and closed quotations,
// invoices and receipts, quick tools — with a + button for a new quotation.
import { BookOpen, Menu, FileCheck2, FilePen, FileText, LayoutDashboard, Map as MapIcon, Plus, Receipt, Ruler, ScanLine, ShieldCheck, TrendingUp } from 'lucide-react';
import { TRADES, tradeMeta } from '../app/brand';
import { usePrefs } from '../app/prefs';
import { quoteTotal } from '../app/totals';
import { newQuoteFor, useDrawer } from '../components/Sidebar';
import { useMemo, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import EditTools from '../components/EditTools';
import { useLicence } from '../components/Licence';
import { Stat } from '../components/ui';
import { STATUS_STYLE, useMoney } from '../hooks';
import { calculateInvoice } from '../lib/pricing';
import type { Quote } from '../lib/types';
import { fmtDate } from '../lib/util';
import { useStore } from '../store';

function Section({ title, icon, link, children, empty }: { title: string; icon: ReactNode; link?: string; children: ReactNode; empty?: string | false }) {
  return (
    <section className="card divide-y divide-stone-100">
      <div className="flex items-center justify-between p-4">
        <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-stone-600">
          {icon} {title}
        </h2>
        {link && (
          <Link to={link} className="text-sm font-semibold text-brand-700">
            See all
          </Link>
        )}
      </div>
      {children}
      {empty && <p className="p-4 text-sm text-stone-500">{empty}</p>}
    </section>
  );
}

export default function Home() {
  const { quotes, invoices, settings, catalog } = useStore();
  const trade = usePrefs((s) => s.trade);
  const meta = tradeMeta(trade);
  const nav = useNavigate();
  const fmt = useMoney();
  const lic = useLicence();
  // remembered per quotation (worked out on the loading page), so the dashboard opens instantly
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const totals = useMemo(() => new Map(quotes.map((q) => [q.id, quoteTotal(q)])), [quotes, catalog, settings]);
  const inv = useMemo(() => invoices.map((i) => ({ i, c: calculateInvoice(i, settings) })), [invoices, settings]);
  const open = quotes.filter((q) => q.status === 'sent' || q.status === 'accepted');
  const drafts = quotes.filter((q) => q.status === 'draft');
  const closed = quotes.filter((q) => q.status === 'invoiced');
  const receipts = inv.flatMap(({ i }) => i.payments.map((p) => ({ p, i }))).sort((a, b) => b.p.date.localeCompare(a.p.date));
  const sumQ = (l: Quote[]) => l.reduce((a, q) => a + (totals.get(q.id) ?? 0), 0);
  const conversion = quotes.length ? Math.round((closed.length / quotes.length) * 100) : 0;
  // quoted value per month, last 6 months
  const months = useMemo(() => {
    const out: { key: string; label: string; value: number }[] = [];
    const d = new Date();
    for (let k = 5; k >= 0; k--) {
      const m = new Date(d.getFullYear(), d.getMonth() - k, 1);
      const key = `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}`;
      out.push({ key, label: m.toLocaleString(undefined, { month: 'short' }), value: quotes.filter((q) => q.date.startsWith(key)).reduce((a, q) => a + (totals.get(q.id) ?? 0), 0) });
    }
    return out;
  }, [quotes, totals]);
  const maxM = Math.max(1, ...months.map((m) => m.value));
  const row = (q: Quote) => (
    <Link key={q.id} to={`/quotes/${q.id}`} className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-stone-50">
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 truncate font-semibold">
          {q.title}
          {TRADES.filter((t) => (t.id === 'joinery' ? q.units.length + q.runs.length + (q.assemblies?.length ?? 0) > 0 : t.id === 'ceilings' ? (q.ceilings?.areas.length ?? 0) > 0 : (q.tiling?.areas.length ?? 0) > 0)).map((t) => (
            <span key={t.id} title={t.label} className="h-2 w-2 shrink-0 rounded-full" style={{ background: t.accent }} />
          ))}
        </div>
        <div className="text-xs text-stone-500">
          {q.number} · {q.client.name || 'No client'} · {fmtDate(q.date)}
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-0.5">
        <span className="text-sm font-bold tabular-nums">{fmt(totals.get(q.id) ?? 0)}</span>
        <span className={`chip ${STATUS_STYLE[q.status]}`}>{q.status}</span>
      </div>
    </Link>
  );

  return (
    <div>
      <div className="safe-top relative overflow-hidden bg-[#14161a] px-4 pb-16 pt-6 text-white">
        <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full opacity-40 blur-3xl" style={{ background: meta.accent }} />
        <div className="relative mx-auto max-w-5xl">
          <div className="flex items-center gap-3">
            <button className="-ml-1 rounded-xl p-2 text-stone-300 hover:bg-white/10 md:hidden" aria-label="Menu" onClick={() => useDrawer.setState({ open: true })}>
              <Menu size={22} />
            </button>
            {settings.company.logo ? <img src={settings.company.logo} className="h-11 w-11 rounded-xl bg-white object-contain p-1" /> : null}
            <div>
              <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-stone-400">
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: meta.accent }} /> {meta.label} workspace
              </div>
              <div className="text-2xl font-semibold tracking-tight">{settings.company.name}</div>
            </div>
            <div className="ml-auto">
              <EditTools light />
            </div>
          </div>
        </div>
      </div>
      <div className="relative z-10 mx-auto -mt-12 max-w-5xl space-y-4 px-3">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Open quotations" value={fmt(sumQ(open) + sumQ(drafts))} />
          <Stat label="Invoiced" value={fmt(inv.reduce((a, x) => a + x.c.total, 0))} />
          <Stat label="Received" value={fmt(inv.reduce((a, x) => a + x.c.paid, 0))} tone="good" />
          <Stat label="Outstanding" value={fmt(inv.reduce((a, x) => a + Math.max(0, x.c.balance), 0))} tone={inv.some((x) => x.c.balance > 0) ? 'warn' : undefined} />
        </div>

        {lic?.ok && lic.daysLeft <= 7 && (
          <Link to="/settings/developer" className="flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            <ShieldCheck size={16} /> Licence ends in {lic.daysLeft} day{lic.daysLeft === 1 ? '' : 's'} — renew with a new code.
          </Link>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <section className="card p-4">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-stone-600">
              <TrendingUp size={16} /> Quoted per month
            </h2>
            <div className="flex h-32 items-end gap-2">
              {months.map((m) => (
                <div key={m.key} className="flex flex-1 flex-col items-center gap-1" title={fmt(m.value)}>
                  <div className="w-full rounded-t-md" style={{ background: meta.accent, height: `${Math.max(2, (m.value / maxM) * 100)}%` }} />
                  <span className="text-[10px] text-stone-500">{m.label}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
              <div className="rounded-lg bg-stone-50 p-2">
                <div className="text-lg font-bold">{quotes.length}</div>quotations
              </div>
              <div className="rounded-lg bg-stone-50 p-2">
                <div className="text-lg font-bold">{conversion}%</div>won (invoiced)
              </div>
              <div className="rounded-lg bg-stone-50 p-2">
                <div className="text-lg font-bold">{receipts.length}</div>receipts
              </div>
            </div>
          </section>
          <section className="card grid grid-cols-2 gap-2 p-3 sm:grid-cols-4">
            {(trade === 'joinery'
              ? [
                  { to: '/start-room', icon: LayoutDashboard, title: 'Start from a room', hint: 'Draw the room, place everything, get the quote' },
                  { to: '/reader', icon: ScanLine, title: 'Diagram reader', hint: 'Sketch, plan or 3D → quote' },
                  { to: '/plan', icon: MapIcon, title: 'Plan reader', hint: 'PDF plan → room & joinery' },
                  { to: '/fit', icon: Ruler, title: 'Measure a space', hint: 'What fits W × H × D' },
                ]
              : [
                  { to: '/settings/materials', icon: BookOpen, title: `${meta.label} price list`, hint: trade === 'ceilings' ? 'Boards, PVC, brandering, cornices, paint' : 'Tiles, adhesive, grout, trims' },
                  { to: '/settings/customization', icon: Ruler, title: 'Labour & markup rates', hint: `Your ${meta.label.toLowerCase()} rates per m²` },
                  { to: '/plan', icon: MapIcon, title: 'Plan reader', hint: 'Room sizes from a PDF plan' },
                  { to: '/quotes', icon: FileText, title: 'All quotations', hint: 'Combine trades in one quotation' },
                ]
            ).map((t) => (
              <Link key={t.to + t.title} to={t.to} className="flex flex-col items-start gap-1 rounded-xl p-2 hover:bg-stone-50">
                <t.icon style={{ color: meta.accent }} />
                <span className="text-sm font-bold">{t.title}</span>
                <span className="text-[11px] text-stone-500">{t.hint}</span>
              </Link>
            ))}
          </section>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Section title={`Open quotations (${open.length})`} icon={<FileText size={16} />} link="/quotes" empty={!open.length && 'No quotations sent or accepted yet.'}>
            {open.slice(0, 5).map(row)}
          </Section>
          <Section title={`Drafts (${drafts.length})`} icon={<FilePen size={16} />} link="/quotes" empty={!drafts.length && 'No drafts — tap + to start a quotation.'}>
            {drafts.slice(0, 5).map(row)}
          </Section>
          <Section title={`Closed – invoiced (${closed.length})`} icon={<FileCheck2 size={16} />} link="/quotes" empty={!closed.length && 'Quotations turned into invoices show here.'}>
            {closed.slice(0, 5).map(row)}
          </Section>
          <Section title={`Invoices & receipts (${invoices.length})`} icon={<Receipt size={16} />} link="/invoices" empty={!invoices.length && 'No invoices yet.'}>
            {inv.slice(0, 4).map(({ i, c }) => (
              <Link key={i.id} to={`/invoices/${i.id}`} className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-stone-50">
                <div className="min-w-0">
                  <div className="truncate font-semibold">{i.client.name || 'No client'}</div>
                  <div className="text-xs text-stone-500">
                    {i.number} · {fmtDate(i.date)}
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-0.5">
                  <span className="text-sm font-bold tabular-nums">{fmt(c.total)}</span>
                  <span className={`chip ${STATUS_STYLE[c.status]}`}>{c.status}</span>
                </div>
              </Link>
            ))}
            {receipts.slice(0, 3).map(({ p, i }) => (
              <Link key={p.id} to={`/invoices/${i.id}`} className="flex items-center justify-between gap-3 px-4 py-2 text-sm hover:bg-stone-50">
                <span className="text-stone-600">
                  Receipt {p.receiptNumber} · {i.client.name || i.number} · {fmtDate(p.date)}
                </span>
                <span className="font-semibold tabular-nums text-emerald-700">{fmt(p.amount)}</span>
              </Link>
            ))}
          </Section>
        </div>
        <div className="h-16" />
      </div>
      <button className="fixed bottom-6 right-5 z-30 flex h-14 items-center justify-center gap-2 rounded-full px-5 font-semibold text-white shadow-xl transition hover:brightness-110" style={{ background: meta.accent }} aria-label="New quotation" title="New quotation (Ctrl+N)" onClick={() => newQuoteFor(trade, nav)}>
        <Plus size={22} /> <span className="hidden sm:inline">New {meta.label.toLowerCase()} quotation</span>
      </button>
    </div>
  );
}
