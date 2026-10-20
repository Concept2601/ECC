// Think Different Visuals Studio server — zero dependencies.
//  • serves the studio app (dist/)
//  • hosts published sites at /sites/<slug>/ and on connected custom domains (by Host header)
//  • captures contact-form submissions
//  • analyses inspiration URLs
//  • deploys to Netlify on the studio's behalf
import http from 'node:http';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { promises as fs, createReadStream } from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { analyse } from './inspect.js';
import { deployToNetlify } from './netlify.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA = path.resolve(process.env.DATA_DIR ?? path.join(ROOT, 'data'));
const DIST = path.join(ROOT, 'dist');
const PORT = Number(process.env.PORT ?? 8787);
const TOKEN = process.env.BUILDER_TOKEN ?? '';
const MAX_BODY = Number(process.env.MAX_UPLOAD_MB ?? 300) * 1024 * 1024;
const VERSION = '1.0.0';

const SITES = path.join(DATA, 'sites');
const META = path.join(DATA, 'meta');
const FORMS = path.join(DATA, 'forms');
const DOMAINS_FILE = path.join(DATA, 'domains.json');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.woff2': 'font/woff2',
};
const COMPRESSIBLE = /^(text\/|application\/(json|xml)|image\/svg)/;
const SLUG = /^[a-z0-9](?:[a-z0-9-]{0,58}[a-z0-9])?$/;

await Promise.all([SITES, META, FORMS].map((d) => fs.mkdir(d, { recursive: true })));

// ------------------------------------------------------------------ helpers

let domainMap = {};
try {
  domainMap = JSON.parse(await fs.readFile(DOMAINS_FILE, 'utf8'));
} catch {
  domainMap = {};
}

const json = (res, status, body, extra = {}) => {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...extra });
  res.end(JSON.stringify(body));
};

const cors = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
  'access-control-allow-headers': 'content-type, authorization, accept',
};

function authorised(req) {
  if (!TOKEN) return true;
  const given = Buffer.from((req.headers.authorization ?? '').replace(/^Bearer\s+/i, ''));
  const want = Buffer.from(TOKEN);
  return given.length === want.length && timingSafeEqual(given, want);
}

function readBody(req, limit = MAX_BODY) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) {
        reject(Object.assign(new Error('Payload too large'), { status: 413 }));
        req.destroy();
      } else chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

/** Resolve a request path inside a directory, refusing traversal. */
function safeJoin(dir, urlPath) {
  const decoded = decodeURIComponent(urlPath.split('?')[0]);
  const p = path.normalize(path.join(dir, decoded));
  return p === dir || p.startsWith(dir + path.sep) ? p : null;
}

const hashPassword = (pw, salt) => createHash('sha256').update(`${salt}:${pw}`).digest('hex');

async function readMeta(slug) {
  try {
    return JSON.parse(await fs.readFile(path.join(META, `${slug}.json`), 'utf8'));
  } catch {
    return null;
  }
}

async function sendFile(req, res, file, headers = {}) {
  let stat;
  try {
    stat = await fs.stat(file);
    if (stat.isDirectory()) {
      file = path.join(file, 'index.html');
      stat = await fs.stat(file);
    }
  } catch {
    return false;
  }
  const type = MIME[path.extname(file).toLowerCase()] ?? 'application/octet-stream';
  const etag = `"${stat.size.toString(36)}-${stat.mtimeMs.toString(36)}"`;
  if (req.headers['if-none-match'] === etag) {
    res.writeHead(304, { etag, ...headers });
    res.end();
    return true;
  }
  const base = { 'content-type': type, etag, 'last-modified': stat.mtime.toUTCString(), vary: 'accept-encoding', ...headers };
  const ae = req.headers['accept-encoding'] ?? '';
  // Byte ranges keep video seekable.
  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range ?? '');
  if (range && type.startsWith('video/')) {
    const start = range[1] ? Number(range[1]) : stat.size - Number(range[2]);
    const end = range[1] && range[2] ? Math.min(Number(range[2]), stat.size - 1) : stat.size - 1;
    if (start >= stat.size || start < 0 || end < start) {
      res.writeHead(416, { 'content-range': `bytes */${stat.size}` });
      res.end();
      return true;
    }
    res.writeHead(206, { ...base, 'accept-ranges': 'bytes', 'content-range': `bytes ${start}-${end}/${stat.size}`, 'content-length': end - start + 1 });
    createReadStream(file, { start, end }).pipe(res);
    return true;
  }
  if (COMPRESSIBLE.test(type) && stat.size > 1024 && /\b(br|gzip)\b/.test(ae)) {
    const br = /\bbr\b/.test(ae);
    res.writeHead(200, { ...base, 'content-encoding': br ? 'br' : 'gzip' });
    createReadStream(file).pipe(br ? zlib.createBrotliCompress() : zlib.createGzip()).pipe(res);
  } else {
    res.writeHead(200, { ...base, 'accept-ranges': 'bytes', 'content-length': stat.size });
    if (req.method === 'HEAD') res.end();
    else createReadStream(file).pipe(res);
  }
  return true;
}

