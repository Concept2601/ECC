import { useMemo, useRef, useState } from 'react';
import { useSite } from '../../store';
import { useUpload } from '../../components/MediaPicker';
import { reoptimise } from '../../lib/media';
import { usedMedia } from '../../lib/render';
import { dataUrlBytes, formatBytes } from '../../lib/util';
import { Badge, Card, Empty, PageHead, Segmented } from '../../components/ui';
import type { MediaAsset, Site } from '../../types';

function usage(site: Site): Map<string, string[]> {
  const map = new Map<string, string[]>();
  const add = (id: string | undefined, where: string) => {
    if (!id) return;
    map.set(id, [...(map.get(id) ?? []), where]);
  };
  for (const p of site.pages) {
    add(p.seo.ogImageId, `${p.name} (share image)`);
    for (const b of p.blocks) {
      add(b.mediaId, p.name);
      b.items?.forEach((i) => add(i.mediaId, p.name));
    }
  }
  add(site.settings.logoId, 'Logo');
  add(site.settings.favicon, 'Favicon');
  add(site.seo.defaultOgImageId, 'Default share image');
  for (const m of site.media) if (m.posterId) add(m.posterId, `Poster for ${m.name}`);
  return map;
}

export function MediaTab() {
  const { site, update, toast } = useSite();
  const { upload, busy } = useUpload();
  const input = useRef<HTMLInputElement>(null);
  const [filter, setFilter] = useState<'all' | 'image' | 'video' | 'unused' | 'noalt'>('all');
  const [drag, setDrag] = useState(false);
  const [working, setWorking] = useState(false);
  const used = useMemo(() => usage(site), [site]);
  const shipped = useMemo(() => new Set(usedMedia(site).map((m) => m.id)), [site]);

  const list = site.media.filter((m) =>
    filter === 'all' ? true : filter === 'unused' ? !used.has(m.id) : filter === 'noalt' ? m.kind === 'image' && !m.alt.trim() : m.kind === filter,
  );
  const total = site.media.reduce((n, m) => n + m.size + Object.values(m.variants ?? {}).reduce((v, src) => v + dataUrlBytes(src), 0), 0);
  const saved = site.media.reduce((n, m) => n + Math.max(0, m.originalSize - m.size), 0);

  const setAsset = (id: string, patch: Partial<MediaAsset>) => update((d) => { Object.assign(d.media.find((m) => m.id === id)!, patch); }, `media-${id}`);

  const remove = (m: MediaAsset) => {
    const where = used.get(m.id);
    if (where && !window.confirm(`“${m.name}” is used on: ${where.join(', ')}. Delete anyway?`)) return;
    update((d) => {
      d.media = d.media.filter((x) => x.id !== m.id);
      const clear = (o: { mediaId?: string }) => { if (o.mediaId === m.id) o.mediaId = undefined; };
      d.pages.forEach((p) => p.blocks.forEach((b) => { clear(b); b.items?.forEach(clear); }));
    });
  };

  const reoptimiseAll = async () => {
    setWorking(true);
    try {
      const imgs = site.media.filter((m) => m.kind === 'image' && !/svg|gif/.test(m.mime));
      const results = await Promise.all(imgs.map((m) => reoptimise(m, site.performance)));
      update((d) => {
        for (const r of results) {
          const i = d.media.findIndex((m) => m.id === r.id);
          if (i >= 0) d.media[i] = r;
        }
      });
      toast(`Re-optimised ${results.length} image(s) with current speed settings.`);
    } catch (err) {
      toast((err as Error).message, 'err');
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="tab-page">
      <PageHead
        title="Media library"
        subtitle="Images are resized, converted to WebP and given mobile-sized variants automatically on upload."
        actions={
          <>
            <button className="btn ghost" disabled={working || !site.media.length} onClick={reoptimiseAll}>{working ? 'Optimising…' : 'Re-optimise all'}</button>
            <button className="btn" disabled={busy} onClick={() => input.current?.click()}>{busy ? 'Uploading…' : 'Upload'}</button>
          </>
        }
      />
      <input ref={input} type="file" multiple accept="image/*,video/*" hidden onChange={(e) => e.target.files && upload(e.target.files)} />
      <div
        className={`dropzone${drag ? ' over' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); if (e.dataTransfer.files.length) upload(e.dataTransfer.files); }}
        onClick={() => input.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && input.current?.click()}
      >
        <strong>{busy ? 'Optimising your files…' : 'Drop images or videos here'}</strong>
        <span className="muted small">JPG, PNG, WebP, SVG, GIF, MP4, WebM · videos up to 200 MB</span>
      </div>
      <div className="stats-row">
        <div><strong>{site.media.length}</strong><span>files</span></div>
        <div><strong>{formatBytes(total)}</strong><span>library size</span></div>
        <div><strong>{formatBytes(saved)}</strong><span>saved by optimisation</span></div>
        <div><strong>{shipped.size}</strong><span>shipped on launch</span></div>
      </div>
      <Segmented value={filter} onChange={setFilter} options={[{ value: 'all', label: 'All' }, { value: 'image', label: 'Images' }, { value: 'video', label: 'Videos' }, { value: 'noalt', label: 'Missing alt' }, { value: 'unused', label: 'Unused' }]} />
      {list.length === 0 ? (
        <Empty icon="▣" title={site.media.length ? 'Nothing matches this filter' : 'No media yet'}>
          <p className="muted">Upload your logo, photos and videos to use them across the site.</p>
        </Empty>
      ) : (
        <div className="asset-grid">
          {list.map((m) => {
            const where = used.get(m.id);
            const pct = m.originalSize > m.size ? Math.round((1 - m.size / m.originalSize) * 100) : 0;
            return (
              <Card key={m.id} className="asset">
                <div className="asset-preview">
                  {m.kind === 'image' ? <img src={m.variants?.[480] ?? m.src} alt="" loading="lazy" /> : <video src={m.src} controls preload="metadata" />}
                </div>
                <div className="asset-meta">
                  <div className="row between">
                    <strong className="ellipsis" title={m.name}>{m.name}</strong>
                    {where ? <Badge tone="good">In use</Badge> : <Badge>Unused</Badge>}
                  </div>
                  <p className="tiny muted">
                    {m.mime.split('/')[1].toUpperCase()} · {formatBytes(m.size)}{pct > 0 && <> · <span className="good-text">−{pct}%</span></>}
                    {m.width && ` · ${m.width}×${m.height}`}
                    {m.variants && Object.keys(m.variants).length > 0 && ` · ${Object.keys(m.variants).length} sizes`}
                  </p>
                  <label className="field">
                    <span className="field-label">{m.kind === 'image' ? 'Alt text (for SEO & screen readers)' : 'Description'}</span>
                    <input value={m.alt} onChange={(e) => setAsset(m.id, { alt: e.target.value })} placeholder={m.kind === 'image' ? 'Describe what the image shows' : 'What happens in this video'} aria-invalid={m.kind === 'image' && !m.alt.trim()} />
                  </label>
                  {where && <p className="tiny muted ellipsis" title={where.join(', ')}>Used on: {[...new Set(where)].join(', ')}</p>}
                  <div className="row">
                    <button className="link danger" onClick={() => remove(m)}>Delete</button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
