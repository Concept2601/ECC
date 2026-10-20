import type { Block, Item, MediaAsset, MenuItem, Page, Site } from '../types';
import { mix, readableOn } from './color';
import { sanitizeHtml } from './sanitize';
import { dataUrlToBytes, escapeHtml as e, mimeExt, stripTags } from './util';

export interface RenderOptions {
  mode: 'preview' | 'export';
  /** Public origin used for canonical URLs, sitemap and social tags, e.g. https://example.com */
  baseUrl?: string;
  selectedBlockId?: string;
}

interface Ctx {
  site: Site;
  page: Page;
  opts: RenderOptions;
  /** relative prefix from the current page to the site root */
  root: string;
  firstImage: boolean;
}

const SYSTEM_STACK = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const fontStack = (f: string) => (f === 'system-ui' ? SYSTEM_STACK : `"${f}", ${SYSTEM_STACK}`);

export const pagePath = (p: Page) => (p.slug ? `${p.slug}/` : '');

export function primaryDomain(site: Site): string | undefined {
  const d = site.domains.domains.find((x) => x.primary) ?? site.domains.domains[0];
  return d ? `https://${d.host}` : undefined;
}

// ---------------------------------------------------------------- media

export const assetPath = (m: MediaAsset, width?: number) =>
  `assets/${m.id}${width ? `-${width}` : ''}.${mimeExt(m.mime)}`;

function mediaUrl(ctx: Ctx, id?: string, width?: number): string | undefined {
  const m = id ? ctx.site.media.find((x) => x.id === id) : undefined;
  if (!m) return undefined;
  if (ctx.opts.mode === 'preview') return width && m.variants?.[width] ? m.variants[width] : m.src;
  return ctx.root + assetPath(m, width && m.variants?.[width] ? width : undefined);
}

function img(ctx: Ctx, id: string | undefined, opts: { sizes?: string; cls?: string; alt?: string; eager?: boolean } = {}): string {
  const m = id ? ctx.site.media.find((x) => x.id === id && x.kind === 'image') : undefined;
  if (!m) return '';
  const perf = ctx.site.performance;
  const eager = opts.eager || ctx.firstImage;
  ctx.firstImage = false;
  const widths = Object.keys(m.variants ?? {}).map(Number).sort((a, b) => a - b);
  const srcset =
    perf.responsiveImages && widths.length
      ? ` srcset="${widths.map((w) => `${mediaUrl(ctx, m.id, w)} ${w}w`).join(', ')}${m.width ? `, ${mediaUrl(ctx, m.id)} ${m.width}w` : ''}" sizes="${opts.sizes ?? '100vw'}"`
      : '';
  const dims = m.width && m.height ? ` width="${m.width}" height="${m.height}"` : '';
  const loading = eager ? ' fetchpriority="high"' : perf.lazyLoad ? ' loading="lazy"' : '';
  return `<img src="${mediaUrl(ctx, m.id)}"${srcset}${dims} alt="${e(opts.alt ?? m.alt)}"${loading} decoding="async"${opts.cls ? ` class="${opts.cls}"` : ''}>`;
}

function videoEmbed(ctx: Ctx, b: Block): string {
  const perf = ctx.site.performance;
  const m = b.mediaId ? ctx.site.media.find((x) => x.id === b.mediaId && x.kind === 'video') : undefined;
  if (m) {
    const poster = m.posterId ? ` poster="${mediaUrl(ctx, m.posterId)}"` : '';
    return `<video class="video" controls playsinline preload="${perf.videoPreload}"${poster} aria-label="${e(m.alt || b.heading || 'Video')}"><source src="${mediaUrl(ctx, m.id)}" type="${m.mime}"></video>`;
  }
  const url = (b.videoUrl ?? '').trim();
  const yt = /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/.exec(url);
  if (yt) {
    // Lite embed: thumbnail first, the heavy player only loads on click.
    const id = yt[1];
    return `<button type="button" class="yt" data-yt="${id}" aria-label="Play video: ${e(b.heading || 'video')}"><img src="https://i.ytimg.com/vi/${id}/hqdefault.jpg" alt="" loading="lazy" width="480" height="360"><span class="yt-play" aria-hidden="true">▶</span></button>`;
  }
  const vimeo = /vimeo\.com\/(\d+)/.exec(url);
  if (vimeo) {
    return `<div class="embed"><iframe src="https://player.vimeo.com/video/${vimeo[1]}?dnt=1" title="${e(b.heading || 'Video')}" loading="lazy" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe></div>`;
  }
  if (/^https?:\/\/.+\.(mp4|webm)(\?|$)/i.test(url)) {
    return `<video class="video" controls playsinline preload="${perf.videoPreload}" src="${e(url)}"></video>`;
  }
  return ctx.opts.mode === 'preview'
    ? `<div class="placeholder">Upload a video in Media or paste a YouTube / Vimeo link</div>`
    : '';
}

// ---------------------------------------------------------------- links

function pageHref(ctx: Ctx, pageId: string): string {
  const p = ctx.site.pages.find((x) => x.id === pageId);
  if (!p) return '#';
  if (ctx.opts.mode === 'preview') return `#__page:${p.id}`;
  return ctx.root + pagePath(p) || './';
}

