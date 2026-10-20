import type { Block, Page, Site } from '../types';
import { contrastRatio, readableOn } from './color';
import { pageDescription, pageTitle, renderPage, usedMedia } from './render';
import { dataUrlBytes, stripTags } from './util';

export type Status = 'pass' | 'warn' | 'fail';
export interface Check {
  id: string;
  label: string;
  status: Status;
  detail: string;
  /** Which studio tab fixes it */
  fix?: string;
}

const W: Record<Status, number> = { pass: 1, warn: 0.5, fail: 0 };
export const score = (checks: Check[]) =>
  checks.length ? Math.round((checks.reduce((n, c) => n + W[c.status], 0) / checks.length) * 100) : 100;

const check = (id: string, label: string, status: Status, detail: string, fix?: string): Check => ({ id, label, status, detail, fix });

const visible = (p: Page) => p.blocks.filter((b) => !b.hidden);

function pageText(p: Page): string {
  return visible(p)
    .flatMap((b: Block) => [b.eyebrow, b.heading, stripTags(b.body ?? ''), ...(b.items ?? []).flatMap((i) => [i.title, i.text, i.features])])
    .filter(Boolean)
    .join(' ');
}

const headingFor = (p: Page) => visible(p)[0]?.heading?.trim() ?? '';

// ------------------------------------------------------------------ SEO

export function seoAudit(site: Site, page: Page): Check[] {
  const title = pageTitle(site, page);
  const desc = pageDescription(site, page);
  const kw = page.seo.focusKeyword.trim().toLowerCase();
  const text = pageText(page);
  const words = text.split(/\s+/).filter(Boolean).length;
  const h1 = headingFor(page);
  const checks: Check[] = [];

  checks.push(
    title.length >= 30 && title.length <= 60
      ? check('title', 'Title length', 'pass', `${title.length} characters — ideal.`)
      : check('title', 'Title length', title.length < 15 || title.length > 70 ? 'fail' : 'warn', `${title.length} characters. Aim for 30–60 so it isn’t cut off in Google.`, 'seo'),
  );
  checks.push(
    !page.seo.description
      ? check('desc', 'Meta description', 'fail', 'No description set. Google will guess one from your content.', 'seo')
      : desc.length >= 70 && desc.length <= 160
        ? check('desc', 'Meta description', 'pass', `${desc.length} characters — ideal.`)
        : check('desc', 'Meta description', 'warn', `${desc.length} characters. Aim for 70–160.`, 'seo'),
  );
  checks.push(h1 ? check('h1', 'Main heading (H1)', 'pass', `“${h1.slice(0, 60)}”`) : check('h1', 'Main heading (H1)', 'fail', 'The first section has no heading, so the page has no H1.', 'design'));
  checks.push(
    words >= 300
      ? check('words', 'Content depth', 'pass', `${words} words.`)
      : check('words', 'Content depth', words >= 120 ? 'warn' : 'fail', `${words} words. Pages with 300+ words tend to rank better.`, 'design'),
  );
  if (kw) {
    const inTitle = title.toLowerCase().includes(kw);
    const inDesc = desc.toLowerCase().includes(kw);
    const inH1 = h1.toLowerCase().includes(kw);
    const count = text.toLowerCase().split(kw).length - 1;
    const density = words ? (count * kw.split(/\s+/).length * 100) / words : 0;
    checks.push(check('kw-title', 'Keyword in title', inTitle ? 'pass' : 'fail', inTitle ? 'Found.' : `Add “${kw}” to the page title.`, 'seo'));
    checks.push(check('kw-desc', 'Keyword in description', inDesc ? 'pass' : 'warn', inDesc ? 'Found.' : `Mention “${kw}” in the meta description.`, 'seo'));
    checks.push(check('kw-h1', 'Keyword in H1', inH1 ? 'pass' : 'warn', inH1 ? 'Found.' : `Use “${kw}” in the main heading.`, 'design'));
    checks.push(
      density >= 0.5 && density <= 3
        ? check('kw-density', 'Keyword density', 'pass', `${density.toFixed(1)}% (${count}×).`)
        : check('kw-density', 'Keyword density', 'warn', `${density.toFixed(1)}% (${count}×). Aim for 0.5–3% — natural use, no stuffing.`, 'design'),
    );
    if (page.slug) {
      const inSlug = page.slug.includes(kw.replace(/\s+/g, '-'));
      checks.push(check('kw-slug', 'Keyword in URL', inSlug ? 'pass' : 'warn', inSlug ? `/${page.slug}/` : `Consider a URL containing “${kw.replace(/\s+/g, '-')}”.`, 'pages'));
    }
  } else {
    checks.push(check('kw', 'Focus keyword', 'warn', 'Set a focus keyword to get targeted recommendations.', 'seo'));
  }
  const imgs = imagesOn(site, page);
  const missingAlt = imgs.filter((m) => !m.alt.trim());
  checks.push(
    missingAlt.length
      ? check('alt', 'Image alt text', 'fail', `${missingAlt.length} of ${imgs.length} images have no alt text.`, 'media')
      : check('alt', 'Image alt text', 'pass', imgs.length ? `All ${imgs.length} images described.` : 'No images on this page.'),
  );
  const internal = visible(page).some((b) => [b.ctaLink, b.secondaryLink, ...(b.items ?? []).map((i) => i.link)].some((l) => l?.startsWith('/'))) || /href="\//.test(visible(page).map((b) => b.body).join(''));
  checks.push(check('links', 'Internal links', internal || site.menus.main.length > 1 ? 'pass' : 'warn', internal ? 'Links to other pages found.' : 'Navigation links only. Link to related pages from your content.', 'design'));
  checks.push(page.seo.noindex ? check('index', 'Indexable', 'warn', 'This page is set to noindex and will not appear in search.', 'seo') : check('index', 'Indexable', 'pass', 'Search engines may index this page.'));
  const og = page.seo.ogImageId || site.seo.defaultOgImageId;
  checks.push(check('og', 'Social share image', og ? 'pass' : 'warn', og ? 'Set.' : 'Add an Open Graph image so links look great when shared.', 'seo'));
  return checks;
}