// ------------------------------------------------------------------ published sites

async function serveSite(req, res, slug, subPath, prefix) {
  const dir = path.join(SITES, slug);
  const meta = (await readMeta(slug)) ?? {};

  if (meta.httpsRedirect && req.headers['x-forwarded-proto'] === 'http') {
    res.writeHead(301, { location: `https://${req.headers.host}${req.url}` });
    return res.end();
  }

  if (meta.passwordHash) {
    const [, b64] = /^Basic\s+(.+)$/i.exec(req.headers.authorization ?? '') ?? [];
    const pw = b64 ? Buffer.from(b64, 'base64').toString().split(':').slice(1).join(':') : '';
    const ok = pw && Buffer.from(hashPassword(pw, meta.salt)).equals(Buffer.from(meta.passwordHash));
    if (!ok) {
      res.writeHead(401, { 'www-authenticate': 'Basic realm="Protected site", charset="UTF-8"', 'content-type': 'text/plain' });
      return res.end('This site is password protected.');
    }
  }

  const clean = subPath.split('?')[0] || '/';
  for (const r of meta.redirects ?? []) {
    if (r.from === clean || r.from === clean.replace(/\/$/, '')) {
      const to = r.to.startsWith('/') ? prefix + r.to : r.to;
      res.writeHead(r.code, { location: to });
      return res.end();
    }
  }

  // Pages live at /<slug>/index.html — send /about to /about/ so relative links resolve.
  if (!path.extname(clean) && !clean.endsWith('/')) {
    res.writeHead(301, { location: `${prefix}${clean}/${req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : ''}` });
    return res.end();
  }

  const headers = {
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'strict-origin-when-cross-origin',
  };
  if (meta.securityHeaders) {
    headers['x-frame-options'] = 'SAMEORIGIN';
    headers['permissions-policy'] = 'camera=(), microphone=(), geolocation=()';
    if (meta.httpsRedirect && req.headers['x-forwarded-proto'] === 'https') headers['strict-transport-security'] = 'max-age=31536000; includeSubDomains';
  }
  headers['cache-control'] = clean.startsWith('/assets/')
    ? `public, max-age=${(meta.cacheAssetsDays ?? 30) * 86400}, immutable`
    : 'public, max-age=0, must-revalidate';

  const file = safeJoin(dir, clean);
  if (file && (await sendFile(req, res, file, headers))) return;
  const notFound = path.join(dir, '404.html');
  try {
    const html = await fs.readFile(notFound);
    res.writeHead(404, { 'content-type': 'text/html; charset=utf-8', ...headers, 'cache-control': 'no-cache' });
    res.end(html);
  } catch {
    json(res, 404, { error: 'Not found' });
  }
}

