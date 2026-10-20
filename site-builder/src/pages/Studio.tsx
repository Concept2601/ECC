import { useEffect, useMemo, type ComponentType } from 'react';
import { useStore } from '../store';
import { href, openPreview, type Area } from '../router';
import { a11yAudit, perfAudit, score, seoAudit, siteSeoAudit } from '../lib/audits';
import { Design } from '../tabs/frontend/Design';
import { InspirationTab } from '../tabs/frontend/Inspiration';
import { PagesTab } from '../tabs/frontend/Pages';
import { MediaTab } from '../tabs/frontend/Media';
import { SpeedTab } from '../tabs/frontend/Speed';
import { AccessibilityTab } from '../tabs/frontend/Accessibility';
import { HostingTab } from '../tabs/backend/Hosting';
import { DomainsTab } from '../tabs/backend/Domains';
import { SeoTab } from '../tabs/backend/Seo';
import { IntegrationsTab } from '../tabs/backend/Integrations';
import { SettingsTab } from '../tabs/backend/Settings';
import { ChecklistTab } from '../tabs/delivery/Checklist';
import { LaunchTab } from '../tabs/delivery/Launch';
import { VersionsTab } from '../tabs/delivery/Versions';
import { GrowthTab } from '../tabs/delivery/Growth';
import { ExportTab } from '../tabs/delivery/Export';
import { ThemeMenu } from '../components/ThemeMenu';

interface TabDef {
  id: string;
  label: string;
  icon: string;
  Component: ComponentType;
}

export const AREAS: Record<Area, { label: string; hint: string; tabs: TabDef[] }> = {
  frontend: {
    label: 'Front-End',
    hint: 'Look & feel',
    tabs: [
      { id: 'design', label: 'Design', icon: '✎', Component: Design },
      { id: 'inspiration', label: 'Inspiration', icon: '✦', Component: InspirationTab },
      { id: 'pages', label: 'Pages & Menus', icon: '☰', Component: PagesTab },
      { id: 'media', label: 'Media', icon: '▣', Component: MediaTab },
      { id: 'speed', label: 'Speed', icon: '⚡', Component: SpeedTab },
      { id: 'accessibility', label: 'Accessibility', icon: '♿', Component: AccessibilityTab },
    ],
  },
  backend: {
    label: 'Back-End',
    hint: 'Infrastructure',
    tabs: [
      { id: 'hosting', label: 'Hosting', icon: '☁', Component: HostingTab },
      { id: 'domains', label: 'Domains', icon: '🌐', Component: DomainsTab },
      { id: 'seo', label: 'SEO', icon: '⌕', Component: SeoTab },
      { id: 'integrations', label: 'Forms & Integrations', icon: '⚙', Component: IntegrationsTab },
      { id: 'settings', label: 'Site settings', icon: '🛡', Component: SettingsTab },
    ],
  },
  delivery: {
    label: 'Delivery',
    hint: 'Go live',
    tabs: [
      { id: 'checklist', label: 'Launch checklist', icon: '☑', Component: ChecklistTab },
      { id: 'launch', label: 'Launch', icon: '🚀', Component: LaunchTab },
      { id: 'versions', label: 'Versions', icon: '⟲', Component: VersionsTab },
      { id: 'growth', label: 'Post-launch', icon: '📈', Component: GrowthTab },
      { id: 'export', label: 'Export & backup', icon: '⇩', Component: ExportTab },
    ],
  },
};

export function Studio({ siteId, area, tab }: { siteId: string; area: Area; tab: string }) {
  const { site, sites, loaded, open, update, undo, redo, canUndo, canRedo, saving } = useStore();

  useEffect(() => {
    open(siteId);
    return () => open(undefined);
  }, [siteId, open]);

  const health = useMemo(() => {
    if (!site) return 0;
    const home = site.pages[0];
    return Math.round((score(seoAudit(site, home).concat(siteSeoAudit(site))) + score(perfAudit(site, home)) + score(a11yAudit(site))) / 3);
  }, [site]);

  if (!loaded) return <div className="center pad">Loading…</div>;
  if (!site) {
    return (
      <div className="center pad">
        <h1>Project not found</h1>
        <p className="muted">{sites.length ? 'It may have been deleted.' : 'Projects are stored in this browser.'}</p>
        <a className="btn" href={href({ name: 'projects' })}>Back to projects</a>
      </div>
    );
  }

  const def = AREAS[area];
  const current = def.tabs.find((t) => t.id === tab) ?? def.tabs[0];
  const Current = current.Component;
  const live = site.deployments.find((d) => d.status === 'success' && d.url);

  return (
    <div className={`studio area-${area}`}>
      <header className="topbar studio-bar">
        <div className="row">
          <a className="icon-btn" href={href({ name: 'projects' })} aria-label="All projects" title="All projects">←</a>
          <input className="site-name" value={site.name} aria-label="Site name" onChange={(e) => update((d) => { d.name = e.target.value; }, 'name')} />
          <span className={`save-dot ${saving}`} title={saving === 'saved' ? 'All changes saved' : saving === 'saving' ? 'Saving…' : 'Save failed'}>
            {saving === 'saved' ? 'Saved' : saving === 'saving' ? 'Saving…' : 'Not saved'}
          </span>
        </div>
        <nav className="area-switch" aria-label="Workspace">
          {(Object.keys(AREAS) as Area[]).map((a, i) => (
            <a key={a} href={href({ name: 'studio', siteId, area: a, tab: '' })} className={a === area ? 'on' : ''} aria-current={a === area ? 'page' : undefined}>
              <span className="step">{i + 1}</span>
              <span>{AREAS[a].label}<small>{AREAS[a].hint}</small></span>
            </a>
          ))}
        </nav>
        <div className="row">
          <ThemeMenu />
          <button className="icon-btn" onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)" aria-label="Undo">↶</button>
          <button className="icon-btn" onClick={redo} disabled={!canRedo} title="Redo (Ctrl+Shift+Z)" aria-label="Redo">↷</button>
          <a className="health" href={href({ name: 'studio', siteId, area: 'delivery', tab: 'checklist' })} title="Site health (SEO, speed, accessibility)">
            <span className={health >= 90 ? 'good' : health >= 60 ? 'ok' : 'bad'}>{health}</span> health
          </a>
          <button className="btn ghost sm hide-sm" onClick={() => openPreview(site.id)}>Preview</button>
          {live && <a className="btn ghost sm hide-sm" href={live.url} target="_blank" rel="noopener">View live ↗</a>}
          <a className="btn sm launch" href={href({ name: 'studio', siteId, area: 'delivery', tab: 'launch' })}>🚀 Launch</a>
        </div>
      </header>
      <div className="studio-body">
        <nav className="sidenav" aria-label={`${def.label} sections`}>
          <p className="sidenav-title">{def.label}</p>
          {def.tabs.map((t) => (
            <a key={t.id} href={href({ name: 'studio', siteId, area, tab: t.id })} className={t.id === current.id ? 'on' : ''} aria-current={t.id === current.id ? 'page' : undefined}>
              <span aria-hidden="true">{t.icon}</span>
              {t.label}
            </a>
          ))}
        </nav>
        <main className={`studio-main tab-${current.id}`}>
          <Current key={current.id} />
        </main>
      </div>
    </div>
  );
}
