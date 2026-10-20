import { describe, expect, it } from 'vitest';
import { sanitizeHtml } from './sanitize';
import { buildSite, minifyHtml, renderPage, robotsTxt, sitemapXml } from './render';
import { createZip, crc32 } from './zip';
import { createSite } from './defaults';
import { INSPIRATIONS, siteFromInspection, siteFromInspiration } from './inspirations';
import { a11yAudit, perfAudit, score, seoAudit } from './audits';
import { launchChecklist } from './launch';
import { contrastRatio } from './color';
import { createBlock } from './blocks';

describe('sanitizeHtml', () => {
  it('keeps formatting and strips scripts, handlers and unsafe links', () => {
    const out = sanitizeHtml('<p onclick="x()">Hi <strong>there</strong><script>alert(1)</script> <a href="javascript:alert(1)">bad</a> <a href="https://ok.com">ok</a></p>');
    expect(out).toBe('<p>Hi <strong>there</strong> <a href="#">bad</a> <a href="https://ok.com" target="_blank" rel="noopener noreferrer">ok</a></p>');
  });
  it('escapes unterminated tags so they cannot combine with later markup', () => {
    expect(sanitizeHtml('<p>x</p><img src=x onerror=alert(1)')).toBe('<p>x</p>&lt;img src=x onerror=alert(1)');
  });
  it('drops disallowed tags but keeps their text', () => {
    expect(sanitizeHtml('<font color="red">a</font><iframe src="x"></iframe>')).toBe('a');
  });
});

describe('render', () => {
  const site = siteFromInspiration(INSPIRATIONS[0], 'Acme');
  site.domains.domains.push({ id: 'd', host: 'acme.com', primary: true, status: 'verified' });

  it('builds every page, 404, robots, sitemap and headers', () => {
    const files = buildSite(site);
    expect(Object.keys(files)).toEqual(expect.arrayContaining(['index.html', 'features/index.html', 'pricing/index.html', 'contact/index.html', '404.html', 'robots.txt', 'sitemap.xml', '_headers']));
    expect(files['sitemap.xml']).toContain('<loc>https://acme.com/pricing/</loc>');
    expect(files['robots.txt']).toContain('Sitemap: https://acme.com/sitemap.xml');
  });

  it('renders SEO tags, one h1, relative links and structured data', () => {
    const html = String(buildSite(site)['pricing/index.html']);
    expect(html).toContain('<link rel="canonical" href="https://acme.com/pricing/">');
    expect(html.match(/<h1/g)).toHaveLength(1);
    expect(html).toContain('href="../contact/"');
    expect(html).toContain('"@type":"FAQPage"');
    expect(html).toContain('<html lang="en">');
  });

  it('escapes user text', () => {
    const s = createSite('<b>X</b>');
    s.pages[0].blocks[0].heading = '<img src=x onerror=alert(1)>';
    const html = renderPage(s, s.pages[0], { mode: 'export' });
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
  });

  it('preview mode wires section selection and never injects custom code', () => {
    const s = createSite('Demo');
    s.integrations.headCode = '<script>window.TRACK=1</script>';
    const html = renderPage(s, s.pages[0], { mode: 'preview' });
    expect(html).toContain('data-block="');
    expect(html).not.toContain('window.TRACK');
  });

  it('maintenance mode publishes only a coming-soon page and blocks crawlers', () => {
    const s = createSite('Soon');
    s.settings.maintenanceMode = true;
    const files = buildSite(s);
    expect(String(files['index.html'])).toContain('launching soon');
    expect(robotsTxt(s)).toContain('Disallow: /');
  });

  it('minifies without touching scripts', () => {
    const out = minifyHtml('<div>\n  <p>a</p>\n</div>\n<script>// note\nvar x = 1;\n</script>');
    expect(out).toBe('<div><p>a</p></div><script>// note\nvar x = 1;\n</script>');
  });

  it('sitemap skips noindex pages', () => {
    const s = createSite('A');
    s.pages[0].seo.noindex = true;
    expect(sitemapXml(s, 'https://a.com')).not.toContain('<loc>');
  });

  it('every inspiration renders', () => {
    for (const insp of INSPIRATIONS) {
      const files = buildSite(siteFromInspiration(insp, insp.name));
      expect(String(files['index.html'])).toContain('<!doctype html>');
    }
  });

  it('builds a site from a URL inspection', () => {
    const s = siteFromInspection({ url: 'https://x.com', title: 'X', description: 'd', colors: ['#ff0000', '#00aa00'], fonts: ['Poppins'], headings: ['Big idea'], sections: ['hero', 'pricing', 'contact'], navLabels: ['Home', 'About', 'Blog'] }, 'X');
    expect(s.theme.primary).toBe('#ff0000');
    expect(s.pages.map((p) => p.slug)).toEqual(['', 'about', 'blog']);
    expect(s.pages[0].blocks.map((b) => b.type)).toEqual(['hero', 'pricing', 'contact']);
    expect(s.pages[0].blocks[0].heading).toBe('Big idea');
  });
});