/** Resolve user-entered links: "/about" → relative page link, "#x", http(s), mailto, tel */
function link(ctx: Ctx, href?: string): string {
  const h = (href ?? '').trim();
  if (!h) return '#';
  if (/^(https?:|mailto:|tel:|#)/i.test(h)) return e(h);
  if (h.startsWith('/')) {
    const [path, hash] = h.slice(1).split('#');
    const p = ctx.site.pages.find((x) => x.slug === path.replace(/\/$/, ''));
    if (p) return pageHref(ctx, p.id) + (hash ? `#${e(hash)}` : '');
    return e(ctx.root + h.slice(1));
  }
  return '#';
}

const btnLink = (ctx: Ctx, label: string | undefined, href: string | undefined, cls = 'btn') =>
  label ? `<a class="${cls}" href="${link(ctx, href)}"${/^https?:/i.test(href ?? '') ? ' target="_blank" rel="noopener"' : ''}>${e(label)}</a>` : '';

// ---------------------------------------------------------------- blocks

const rich = (html?: string) => (html ? `<div class="rich">${sanitizeHtml(html)}</div>` : '');

function head(b: Block, level: 'h1' | 'h2') {
  return `${b.eyebrow ? `<p class="eyebrow">${e(b.eyebrow)}</p>` : ''}${b.heading ? `<${level} class="title">${e(b.heading)}</${level}>` : ''}`;
}

const intro = (b: Block, level: 'h1' | 'h2' = 'h2') =>
  b.heading || b.body || b.eyebrow ? `<header class="intro">${head(b, level)}${rich(b.body)}</header>` : '';

const items = (b: Block) => b.items ?? [];

function renderBlock(ctx: Ctx, b: Block, isFirst: boolean): string {
  const cols = `cols-${b.columns ?? 3}`;
  // The first section carries the page's single <h1>.
  const level = isFirst ? 'h1' : 'h2';
  switch (b.type) {
    case 'hero': {
      const media = b.mediaId ? img(ctx, b.mediaId, { sizes: b.layout === 'split' ? '(min-width: 900px) 50vw, 100vw' : '100vw', cls: 'hero-img', eager: isFirst }) : '';
      const actions = `<div class="actions">${btnLink(ctx, b.ctaLabel, b.ctaLink)}${btnLink(ctx, b.secondaryLabel, b.secondaryLink, 'btn btn-ghost')}</div>`;
      const copy = `<div class="hero-copy">${head(b, level)}${rich(b.body)}${actions}</div>`;
      if (b.layout === 'cover') {
        return `<div class="hero hero-cover">${media ? `<div class="hero-bg">${media}</div>` : ''}<div class="wrap">${copy}</div></div>`;
      }
      return `<div class="wrap hero hero-${b.layout ?? 'split'}">${copy}${media ? `<div class="hero-media">${media}</div>` : ''}</div>`;
    }
    case 'features':
      return `<div class="wrap">${intro(b, level)}<div class="grid ${cols}">${items(b)
        .map(
          (it) =>
            `<article class="card feature">${it.mediaId ? img(ctx, it.mediaId, { sizes: '(min-width: 900px) 33vw, 100vw', cls: 'card-img' }) : it.icon ? `<div class="icon" aria-hidden="true">${e(it.icon)}</div>` : ''}<h3>${e(it.title)}</h3>${it.text ? `<p>${e(it.text)}</p>` : ''}</article>`,
        )
        .join('')}</div></div>`;
    case 'richtext':
      return `<div class="wrap narrow">${head(b, level)}${rich(b.body)}</div>`;
    case 'image': {
      const m = img(ctx, b.mediaId, { sizes: `(min-width: ${ctx.site.theme.maxWidth}px) ${ctx.site.theme.maxWidth}px, 100vw`, cls: 'full-img' });
      if (!m) return ctx.opts.mode === 'preview' ? `<div class="wrap"><div class="placeholder">Choose an image for this section</div></div>` : '';
      return `<div class="wrap"><figure>${m}${b.heading ? `<figcaption>${e(b.heading)}</figcaption>` : ''}</figure></div>`;
    }
    case 'video':
      return `<div class="wrap">${intro(b, level)}${videoEmbed(ctx, b)}</div>`;
    case 'gallery': {
      const list = items(b).filter((it) => it.mediaId);
      const body = list.length
        ? `<div class="gallery ${cols}">${list
            .map((it) => `<figure>${img(ctx, it.mediaId, { sizes: '(min-width: 900px) 33vw, 50vw', alt: it.title })}${it.title ? `<figcaption>${e(it.title)}</figcaption>` : ''}</figure>`)
            .join('')}</div>`
        : ctx.opts.mode === 'preview'
          ? '<div class="placeholder">Add images to this gallery from the Media library</div>'
          : '';
      return `<div class="wrap">${intro(b, level)}${body}</div>`;
    }
    case 'cta':
      return `<div class="wrap cta">${head(b, level)}${rich(b.body)}<div class="actions">${btnLink(ctx, b.ctaLabel, b.ctaLink)}${btnLink(ctx, b.secondaryLabel, b.secondaryLink, 'btn btn-ghost')}</div></div>`;
    case 'testimonials':
      return `<div class="wrap">${intro(b, level)}<div class="grid ${cols}">${items(b)
        .map(
          (it) =>
            `<figure class="card quote"><blockquote>${e(it.text)}</blockquote><figcaption>${it.mediaId ? img(ctx, it.mediaId, { sizes: '48px', cls: 'avatar', alt: it.title }) : ''}<span><strong>${e(it.title)}</strong>${it.icon ? `<br><small>${e(it.icon)}</small>` : ''}</span></figcaption></figure>`,
        )
        .join('')}</div></div>`;
    case 'pricing':
      return `<div class="wrap">${intro(b, level)}<div class="grid ${cols}">${items(b)
        .map(
          (it) =>
            `<article class="card plan${it.highlight ? ' plan-hi' : ''}">${it.highlight ? '<span class="badge">Most popular</span>' : ''}<h3>${e(it.title)}</h3><p class="price">${e(it.price)}</p>${it.text ? `<p class="muted">${e(it.text)}</p>` : ''}<ul>${(it.features ?? '')
              .split('\n')
              .filter(Boolean)
              .map((f) => `<li>${e(f)}</li>`)
              .join('')}</ul>${btnLink(ctx, 'Choose ' + (it.title ?? ''), it.link, it.highlight ? 'btn' : 'btn btn-ghost')}</article>`,
        )
        .join('')}</div></div>`;
    case 'faq':
      return `<div class="wrap narrow">${intro(b, level)}<div class="faq">${items(b)
        .map((it) => `<details><summary>${e(it.title)}</summary><p>${e(it.text)}</p></details>`)
        .join('')}</div></div>`;
    case 'stats':
      return `<div class="wrap">${intro(b, level)}<dl class="grid ${cols} stats">${items(b)
        .map((it) => `<div><dt>${e(it.text)}</dt><dd>${e(it.title)}</dd></div>`)
        .join('')}</dl></div>`;
    case 'logos':
      return `<div class="wrap">${b.heading ? `<p class="eyebrow center">${e(b.heading)}</p>` : ''}<ul class="logos">${items(b)
        .map((it) => {
          const inner = it.mediaId ? img(ctx, it.mediaId, { sizes: '160px', alt: it.title }) : `<span>${e(it.title)}</span>`;
          return `<li>${it.link ? `<a href="${link(ctx, it.link)}">${inner}</a>` : inner}</li>`;
        })
        .join('')}</ul></div>`;
    case 'team':
      return `<div class="wrap">${intro(b, level)}<div class="grid ${cols}">${items(b)
        .map(
          (it) =>
            `<article class="member">${it.mediaId ? img(ctx, it.mediaId, { sizes: '240px', cls: 'portrait', alt: it.title }) : `<div class="portrait initials" aria-hidden="true">${e((it.title ?? '?').split(' ').map((w) => w[0]).join('').slice(0, 2))}</div>`}<h3>${e(it.title)}</h3><p class="muted">${e(it.text)}</p></article>`,
        )
        .join('')}</div></div>`;
    case 'contact': {
      const action = formAction(ctx);
      return `<div class="wrap contact contact-${b.layout ?? 'split'}"><div>${head(b, level)}${rich(b.body)}${contactDetails(ctx)}</div><form class="form" method="post" action="${e(action)}" data-form><input type="hidden" name="_page" value="${e(ctx.page.name)}"><div class="hp" aria-hidden="true"><label>Leave empty<input name="_gotcha" tabindex="-1" autocomplete="off"></label></div><label>Name<input name="name" autocomplete="name" required></label><label>Email<input type="email" name="email" autocomplete="email" required></label><label>Phone <small>(optional)</small><input type="tel" name="phone" autocomplete="tel"></label><label>Message<textarea name="message" rows="5" required></textarea></label><button class="btn" type="submit">${e(b.ctaLabel || 'Send')}</button><p class="form-status" role="status" aria-live="polite"></p></form></div>`;
    }
  }
}

function formAction(ctx: Ctx): string {
  const { integrations: i, hosting: h } = ctx.site;
  if (i.formEndpoint === 'custom' && i.customFormAction) return i.customFormAction;
  return `${h.serverUrl.replace(/\/$/, '')}/api/forms/${encodeURIComponent(h.slug)}`;
}

function contactDetails(ctx: Ctx) {
  const s = ctx.site.seo;
  const rows = [
    s.businessPhone && `<li><a href="tel:${e(s.businessPhone.replace(/\s/g, ''))}">${e(s.businessPhone)}</a></li>`,
    s.businessAddress && `<li>${e(s.businessAddress)}</li>`,
  ].filter(Boolean);
  return rows.length ? `<ul class="details">${rows.join('')}</ul>` : '';
}

// ---------------------------------------------------------------- chrome

function menuHtml(ctx: Ctx, list: MenuItem[], depth = 0): string {
  return list
    .map((mi) => {
      const href = mi.pageId ? pageHref(ctx, mi.pageId) : link(ctx, mi.url);
      const current = mi.pageId === ctx.page.id ? ' aria-current="page"' : '';
      if (mi.children?.length && depth === 0) {
        return `<li class="has-sub"><a href="${href}"${current}>${e(mi.label)}</a><ul class="sub">${menuHtml(ctx, mi.children, 1)}</ul></li>`;
      }
      return `<li><a href="${href}"${current}>${e(mi.label)}</a></li>`;
    })
    .join('');
}

function header(ctx: Ctx): string {
  const { settings: s } = ctx.site;
  const logo = s.logoId ? img(ctx, s.logoId, { sizes: '160px', cls: 'logo-img', alt: s.logoText, eager: true }) : '';
  const homeHref = ctx.opts.mode === 'preview' ? `#__page:${ctx.site.pages[0]?.id}` : ctx.root || './';
  ctx.firstImage = true;
  return `${s.announcement ? `<div class="announce">${e(s.announcement)}</div>` : ''}<header class="site-header"><div class="wrap nav"><a class="brand" href="${homeHref}">${logo}${s.logoText ? `<span>${e(s.logoText)}</span>` : ''}</a><button class="menu-toggle" type="button" aria-expanded="false" aria-controls="site-menu"><span class="sr">Menu</span><span class="bars" aria-hidden="true"></span></button><nav id="site-menu" aria-label="Main"><ul>${menuHtml(ctx, ctx.site.menus.main)}</ul></nav></div></header>`;
}

const SOCIAL_LABEL: Record<string, string> = { facebook: 'Facebook', instagram: 'Instagram', x: 'X', linkedin: 'LinkedIn', youtube: 'YouTube', tiktok: 'TikTok', github: 'GitHub' };

function footer(ctx: Ctx): string {
  const { settings: s, menus } = ctx.site;
  const socials = s.socials.filter((x) => x.url);
  return `<footer class="site-footer"><div class="wrap foot">${menus.footer.length ? `<nav aria-label="Footer"><ul>${menuHtml(ctx, menus.footer)}</ul></nav>` : ''}${socials.length ? `<ul class="socials">${socials.map((x) => `<li><a href="${e(x.url)}" target="_blank" rel="noopener">${e(SOCIAL_LABEL[x.network] ?? x.network)}</a></li>`).join('')}</ul>` : ''}<p>${e(s.footerText)}</p></div></footer>`;
}

// ---------------------------------------------------------------- CSS

export function siteCss(site: Site): string {
  const t = site.theme;
  const onPrimary = readableOn(t.primary);
  const onDark = readableOn(t.dark);
  const r = `${t.radius}px`;
  const btnRadius = t.buttonStyle === 'pill' ? '999px' : r;
  return `
:root{--primary:${t.primary};--primary-ink:${onPrimary};--primary-soft:${mix(t.primary, t.background, 0.88)};--accent:${t.accent};--bg:${t.background};--surface:${t.surface};--text:${t.text};--muted:${t.muted};--dark:${t.dark};--on-dark:${onDark};--radius:${r};--max:${t.maxWidth}px;--hf:${fontStack(t.headingFont)};--bf:${fontStack(t.bodyFont)};--hw:${t.headingWeight}}
*,*::before,*::after{box-sizing:border-box}
html{-webkit-text-size-adjust:100%;scroll-behavior:smooth}
body{margin:0;background:var(--bg);color:var(--text);font:400 ${t.baseSize}px/1.65 var(--bf);text-rendering:optimizeLegibility;-webkit-font-smoothing:antialiased}
img,video,iframe{max-width:100%;display:block}
img{height:auto}
a{color:var(--primary);text-underline-offset:3px}
h1,h2,h3,h4{font-family:var(--hf);font-weight:var(--hw);line-height:1.15;margin:0 0 .5em;letter-spacing:-.015em;text-wrap:balance}
h1{font-size:clamp(2.2rem,5vw + 1rem,4.2rem)}
h2{font-size:clamp(1.7rem,2.5vw + 1rem,2.8rem)}
h3{font-size:1.2rem}
p{margin:0 0 1em}
:focus-visible{outline:3px solid var(--accent);outline-offset:3px}
.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.skip{position:absolute;left:-999px;top:0;background:var(--primary);color:var(--primary-ink);padding:.6em 1em;z-index:99}
.skip:focus{left:1rem}
.wrap{width:min(100% - 2.5rem,var(--max));margin-inline:auto}
.narrow{max-width:760px}
.muted{color:var(--muted)}
.center{text-align:center}
.sec{padding-block:clamp(3rem,7vw,6rem)}
.sp-sm{padding-block:clamp(1.75rem,4vw,3rem)}
.sp-lg{padding-block:clamp(4.5rem,10vw,9rem)}
.tone-alt{background:var(--surface)}
.tone-primary{background:var(--primary);color:var(--primary-ink)}
.tone-dark{background:var(--dark);color:var(--on-dark)}
.tone-primary a:not(.btn),.tone-dark a:not(.btn){color:inherit}
.tone-primary .muted,.tone-dark .muted{color:inherit;opacity:.8}
.al-center{text-align:center}
.al-center .intro,.al-center .narrow{margin-inline:auto}
.al-center .actions{justify-content:center}
.intro{max-width:720px;margin-bottom:clamp(1.75rem,4vw,3rem)}
.eyebrow{font-size:.8rem;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--primary);margin-bottom:.75rem}
.tone-primary .eyebrow,.tone-dark .eyebrow{color:var(--accent)}
.rich{font-size:1.06em}
.rich>:last-child{margin-bottom:0}
.rich blockquote{border-left:4px solid var(--primary);margin:1.5em 0;padding:.25em 0 .25em 1.25em;font-style:italic}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:.5em;min-height:48px;padding:.75em 1.5em;border-radius:${btnRadius};font-weight:600;text-decoration:none;border:2px solid var(--primary);${t.buttonStyle === 'outline' ? 'background:transparent;color:var(--primary)' : 'background:var(--primary);color:var(--primary-ink)'};transition:transform .15s ease,box-shadow .15s ease,background .15s}
.btn:hover{transform:translateY(-1px);box-shadow:0 8px 24px -10px var(--primary)}
.btn-ghost{background:transparent;color:inherit;border-color:currentColor;opacity:.9}
.tone-primary .btn:not(.btn-ghost){background:var(--primary-ink);color:var(--primary);border-color:var(--primary-ink)}
.actions{display:flex;flex-wrap:wrap;gap:.75rem;margin-top:1.75rem}
.announce{background:var(--dark);color:var(--on-dark);text-align:center;font-size:.875rem;padding:.55rem 1rem}
.site-header{position:sticky;top:0;z-index:50;background:color-mix(in srgb,var(--bg) 88%,transparent);backdrop-filter:saturate(1.6) blur(12px);border-bottom:1px solid color-mix(in srgb,var(--text) 8%,transparent)}
.nav{display:flex;align-items:center;justify-content:space-between;min-height:68px;gap:1rem}
.brand{display:flex;align-items:center;gap:.6rem;font:var(--hw) 1.2rem var(--hf);color:var(--text);text-decoration:none}
.logo-img{height:36px;width:auto}
.nav ul{list-style:none;margin:0;padding:0}
#site-menu>ul{display:flex;gap:.25rem;align-items:center}
#site-menu a{display:block;padding:.6rem .85rem;border-radius:8px;color:var(--text);text-decoration:none;font-weight:500}
#site-menu a:hover,#site-menu a[aria-current]{background:var(--primary-soft);color:var(--primary)}
.has-sub{position:relative}
.sub{position:absolute;top:100%;left:0;min-width:200px;background:var(--bg);border:1px solid color-mix(in srgb,var(--text) 10%,transparent);border-radius:var(--radius);padding:.4rem;box-shadow:0 20px 40px -20px rgba(0,0,0,.25);opacity:0;visibility:hidden;transform:translateY(6px);transition:.15s}
.has-sub:hover .sub,.has-sub:focus-within .sub{opacity:1;visibility:visible;transform:none}
.menu-toggle{display:none;width:48px;height:48px;border:0;background:none;cursor:pointer;color:var(--text)}
.bars,.bars::before,.bars::after{display:block;width:22px;height:2px;background:currentColor;margin:auto;position:relative;transition:.2s}
.bars::before,.bars::after{content:"";position:absolute;left:0}
.bars::before{top:-7px}.bars::after{top:7px}
.menu-toggle[aria-expanded=true] .bars{background:transparent}
.menu-toggle[aria-expanded=true] .bars::before{top:0;transform:rotate(45deg)}
.menu-toggle[aria-expanded=true] .bars::after{top:0;transform:rotate(-45deg)}
@media (max-width:860px){
.menu-toggle{display:block}
#site-menu{position:absolute;left:0;right:0;top:100%;background:var(--bg);border-bottom:1px solid color-mix(in srgb,var(--text) 10%,transparent);display:none;max-height:calc(100vh - 68px);overflow:auto}
#site-menu.open{display:block}
#site-menu>ul{flex-direction:column;align-items:stretch;padding:.75rem 1.25rem 1.25rem}
#site-menu a{padding:.9rem .75rem;font-size:1.05rem}
.sub{position:static;opacity:1;visibility:visible;transform:none;box-shadow:none;border:0;padding:0 0 0 1rem}
}
.hero{display:grid;gap:clamp(2rem,5vw,4rem);align-items:center}
.hero-split{grid-template-columns:1.05fr 1fr}
.hero-stacked{max-width:900px}
.al-center .hero-stacked{margin-inline:auto}
.hero .rich{font-size:clamp(1.05rem,.6vw + 1rem,1.3rem);opacity:.92;max-width:620px}
.al-center .hero .rich{margin-inline:auto}
.hero-media img{border-radius:var(--radius);width:100%;object-fit:cover;aspect-ratio:4/3;box-shadow:0 30px 60px -30px rgba(0,0,0,.35)}
.hero-cover{position:relative;min-height:min(82vh,760px);display:grid;align-items:center;color:#fff;background:var(--dark);overflow:hidden;isolation:isolate}
.sec:has(.hero-cover){padding:0}
.hero-cover .wrap{padding-block:6rem}
.hero-bg{position:absolute;inset:0;z-index:-1}
.hero-bg img{width:100%;height:100%;object-fit:cover}
.hero-bg::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.25),rgba(0,0,0,.65))}
.hero-cover .hero-copy{max-width:760px}
.al-center .hero-cover .hero-copy{margin-inline:auto}
@media (max-width:860px){.hero-split{grid-template-columns:1fr}}
.grid{display:grid;gap:clamp(1rem,2.5vw,1.75rem);grid-template-columns:repeat(var(--cols,3),minmax(0,1fr))}
.cols-2{--cols:2}.cols-3{--cols:3}.cols-4{--cols:4}
@media (max-width:1024px){.cols-4{--cols:2}.cols-3{--cols:2}}
@media (max-width:640px){.grid{--cols:1!important}.stats{--cols:2!important}}
.card{background:var(--bg);border:1px solid color-mix(in srgb,var(--text) 9%,transparent);border-radius:var(--radius);padding:clamp(1.25rem,2.5vw,2rem);text-align:left;color:var(--text);transition:transform .2s,box-shadow .2s}
.card:hover{transform:translateY(-3px);box-shadow:0 24px 48px -28px rgba(0,0,0,.3)}
.tone-alt .card{background:var(--bg)}
.card p:last-child{margin:0}
.icon{width:48px;height:48px;display:grid;place-items:center;border-radius:12px;background:var(--primary-soft);font-size:1.4rem;margin-bottom:1rem}
.card-img{border-radius:calc(var(--radius) - 4px);margin-bottom:1rem;aspect-ratio:16/10;object-fit:cover;width:100%}
.quote blockquote{margin:0 0 1.25rem;font-size:1.08rem}
.quote figcaption{display:flex;gap:.75rem;align-items:center;color:var(--muted)}
.quote strong{color:var(--text)}
.avatar{width:48px;height:48px;border-radius:50%;object-fit:cover}
.plan{display:flex;flex-direction:column;position:relative}
.plan ul{list-style:none;padding:0;margin:1rem 0 1.5rem;flex:1}
.plan li{padding:.4rem 0 .4rem 1.6rem;position:relative}
.plan li::before{content:"✓";position:absolute;left:0;color:var(--primary);font-weight:700}
.plan .btn{width:100%}
.price{font:var(--hw) 2.2rem var(--hf);margin:.25rem 0}
.plan-hi{border:2px solid var(--primary);box-shadow:0 30px 60px -35px var(--primary)}
.badge{position:absolute;top:-.8rem;right:1.25rem;background:var(--accent);color:${readableOn(t.accent)};font-size:.75rem;font-weight:700;padding:.3rem .7rem;border-radius:999px}
.faq{display:grid;gap:.75rem;text-align:left}
.faq details{border:1px solid color-mix(in srgb,currentColor 14%,transparent);border-radius:var(--radius);padding:1rem 1.25rem}
.faq summary{cursor:pointer;font-weight:600;list-style:none;display:flex;justify-content:space-between;gap:1rem}
.faq summary::after{content:"+";font-size:1.3em;line-height:1;transition:transform .2s}
.faq details[open] summary::after{transform:rotate(45deg)}
.faq details p{margin:.75rem 0 0;color:var(--muted)}
.stats{margin:0}
.stats div{padding:.5rem}
.stats dd{margin:0;font:var(--hw) clamp(2rem,4vw,3.2rem) var(--hf);line-height:1.1;order:-1}
.stats div{display:flex;flex-direction:column}
.stats dt{opacity:.8}
.logos{list-style:none;padding:0;margin:0;display:flex;flex-wrap:wrap;justify-content:center;align-items:center;gap:1.5rem clamp(2rem,5vw,4rem)}
.logos span{font:700 1.3rem var(--hf);opacity:.55}
.logos img{height:36px;width:auto;opacity:.7;filter:grayscale(1)}
.member{text-align:center}
.portrait{width:160px;height:160px;border-radius:50%;object-fit:cover;margin:0 auto 1rem}
.initials{display:grid;place-items:center;background:var(--primary-soft);color:var(--primary);font:700 2.4rem var(--hf)}
.gallery{display:grid;gap:1rem;grid-template-columns:repeat(var(--cols,3),minmax(0,1fr))}
.gallery figure{margin:0}
.gallery img{width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:var(--radius)}
@media (max-width:640px){.gallery{--cols:2!important;gap:.6rem}}
figure{margin:0}
figcaption{font-size:.9rem;color:var(--muted);margin-top:.6rem}
.full-img{border-radius:var(--radius);width:100%}
.cta{text-align:inherit}
.al-center .cta .rich{max-width:620px;margin-inline:auto}
.video,.embed iframe,.yt{width:100%;aspect-ratio:16/9;border-radius:var(--radius);background:#000;border:0}
.embed iframe{height:auto}
.yt{position:relative;padding:0;cursor:pointer;overflow:hidden}
.yt img{width:100%;height:100%;object-fit:cover;opacity:.85}
.yt-play{position:absolute;inset:0;margin:auto;width:76px;height:54px;border-radius:14px;background:#f00;color:#fff;display:grid;place-items:center;font-size:1.4rem}
.contact{display:grid;gap:clamp(2rem,5vw,4rem)}
.contact-split{grid-template-columns:1fr 1.1fr}
@media (max-width:860px){.contact-split{grid-template-columns:1fr}}
.details{list-style:none;padding:0;margin:1.5rem 0 0;display:grid;gap:.5rem}
.form{display:grid;gap:1rem;background:var(--bg);color:var(--text);padding:clamp(1.25rem,3vw,2rem);border-radius:var(--radius);border:1px solid color-mix(in srgb,var(--text) 10%,transparent);text-align:left}
.form label{display:grid;gap:.35rem;font-weight:600;font-size:.92rem}
.form input,.form textarea{font:inherit;font-weight:400;padding:.8rem .9rem;border-radius:calc(var(--radius) / 1.5);border:1px solid color-mix(in srgb,var(--text) 20%,transparent);background:var(--bg);color:var(--text);min-height:48px}
.form input:focus,.form textarea:focus{outline:2px solid var(--primary);outline-offset:1px;border-color:var(--primary)}
.hp{position:absolute;left:-9999px}
.form-status:empty{display:none}
.placeholder{border:2px dashed color-mix(in srgb,currentColor 25%,transparent);border-radius:var(--radius);padding:3rem 1.5rem;text-align:center;opacity:.7}
.site-footer{background:var(--surface);padding:3rem 0 2rem;font-size:.95rem;color:var(--muted)}
.foot{display:grid;gap:1.25rem;justify-items:start}
.foot ul{list-style:none;margin:0;padding:0;display:flex;flex-wrap:wrap;gap:.5rem 1.25rem}
.foot a{color:var(--text);text-decoration:none}
.foot a:hover{color:var(--primary)}
.foot p{margin:0}
.wa{position:fixed;right:1.25rem;bottom:1.25rem;width:56px;height:56px;border-radius:50%;background:#25d366;color:#fff;display:grid;place-items:center;box-shadow:0 10px 30px -8px rgba(0,0,0,.4);z-index:60;text-decoration:none;font-size:1.6rem}
.cookie{position:fixed;left:1rem;right:1rem;bottom:1rem;max-width:560px;margin-inline:auto;background:var(--dark);color:var(--on-dark);padding:1rem 1.25rem;border-radius:var(--radius);display:flex;gap:1rem;align-items:center;flex-wrap:wrap;z-index:70;box-shadow:0 20px 50px -20px rgba(0,0,0,.5)}
.cookie p{margin:0;flex:1 1 240px;font-size:.92rem}
.cookie button{min-height:40px;padding:.5em 1.1em}
.notfound{min-height:60vh;display:grid;place-items:center;text-align:center}
@media (prefers-reduced-motion:reduce){*,*::before,*::after{animation:none!important;transition:none!important;scroll-behavior:auto!important}}
`;
}

export function minifyCss(css: string) {
  return css
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s*([{}:;,>])\s*/g, '$1')
    .replace(/;}/g, '}')
    .trim();
}

