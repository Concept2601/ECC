import { useMemo, useState } from 'react';
import { useSite } from '../../store';
import { pageWeight, perfAudit, score } from '../../lib/audits';
import { formatBytes } from '../../lib/util';
import type { PerformanceSettings } from '../../types';
import { Card, Checks, PageHead, Score, Select, Toggle } from '../../components/ui';
import { useFix } from '../../hooks';

export function SpeedTab() {
  const { site, update } = useSite();
  const fix = useFix();
  const [pageId, setPageId] = useState(site.pages[0].id);
  const page = site.pages.find((p) => p.id === pageId) ?? site.pages[0];
  const checks = useMemo(() => perfAudit(site, page), [site, page]);
  const w = useMemo(() => pageWeight(site, page), [site, page]);
  const p = site.performance;
  const set = <K extends keyof PerformanceSettings>(k: K, v: PerformanceSettings[K]) => update((d) => { d.performance[k] = v; }, `perf-${k}`);
  const budget = p.pageWeightBudgetKb * 1024;
  const parts = [
    { label: 'HTML + CSS', value: w.html, cls: 'b1' },
    { label: 'Images', value: w.images, cls: 'b2' },
    { label: 'Fonts', value: w.fonts, cls: 'b3' },
    { label: 'Video preload', value: w.video, cls: 'b4' },
  ];
  // Rough 4G estimate: ~1.6 MB/s effective plus connection overhead.
  const seconds = (0.35 + w.total / (1.6 * 1024 * 1024)).toFixed(1);

  return (
    <div className="tab-page">
      <PageHead title="Speed optimisation" subtitle="Fast sites rank higher and convert better. Everything here applies automatically when you launch." />
      <div className="grid-2col">
        <Card title="Page speed" actions={<select value={page.id} onChange={(e) => setPageId(e.target.value)} aria-label="Page">{site.pages.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>}>
          <div className="row gap-lg">
            <Score value={score(checks)} label="Speed" size={110} />
            <dl className="kv">
              <dt>Page weight</dt><dd>{formatBytes(w.total)}</dd>
              <dt>Requests</dt><dd>{w.requests}</dd>
              <dt>Est. load on 4G</dt><dd>~{seconds}s</dd>
            </dl>
          </div>
          <div className="weight-bar" role="img" aria-label="Page weight breakdown">
            {parts.map((x) => <span key={x.label} className={x.cls} style={{ width: `${Math.min(100, (x.value / Math.max(budget, w.total)) * 100)}%` }} />)}
          </div>
          <div className="legend">
            {parts.map((x) => <span key={x.label}><i className={x.cls} />{x.label} {formatBytes(x.value)}</span>)}
            <span className="muted">Budget {p.pageWeightBudgetKb} KB</span>
          </div>
        </Card>
        <Card title="Recommendations">
          <Checks checks={checks} onFix={fix} />
        </Card>
      </div>
      <div className="grid-2col">
        <Card title="Images & video">
          <Toggle label="Convert images to WebP" hint="~25–35% smaller than JPEG/PNG at the same quality." checked={p.convertToWebp} onChange={(v) => set('convertToWebp', v)} />
          <Toggle label="Responsive images (srcset)" hint="Phones download 480–960px versions instead of full size." checked={p.responsiveImages} onChange={(v) => set('responsiveImages', v)} />
          <Toggle label="Lazy-load below-the-fold images" hint="The first image is prioritised; the rest load as visitors scroll." checked={p.lazyLoad} onChange={(v) => set('lazyLoad', v)} />
          <label className="field">
            <span className="field-label">Image quality — {Math.round(p.imageQuality * 100)}%</span>
            <input type="range" min={0.5} max={0.95} step={0.01} value={p.imageQuality} onChange={(e) => set('imageQuality', Number(e.target.value))} />
          </label>
          <Select label="Maximum image width" value={p.maxImageWidth} options={[1280, 1600, 1920, 2560].map((n) => ({ value: n, label: `${n}px` }))} onChange={(v) => set('maxImageWidth', v)} />
          <Select label="Uploaded video preload" value={p.videoPreload} options={[{ value: 'none', label: 'None (fastest)' }, { value: 'metadata', label: 'Metadata (shows duration)' }]} onChange={(v) => set('videoPreload', v)} />
          <p className="hint">Image settings apply to new uploads. Use “Re-optimise all” in Media to update existing images.</p>
        </Card>
        <Card title="Code & fonts">
          <Toggle label="Minify HTML & CSS" checked={p.minify} onChange={(v) => set('minify', v)} />
          <Toggle label="Inline critical CSS" hint="Removes a render-blocking request. Turn off for very large sites to share one cached stylesheet." checked={p.inlineCss} onChange={(v) => set('inlineCss', v)} />
          <Toggle label="Preconnect to font servers" checked={p.preconnectFonts} onChange={(v) => set('preconnectFonts', v)} />
          <Toggle label="font-display: swap" hint="Shows text immediately in a fallback font while web fonts load." checked={p.fontDisplaySwap} onChange={(v) => set('fontDisplaySwap', v)} />
          <Select label="Page weight budget" value={p.pageWeightBudgetKb} options={[800, 1000, 1500, 2000, 3000].map((n) => ({ value: n, label: `${n} KB` }))} onChange={(v) => set('pageWeightBudgetKb', v)} />
          <p className="hint">Always on: lightweight click-to-play YouTube embeds, explicit image dimensions (no layout shift), Brotli/gzip compression and long-lived asset caching on the hosting server.</p>
        </Card>
      </div>
    </div>
  );
}