async function publish(req, res) {
  if (!authorised(req)) return json(res, 401, { error: 'Invalid or missing publish token.' });
  const body = JSON.parse((await readBody(req)).toString());
  const slug = String(body.slug ?? '').toLowerCase();
  if (!SLUG.test(slug)) return json(res, 400, { error: 'Site address may only contain a–z, 0–9 and dashes.' });
  if (!body.files || typeof body.files !== 'object' || !body.files['index.html']) return json(res, 400, { error: 'No index.html in upload.' });

  // Write into a fresh folder, then swap it in so visitors never see a half-published site.
  const stage = path.join(SITES, `.stage-${slug}-${randomBytes(4).toString('hex')}`);
  let count = 0;
  for (const [rel, b64] of Object.entries(body.files)) {
    const dest = safeJoin(stage, '/' + rel);
    if (!dest) return json(res, 400, { error: `Bad path: ${rel}` });
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.writeFile(dest, Buffer.from(String(b64), 'base64'));
    count++;
  }
  const live = path.join(SITES, slug);
  const old = `${live}.old-${Date.now()}`;
  await fs.rename(live, old).catch(() => {});
  await fs.rename(stage, live);
  fs.rm(old, { recursive: true, force: true }).catch(() => {});

  const redirects = [];
  const rf = body.files._redirects ? Buffer.from(body.files._redirects, 'base64').toString() : '';
  for (const line of rf.split('\n')) {
    const [from, to, code] = line.trim().split(/\s+/);
    if (from && to) redirects.push({ from, to, code: Number(code) === 302 ? 302 : 301 });
  }
  const salt = randomBytes(8).toString('hex');
  const meta = {
    slug,
    publishedAt: new Date().toISOString(),
    redirects,
    httpsRedirect: !!body.httpsRedirect,
    securityHeaders: body.securityHeaders !== false,
    cacheAssetsDays: Number(body.cacheAssetsDays) || 30,
    salt,
    passwordHash: body.password ? hashPassword(String(body.password), salt) : undefined,
  };
  await fs.writeFile(path.join(META, `${slug}.json`), JSON.stringify(meta, null, 2));

  // Point every connected domain at this site.
  for (const [host, s] of Object.entries(domainMap)) if (s === slug) delete domainMap[host];
  for (const host of body.domains ?? []) {
    const h = String(host).toLowerCase();
    if (/^[a-z0-9.-]+$/.test(h)) domainMap[h] = slug;
  }
  await fs.writeFile(DOMAINS_FILE, JSON.stringify(domainMap, null, 2));

  json(res, 200, { url: `/sites/${slug}/`, message: `Published ${count} files. Live at /sites/${slug}/${(body.domains ?? []).length ? ` and on ${body.domains.join(', ')} once DNS points here` : ''}.` });
}

// ------------------------------------------------------------------ forms

function parseMultipart(buf, boundary) {
  const out = {};
  const parts = buf.toString('utf8').split(`--${boundary}`);
  for (const part of parts) {
    const m = /name="([^"]+)"(?:; filename="[^"]*")?\r\n(?:[^\r\n]+\r\n)*\r\n([\s\S]*)\r\n$/.exec(part);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

const recent = new Map();
function rateLimited(ip) {
  const now = Date.now();
  const list = (recent.get(ip) ?? []).filter((t) => now - t < 60_000);
  list.push(now);
  recent.set(ip, list);
  return list.length > 5;
}

async function submitForm(req, res, slug) {
  if (!SLUG.test(slug)) return json(res, 404, { error: 'Unknown site' }, cors);
  const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() ?? req.socket.remoteAddress;
  if (rateLimited(ip)) return json(res, 429, { error: 'Too many submissions, please wait a minute.' }, cors);
  const raw = await readBody(req, 64 * 1024);
  const ct = req.headers['content-type'] ?? '';
  const boundary = /boundary=(.+)$/.exec(ct)?.[1];
  const fields = boundary ? parseMultipart(raw, boundary) : ct.includes('json') ? JSON.parse(raw.toString()) : Object.fromEntries(new URLSearchParams(raw.toString()));
  const wantsJson = (req.headers.accept ?? '').includes('application/json');
  if (!fields._gotcha) {
    const clip = (v) => String(v ?? '').slice(0, 5000);
    const entry = { at: Date.now(), page: clip(fields._page), name: clip(fields.name), email: clip(fields.email), phone: clip(fields.phone), message: clip(fields.message) };
    await fs.appendFile(path.join(FORMS, `${slug}.jsonl`), JSON.stringify(entry) + '\n');
  }
  if (wantsJson) return json(res, 200, { ok: true }, cors);
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  res.end('<!doctype html><meta name="viewport" content="width=device-width"><title>Thank you</title><body style="font:18px system-ui;display:grid;place-items:center;min-height:90vh;text-align:center"><div><h1>Thank you!</h1><p>Your message has been sent.</p><p><a href="javascript:history.back()">Go back</a></p></div>');
}