/** Collapse whitespace between tags, leaving <script>, <pre> and <textarea> contents untouched. */
export function minifyHtml(html: string) {
  return html
    .split(/(<(script|pre|textarea)\b[\s\S]*?<\/\2>)/i)
    .map((chunk, i) => {
      if (i % 3 === 1) return chunk;
      if (i % 3 === 2) return '';
      return chunk.replace(/\n\s*/g, '').replace(/>\s{2,}</g, '> <');
    })
    .join('')
    .trim();
}

// ---------------------------------------------------------------- scripts

const SITE_JS = `(function(){var t=document.querySelector('.menu-toggle'),m=document.getElementById('site-menu');if(t&&m){t.addEventListener('click',function(){var o=m.classList.toggle('open');t.setAttribute('aria-expanded',o)});m.addEventListener('click',function(e){if(e.target.tagName==='A'){m.classList.remove('open');t.setAttribute('aria-expanded','false')}})}
document.querySelectorAll('[data-yt]').forEach(function(b){b.addEventListener('click',function(){var f=document.createElement('iframe');f.src='https://www.youtube-nocookie.com/embed/'+b.dataset.yt+'?autoplay=1';f.title=b.getAttribute('aria-label');f.allow='autoplay; encrypted-media; picture-in-picture';f.allowFullscreen=true;f.className='video';b.replaceWith(f)})});
document.querySelectorAll('form[data-form]').forEach(function(f){f.addEventListener('submit',function(e){if(!window.fetch)return;e.preventDefault();var s=f.querySelector('.form-status'),btn=f.querySelector('button');btn.disabled=true;s.textContent='Sending…';fetch(f.action,{method:'POST',body:new FormData(f),headers:{Accept:'application/json'}}).then(function(r){if(!r.ok)throw 0;f.reset();s.textContent='Thanks! Your message has been sent.'}).catch(function(){s.textContent='Sorry, something went wrong. Please try again or email us directly.'}).finally(function(){btn.disabled=false})})});})();`;

