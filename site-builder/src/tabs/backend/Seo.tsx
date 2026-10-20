import { useMemo, useState } from 'react';
import { useSite } from '../../store';
import { score, seoAudit, siteSeoAudit } from '../../lib/audits';
import { pageDescription, pagePath, pageTitle, primaryDomain, robotsTxt, sitemapXml } from '../../lib/render';
import type { PageSeo, SeoSettings } from '../../types';
import { Area, Card, Checks, PageHead, Score, Segmented, Select, Text, Toggle } from '../../components/ui';
import { MediaField } from '../../components/MediaPicker';
import { useFix } from '../../hooks';

function SerpPreview({ url, title, description }: { url: string; title: string; description: string }) {
  return (
    <div className="serp" aria-label="Google search preview">
      <div className="serp-url">{url}</div>
      <div className="serp-title">{title.length > 60 ? `${title.slice(0, 58)}…` : title}</div>
      <div className="serp-desc">{description.length > 160 ? `${description.slice(0, 157)}…` : description || 'Add a meta description to control this text.'}</div>
    </div>
  );
}

function SocialPreview({ image, title, description, domain }: { image?: string; title: string; description: string; domain: string }) {
  return (
    <div className="social-card" aria-label="Social share preview">
      <div className="social-img">{image ? <img src={image} alt="" /> : <span>No share image</span>}</div>
      <div className="social-body">
        <span className="tiny muted">{domain.toUpperCase()}</span>
        <strong>{title}</strong>
        <span className="small muted">{description.slice(0, 110)}</span>
      </div>
    </div>
  );
}

