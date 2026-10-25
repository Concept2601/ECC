import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { HashRouter, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { usePrefs } from './app/prefs';
import AppShell from './components/AppShell';
import { usePdfExport } from './pdf/exportState';
import Launcher from './components/Launcher';
import Sidebar, { useDrawer } from './components/Sidebar';
import Splash from './components/Splash';
import type { Trade } from './lib/types';
import Home from './pages/Home';
import { useStore } from './store';

// Screens load when first opened (the loading page fetches them in the background),
// so the app starts fast and the 3D / PDF engines are only loaded once needed.
const pages = {
  Quotes: () => import('./pages/Quotes'),
  QuoteEditor: () => import('./pages/QuoteEditor'),
  UnitDesigner: () => import('./pages/UnitDesigner'),
  RunDesigner: () => import('./pages/RunDesigner'),
  RoomDesigner: () => import('./pages/RoomDesigner'),
  AssemblyDesigner: () => import('./pages/AssemblyDesigner'),
  Invoices: () => import('./pages/Invoices'),
  InvoiceEditor: () => import('./pages/InvoiceEditor'),
  Library: () => import('./pages/Library'),
  Settings: () => import('./pages/Settings'),
  Reader: () => import('./pages/Reader'),
  SpaceFit: () => import('./pages/SpaceFit'),
  PlanReader: () => import('./pages/PlanReader'),
};
const Quotes = lazy(pages.Quotes);
const QuoteEditor = lazy(pages.QuoteEditor);
const UnitDesigner = lazy(pages.UnitDesigner);
const RunDesigner = lazy(pages.RunDesigner);
const RoomDesigner = lazy(pages.RoomDesigner);
const AssemblyDesigner = lazy(pages.AssemblyDesigner);
const Invoices = lazy(pages.Invoices);
const InvoiceEditor = lazy(pages.InvoiceEditor);
const Library = lazy(pages.Library);
const SettingsPage = lazy(pages.Settings);
const Reader = lazy(pages.Reader);
const SpaceFit = lazy(pages.SpaceFit);
const PlanReader = lazy(pages.PlanReader);

const ExportSheet = lazy(() => import('./components/ExportSheet'));

const preload = () => Object.values(pages).map((p) => p());

/** The save / share panel loads only when a PDF is ready. */
function PdfReady() {
  const doc = usePdfExport((s) => s.doc);
  return doc ? (
    <Suspense fallback={null}>
      <ExportSheet />
    </Suspense>
  ) : null;
}

function PageLoading() {
  return (
    <div className="flex h-[60vh] items-center justify-center">
      <span className="h-6 w-6 animate-spin rounded-full border-2 border-stone-300 border-t-brand-600" />
    </div>
  );
}

/** Joinery: a new quotation that opens straight on its room plan. */
function StartRoom() {
  const nav = useNavigate();
  useEffect(() => {
    nav(`/quotes/${useStore.getState().createQuote({ title: 'Room design', trade: 'joinery' })}/room?start=1`, { replace: true });
  }, [nav]);
  return <PageLoading />;
}

function Workspace() {
  const launcher = useDrawer((s) => s.launcher);
  const set = usePrefs((s) => s.set);
  const nav = useNavigate();
  return (
    <>
      <AppShell />
      <Sidebar />
      <main className="min-h-full md:pl-64">
        <Suspense fallback={<PageLoading />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/quotes" element={<Quotes />} />
            <Route path="/quotes/:id" element={<QuoteEditor />} />
            <Route path="/quotes/:id/units/:uid" element={<UnitDesigner />} />
            <Route path="/quotes/:id/runs/:rid" element={<RunDesigner />} />
            <Route path="/quotes/:id/room" element={<RoomDesigner />} />
            <Route path="/quotes/:id/groups/:gid" element={<AssemblyDesigner />} />
            <Route path="/invoices" element={<Invoices />} />
            <Route path="/invoices/:id" element={<InvoiceEditor />} />
            <Route path="/library" element={<Library />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/settings/:section" element={<SettingsPage />} />
            <Route path="/reader" element={<Reader />} />
            <Route path="/fit" element={<SpaceFit />} />
            <Route path="/plan" element={<PlanReader />} />
            <Route path="/start-room" element={<StartRoom />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </main>
      <PdfReady />
      {launcher && (
        <Launcher
          onPick={(t: Trade) => {
            set({ trade: t });
            useDrawer.setState({ launcher: false });
            nav('/');
          }}
        />
      )}
    </>
  );
}

export default function App() {
  const [phase, setPhase] = useState<'loading' | 'app'>('loading');
  const showLauncher = usePrefs((s) => s.showLauncher);
  const done = useCallback(() => {
    if (showLauncher) useDrawer.setState({ launcher: true });
    setPhase('app');
  }, [showLauncher]);
  if (phase === 'loading') return <Splash preload={preload} onDone={done} />;
  return (
    <HashRouter>
      <Workspace />
    </HashRouter>
  );
}