function analytics(site: Site): { head: string; consent: string } {
  const i = site.integrations;
  const parts: string[] = [];
  if (i.ga4Id) {
    const id = e(i.ga4Id);
    parts.push(`var g=document.createElement('script');g.async=1;g.src='https://www.googletagmanager.com/gtag/js?id=${id}';document.head.appendChild(g);window.dataLayer=window.dataLayer||[];window.gtag=function(){dataLayer.push(arguments)};gtag('js',new Date());gtag('config','${id}');`);
  }
  if (i.metaPixelId) {
    const id = e(i.metaPixelId);
    parts.push(`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${id}');fbq('track','PageView');`);
  }
  // Plausible is cookieless, so it never needs consent.
  const plausible = i.plausibleDomain
    ? `<script defer data-domain="${e(i.plausibleDomain)}" src="https://plausible.io/js/script.js"></script>`
    : '';
  if (!parts.length) return { head: plausible, consent: '' };
  const load = `function __loadAnalytics(){${parts.join('')}}`;
  if (!i.cookieBanner) return { head: `${plausible}<script>${load}__loadAnalytics();</script>`, consent: '' };
  return {
    head: `${plausible}<script>${load}try{if(localStorage.getItem('consent')==='yes')__loadAnalytics()}catch(e){}</script>`,
    consent: 'yes',
  };
}

