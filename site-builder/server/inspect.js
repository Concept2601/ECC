// Inspiration analyser: fetches a public web page and extracts its design DNA —
// palette, typography, navigation and the order of its content sections.
import dns from 'node:dns/promises';
import net from 'node:net';

const MAX_BYTES = 2 * 1024 * 1024;
const TIMEOUT = 10_000;

function isPrivate(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
  }
  const v = ip.toLowerCase();
  return v === '::1' || v === '::' || v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe80') || v.startsWith('::ffff:') && isPrivate(v.slice(7));
}

/** Refuse URLs that resolve to private / internal addresses (SSRF guard). */
async function assertPublic(u) {
  if (!/^https?:$/.test(u.protocol)) throw new Error('Only http(s) URLs are supported.');
  const addrs = net.isIP(u.hostname) ? [{ address: u.hostname }] : await dns.lookup(u.hostname, { all: true });
  if (!addrs.length || addrs.some((a) => isPrivate(a.address))) throw new Error('That address is not publicly reachable.');
}

async function fetchText(url, hops = 0) {
  const u = new URL(url);
  await assertPublic(u);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT);
  try {
    const res = await fetch(u, {
      redirect: 'manual',
      signal: ctrl.signal,
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; LaunchpadStudio/1.0; +design-inspiration)', accept: 'text/html,text/css,*/*' },
    });
    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
      if (hops >= 4) throw new Error('Too many redirects.');
      return fetchText(new URL(res.headers.get('location'), u).toString(), hops + 1);
    }
    if (!res.ok) throw new Error(`The site responded with ${res.status}.`);
    const reader = res.body.getReader();
    const chunks = [];
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > MAX_BYTES) {
        ctrl.abort();
        break;
      }
      chunks.push(value);
    }
    return { text: Buffer.concat(chunks).toString('utf8'), finalUrl: u.toString() };
  } catch (err) {
    if (err.name === 'AbortError') throw new Error('The site took too long to respond.');
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

const text = (html) => html.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&nbsp;|&#160;/g, ' ').replace(/&#39;|&rsquo;/g, '’').replace(/\s+/g, ' ').trim();

function toHex(c) {
  c = c.trim().toLowerCase();
  if (c.startsWith('#')) {
    let h = c.slice(1);
    if (h.length === 3 || h.length === 4) h = h.slice(0, 3).split('').map((x) => x + x).join('');
    return h.length >= 6 ? `#${h.slice(0, 6)}` : null;
  }
  const m = /rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/.exec(c);
  if (m) return '#' + m.slice(1, 4).map((n) => Math.min(255, Number(n)).toString(16).padStart(2, '0')).join('');
  return null;
}

function saturation(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { s: 0, l };
  return { s: (max - min) / (1 - Math.abs(2 * l - 1)), l };
}

/** Rank the "brand" colours: frequent, saturated, neither near-white nor near-black. */
function palette(css, themeColor) {
  const counts = new Map();
  for (const m of css.matchAll(/#[0-9a-f]{3,8}\b|rgba?\([^)]+\)/gi)) {
    const hex = toHex(m[0]);
    if (!hex) continue;
    const { s, l } = saturation(hex);
    if (s < 0.25 || l < 0.12 || l > 0.92) continue;
    counts.set(hex, (counts.get(hex) ?? 0) + 1);
  }
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([h]) => h);
  const tc = themeColor && toHex(themeColor);
  const list = tc && saturation(tc).s >= 0.2 ? [tc, ...ranked.filter((h) => h !== tc)] : ranked;
  // Keep colours that are visibly different from each other.
  const distinct = [];
  for (const h of list) {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
    if (distinct.every((d) => {
      const [r2, g2, b2] = [1, 3, 5].map((i) => parseInt(d.slice(i, i + 2), 16));
      return Math.abs(r - r2) + Math.abs(g - g2) + Math.abs(b - b2) > 90;
    })) distinct.push(h);
    if (distinct.length === 5) break;
  }
  return distinct;
}

const GENERIC = new Set(['sans-serif', 'serif', 'monospace', 'system-ui', 'inherit', 'initial', '-apple-system', 'blinkmacsystemfont', 'segoe ui', 'roboto', 'helvetica', 'helvetica neue', 'arial', 'cursive', 'ui-sans-serif', 'ui-serif', 'var']);

function fonts(html, css) {
  const found = [];
  for (const m of html.matchAll(/fonts\.googleapis\.com\/css2?\?([^"'>]+)/g)) {
    for (const f of m[1].split('&')) {
      const fam = /^family=([^:&]+)/.exec(f)?.[1];
      if (fam) found.push(decodeURIComponent(fam.replace(/\+/g, ' ')));
    }
  }
  const counts = new Map();
  for (const m of css.matchAll(/font-family\s*:\s*([^;}]+)/gi)) {
    const first = m[1].split(',')[0].replace(/["']/g, '').trim();
    if (first && !GENERIC.has(first.toLowerCase()) && !first.startsWith('var(') && !/icon|awesome|symbol/i.test(first)) counts.set(first, (counts.get(first) ?? 0) + 1);
  }
  found.push(...[...counts.entries()].sort((a, b) => b[1] - a[1]).map(([f]) => f));
  return [...new Set(found)].slice(0, 3);
}

const SECTION_RULES = [
  ['logos', /trusted by|our (clients|partners)|as seen (in|on)|backed by/i],
  ['features', /features|services|what we do|why (choose|us)|how it works|benefits/i],
  ['stats', /\b\d+[k+%]\+?\s*(customers|clients|users|projects|years|countries)/i],
  ['gallery', /gallery|portfolio|our work|case stud|projects/i],
  ['video', /<video|youtube\.com\/embed|player\.vimeo|youtu\.be/i],
  ['testimonials', /testimonial|what (our )?(customers|clients) say|reviews|loved by/i],
  ['team', /our team|meet the|leadership|founders/i],
  ['pricing', /pricing|plans|per month|\/mo\b/i],
  ['faq', /faq|frequently asked/i],
  ['contact', /<form|contact us|get in touch/i],
];

function sections(body) {
  const found = SECTION_RULES.map(([type, re]) => {
    const m = re.exec(body);
    return m ? { type, at: m.index } : null;
  })
    .filter(Boolean)
    .sort((a, b) => a.at - b.at)
    .map((s) => s.type);
  const list = ['hero', ...found];
  if (!list.includes('contact')) list.push('cta');
  return list;
}

/** Pure extraction step, separated from fetching so it can be tested offline. */
export function extract(html, css, url) {
  const head = /<head[\s\S]*?<\/head>/i.exec(html)?.[0] ?? html.slice(0, 20000);
  const body = /<body[\s\S]*<\/body>/i.exec(html)?.[0] ?? html;
  css += '\n' + [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]).join('\n');
  css += [...html.matchAll(/style="([^"]+)"/gi)].map((m) => m[1]).join(';');
  const meta = (name) => new RegExp(`<meta[^>]+(?:name|property)=["']${name}["'][^>]*content=["']([^"']*)`, 'i').exec(head)?.[1] ?? new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:name|property)=["']${name}["']`, 'i').exec(head)?.[1] ?? '';
  const nav = /<nav[\s\S]*?<\/nav>/i.exec(body)?.[0] ?? /<header[\s\S]*?<\/header>/i.exec(body)?.[0] ?? '';
  const navLabels = [...new Set([...nav.matchAll(/<a[^>]*>([\s\S]*?)<\/a>/gi)].map((m) => text(m[1])).filter((t) => t && t.length < 24 && !/log ?in|sign ?(in|up)|cart|search|menu/i.test(t)))].slice(0, 6);
  const headings = [...body.matchAll(/<h([12])[^>]*>([\s\S]*?)<\/h\1>/gi)].map((m) => text(m[2])).filter((t) => t && t.length < 140).slice(0, 10);
  return {
    url,
    title: text(/<title[^>]*>([\s\S]*?)<\/title>/i.exec(head)?.[1] ?? ''),
    description: meta('description') || meta('og:description'),
    colors: palette(css, meta('theme-color')),
    fonts: fonts(html, css),
    headings,
    sections: sections(body.replace(/<script[\s\S]*?<\/script>/gi, '')),
    navLabels,
  };
}

export async function analyse(rawUrl) {
  const url = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
  const { text: html, finalUrl } = await fetchText(url);
  const head = /<head[\s\S]*?<\/head>/i.exec(html)?.[0] ?? html.slice(0, 20000);
  const sheets = [...head.matchAll(/<link[^>]+rel=["']?stylesheet[^>]*>/gi)]
    .map((m) => /href=["']?([^"'\s>]+)/.exec(m[0])?.[1])
    .filter((h) => h && !/fonts\.googleapis/.test(h))
    .slice(0, 3);
  const external = await Promise.allSettled(sheets.map((h) => fetchText(new URL(h.replace(/&amp;/g, '&'), finalUrl).toString())));
  const css = external.filter((r) => r.status === 'fulfilled').map((r) => r.value.text).join('\n');
  return extract(html, css, finalUrl);
}