export function siteSeoAudit(site: Site): Check[] {
  const titles = site.pages.map((p) => pageTitle(site, p));
  const dupes = titles.filter((t, i) => titles.indexOf(t) !== i);
  return [
    check('sitename', 'Site name', site.seo.siteName ? 'pass' : 'fail', site.seo.siteName || 'Missing', 'seo'),
    check('sitemap', 'XML sitemap', site.seo.generateSitemap ? 'pass' : 'warn', site.seo.generateSitemap ? 'Generated on launch (needs a connected domain for absolute URLs).' : 'Sitemap disabled.', 'seo'),
    check('indexing', 'Search indexing', site.seo.allowIndexing ? 'pass' : 'fail', site.seo.allowIndexing ? 'Allowed.' : 'Whole site is blocked from search engines.', 'seo'),
    check('dupes', 'Unique page titles', dupes.length ? 'fail' : 'pass', dupes.length ? `Duplicate: ${[...new Set(dupes)].join(', ')}` : 'All titles unique.', 'seo'),
    check('verify', 'Search Console verification', site.seo.googleVerification ? 'pass' : 'warn', site.seo.googleVerification ? 'Google tag set.' : 'Add your Google Search Console verification code.', 'seo'),
    check('schema', 'Structured data', 'pass', `${site.seo.schemaType} + WebSite schema${site.pages.some((p) => p.blocks.some((b) => b.type === 'faq')) ? ' + FAQ' : ''}.`),
    check('favicon', 'Favicon', site.settings.favicon ? 'pass' : 'warn', site.settings.favicon ? 'Set.' : 'Add a favicon so your tab and search result have your icon.', 'settings'),
  ];
}

// ------------------------------------------------------------------ performance

function imagesOn(site: Site, page: Page) {
  const ids = new Set<string>();
  for (const b of visible(page)) {
    if (b.mediaId) ids.add(b.mediaId);
    b.items?.forEach((i) => i.mediaId && ids.add(i.mediaId));
  }
  return site.media.filter((m) => ids.has(m.id) && m.kind === 'image');
}

function videosOn(site: Site, page: Page) {
  const ids = new Set(visible(page).filter((b) => b.type === 'video' && b.mediaId).map((b) => b.mediaId));
  return site.media.filter((m) => ids.has(m.id) && m.kind === 'video');
}

const FONT_KB = 45;

export interface Weight {
  html: number;
  images: number;
  fonts: number;
  video: number;
  total: number;
  requests: number;
}

/** Estimated transfer for a first page view on a laptop (videos count only their preload). */
export function pageWeight(site: Site, page: Page): Weight {
  const html = new TextEncoder().encode(renderPage(site, page, { mode: 'export' })).length;
  const imgs = imagesOn(site, page);
  const images = imgs.reduce((n, m) => {
    const variants = Object.entries(m.variants ?? {});
    const pick = site.performance.responsiveImages ? variants.find(([w]) => Number(w) >= 1280)?.[1] : undefined;
    return n + (pick ? dataUrlBytes(pick) : m.size);
  }, 0);
  const families = new Set([site.theme.headingFont, site.theme.bodyFont].filter((f) => f !== 'system-ui')).size;
  const fonts = families * FONT_KB * 1024;
  const vids = videosOn(site, page);
  const video = site.performance.videoPreload === 'none' ? 0 : vids.length * 150 * 1024;
  return { html, images, fonts, video, total: html + images + fonts + video, requests: 1 + imgs.length + families * 2 + vids.length };
}