function cookieBanner(site: Site) {
  if (!site.integrations.cookieBanner) return '';
  return `<div class="cookie" id="cookie" hidden role="dialog" aria-label="Cookie consent"><p>${e(site.integrations.cookieText)}</p><button class="btn" data-c="yes">Accept</button><button class="btn btn-ghost" data-c="no">Decline</button></div><script>(function(){var c=document.getElementById('cookie'),v;try{v=localStorage.getItem('consent')}catch(e){}if(!v)c.hidden=false;c.addEventListener('click',function(e){var a=e.target.getAttribute('data-c');if(!a)return;try{localStorage.setItem('consent',a)}catch(e){}c.hidden=true;if(a==='yes'&&window.__loadAnalytics)__loadAnalytics()})})();</script>`;
}

// ---------------------------------------------------------------- SEO

/** Home uses its own title (or the site name); other pages go through the title template. */
export function pageTitle(site: Site, page: Page) {
  if (!page.slug) return page.seo.title || site.seo.siteName || page.name;
  const base = page.seo.title || page.name;
  return site.seo.titleTemplate.includes('%s') ? site.seo.titleTemplate.replace('%s', base) : base;
}

function jsonLd(ctx: Ctx, canonical: string | undefined): string {
  const { site, page } = ctx;
  const s = site.seo;
  const origin = ctx.opts.baseUrl;
  const graph: Record<string, unknown>[] = [];
  const logo = site.settings.logoId && origin ? `${origin}/${assetPath(site.media.find((m) => m.id === site.settings.logoId)!)}` : undefined;
  const org: Record<string, unknown> = { '@type': s.schemaType === 'WebSite' ? 'Organization' : s.schemaType, name: s.siteName };
  if (origin) org.url = origin + '/';
  if (logo) org.logo = logo;
  if (s.businessPhone) org.telephone = s.businessPhone;
  if (s.businessAddress) org.address = s.businessAddress;
  const sameAs = site.settings.socials.map((x) => x.url).filter(Boolean);
  if (sameAs.length) org.sameAs = sameAs;
  graph.push(org);
  if (!page.slug) graph.push({ '@type': 'WebSite', name: s.siteName, ...(origin ? { url: origin + '/' } : {}), inLanguage: s.language });
  const faqs = page.blocks.filter((b) => b.type === 'faq' && !b.hidden).flatMap((b) => b.items ?? []);
  if (faqs.length) {
    graph.push({
      '@type': 'FAQPage',
      mainEntity: faqs.map((q) => ({ '@type': 'Question', name: q.title, acceptedAnswer: { '@type': 'Answer', text: q.text } })),
    });
  }
  if (page.slug && origin && canonical) {
    graph.push({
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: origin + '/' },
        { '@type': 'ListItem', position: 2, name: page.name, item: canonical },
      ],
    });
  }
  return `<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }).replace(/</g, '\\u003c')}</script>`;
}

