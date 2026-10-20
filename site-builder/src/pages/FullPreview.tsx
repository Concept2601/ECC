import { useEffect, useState } from 'react';
import { useStore } from '../store';
import { Preview, type Device } from '../components/Preview';
import { Segmented } from '../components/ui';
import { go } from '../router';

export function FullPreview({ siteId, pageId }: { siteId: string; pageId?: string }) {
  const { site, loaded, open } = useStore();
  const [device, setDevice] = useState<Device>('desktop');

  useEffect(() => {
    open(siteId);
  }, [siteId, open]);

  if (!loaded) return null;
  if (!site) return <p className="center pad">Project not found.</p>;
  const page = site.pages.find((p) => p.id === pageId) ?? site.pages[0];

  return (
    <div className="full-preview">
      <header className="topbar">
        <strong className="ellipsis">{site.name} — preview</strong>
        <select value={page.id} onChange={(e) => go({ name: 'preview', siteId, pageId: e.target.value })} aria-label="Page">
          {site.pages.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <Segmented value={device} onChange={setDevice} options={[{ value: 'desktop', label: '🖥', title: 'Desktop' }, { value: 'tablet', label: '▭', title: 'Tablet' }, { value: 'mobile', label: '📱', title: 'Mobile' }]} />
      </header>
      <Preview site={site} page={page} device={device} onNavigate={(id) => go({ name: 'preview', siteId, pageId: id })} />
    </div>
  );
}
