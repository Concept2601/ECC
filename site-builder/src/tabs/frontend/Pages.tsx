import { useState } from 'react';
import { useSite } from '../../store';
import type { MenuItem, Page, Site } from '../../types';
import { createPage, menuFromPages } from '../../lib/defaults';
import { createBlock } from '../../lib/blocks';
import { clone, slugify, uid } from '../../lib/util';
import { Card, Modal, PageHead, Text } from '../../components/ui';
import { openPreview } from '../../router';
import { ask } from '../../components/dialog';

const legal = (title: string, site: Site) =>
  `<p>Last updated: ${new Date().toLocaleDateString()}</p><h2>Who we are</h2><p>${site.seo.siteName} operates this website. Contact us via our contact page with any questions about this ${title.toLowerCase()}.</p><h2>Information we collect</h2><p>We collect the details you submit through our forms (such as your name, email and message) and anonymous usage data if analytics is enabled.</p><h2>How we use it</h2><p>To respond to enquiries, provide our services and improve this website. We never sell your personal data.</p><h2>Your rights</h2><p>You may request access to, correction of, or deletion of your personal data at any time.</p><p><em>This is a starting template — have it reviewed for your jurisdiction.</em></p>`;

const TEMPLATES: { name: string; slug: string; make: (site: Site) => Page['blocks'] }[] = [
  { name: 'Blank', slug: 'new-page', make: () => [] },
  { name: 'About', slug: 'about', make: () => [createBlock('hero', { heading: 'About us', layout: 'stacked', ctaLabel: '', secondaryLabel: '' }), createBlock('richtext', { heading: 'Our story' }), createBlock('stats'), createBlock('team')] },
  { name: 'Services', slug: 'services', make: () => [createBlock('hero', { heading: 'Our services', layout: 'stacked', secondaryLabel: '' }), createBlock('features', { columns: 2 }), createBlock('faq'), createBlock('cta')] },
  { name: 'Contact', slug: 'contact', make: () => [createBlock('contact', { spacing: 'lg' })] },
  { name: 'Pricing', slug: 'pricing', make: () => [createBlock('pricing', { spacing: 'lg' }), createBlock('faq'), createBlock('cta')] },
  { name: 'Gallery', slug: 'gallery', make: () => [createBlock('gallery', { spacing: 'lg' })] },
  { name: 'Privacy policy', slug: 'privacy', make: (s) => [createBlock('richtext', { heading: 'Privacy policy', body: legal('Privacy policy', s), spacing: 'lg' })] },
  { name: 'Terms of service', slug: 'terms', make: (s) => [createBlock('richtext', { heading: 'Terms of service', body: legal('Terms of service', s), spacing: 'lg' })] },
];