export function pageDescription(site: Site, page: Page): string {
  if (page.seo.description) return page.seo.description;
  if (site.seo.defaultDescription) return site.seo.defaultDescription;
  const text = page.blocks.map((b) => stripTags(b.body ?? '')).join(' ').trim();
  return text.slice(0, 155);
}

function headTags(ctx: Ctx): string {
  const { site, page, opts } = ctx;
  const t = site.theme;
  const title = pageTitle(site, page);
  const desc = pageDescription(site, page);
  const canonical = page.seo.canonical || (opts.baseUrl ? `${opts.baseUrl}/${pagePath(page)}` : undefined);
  const noindex = page.seo.noindex || !site.seo.allowIndexing || site.settings.maintenanceMode;
  const ogId = page.seo.ogImageId || site.seo.defaultOgImageId;
  const ogMedia = ogId ? site.media.find((m) => m.id === ogId) : undefined;
  const ogImage = ogMedia ? (opts.mode === 'preview' ? undefined : opts.baseUrl ? `${opts.baseUrl}/${assetPath(ogMedia)}` : undefined) : undefined;
  const fav = site.settings.favicon ? site.media.find((m) => m.id === site.settings.favicon) : undefined;
  const fonts = [...new Set([t.headingFont, t.bodyFont])].filter((f) => f !== 'system-ui');
  const fontUrl = fonts.length
    ? `https://fonts.googleapis.com/css2?${fonts.map((f) => `family=${encodeURIComponent(f).replace(/%20/g, '+')}:wght@400;500;600;700;800`).join('&')}${site.performance.fontDisplaySwap ? '&display=swap' : ''}`
    : '';
  const tags = [
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${e(title)}</title>`,
    desc && `<meta name="description" content="${e(desc)}">`,
    canonical && `<link rel="canonical" href="${e(canonical)}">`,
    noindex && '<meta name="robots" content="noindex, nofollow">',
    `<meta name="theme-color" content="${e(t.primary)}">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:site_name" content="${e(site.seo.siteName)}">`,
    `<meta property="og:title" content="${e(title)}">`,
    desc && `<meta property="og:description" content="${e(desc)}">`,
    canonical && `<meta property="og:url" content="${e(canonical)}">`,
    ogImage && `<meta property="og:image" content="${e(ogImage)}">`,
    `<meta name="twitter:card" content="${ogImage ? 'summary_large_image' : 'summary'}">`,
    site.seo.twitterHandle && `<meta name="twitter:site" content="@${e(site.seo.twitterHandle.replace(/^@/, ''))}">`,
    !page.slug && site.seo.googleVerification && `<meta name="google-site-verification" content="${e(site.seo.googleVerification)}">`,
    !page.slug && site.seo.bingVerification && `<meta name="msvalidate.01" content="${e(site.seo.bingVerification)}">`,
    fav && `<link rel="icon" href="${mediaUrl(ctx, fav.id)}">`,
    fontUrl && site.performance.preconnectFonts && '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>',
    fontUrl && `<link rel="stylesheet" href="${fontUrl}">`,
    opts.mode === 'export' && site.seo.generateSitemap && `<link rel="sitemap" type="application/xml" href="${ctx.root}sitemap.xml">`,
  ];
  return tags.filter(Boolean).join('\n') + '\n' + jsonLd(ctx, canonical);
}

