import { FileText, Home as HomeIcon, Layers, Receipt, Settings as SettingsIcon } from 'lucide-react';
import { HashRouter, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import Home from './pages/Home';
import InvoiceEditor from './pages/InvoiceEditor';
import Invoices from './pages/Invoices';
import Library from './pages/Library';
import QuoteEditor from './pages/QuoteEditor';
import Quotes from './pages/Quotes';
import Reader from './pages/Reader';
import RunDesigner from './pages/RunDesigner';
import SettingsPage from './pages/Settings';
import UnitDesigner from './pages/UnitDesigner';
import { useStore } from './store';

const NAV = [
  { to: '/', label: 'Home', icon: HomeIcon },
  { to: '/quotes', label: 'Quotes', icon: FileText },
  { to: '/invoices', label: 'Invoices', icon: Receipt },
  { to: '/library', label: 'Prices', icon: Layers },
  { to: '/settings', label: 'Settings', icon: SettingsIcon },
];

function BottomNav() {
  const loc = useLocation();
  // hide on the full-screen designer
  if (/\/(units|runs)\//.test(loc.pathname)) return null;
  return (
    <nav className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-stone-200 bg-white/95 backdrop-blur">
      <div className="mx-auto grid max-w-5xl grid-cols-5">
        {NAV.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) => `flex flex-col items-center gap-0.5 py-2 text-[11px] font-semibold ${isActive ? 'text-brand-700' : 'text-stone-500'}`}
          >
            {({ isActive }) => (
              <>
                <span className={`rounded-full px-4 py-1 ${isActive ? 'bg-brand-100' : ''}`}>
                  <Icon size={20} />
                </span>
                {label}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

export default function App() {
  const hydrated = useStore((s) => s.hydrated);
  if (!hydrated) return <div className="flex h-full items-center justify-center text-stone-400">Loading…</div>;
  return (
    <HashRouter>
      <div className="min-h-full pb-24">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/quotes" element={<Quotes />} />
          <Route path="/quotes/:id" element={<QuoteEditor />} />
          <Route path="/quotes/:id/units/:uid" element={<UnitDesigner />} />
          <Route path="/quotes/:id/runs/:rid" element={<RunDesigner />} />
          <Route path="/invoices" element={<Invoices />} />
          <Route path="/invoices/:id" element={<InvoiceEditor />} />
          <Route path="/library" element={<Library />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/reader" element={<Reader />} />
        </Routes>
      </div>
      <BottomNav />
    </HashRouter>
  );
}
