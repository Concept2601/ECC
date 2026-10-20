import type { Site } from '../types';
import { buildSite, filesSize, primaryDomain, type SiteFiles } from './render';
import { createZip } from './zip';
import { downloadBlob } from './storage';
import { slugify } from './util';
import { DEMO, DEMO_NOTE } from '../demo';

export interface DeployResult {
  url?: string;
  message: string;
  bytes: number;
  netlifySiteId?: string;
  /** e.g. my-site.netlify.app — the CNAME target for custom subdomains */
  netlifyHost?: string;
}

type Log = (line: string) => void;

function toBase64(files: SiteFiles): Record<string, string> {
  const enc = new TextEncoder();
  const out: Record<string, string> = {};
  for (const [path, f] of Object.entries(files)) {
    const bytes = typeof f === 'string' ? enc.encode(f) : f;
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    out[path] = btoa(bin);
  }
  return out;
}

async function api<T>(base: string, path: string, body: unknown, token?: string): Promise<T> {
  const res = await fetch(`${base.replace(/\/$/, '')}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((json as { error?: string }).error ?? `Request failed (${res.status})`);
  return json as T;
}

export async function deploy(site: Site, log: Log): Promise<DeployResult> {
  const h = site.hosting;
  const baseUrl = primaryDomain(site);
  // Canonical URLs use the primary domain right away, but only send people there once DNS is verified.
  const liveDomain = site.domains.domains.find((d) => d.primary && d.status === 'verified');
  log(`Building ${site.pages.length} page(s)${baseUrl ? ` for ${baseUrl}` : ''}…`);
  const files = buildSite(site, baseUrl);
  const bytes = filesSize(files);
  log(`Built ${Object.keys(files).length} files (${(bytes / 1024).toFixed(0)} KB).`);
  if (DEMO) throw new Error(`Your site built successfully. Publishing it ${DEMO_NOTE}`);

  if (h.provider === 'zip') {
    const zip = createZip(files);
    downloadBlob(zip, `${slugify(site.name) || 'site'}.zip`, 'application/zip');
    log('ZIP downloaded. Upload its contents to any static host (cPanel, GitHub Pages, Cloudflare Pages, S3…).');
    return { message: 'Exported ZIP', bytes };
  }

  if (h.provider === 'self') {
    log(`Uploading to ${h.serverUrl || window.location.origin}…`);
    const res = await api<{ url: string; message: string }>(h.serverUrl, '/api/publish', {
      slug: h.slug,
      files: toBase64(files),
      domains: site.domains.domains.map((d) => d.host),
      password: site.settings.passwordProtect ? site.settings.password : '',
      httpsRedirect: h.httpsRedirect,
      securityHeaders: h.securityHeaders,
      cacheAssetsDays: h.cacheAssetsDays,
    }, h.serverToken);
    const url = liveDomain ? `https://${liveDomain.host}/` : new URL(res.url, h.serverUrl || window.location.origin).toString();
    log(res.message);
    return { url, message: res.message, bytes };
  }

  log('Deploying to Netlify (only changed files are uploaded)…');
  const res = await api<{ url: string; siteId: string; defaultHost: string; message: string }>(h.serverUrl, '/api/deploy/netlify', {
    token: h.netlifyToken,
    siteId: h.netlifySiteId,
    name: h.slug,
    files: toBase64(files),
    domain: site.domains.domains.find((d) => d.primary)?.host ?? site.domains.domains[0]?.host,
  }, h.serverToken);
  log(res.message);
  return { url: liveDomain ? `https://${liveDomain.host}/` : res.url, message: res.message, bytes, netlifySiteId: res.siteId, netlifyHost: res.defaultHost };
}

export interface FormSubmission {
  at: number;
  page?: string;
  name?: string;
  email?: string;
  phone?: string;
  message?: string;
}

export async function fetchSubmissions(site: Site): Promise<FormSubmission[]> {
  const h = site.hosting;
  const res = await fetch(`${h.serverUrl.replace(/\/$/, '')}/api/forms/${encodeURIComponent(h.slug)}`, {
    headers: h.serverToken ? { authorization: `Bearer ${h.serverToken}` } : {},
  });
  if (!res.ok) throw new Error(`Could not load submissions (${res.status})`);
  return res.json();
}

export async function serverStatus(site: Site): Promise<{ ok: boolean; version?: string; publicIp?: string; authRequired?: boolean }> {
  try {
    const res = await fetch(`${site.hosting.serverUrl.replace(/\/$/, '')}/api/health`);
    if (!res.ok) return { ok: false };
    return { ok: true, ...(await res.json()) };
  } catch {
    return { ok: false };
  }
}