function MenuEditor({ which }: { which: 'main' | 'footer' }) {
  const { site, update } = useSite();
  const items = site.menus[which];
  const setItems = (fn: (list: MenuItem[]) => MenuItem[]) => update((d) => { d.menus[which] = fn(clone(d.menus[which])); }, `menu-${which}`);

  const flat: { item: MenuItem; parent?: MenuItem; index: number }[] = [];
  items.forEach((item, index) => {
    flat.push({ item, index });
    item.children?.forEach((c, ci) => flat.push({ item: c, parent: item, index: ci }));
  });

  const patch = (id: string, p: Partial<MenuItem>) =>
    setItems((list) => list.map((m) => (m.id === id ? { ...m, ...p } : { ...m, children: m.children?.map((c) => (c.id === id ? { ...c, ...p } : c)) })));
  const removeItem = (id: string) => setItems((list) => list.filter((m) => m.id !== id).map((m) => ({ ...m, children: m.children?.filter((c) => c.id !== id) })));
  const move = (id: string, dir: -1 | 1) =>
    setItems((list) => {
      const swap = (arr: MenuItem[]) => {
        const i = arr.findIndex((m) => m.id === id);
        if (i < 0) return false;
        const j = i + dir;
        if (j >= 0 && j < arr.length) [arr[i], arr[j]] = [arr[j], arr[i]];
        return true;
      };
      if (!swap(list)) list.forEach((m) => m.children && swap(m.children));
      return list;
    });
  const indent = (id: string) =>
    setItems((list) => {
      const i = list.findIndex((m) => m.id === id);
      if (i <= 0) return list;
      const [it] = list.splice(i, 1);
      list[i - 1].children = [...(list[i - 1].children ?? []), { ...it, children: undefined }, ...(it.children ?? [])];
      return list;
    });
  const outdent = (id: string) =>
    setItems((list) => {
      const pi = list.findIndex((m) => m.children?.some((c) => c.id === id));
      if (pi < 0) return list;
      const child = list[pi].children!.find((c) => c.id === id)!;
      list[pi].children = list[pi].children!.filter((c) => c.id !== id);
      list.splice(pi + 1, 0, child);
      return list;
    });

  return (
    <Card
      title={which === 'main' ? 'Main menu' : 'Footer menu'}
      subtitle={which === 'main' ? 'Shown in the header; collapses into a mobile menu on small screens. Indent an item to make a dropdown.' : 'Links in the footer — a good place for legal pages.'}
      actions={
        <>
          <button className="btn sm ghost" onClick={() => setItems(() => menuFromPages(which === 'main' ? site.pages : site.pages.filter((p) => /privacy|terms|contact/.test(p.slug))))}>Rebuild from pages</button>
          <button className="btn sm" onClick={() => setItems((l) => [...l, { id: uid('mi'), label: 'New link', pageId: site.pages[0].id }])}>＋ Link</button>
        </>
      }
    >
      {flat.length === 0 && <p className="muted">No links yet.</p>}
      <ul className="menu-list">
        {flat.map(({ item, parent }) => (
          <li key={item.id} className={parent ? 'child' : ''}>
            <input value={item.label} onChange={(e) => patch(item.id, { label: e.target.value })} aria-label="Link label" />
            <select
              value={item.pageId ?? '__url'}
              onChange={(e) => patch(item.id, e.target.value === '__url' ? { pageId: undefined, url: item.url ?? 'https://' } : { pageId: e.target.value, url: undefined })}
              aria-label="Link target"
            >
              {site.pages.map((p) => <option key={p.id} value={p.id}>Page: {p.name}</option>)}
              <option value="__url">Custom URL / anchor…</option>
            </select>
            {!item.pageId && <input value={item.url ?? ''} onChange={(e) => patch(item.id, { url: e.target.value })} placeholder="https://… or #section" aria-label="URL" />}
            <div className="row nowrap">
              <button className="icon-btn sm" onClick={() => move(item.id, -1)} aria-label="Move up">↑</button>
              <button className="icon-btn sm" onClick={() => move(item.id, 1)} aria-label="Move down">↓</button>
              {which === 'main' && (parent
                ? <button className="icon-btn sm" onClick={() => outdent(item.id)} aria-label="Outdent" title="Move out of dropdown">⇤</button>
                : <button className="icon-btn sm" onClick={() => indent(item.id)} aria-label="Indent" title="Put in dropdown of item above">⇥</button>)}
              <button className="icon-btn sm danger" onClick={() => removeItem(item.id)} aria-label="Remove">✕</button>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function PagesTab() {
  const { site, update, toast } = useSite();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');

  const addPage = (t: (typeof TEMPLATES)[number]) => {
    const pageName = name.trim() || t.name;
    let slug = slugify(name.trim() ? pageName : t.slug) || 'page';
    const taken = new Set(site.pages.map((p) => p.slug));
    for (let n = 2; taken.has(slug); n++) slug = `${slugify(pageName) || 'page'}-${n}`;
    const p = createPage(pageName, slug);
    p.blocks = t.make(site);
    update((d) => {
      d.pages.push(p);
      const isLegal = /privacy|terms/.test(t.slug);
      d.menus[isLegal ? 'footer' : 'main'].push({ id: uid('mi'), label: pageName, pageId: p.id });
    });
    toast(`Page “${pageName}” added`);
    setAdding(false);
    setName('');
  };

  const setPage = (id: string, patch: Partial<Page>) =>
    update((d) => {
      const p = d.pages.find((x) => x.id === id)!;
      Object.assign(p, patch);
    }, `page-${id}-${Object.keys(patch).join()}`);

  const removePage = async (p: Page) => {
    if (!(await ask({ title: 'Delete page?', message: `Delete “${p.name}” and remove it from the menus?`, confirmLabel: 'Delete', danger: true }))) return;
    update((d) => {
      d.pages = d.pages.filter((x) => x.id !== p.id);
      const strip = (list: MenuItem[]): MenuItem[] => list.filter((m) => m.pageId !== p.id).map((m) => ({ ...m, children: m.children && strip(m.children) }));
      d.menus.main = strip(d.menus.main);
      d.menus.footer = strip(d.menus.footer);
    });
  };

  const movePage = (i: number, dir: -1 | 1) =>
    update((d) => {
      const j = i + dir;
      if (i === 0 || j <= 0 || j >= d.pages.length) return; // home stays first
      [d.pages[i], d.pages[j]] = [d.pages[j], d.pages[i]];
    });

  return (
    <div className="tab-page">
      <PageHead title="Pages & Menus" subtitle="Organise your pages, their web addresses and navigation." actions={<button className="btn" onClick={() => setAdding(true)}>＋ New page</button>} />
      <Card title={`Pages (${site.pages.length})`}>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th>Name</th><th>Address</th><th>Sections</th><th>SEO</th><th /></tr>
            </thead>
            <tbody>
              {site.pages.map((p, i) => {
                const dupe = site.pages.some((x) => x.id !== p.id && x.slug === p.slug);
                return (
                  <tr key={p.id}>
                    <td><input value={p.name} onChange={(e) => setPage(p.id, { name: e.target.value })} aria-label="Page name" /></td>
                    <td>
                      {i === 0 ? (
                        <span className="muted">/ (home)</span>
                      ) : (
                        <span className="slug">/<input value={p.slug} onChange={(e) => setPage(p.id, { slug: slugify(e.target.value) || p.slug })} aria-label="Page address" aria-invalid={dupe} />/</span>
                      )}
                      {dupe && <span className="error tiny">Address already used</span>}
                    </td>
                    <td>{p.blocks.length}</td>
                    <td>{p.seo.noindex ? <span className="muted">Hidden</span> : p.seo.description ? '✓' : <span className="warn-text">No description</span>}</td>
                    <td className="row nowrap">
                      <button className="icon-btn sm" disabled={i <= 1} onClick={() => movePage(i, -1)} aria-label="Move up">↑</button>
                      <button className="icon-btn sm" disabled={i === 0 || i === site.pages.length - 1} onClick={() => movePage(i, 1)} aria-label="Move down">↓</button>
                      <button className="icon-btn sm" onClick={() => openPreview(site.id, p.id)} aria-label="Preview" title="Preview">👁</button>
                      <button className="icon-btn sm" onClick={() => {
                        const copy = { ...clone(p), id: uid('pg'), name: `${p.name} copy`, slug: `${p.slug || 'home'}-copy` };
                        copy.blocks = copy.blocks.map((b) => ({ ...b, id: uid('blk') }));
                        update((d) => { d.pages.push(copy); });
                      }} aria-label="Duplicate" title="Duplicate">⧉</button>
                      {i > 0 && <button className="icon-btn sm danger" onClick={() => removePage(p)} aria-label="Delete" title="Delete">✕</button>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
      <div className="grid-2col">
        <MenuEditor which="main" />
        <MenuEditor which="footer" />
      </div>
      {adding && (
        <Modal title="New page" onClose={() => setAdding(false)} wide>
          <Text label="Page name (optional)" value={name} onChange={setName} placeholder="Uses the template name if empty" />
          <div className="block-grid">
            {TEMPLATES.map((t) => (
              <button key={t.name} className="block-tile" onClick={() => addPage(t)}>
                <strong>{t.name}</strong>
                <span className="muted small">/{t.slug}</span>
              </button>
            ))}
          </div>
        </Modal>
      )}
    </div>
  );
}
