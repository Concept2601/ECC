import type { Site } from '../types';
import { a11yAudit, perfAudit, score, seoAudit, siteSeoAudit, type Check } from './audits';
import { createBlock } from './blocks';

export interface LaunchGroup {
  title: string;
  checks: Check[];
}

const c = (id: string, label: string, ok: boolean | 'warn', detail: string, fix?: string): Check => ({
  id,
  label,
  status: ok === true ? 'pass' : ok === 'warn' ? 'warn' : 'fail',
  detail,
  fix,
});

const PLACEHOLDERS = new Set(
  (['hero', 'richtext', 'cta', 'contact'] as const).flatMap((t) => {
    const b = createBlock(t);
    return [b.heading, b.body].filter(Boolean) as string[];
  }),
);

export function launchChecklist(site: Site): LaunchGroup[] {
  const blocks = site.pages.flatMap((p) => p.blocks.filter((b) => !b.hidden).map((b) => ({ p, b })));
  const placeholder = blocks.filter(({ b }) => PLACEHOLDERS.has(b.heading ?? '') || PLACEHOLDERS.has(b.body ?? '') || /lorem ipsum/i.test(b.body ?? ''));
  const slugs = new Set(site.pages.map((p) => p.slug));
  const links = blocks.flatMap(({ p, b }) => [b.ctaLink, b.secondaryLink, ...(b.items ?? []).map((i) => i.link)].filter((l): l is string => !!l && l.startsWith('/')).map((l) => ({ p, l })));
  const broken = links.filter(({ l }) => !slugs.has(l.slice(1).split('#')[0].replace(/\/$/, '')));
  const emptyPages = site.pages.filter((p) => !p.blocks.some((b) => !b.hidden));
  const hasForm = blocks.some(({ b }) => b.type === 'contact');
  const tracking = !!(site.integrations.ga4Id || site.integrations.metaPixelId);
  const privacy = site.pages.some((p) => /privacy/.test(p.slug));

  const seoAvg = Math.round(site.pages.reduce((n, p) => n + score(seoAudit(site, p)), 0) / site.pages.length);
  const perfAvg = Math.round(site.pages.reduce((n, p) => n + score(perfAudit(site, p)), 0) / site.pages.length);
  const a11y = score(a11yAudit(site));
  const siteSeo = siteSeoAudit(site);

  const h = site.hosting;
  const hostingReady = h.provider === 'zip' || (h.provider === 'self' && !!h.slug) || (h.provider === 'netlify' && !!h.netlifyToken);
  const verified = site.domains.domains.filter((d) => d.status === 'verified');

  return [
    {
      title: 'Content',
      checks: [
        c('placeholder', 'No placeholder text', placeholder.length ? 'warn' : true, placeholder.length ? `Template text remains in ${placeholder.length} section(s): ${[...new Set(placeholder.map(({ p }) => p.name))].join(', ')}.` : 'All copy has been customised.', 'design'),
        c('empty', 'No empty pages', emptyPages.length === 0, emptyPages.length ? `Empty: ${emptyPages.map((p) => p.name).join(', ')}` : `${site.pages.length} pages with content.`, 'design'),
        c('links', 'No broken internal links', broken.length === 0, broken.length ? `${broken.map(({ l, p }) => `${l} on ${p.name}`).join(', ')}` : `${links.length} internal button links checked.`, 'design'),
        c('logo', 'Logo or brand name', !!(site.settings.logoId || site.settings.logoText), site.settings.logoId ? 'Logo image set.' : site.settings.logoText ? 'Text logo set.' : 'Add a logo.', 'settings'),
        c('menu', 'Navigation menu', site.menus.main.length > 0, `${site.menus.main.length} menu links.`, 'pages'),
      ],
    },
    {
      title: 'Quality scores',
      checks: [
        c('seo', 'SEO (average)', seoAvg >= 80 ? true : seoAvg >= 60 ? 'warn' : false, `${seoAvg}/100 across ${site.pages.length} pages.`, 'seo'),
        c('speed', 'Speed (average)', perfAvg >= 80 ? true : perfAvg >= 60 ? 'warn' : false, `${perfAvg}/100.`, 'speed'),
        c('a11y', 'Accessibility', a11y >= 80 ? true : a11y >= 60 ? 'warn' : false, `${a11y}/100.`, 'design'),
        ...siteSeo.filter((x) => x.status === 'fail'),
      ],
    },
    {
      title: 'Back-End',
      checks: [
        c('hosting', 'Hosting configured', hostingReady, h.provider === 'netlify' && !h.netlifyToken ? 'Add your Netlify token.' : `Target: ${h.provider === 'self' ? `Launchpad server (/sites/${h.slug}/)` : h.provider === 'netlify' ? 'Netlify' : 'ZIP export'}.`, 'hosting'),
        c('domain', 'Custom domain', site.domains.domains.length === 0 ? 'warn' : verified.length ? true : 'warn', site.domains.domains.length === 0 ? 'Launching on the free address. Connect a domain for a professional URL.' : verified.length ? `${verified.map((d) => d.host).join(', ')} verified.` : 'Domain added but DNS not verified yet.', 'domains'),
        c('https', 'HTTPS enforced', h.httpsRedirect || h.provider !== 'self', h.provider === 'self' ? (h.httpsRedirect ? 'HTTP redirects to HTTPS.' : 'Turn on Force HTTPS.') : 'Handled by the host.', 'hosting'),
        c('forms', 'Contact form delivery', !hasForm || site.integrations.formEndpoint === 'self' || !!site.integrations.customFormAction, hasForm ? (site.integrations.formEndpoint === 'self' ? 'Submissions go to your Launchpad inbox.' : site.integrations.customFormAction ? 'Custom endpoint set.' : 'Custom endpoint missing — messages would be lost.') : 'No forms on the site.', 'integrations'),
        c('analytics', 'Analytics', site.integrations.ga4Id || site.integrations.plausibleDomain ? true : 'warn', site.integrations.ga4Id || site.integrations.plausibleDomain ? 'Traffic will be measured.' : 'No analytics — you won’t know how visitors find you.', 'integrations'),
      ],
    },
    {
      title: 'Legal & access',
      checks: [
        c('privacy', 'Privacy policy', privacy || (!hasForm && !tracking) ? true : 'warn', privacy ? 'Privacy page found.' : hasForm || tracking ? 'You collect personal data — add a Privacy policy page.' : 'Not required (no forms or tracking).', 'pages'),
        c('cookies', 'Cookie consent', !tracking || site.integrations.cookieBanner, tracking ? (site.integrations.cookieBanner ? 'Banner on; tracking waits for consent.' : 'Cookie-based tracking without consent.') : 'No cookie-based tracking.', 'integrations'),
        c('maintenance', 'Maintenance mode off', site.settings.maintenanceMode ? 'warn' : true, site.settings.maintenanceMode ? 'Only a “coming soon” page will be published.' : 'Full site will be published.', 'settings'),
        c('password', 'Public access', site.settings.passwordProtect ? 'warn' : true, site.settings.passwordProtect ? 'Site is password protected.' : 'Anyone can visit.', 'settings'),
        c('indexing', 'Visible to search engines', site.seo.allowIndexing ? true : 'warn', site.seo.allowIndexing ? 'Indexing allowed.' : 'Indexing disabled.', 'seo'),
      ],
    },
  ];
}

export const blockers = (groups: LaunchGroup[]) => groups.flatMap((g) => g.checks).filter((x) => x.status === 'fail');
