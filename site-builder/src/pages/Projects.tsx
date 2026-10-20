import { useRef, useState } from 'react';
import { useStore } from '../store';
import { go, href } from '../router';
import { createSite } from '../lib/defaults';
import { siteFromInspection, siteFromInspiration, type Inspiration, type InspectResult } from '../lib/inspirations';
import { InspirationGallery, UrlInspector } from '../components/InspirationGallery';
import { Badge, Empty, Modal, Segmented } from '../components/ui';
import { ThemeMenu } from '../components/ThemeMenu';
import { BrandLogo } from '../brand/BrandLogo';
import { downloadBlob } from '../lib/storage';
import { clone, slugify, timeAgo, uid } from '../lib/util';
import type { Site } from '../types';
import { ask } from '../components/dialog';
import { DemoBanner } from '../components/DemoBanner';

function NewSite({ onClose }: { onClose: () => void }) {
  const { create } = useStore();
  const [name, setName] = useState('');
  const [mode, setMode] = useState<'gallery' | 'url' | 'blank'>('gallery');
  const finalName = name.trim() || 'My website';

  const start = async (site: Site) => {
    site.hosting.slug = slugify(site.name) || site.hosting.slug;
    await create(site);
    onClose();
    go({ name: 'studio', siteId: site.id, area: 'frontend', tab: 'design' });
  };

  return (
    <Modal title="Create a new website" onClose={onClose} wide>
      <label className="field">
        <span className="field-label">Website name</span>
        <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Bloom Studio" />
      </label>
      <Segmented
        label="Start from"
        value={mode}
        onChange={setMode}
        options={[
          { value: 'gallery', label: 'Inspiration gallery' },
          { value: 'url', label: 'A website I love' },
          { value: 'blank', label: 'Blank site' },
        ]}
      />
      <div className="spacer" />
      {mode === 'gallery' && <InspirationGallery onUse={(i: Inspiration) => start(siteFromInspiration(i, finalName))} />}
      {mode === 'url' && (
        <>
          <p className="muted">Paste the address of a site whose look you like. We’ll analyse its colours, typography, navigation and section layout, then build a starting point with your own content.</p>
          <UrlInspector onResult={(r: InspectResult) => start(siteFromInspection(r, finalName))} />
        </>
      )}
      {mode === 'blank' && (
        <div className="center pad">
          <p className="muted">A home page with a hero, features and call to action, on a neutral theme.</p>
          <button className="btn" onClick={() => start(createSite(finalName))}>Create blank site</button>
        </div>
      )}
    </Modal>
  );
}

export function Projects() {
  const { sites, loaded, create, remove, toast } = useStore();
  const [creating, setCreating] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const duplicate = async (s: Site) => {
    const copy = clone(s);
    copy.id = uid('site');
    copy.name = `${s.name} (copy)`;
    copy.hosting.slug = `${s.hosting.slug}-copy`;
    copy.domains.domains = [];
    copy.deployments = [];
    copy.createdAt = copy.updatedAt = Date.now();
    await create(copy);
    toast('Site duplicated');
  };

  const importBackup = async (file: File) => {
    try {
      const data = JSON.parse(await file.text()) as Site;
      if (!data.pages || !data.theme) throw new Error('Not a studio backup file.');
      data.id = uid('site');
      data.updatedAt = Date.now();
      await create(data);
      toast(`Imported “${data.name}”`);
    } catch (err) {
      toast((err as Error).message, 'err');
    }
  };

  return (
    <div className="projects">
      <header className="topbar">
        <a className="brand" href={href({ name: 'landing' })} aria-label="Studio home"><BrandLogo size={28} suffix="Studio" /></a>
        <div className="row">
          <ThemeMenu />
          <input ref={fileInput} type="file" accept="application/json" hidden onChange={(e) => e.target.files?.[0] && importBackup(e.target.files[0])} />
          <button className="btn ghost" onClick={() => fileInput.current?.click()}>Import backup</button>
          <button className="btn" onClick={() => setCreating(true)}>＋ New website</button>
        </div>
      </header>
      <DemoBanner />
      <main className="projects-main">
        <h1>Your websites</h1>
        {!loaded ? (
          <p className="muted">Loading…</p>
        ) : sites.length === 0 ? (
          <Empty icon="✦" title="Create your first website">
            <p className="muted">Pick an inspiration, analyse a site you admire, or start blank.</p>
            <button className="btn lg" onClick={() => setCreating(true)}>＋ New website</button>
          </Empty>
        ) : (
          <div className="site-grid">
            <button className="site-card new" onClick={() => setCreating(true)}>
              <span>＋</span>New website
            </button>
            {sites.map((s) => {
              const live = s.deployments.find((d) => d.status === 'success');
              return (
                <article key={s.id} className="site-card">
                  <a className="site-thumb" href={href({ name: 'studio', siteId: s.id, area: 'frontend', tab: 'design' })} style={{ background: `linear-gradient(135deg, ${s.theme.primary}, ${s.theme.dark})` }} aria-label={`Open ${s.name}`}>
                    <span style={{ fontFamily: `"${s.theme.headingFont}"` }}>{s.name}</span>
                  </a>
                  <div className="site-info">
                    <div className="row between">
                      <h3>{s.name}</h3>
                      {live ? <Badge tone="good">Live</Badge> : <Badge>Draft</Badge>}
                    </div>
                    <p className="tiny muted">{s.pages.length} pages · edited {timeAgo(s.updatedAt)}{s.inspiration ? ` · from ${s.inspiration}` : ''}</p>
                    <div className="row">
                      <a className="btn sm" href={href({ name: 'studio', siteId: s.id, area: 'frontend', tab: 'design' })}>Edit</a>
                      <button className="btn sm ghost" onClick={() => duplicate(s)}>Duplicate</button>
                      <button className="btn sm ghost" onClick={() => downloadBlob(JSON.stringify(s), `${slugify(s.name)}-backup.json`, 'application/json')}>Backup</button>
                      <button className="btn sm ghost danger" onClick={async () => { if (await ask({ title: 'Delete website?', message: `Delete “${s.name}”? This cannot be undone.`, confirmLabel: 'Delete', danger: true })) remove(s.id); }}>Delete</button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>
      {creating && <NewSite onClose={() => setCreating(false)} />}
    </div>
  );
}
