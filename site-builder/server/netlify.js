// Netlify "file digest" deploys: send SHA1s, upload only the files Netlify doesn't already have.
import { createHash } from 'node:crypto';

const API = 'https://api.netlify.com/api/v1';

async function call(token, method, path, body, raw = false) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      ...(raw ? { 'content-type': 'application/octet-stream' } : body ? { 'content-type': 'application/json' } : {}),
    },
    body: raw ? body : body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(`Netlify: ${data.message ?? res.statusText} (${res.status})`);
    err.status = res.status === 401 ? 401 : 502;
    throw err;
  }
  return data;
}

export async function deployToNetlify({ token, siteId, name, files, domain }) {
  if (!token) throw Object.assign(new Error('Add your Netlify personal access token in Back-End → Hosting.'), { status: 400 });

  let site;
  if (siteId) site = await call(token, 'GET', `/sites/${siteId}`);
  else {
    try {
      site = await call(token, 'POST', '/sites', { name });
    } catch {
      // Name taken on Netlify — add a short suffix.
      site = await call(token, 'POST', '/sites', { name: `${name}-${Math.random().toString(36).slice(2, 6)}` });
    }
  }

  const buffers = {};
  const digests = {};
  for (const [p, b64] of Object.entries(files)) {
    const buf = Buffer.from(b64, 'base64');
    const key = `/${p}`;
    buffers[key] = buf;
    digests[key] = createHash('sha1').update(buf).digest('hex');
  }

  const deploy = await call(token, 'POST', `/sites/${site.id}/deploys`, { files: digests });
  const required = new Set(deploy.required ?? []);
  let uploaded = 0;
  for (const [p, sha] of Object.entries(digests)) {
    if (!required.has(sha)) continue;
    required.delete(sha);
    await call(token, 'PUT', `/deploys/${deploy.id}/files${p.split('/').map(encodeURIComponent).join('/')}`, buffers[p], true);
    uploaded++;
  }

  let state = deploy.state;
  for (let i = 0; i < 30 && !['ready', 'error'].includes(state); i++) {
    await new Promise((r) => setTimeout(r, 1500));
    state = (await call(token, 'GET', `/deploys/${deploy.id}`)).state;
  }
  if (state === 'error') throw new Error('Netlify reported a deploy error.');

  if (domain && site.custom_domain !== domain) {
    await call(token, 'PATCH', `/sites/${site.id}`, { custom_domain: domain }).catch(() => {});
  }

  return {
    siteId: site.id,
    defaultHost: site.default_domain ?? `${site.name}.netlify.app`,
    url: site.ssl_url ?? site.url,
    message: `Netlify deploy ${state === 'ready' ? 'is live' : 'is processing'} — uploaded ${uploaded} changed of ${Object.keys(digests).length} files.`,
  };
}