export function SeoTab() {
  const { site, update } = useSite();
  const fix = useFix();
  const [view, setView] = useState<'pages' | 'site' | 'files'>('pages');
  const [pageId, setPageId] = useState(site.pages[0].id);
  const page = site.pages.find((p) => p.id === pageId) ?? site.pages[0];
  const s = site.seo;
  const base = primaryDomain(site) ?? `https://${site.hosting.slug}.example`;
  const checks = useMemo(() => seoAudit(site, page), [site, page]);
  const siteChecks = useMemo(() => siteSeoAudit(site), [site]);
  const setSeo = <K extends keyof SeoSettings>(k: K, v: SeoSettings[K]) => update((d) => { d.seo[k] = v; }, `seo-${k}`);
  const setPage = <K extends keyof PageSeo>(k: K, v: PageSeo[K]) => update((d) => { d.pages.find((p) => p.id === page.id)!.seo[k] = v; }, `pseo-${page.id}-${k}`);
  const ogId = page.seo.ogImageId || s.defaultOgImageId;
  const og = site.media.find((m) => m.id === ogId);

  return (
    <div className="tab-page">
      <PageHead title="SEO" subtitle="Get found on Google. Live scoring tells you exactly what to improve." />
      <Segmented value={view} onChange={setView} options={[{ value: 'pages', label: 'Page SEO' }, { value: 'site', label: 'Site-wide' }, { value: 'files', label: 'Sitemap & robots' }]} />

      {view === 'pages' && (
        <>
          <div className="row">
            <label className="field"><span className="field-label">Page</span>
              <select value={page.id} onChange={(e) => setPageId(e.target.value)}>
                {site.pages.map((p) => <option key={p.id} value={p.id}>{p.name} — {score(seoAudit(site, p))}/100</option>)}
              </select>
            </label>
          </div>
          <div className="grid-2col">
            <Card title="Search appearance">
              <Text label="Focus keyword" value={page.seo.focusKeyword} onChange={(v) => setPage('focusKeyword', v)} placeholder="e.g. wedding photographer harare" hint="The main phrase people would search to find this page." />
              <Text label="SEO title" value={page.seo.title} onChange={(v) => setPage('title', v)} counter={[30, 60]} placeholder={page.slug ? page.name : site.seo.siteName} hint={<>Shown as: “{pageTitle(site, page)}”</>} />
              <Area label="Meta description" value={page.seo.description} onChange={(v) => setPage('description', v)} counter={[70, 160]} rows={3} placeholder="A compelling summary that makes searchers click." />
              <MediaField label="Social share image (1200×630 ideal)" value={page.seo.ogImageId} onChange={(v) => setPage('ogImageId', v)} />
              <Text label="Canonical URL (advanced)" value={page.seo.canonical} onChange={(v) => setPage('canonical', v)} placeholder={`${base}/${pagePath(page)}`} />
              <Toggle label="Hide from search engines (noindex)" checked={page.seo.noindex} onChange={(v) => setPage('noindex', v)} />
            </Card>
            <div className="stack">
              <Card title="Google preview">
                <SerpPreview url={`${base.replace(/^https?:\/\//, '')}${page.slug ? ` › ${page.slug}` : ''}`} title={pageTitle(site, page)} description={pageDescription(site, page)} />
              </Card>
              <Card title="Social preview">
                <SocialPreview image={og?.variants?.[960] ?? og?.src} title={pageTitle(site, page)} description={pageDescription(site, page)} domain={base.replace(/^https?:\/\//, '')} />
              </Card>
              <Card title="Page score">
                <div className="row gap-lg"><Score value={score(checks)} label="SEO" /><p className="muted small">Fix red items first; yellow items are worthwhile improvements.</p></div>
                <Checks checks={checks} onFix={fix} />
              </Card>
            </div>
          </div>
        </>
      )}

      {view === 'site' && (
        <div className="grid-2col">
          <Card title="Site identity">
            <Text label="Site / business name" value={s.siteName} onChange={(v) => setSeo('siteName', v)} />
            <Text label="Title template" value={s.titleTemplate} onChange={(v) => setSeo('titleTemplate', v)} hint="%s is replaced by each page’s title. The home page uses its SEO title, or the site name." />
            <Area label="Default description" value={s.defaultDescription} onChange={(v) => setSeo('defaultDescription', v)} counter={[70, 160]} />
            <MediaField label="Default share image" value={s.defaultOgImageId} onChange={(v) => setSeo('defaultOgImageId', v)} />
            <div className="grid2">
              <Select label="Language" value={s.language} options={[{ value: 'en', label: 'English' }, { value: 'en-GB', label: 'English (UK)' }, { value: 'fr', label: 'French' }, { value: 'pt', label: 'Portuguese' }, { value: 'es', label: 'Spanish' }, { value: 'de', label: 'German' }, { value: 'sn', label: 'Shona' }, { value: 'nd', label: 'Ndebele' }, { value: 'sw', label: 'Swahili' }, { value: 'zu', label: 'Zulu' }]} onChange={(v) => setSeo('language', v)} />
              <Text label="X / Twitter handle" value={s.twitterHandle} onChange={(v) => setSeo('twitterHandle', v)} placeholder="@yourbrand" />
            </div>
          </Card>
          <Card title="Business details (structured data)" subtitle="Helps Google show rich results and your business panel.">
            <Select label="You are a…" value={s.schemaType} options={[{ value: 'Organization', label: 'Company / organisation' }, { value: 'LocalBusiness', label: 'Local business' }, { value: 'Person', label: 'Person / freelancer' }, { value: 'WebSite', label: 'Website only' }]} onChange={(v) => setSeo('schemaType', v)} />
            <Text label="Phone" value={s.businessPhone} onChange={(v) => setSeo('businessPhone', v)} />
            <Text label="Address" value={s.businessAddress} onChange={(v) => setSeo('businessAddress', v)} />
            <h4>Search engine verification</h4>
            <Text label="Google Search Console code" value={s.googleVerification} onChange={(v) => setSeo('googleVerification', v.replace(/.*content="([^"]+)".*/, '$1'))} hint="Paste the meta tag or just its content value." />
            <Text label="Bing Webmaster code" value={s.bingVerification} onChange={(v) => setSeo('bingVerification', v.replace(/.*content="([^"]+)".*/, '$1'))} />
            <Toggle label="Generate XML sitemap" checked={s.generateSitemap} onChange={(v) => setSeo('generateSitemap', v)} />
            <Toggle label="Allow search engines to index the site" checked={s.allowIndexing} onChange={(v) => setSeo('allowIndexing', v)} hint="Turn off for staging or private sites." />
          </Card>
          <Card title="Site-wide checks" className="span2">
            <Checks checks={siteChecks} onFix={fix} />
          </Card>
        </div>
      )}

      {view === 'files' && (
        <div className="grid-2col">
          <Card title="sitemap.xml" subtitle={primaryDomain(site) ? 'Submitted to search engines after launch.' : 'Connect a domain so the sitemap can use absolute URLs.'}>
            <pre className="code">{sitemapXml(site, base)}</pre>
          </Card>
          <Card title="robots.txt">
            <pre className="code">{robotsTxt(site, primaryDomain(site))}</pre>
          </Card>
        </div>
      )}
    </div>
  );
}