async function listForms(req, res, slug) {
  if (!authorised(req)) return json(res, 401, { error: 'Unauthorised' }, cors);
  try {
    const lines = (await fs.readFile(path.join(FORMS, `${slug}.jsonl`), 'utf8')).trim().split('\n').filter(Boolean);
    json(res, 200, lines.map((l) => JSON.parse(l)).reverse(), cors);
  } catch {
    json(res, 200, [], cors);
  }
}

// ------------------------------------------------------------------ router

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://x');
    const p = url.pathname;
    const host = (req.headers.host ?? '').split(':')[0].toLowerCase();

    // Custom domains: any Host we know about serves that site at the root.
    const mapped = domainMap[host] ?? (host.startsWith('www.') ? domainMap[host.slice(4)] : domainMap[`www.${host}`]);
    if (mapped && !p.startsWith('/api/')) return await serveSite(req, res, mapped, req.url, '');

    if (req.method === 'OPTIONS') {
      res.writeHead(204, cors);
      return res.end();
    }
    if (p === '/api/health') return json(res, 200, { ok: true, version: VERSION, authRequired: !!TOKEN }, cors);
    // Caddy on-demand TLS asks here before issuing a certificate: only for connected domains.
    if (p === '/api/domain-allowed') {
      const d = (url.searchParams.get('domain') ?? '').toLowerCase();
      return json(res, domainMap[d] ? 200 : 404, { allowed: !!domainMap[d] });
    }
    if (p === '/api/publish' && req.method === 'POST') return await publish(req, res);
    if (p === '/api/inspect') {
      const target = url.searchParams.get('url') ?? '';
      try {
        return json(res, 200, await analyse(target));
      } catch (err) {
        return json(res, 400, { error: err.message });
      }
    }
    if (p === '/api/deploy/netlify' && req.method === 'POST') {
      if (!authorised(req)) return json(res, 401, { error: 'Unauthorised' });
      const body = JSON.parse((await readBody(req)).toString());
      return json(res, 200, await deployToNetlify(body));
    }
    const form = /^\/api\/forms\/([^/]+)$/.exec(p);
    if (form) {
      const slug = decodeURIComponent(form[1]);
      if (req.method === 'POST') return await submitForm(req, res, slug);
      return await listForms(req, res, slug);
    }
    const site = /^\/sites\/([^/]+)(\/.*)?$/.exec(p);
    if (site) {
      const slug = site[1];
      if (!SLUG.test(slug)) return json(res, 404, { error: 'Not found' });
      if (!site[2]) {
        res.writeHead(301, { location: `/sites/${slug}/` });
        return res.end();
      }
      return await serveSite(req, res, slug, req.url.slice(`/sites/${slug}`.length), `/sites/${slug}`);
    }

    // The studio itself (production build). Hashed assets are cached forever.
    const file = safeJoin(DIST, p === '/' ? '/index.html' : p);
    const cache = p.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache';
    if (file && (await sendFile(req, res, file, { 'cache-control': cache }))) return;
    if (!(await sendFile(req, res, path.join(DIST, 'index.html'), { 'cache-control': 'no-cache' }))) {
      json(res, 404, { error: 'Studio not built. Run `npm run build` or use `npm run dev`.' });
    }
  } catch (err) {
    if (!res.headersSent) json(res, err.status ?? 500, { error: err.message ?? 'Server error' });
    else res.end();
  }
});

server.listen(PORT, () => {
  console.log(`Think Different Visuals Studio server on http://localhost:${PORT}`);
  if (!TOKEN) console.log('  ⚠ BUILDER_TOKEN is not set — anyone who can reach this server can publish. Set it in production.');
});
