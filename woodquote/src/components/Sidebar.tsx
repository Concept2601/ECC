// Left side bar: workspace switch (Joinery / Ceilings / Tiling) and navigation.
// Always visible on tablets and computers; slides in from the left on phones.
import { BookOpen, ChevronsUpDown, FilePlus2, FileText, Home, LayoutDashboard, Map as MapIcon, Receipt, Ruler, ScanLine, Settings as SettingsIcon, X } from 'lucide-react';
import { useEffect } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { create } from 'zustand';
import { TRADES, tradeMeta } from '../app/brand';
import { DEVELOPER } from '../app/developer';
import { usePrefs } from '../app/prefs';
import type { Trade } from '../lib/types';
import { useStore } from '../store';
import { LogoMark, Wordmark } from './Logo';

export const useDrawer = create<{ open: boolean; launcher: boolean }>(() => ({ open: false, launcher: false }));

/** Start a quotation in a workspace and open the right section. */
export function newQuoteFor(trade: Trade, nav: (to: string) => void) {
  const id = useStore.getState().createQuote({ trade, title: trade === 'joinery' ? 'New quotation' : `${tradeMeta(trade).label} quotation` });
  nav(`/quotes/${id}?section=${trade}`);
}

function Item({ to, icon: Icon, label, end }: { to: string; icon: typeof Home; label: string; end?: boolean }) {
  return (
    <NavLink
      to={to}
      end={end}
      onClick={() => useDrawer.setState({ open: false })}
      className={({ isActive }) => `flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition ${isActive ? 'bg-white/10 text-white' : 'text-stone-400 hover:bg-white/5 hover:text-stone-100'}`}
    >
      <Icon size={18} strokeWidth={1.8} />
      {label}
    </NavLink>
  );
}

export default function Sidebar() {
  const open = useDrawer((s) => s.open);
  const trade = usePrefs((s) => s.trade);
  const set = usePrefs((s) => s.set);
  const nav = useNavigate();
  const loc = useLocation();
  const meta = tradeMeta(trade);
  useEffect(() => useDrawer.setState({ open: false }), [loc.pathname]);
  const Tools =
    trade === 'joinery'
      ? [
          { to: '/reader', icon: ScanLine, label: 'Diagram reader' },
          { to: '/plan', icon: MapIcon, label: 'Plan reader' },
          { to: '/fit', icon: Ruler, label: 'Measure a space' },
        ]
      : [{ to: '/plan', icon: MapIcon, label: 'Plan reader' }];
  return (
    <>
      {open && <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[1px] md:hidden" onClick={() => useDrawer.setState({ open: false })} />}
      <aside className={`safe-top fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-[#14161a] text-stone-200 transition-transform duration-200 md:translate-x-0 ${open ? 'translate-x-0 shadow-2xl' : '-translate-x-full'}`}>
        <div className="flex items-center gap-2.5 px-4 pb-4 pt-5">
          <LogoMark size={34} />
          <Wordmark dark className="text-xl" />
          <button className="ml-auto rounded-lg p-1.5 text-stone-400 hover:bg-white/10 md:hidden" aria-label="Close menu" onClick={() => useDrawer.setState({ open: false })}>
            <X size={18} />
          </button>
        </div>

        {/* workspace switch */}
        <div className="mx-3 rounded-2xl bg-white/[.04] p-1.5">
          <div className="grid grid-cols-3 gap-1">
            {TRADES.map((t) => {
              const Icon = t.icon;
              const on = t.id === trade;
              return (
                <button key={t.id} onClick={() => set({ trade: t.id })} title={t.label} className={`flex flex-col items-center gap-1 rounded-xl px-1 py-2 text-[11px] font-semibold transition ${on ? 'text-white' : 'text-stone-500 hover:text-stone-200'}`} style={on ? { background: t.accent } : undefined}>
                  <Icon size={17} />
                  {t.label}
                </button>
              );
            })}
          </div>
          <button className="mt-1 flex w-full items-center justify-center gap-1 rounded-lg py-1 text-[11px] text-stone-500 hover:text-stone-300" onClick={() => useDrawer.setState({ launcher: true, open: false })}>
            <ChevronsUpDown size={12} /> All workspaces
          </button>
        </div>

        <button className="mx-3 mt-4 flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold text-white shadow-lg transition hover:brightness-110" style={{ background: meta.accent }} onClick={() => newQuoteFor(trade, nav)}>
          <FilePlus2 size={17} /> New {meta.label.toLowerCase()} quotation
        </button>

        <nav className="mt-5 flex-1 space-y-0.5 overflow-y-auto px-3">
          <Item to="/" end icon={LayoutDashboard} label="Dashboard" />
          <Item to="/quotes" icon={FileText} label="Quotations" />
          <Item to="/invoices" icon={Receipt} label="Invoices & receipts" />
          <Item to="/settings/materials" icon={BookOpen} label="Price lists" />
          <p className="px-3 pb-1 pt-5 text-[10px] font-semibold uppercase tracking-widest text-stone-600">{meta.label} tools</p>
          {Tools.map((t) => (
            <Item key={t.to} {...t} />
          ))}
          {trade === 'joinery' && <Item to="/start-room" icon={Home} label="Start from a room" />}
          <p className="px-3 pb-1 pt-5 text-[10px] font-semibold uppercase tracking-widest text-stone-600">App</p>
          <Item to="/settings" end icon={SettingsIcon} label="Settings" />
        </nav>
        <div className="safe-bottom border-t border-white/5 px-4 py-3 text-[11px] text-stone-600">
          v{DEVELOPER.version} · {DEVELOPER.name}
        </div>
      </aside>
    </>
  );
}