export function perfAudit(site: Site, page: Page): Check[] {
  const p = site.performance;
  const w = pageWeight(site, page);
  const kb = Math.round(w.total / 1024);
  const imgs = imagesOn(site, page);
  const heavy = imgs.filter((m) => m.size > 350 * 1024);
  const noVariants = imgs.filter((m) => !m.variants || !Object.keys(m.variants).length);
  const vids = videosOn(site, page);
  const bigVideo = vids.filter((v) => v.size > 15 * 1024 * 1024);
  const families = new Set([site.theme.headingFont, site.theme.bodyFont]).size;
  return [
    check('budget', 'Page weight budget', kb <= p.pageWeightBudgetKb ? 'pass' : kb <= p.pageWeightBudgetKb * 1.5 ? 'warn' : 'fail', `${kb} KB of ${p.pageWeightBudgetKb} KB budget.`, 'speed'),
    check('requests', 'Requests', w.requests <= 25 ? 'pass' : w.requests <= 50 ? 'warn' : 'fail', `${w.requests} requests on first load.`),
    check('heavy', 'Image file sizes', heavy.length ? 'warn' : 'pass', heavy.length ? `${heavy.length} image(s) over 350 KB: ${heavy.map((m) => m.name).join(', ')}` : 'All images are lean.', 'media'),
    check('webp', 'Modern image format', p.convertToWebp ? 'pass' : 'warn', p.convertToWebp ? 'New uploads are converted to WebP.' : 'Enable WebP conversion for ~30% smaller images.', 'speed'),
    check('responsive', 'Responsive images', !p.responsiveImages ? 'warn' : noVariants.length ? 'warn' : 'pass', !p.responsiveImages ? 'srcset disabled — phones download desktop-size images.' : noVariants.length ? `${noVariants.length} image(s) have no mobile variants (re-optimise in Media).` : 'Phones get appropriately sized images.', 'speed'),
    check('lazy', 'Lazy loading', p.lazyLoad ? 'pass' : 'warn', p.lazyLoad ? 'Below-the-fold images load on demand; the hero image is prioritised.' : 'Enable lazy loading.', 'speed'),
    check('minify', 'Minified HTML & CSS', p.minify ? 'pass' : 'warn', p.minify ? 'Enabled.' : 'Enable minification.', 'speed'),
    check('css', 'Render-blocking CSS', p.inlineCss ? 'pass' : 'warn', p.inlineCss ? 'Critical CSS is inlined — no extra round trip.' : 'CSS is a separate file (better caching across many pages).', 'speed'),
    check('fonts', 'Web fonts', families <= 2 && p.fontDisplaySwap ? 'pass' : 'warn', `${families} font famil${families === 1 ? 'y' : 'ies'}${p.fontDisplaySwap ? ', font-display: swap' : ', text invisible while loading'}.`, 'speed'),
    check('video', 'Video', bigVideo.length ? 'warn' : 'pass', bigVideo.length ? `${bigVideo.length} uploaded video(s) over 15 MB — consider YouTube/Vimeo for long clips.` : vids.length ? `Preload: ${p.videoPreload}.` : 'YouTube embeds load a lightweight placeholder first.', 'media'),
  ];
}

// ------------------------------------------------------------------ accessibility

export function a11yAudit(site: Site): Check[] {
  const t = site.theme;
  const pairs: [string, string, string, number][] = [
    ['Body text', t.text, t.background, 4.5],
    ['Muted text', t.muted, t.background, 4.5],
    ['Muted text on surface', t.muted, t.surface, 4.5],
    ['Button text', readableOn(t.primary), t.primary, 4.5],
    ['Links', t.primary, t.background, 4.5],
    ['Text on dark sections', readableOn(t.dark), t.dark, 4.5],
  ];
  const checks = pairs.map(([label, fg, bg, min]) => {
    const r = contrastRatio(fg, bg);
    return check(`c-${label}`, `Contrast: ${label}`, r >= min ? 'pass' : r >= 3 ? 'warn' : 'fail', `${r}:1 (WCAG AA needs ${min}:1)`, 'design');
  });
  const used = usedMedia(site).filter((m) => m.kind === 'image');
  const noAlt = used.filter((m) => !m.alt.trim());
  checks.push(check('alt', 'Alt text on images', noAlt.length ? 'fail' : 'pass', noAlt.length ? `${noAlt.length} image(s) missing alt text.` : 'All images described.', 'media'));
  const noH1 = site.pages.filter((p) => !headingFor(p));
  checks.push(check('h1', 'One H1 per page', noH1.length ? 'fail' : 'pass', noH1.length ? `Missing on: ${noH1.map((p) => p.name).join(', ')}` : 'Every page starts with a heading.', 'design'));
  const vague = site.pages.flatMap((p) => visible(p)).filter((b) => /^(click here|here|read more|more)$/i.test(b.ctaLabel?.trim() ?? ''));
  checks.push(check('links', 'Descriptive link text', vague.length ? 'warn' : 'pass', vague.length ? `${vague.length} button(s) use vague text like “Click here”.` : 'Buttons describe where they go.', 'design'));
  checks.push(check('lang', 'Page language', site.seo.language ? 'pass' : 'fail', site.seo.language ? `lang="${site.seo.language}"` : 'Set the site language.', 'seo'));
  checks.push(check('base', 'Built-in a11y', 'pass', 'Skip link, focus rings, labelled form fields, keyboard menu and reduced-motion support are generated automatically.'));
  checks.push(check('size', 'Readable font size', t.baseSize >= 16 ? 'pass' : 'warn', `${t.baseSize}px body text.`, 'design'));
  return checks;
}