// ---------------------------------------------------------------- documents

const PREVIEW_JS = `(function(){document.addEventListener('click',function(e){var a=e.target.closest('a');if(a){e.preventDefault();var h=a.getAttribute('href')||'';if(h.indexOf('#__page:')===0){parent.postMessage({type:'sb:navigate',pageId:h.slice(8)},'*');return}if(h.charAt(0)==='#'&&h.length>1){var t=document.getElementById(h.slice(1));if(t)t.scrollIntoView({behavior:'smooth'})}}var s=e.target.closest('[data-block]');if(s&&!e.target.closest('form,summary,.menu-toggle,[data-yt]')){parent.postMessage({type:'sb:select',blockId:s.getAttribute('data-block')},'*')}},true);document.addEventListener('submit',function(e){e.preventDefault()},true);window.addEventListener('message',function(e){if(e.data&&e.data.type==='sb:scroll'){var el=document.querySelector('[data-block="'+e.data.blockId+'"]');if(el)el.scrollIntoView({behavior:'smooth',block:'start'})}})})();`;

const PREVIEW_CSS = `[data-block]{position:relative;cursor:pointer}[data-block]:hover{outline:2px dashed color-mix(in srgb,var(--primary) 60%,transparent);outline-offset:-2px}[data-block].sb-sel{outline:3px solid var(--primary);outline-offset:-3px}`;

function documentShell(ctx: Ctx, bodyInner: string, extraHead = ''): string {
  const { site, opts } = ctx;
  const css = site.performance.minify ? minifyCss(siteCss(site)) : siteCss(site);
  const cssTag =
    opts.mode === 'preview' || site.performance.inlineCss
      ? `<style>${css}${opts.mode === 'preview' ? PREVIEW_CSS : ''}</style>`
      : `<link rel="stylesheet" href="${ctx.root}assets/site.css">`;
  const an = opts.mode === 'export' ? analytics(site) : { head: '', consent: '' };
  const i = site.integrations;
  const wa = i.whatsappNumber
    ? `<a class="wa" href="https://wa.me/${e(i.whatsappNumber.replace(/[^\d]/g, ''))}" target="_blank" rel="noopener" aria-label="Chat on WhatsApp">✆</a>`
    : '';
  const html = `<!doctype html>
<html lang="${e(site.seo.language || 'en')}">
<head>
${headTags(ctx)}
${cssTag}
${an.head}
${opts.mode === 'export' ? i.headCode : ''}
${extraHead}
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
${bodyInner}
${wa}
${opts.mode === 'export' ? cookieBanner(site) : ''}
<script>${SITE_JS}</script>
${opts.mode === 'preview' ? `<script>${PREVIEW_JS}</script>` : i.bodyCode}
</body>
</html>`;
  return site.performance.minify && opts.mode === 'export' ? minifyHtml(html) : html;
}

function ctxFor(site: Site, page: Page, opts: RenderOptions): Ctx {
  return { site, page, opts, root: opts.mode === 'export' && page.slug ? '../'.repeat(page.slug.split('/').length) : './', firstImage: true };
}

