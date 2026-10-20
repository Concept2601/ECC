import { useEffect, useState } from 'react';
import { useSite } from '../../store';
import { serverStatus } from '../../lib/deploy';
import { slugify } from '../../lib/util';
import type { HostingProvider, HostingSettings } from '../../types';
import { Badge, Card, PageHead, Select, Text, Toggle } from '../../components/ui';

const PROVIDERS: { id: HostingProvider; title: string; text: string; badge: string }[] = [
  { id: 'self', title: 'TDV hosting server', text: 'Host on the bundled Node server (your VPS, cloud VM or this machine). Custom domains, forms inbox, password protection and redirects included.', badge: 'Recommended' },
  { id: 'netlify', title: 'Netlify', text: 'Global CDN with automatic HTTPS. Deploys only changed files. Needs a free Netlify access token.', badge: 'CDN' },
  { id: 'zip', title: 'Any host (ZIP)', text: 'Download clean static files for cPanel, GitHub Pages, Cloudflare Pages, S3 or any web server.', badge: 'Portable' },
];

export function HostingTab() {
  const { site, update } = useSite();
  const h = site.hosting;
  const set = <K extends keyof HostingSettings>(k: K, v: HostingSettings[K]) => update((d) => { d.hosting[k] = v; }, `host-${k}`);
  const [status, setStatus] = useState<Awaited<ReturnType<typeof serverStatus>>>();
  const [checking, setChecking] = useState(false);

  const check = async () => {
    setChecking(true);
    setStatus(await serverStatus(site));
    setChecking(false);
  };
  useEffect(() => {
    if (h.provider === 'self') void check();
  }, [h.provider, h.serverUrl]);

  const origin = h.serverUrl || window.location.origin;

  return (
    <div className="tab-page">
      <PageHead title="Hosting" subtitle="Choose where your website lives. You can switch at any time — your design is never locked in." />
      <div className="provider-grid" role="radiogroup" aria-label="Hosting provider">
        {PROVIDERS.map((p) => (
          <button key={p.id} role="radio" aria-checked={h.provider === p.id} className={`provider${h.provider === p.id ? ' on' : ''}`} onClick={() => set('provider', p.id)}>
            <div className="row between"><strong>{p.title}</strong><Badge tone={h.provider === p.id ? 'info' : 'neutral'}>{p.badge}</Badge></div>
            <span className="muted small">{p.text}</span>
          </button>
        ))}
      </div>

      {h.provider === 'self' && (
        <Card
          title="TDV hosting server"
          subtitle="The server that publishes and serves your site."
          actions={<button className="btn sm ghost" onClick={check} disabled={checking}>{checking ? 'Checking…' : 'Test connection'}</button>}
        >
          <p>
            Status:{' '}
            {status === undefined ? <Badge>Unknown</Badge> : status.ok ? <Badge tone="good">Connected · v{status.version}{status.authRequired ? ' · token required' : ''}</Badge> : <Badge tone="bad">Not reachable</Badge>}
          </p>
          <div className="grid2">
            <Text label="Server URL" value={h.serverUrl} onChange={(v) => set('serverUrl', v.trim())} placeholder="Leave empty to use this studio’s server" hint="e.g. https://hosting.yourcompany.com" />
            <Text label="Publish token" type="password" value={h.serverToken} onChange={(v) => set('serverToken', v)} hint="Must match BUILDER_TOKEN on the server." />
            <Text label="Site address" value={h.slug} onChange={(v) => set('slug', slugify(v))} hint={<>Preview URL: <code>{origin.replace(/\/$/, '')}/sites/{h.slug}/</code></>} />
          </div>
        </Card>
      )}

      {h.provider === 'netlify' && (
        <Card title="Netlify" subtitle="Deploys go through your TDV hosting server so your token never touches third-party scripts.">
          <div className="grid2">
            <Text label="Personal access token" type="password" value={h.netlifyToken} onChange={(v) => set('netlifyToken', v.trim())} hint={<a href="https://app.netlify.com/user/applications#personal-access-tokens" target="_blank" rel="noopener">Create a token ↗</a>} />
            <Text label="Netlify site ID" value={h.netlifySiteId} onChange={(v) => set('netlifySiteId', v.trim())} hint="Filled in automatically after the first launch." />
            <Text label="Site name" value={h.slug} onChange={(v) => set('slug', slugify(v))} hint={<>Default address: <code>{h.slug}.netlify.app</code></>} />
            <Text label="TDV hosting server URL" value={h.serverUrl} onChange={(v) => set('serverUrl', v.trim())} placeholder="Same origin" />
          </div>
        </Card>
      )}

      {h.provider === 'zip' && (
        <Card title="Static export" subtitle="Launching downloads a ZIP of production-ready files.">
          <ul className="ticks">
            <li><code>index.html</code> per page with clean URLs (<code>/about/</code>)</li>
            <li><code>assets/</code> with optimised images in every responsive size</li>
            <li><code>sitemap.xml</code>, <code>robots.txt</code> and a branded <code>404.html</code></li>
            <li><code>_headers</code> and <code>_redirects</code> (understood by Netlify & Cloudflare Pages)</li>
          </ul>
          <p className="hint">Connect a domain in Domains first so the sitemap and canonical URLs use it.</p>
        </Card>
      )}

      <Card title="Delivery settings">
        <Toggle label="Force HTTPS" hint="Redirect http:// to https:// and send HSTS." checked={h.httpsRedirect} onChange={(v) => set('httpsRedirect', v)} />
        <Toggle label="Security headers" hint="nosniff, frame protection, referrer and permissions policies." checked={h.securityHeaders} onChange={(v) => set('securityHeaders', v)} />
        <Select label="Browser cache for images & assets" value={h.cacheAssetsDays} options={[7, 30, 90, 365].map((n) => ({ value: n, label: `${n} days` }))} onChange={(v) => set('cacheAssetsDays', v)} />
      </Card>

      {h.provider === 'self' && (
        <Card title="Production setup" subtitle="Run the server on any machine with Node 18+, behind Caddy for free automatic HTTPS on every connected domain.">
          <pre className="code">{`# on your server
git clone <this repo> && cd site-builder
npm ci && npm run build
BUILDER_TOKEN=<long-random-secret> PORT=8787 npm start

# /etc/caddy/Caddyfile — automatic TLS for any domain you connect
{
  on_demand_tls {
    ask http://localhost:8787/api/domain-allowed
  }
}
https:// {
  tls { on_demand }
  reverse_proxy localhost:8787
}`}</pre>
        </Card>
      )}
    </div>
  );
}
