import { StoreProvider, useStore } from './store';
import { useRoute } from './router';
import { Landing } from './pages/Landing';
import { Projects } from './pages/Projects';
import { Studio } from './pages/Studio';
import { FullPreview } from './pages/FullPreview';
import { DialogHost } from './components/dialog';

function Toasts() {
  const { toasts } = useStore();
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.kind}`}>{t.msg}</div>
      ))}
    </div>
  );
}

function Routes() {
  const route = useRoute();
  switch (route.name) {
    case 'landing':
      return <Landing />;
    case 'projects':
      return <Projects />;
    case 'preview':
      return <FullPreview siteId={route.siteId} pageId={route.pageId} />;
    case 'studio':
      return <Studio siteId={route.siteId} area={route.area} tab={route.tab} />;
  }
}

export default function App() {
  return (
    <StoreProvider>
      <Routes />
      <Toasts />
      <DialogHost />
    </StoreProvider>
  );
}