export function renderPage(site: Site, page: Page, opts: RenderOptions): string {
  const ctx = ctxFor(site, page, opts);
  if (site.settings.maintenanceMode && opts.mode === 'export') {
    return documentShell(ctx, `<main id="main" class="sec notfound"><div class="wrap narrow"><p class="eyebrow">${e(site.seo.siteName)}</p><h1>We’re launching soon</h1><p class="muted">We’re putting the finishing touches on our new website. Please check back shortly.</p></div></main>`);
  }
  const visible = page.blocks.filter((b) => !b.hidden);
  const sections = visible
    .map((b, i) => {
      const cls = `sec tone-${b.tone} sp-${b.spacing} al-${b.align}${opts.selectedBlockId === b.id ? ' sb-sel' : ''}`;
      const anchor = b.type === 'contact' ? 'contact' : b.type === 'features' ? 'features' : b.type === 'pricing' ? 'pricing' : `s-${b.id.slice(-6)}`;
      const data = opts.mode === 'preview' ? ` data-block="${b.id}"` : '';
      return `<section id="${anchor}" class="${cls}"${data}>${renderBlock(ctx, b, i === 0)}</section>`;
    })
    .join('\n');
  const empty =
    !visible.length && opts.mode === 'preview'
      ? '<section class="sec"><div class="wrap"><div class="placeholder">This page is empty — add a section from the Design panel.</div></div></section>'
      : '';
  return documentShell(ctx, `${header(ctx)}<main id="main">${sections}${empty}</main>${footer(ctx)}`);
}

export function render404(site: Site, opts: RenderOptions): string {
  const page: Page = { id: '__404', name: site.settings.notFoundHeading, slug: '', blocks: [], seo: { title: site.settings.notFoundHeading, description: '', focusKeyword: '', noindex: true } };
  const ctx = ctxFor(site, page, opts);
  // 404 is served from arbitrary paths, so it must use absolute asset paths.
  ctx.root = '/';
  return documentShell(
    ctx,
    `${header(ctx)}<main id="main" class="sec notfound"><div class="wrap narrow"><p class="eyebrow">404</p><h1>${e(site.settings.notFoundHeading)}</h1><p class="muted">${e(site.settings.notFoundBody)}</p><div class="actions" style="justify-content:center"><a class="btn" href="/">Back to home</a></div></div></main>${footer(ctx)}`,
  );
}

// ---------------------------------------------------------------- build

export type SiteFiles = Record<string, string | Uint8Array>;

export function sitemapXml(site: Site, baseUrl: string): string {
  const today = new Date().toISOString().slice(0, 10);
  const urls = site.pages
    .filter((p) => !p.seo.noindex)
    .map((p) => `  <url><loc>${e(`${baseUrl}/${pagePath(p)}`)}</loc><lastmod>${today}</lastmod><priority>${p.slug ? '0.8' : '1.0'}</priority></url>`)
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

export function robotsTxt(site: Site, baseUrl?: string): string {
  if (!site.seo.allowIndexing || site.settings.maintenanceMode) return 'User-agent: *\nDisallow: /\n';
  const disallow = site.pages.filter((p) => p.seo.noindex).map((p) => `Disallow: /${pagePath(p)}`);
  return ['User-agent: *', 'Allow: /', ...disallow, '', baseUrl && site.seo.generateSitemap ? `Sitemap: ${baseUrl}/sitemap.xml` : '']
    .filter((l, i, a) => l || i < a.length - 1)
    .join('\n');
}

export function headersFile(site: Site): string {
  const lines = ['/*', '  X-Content-Type-Options: nosniff', '  Referrer-Policy: strict-origin-when-cross-origin'];
  if (site.hosting.securityHeaders) {
    lines.push('  X-Frame-Options: SAMEORIGIN', '  Permissions-Policy: camera=(), microphone=(), geolocation=()');
    if (site.hosting.httpsRedirect) lines.push('  Strict-Transport-Security: max-age=31536000; includeSubDomains');
  }
  lines.push('/assets/*', `  Cache-Control: public, max-age=${site.hosting.cacheAssetsDays * 86400}, immutable`);
  return lines.join('\n') + '\n';
}

export function redirectsFile(site: Site): string {
  return site.redirects
    .filter((r) => r.from && r.to)
    .map((r) => `${r.from} ${r.to} ${r.code}`)
    .join('\n');
}

/** Produce every file needed to host the site on any static host. */
export function buildSite(site: Site, baseUrl = primaryDomain(site)): SiteFiles {
  const opts: RenderOptions = { mode: 'export', baseUrl };
  const files: SiteFiles = {};
  const pages = site.settings.maintenanceMode ? site.pages.slice(0, 1) : site.pages;
  for (const p of pages) files[`${pagePath(p)}index.html`] = renderPage(site, p, opts);
  files['404.html'] = render404(site, opts);
  if (!site.performance.inlineCss) {
    files['assets/site.css'] = site.performance.minify ? minifyCss(siteCss(site)) : siteCss(site);
  }
  for (const m of usedMedia(site)) {
    files[assetPath(m)] = dataUrlToBytes(m.src);
    for (const [w, src] of Object.entries(m.variants ?? {})) files[assetPath(m, Number(w))] = dataUrlToBytes(src);
  }
  files['robots.txt'] = robotsTxt(site, baseUrl);
  if (baseUrl && site.seo.generateSitemap) files['sitemap.xml'] = sitemapXml(site, baseUrl);
  files['_headers'] = headersFile(site);
  const redirects = redirectsFile(site);
  if (redirects) files['_redirects'] = redirects + '\n';
  return files;
}

/** Media actually referenced by the site (unused uploads are not shipped). */
export function usedMedia(site: Site): MediaAsset[] {
  const ids = new Set<string>();
  const add = (id?: string) => id && ids.add(id);
  for (const p of site.pages) {
    add(p.seo.ogImageId);
    for (const b of p.blocks) {
      if (b.hidden) continue;
      add(b.mediaId);
      b.items?.forEach((it: Item) => add(it.mediaId));
    }
  }
  add(site.settings.logoId);
  add(site.settings.favicon);
  add(site.seo.defaultOgImageId);
  for (const m of site.media) if (ids.has(m.id) && m.posterId) ids.add(m.posterId);
  return site.media.filter((m) => ids.has(m.id));
}

export const filesSize = (files: SiteFiles) =>
  Object.values(files).reduce((n, f) => n + (typeof f === 'string' ? new TextEncoder().encode(f).length : f.length), 0);