describe('zip', () => {
  it('computes the standard CRC-32', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926);
  });
  it('writes a valid archive layout', () => {
    const zip = createZip({ 'a.txt': 'hello', 'dir/b.txt': 'world' });
    const view = new DataView(zip.buffer);
    expect(view.getUint32(0, true)).toBe(0x04034b50);
    const end = zip.length - 22;
    expect(view.getUint32(end, true)).toBe(0x06054b50);
    expect(view.getUint16(end + 10, true)).toBe(2);
  });
});

describe('audits', () => {
  it('scores an untouched site below a polished one', () => {
    const s = createSite('Shop');
    const before = score(seoAudit(s, s.pages[0]));
    s.pages[0].seo = { title: 'Handmade leather bags in Harare | Shop', description: 'Shop handmade leather bags crafted in Harare. Free delivery, lifetime repairs and a 30-day return policy on every bag.', focusKeyword: 'leather bags', noindex: false };
    s.pages[0].blocks[0].heading = 'Handmade leather bags';
    s.pages[0].blocks.push(createBlock('richtext', { body: `<p>${'Our leather bags are made by hand. '.repeat(50)}</p>` }));
    expect(score(seoAudit(s, s.pages[0]))).toBeGreaterThan(before);
  });
  it('flags low contrast', () => {
    const s = createSite('C');
    s.theme.text = '#cccccc';
    expect(a11yAudit(s).find((c) => c.label === 'Contrast: Body text')?.status).toBe('fail');
    expect(contrastRatio('#000000', '#ffffff')).toBe(21);
  });
  it('perf audit reports budget', () => {
    const s = createSite('P');
    expect(perfAudit(s, s.pages[0]).find((c) => c.id === 'budget')?.status).toBe('pass');
  });
  it('launch checklist finds placeholder copy and broken links', () => {
    const s = createSite('L');
    s.pages[0].blocks[0].ctaLink = '/nowhere';
    const all = launchChecklist(s).flatMap((g) => g.checks);
    expect(all.find((c) => c.id === 'placeholder')?.status).toBe('warn');
    expect(all.find((c) => c.id === 'links')?.status).toBe('fail');
  });
});

describe('domains', async () => {
  const { isApex, subLabel, pairOf, expectedRecords } = await import('./domains');
  it('understands two-part country suffixes', () => {
    expect(isApex('bloomflorals.co.zw')).toBe(true);
    expect(isApex('www.bloomflorals.co.zw')).toBe(false);
    expect(subLabel('shop.example.com.au')).toBe('shop');
    expect(pairOf('example.com')).toBe('www.example.com');
    expect(pairOf('www.example.co.uk')).toBe('example.co.uk');
    expect(pairOf('blog.example.com')).toBe('');
  });
  it('gives A for root and the right host label for subdomains', () => {
    const s = createSite('D');
    s.domains.targetIp = '203.0.113.10';
    expect(expectedRecords(s, { id: '1', host: 'bloom.co.zw', primary: true, status: 'pending' })).toEqual([expect.objectContaining({ type: 'A', name: '@', value: '203.0.113.10' })]);
    expect(expectedRecords(s, { id: '2', host: 'www.bloom.co.zw', primary: false, status: 'pending' })[0].name).toBe('www');
  });
});
