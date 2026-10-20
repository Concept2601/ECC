import { useState } from 'react';
import { useSite } from '../../store';
import { INSPIRATIONS, siteFromInspection, siteFromInspiration, type Inspiration, type InspectResult } from '../../lib/inspirations';
import { InspirationGallery, UrlInspector } from '../../components/InspirationGallery';
import { Card, Modal, PageHead } from '../../components/ui';
import { DEFAULT_THEME } from '../../lib/defaults';
import { slugify } from '../../lib/util';
import type { Page, Site } from '../../types';

type Pending = { label: string; from: Site };

export function InspirationTab() {
  const { site, update, toast } = useSite();
  const [pending, setPending] = useState<Pending>();

  const applyTheme = (from: Site) => {
    update((d) => {
      d.theme = { ...from.theme };
    });
    toast('Theme applied — your content is unchanged.');
    setPending(undefined);
  };

  const addPages = (from: Site) => {
    const taken = new Set(site.pages.map((p) => p.slug));
    const fresh: Page[] = from.pages
      .filter((p) => p.slug)
      .map((p) => {
        let slug = p.slug;
        for (let n = 2; taken.has(slug); n++) slug = `${p.slug}-${n}`;
        taken.add(slug);
        return { ...p, slug };
      });
    update((d) => {
      d.pages.push(...fresh);
      d.menus.main.push(...fresh.map((p) => ({ id: `mi_${p.id}`, label: p.name, pageId: p.id })));
    });
    toast(`Added ${fresh.length} page(s): ${fresh.map((p) => p.name).join(', ')}`);
    setPending(undefined);
  };

  const replaceAll = (from: Site) => {
    if (!window.confirm('Replace all pages, menus and theme with this inspiration? (You can undo or restore a version.)')) return;
    update((d) => {
      d.theme = from.theme;
      d.pages = from.pages;
      d.menus = from.menus;
      d.inspiration = from.inspiration;
    });
    toast('Layout replaced.');
    setPending(undefined);
  };

  return (
    <div className="tab-page">
      <PageHead title="Inspiration" subtitle="Borrow the look and structure of great websites — then make it yours." />
      <Card title="Analyse a website you love" subtitle="We extract its colour palette, fonts, navigation and the order of its sections.">
        <UrlInspector serverUrl={site.hosting.serverUrl} onResult={(r: InspectResult) => setPending({ label: r.title || r.url, from: siteFromInspection(r, site.name) })} />
      </Card>
      <Card title="Curated inspirations" subtitle={`${INSPIRATIONS.length} professionally designed starting points.`}>
        <InspirationGallery actionLabel="Apply…" onUse={(i: Inspiration) => setPending({ label: i.name, from: siteFromInspiration(i, site.name) })} />
      </Card>
      {pending && (
        <Modal title={`Use “${pending.label}”`} onClose={() => setPending(undefined)}>
          <div className="swatches lg">
            {[pending.from.theme.primary, pending.from.theme.accent, pending.from.theme.dark, pending.from.theme.surface].map((c, i) => <i key={i} style={{ background: c }} />)}
          </div>
          <p className="muted small">{pending.from.theme.headingFont} / {pending.from.theme.bodyFont} · {pending.from.pages.length} pages</p>
          <div className="choice-list">
            <button className="choice" onClick={() => applyTheme(pending.from)}>
              <strong>Apply theme only</strong>
              <span className="muted small">Colours, fonts, corners and buttons. Keeps all your pages and content.</span>
            </button>
            <button className="choice" onClick={() => addPages(pending.from)}>
              <strong>Add its pages</strong>
              <span className="muted small">{pending.from.pages.filter((p) => p.slug).map((p) => p.name).join(', ') || 'No extra pages'} — added alongside yours.</span>
            </button>
            <button className="choice danger" onClick={() => replaceAll(pending.from)}>
              <strong>Replace everything</strong>
              <span className="muted small">Start over with this layout. Media, SEO and back-end settings are kept.</span>
            </button>
          </div>
        </Modal>
      )}
      <p className="tiny muted">Current theme: {site.theme.headingFont === DEFAULT_THEME.headingFont && site.theme.primary === DEFAULT_THEME.primary ? 'default' : `${site.theme.headingFont}, ${site.theme.primary}`}{site.inspiration ? ` · originally from ${site.inspiration}` : ''} · site address /{slugify(site.hosting.slug)}</p>
    </div>
  );
}
