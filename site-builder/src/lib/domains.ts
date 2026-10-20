import type { DomainRecord, Site } from '../types';
import { DEMO, DEMO_NOTE } from '../demo';

export interface DnsRecord {
  type: 'A' | 'CNAME' | 'TXT';
  name: string;
  value: string;
  note: string;
}

const NETLIFY_LB = '75.2.60.5';

// Second-level labels used under country TLDs: example.co.zw, example.com.au, example.org.uk…
const SECOND_LEVEL = new Set(['co', 'com', 'org', 'net', 'ac', 'gov', 'edu', 'ltd', 'plc', 'or', 'ne', 'go', 'gen', 'nom', 'sch', 'mil', 'info', 'biz']);

/** Number of labels in the registrable ("root") domain. */
const rootLabels = (host: string) => {
  const parts = host.split('.');
  const n = parts.length;
  return n >= 3 && parts[n - 1].length === 2 && SECOND_LEVEL.has(parts[n - 2]) ? 3 : 2;
};

export const isApex = (host: string) => host.split('.').length <= rootLabels(host);

/** The part before the root domain, as entered at the registrar ("www", "shop"…). */
export const subLabel = (host: string) => host.split('.').slice(0, -rootLabels(host)).join('.');

/** The other half of a www / root pair, if any. */
export const pairOf = (host: string) => (isApex(host) ? `www.${host}` : subLabel(host) === 'www' ? host.slice(4) : '');

export function isValidHost(host: string) {
  return /^(?=.{1,253}$)(?!-)([a-z0-9-]{1,63}(?<!-)\.)+[a-z]{2,63}$/i.test(host);
}

/** The DNS records the user must add at their registrar for this domain. */
export function expectedRecords(site: Site, d: DomainRecord): DnsRecord[] {
  const h = site.hosting;
  const label = isApex(d.host) ? '@' : subLabel(d.host);
  if (h.provider === 'netlify') {
    const target = h.netlifyHost || `${h.slug}.netlify.app`;
    return isApex(d.host)
      ? [{ type: 'A', name: '@', value: NETLIFY_LB, note: 'Netlify load balancer' }]
      : [{ type: 'CNAME', name: label, value: target, note: 'Points this subdomain at Netlify' }];
  }
  const ip = site.domains.targetIp || '<your server IP>';
  if (isApex(d.host)) return [{ type: 'A', name: '@', value: ip, note: 'Points your root domain at your server' }];
  return site.domains.targetCname
    ? [{ type: 'CNAME', name: label, value: site.domains.targetCname, note: 'Points this subdomain at your server' }]
    : [{ type: 'A', name: label, value: ip, note: 'Points this subdomain at your server' }];
}

interface DohAnswer {
  name: string;
  type: number;
  data: string;
}

async function resolve(name: string, type: 'A' | 'CNAME'): Promise<string[]> {
  const res = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=${type}`, {
    headers: { accept: 'application/dns-json' },
  });
  if (!res.ok) throw new Error(`DNS lookup failed (${res.status})`);
  const json = (await res.json()) as { Answer?: DohAnswer[] };
  return (json.Answer ?? []).map((a) => a.data.replace(/\.$/, '').toLowerCase());
}

/** Check live DNS (via DNS-over-HTTPS) against the expected records. */
export async function verifyDomain(site: Site, d: DomainRecord): Promise<Pick<DomainRecord, 'status' | 'message' | 'lastChecked'>> {
  const expected = expectedRecords(site, d);
  try {
    const results = await Promise.all(
      expected.map(async (r) => {
        if (r.value.startsWith('<')) return { ok: false, msg: 'Set your server IP in the DNS targets first.' };
        const found = await resolve(d.host, r.type as 'A' | 'CNAME');
        // A CNAME check also passes if the A records already resolve through it.
        const ok = found.includes(r.value.toLowerCase());
        return { ok, msg: ok ? `${r.type} → ${r.value} ✓` : found.length ? `${r.type} currently points to ${found.join(', ')}` : `No ${r.type} record found yet` };
      }),
    );
    const ok = results.every((r) => r.ok);
    return { status: ok ? 'verified' : 'pending', message: results.map((r) => r.msg).join(' · ') + (ok ? '' : ' — DNS changes can take up to 48 h.'), lastChecked: Date.now() };
  } catch (err) {
    const msg = (err as Error).message;
    return { status: 'failed', message: msg === 'Failed to fetch' ? `Could not reach the DNS checker. Live DNS checks ${DEMO ? DEMO_NOTE : 'need an internet connection.'}` : msg, lastChecked: Date.now() };
  }
}
