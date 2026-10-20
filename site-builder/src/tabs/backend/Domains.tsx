import { useState } from 'react';
import { useSite } from '../../store';
import { expectedRecords, isValidHost, pairOf, verifyDomain } from '../../lib/domains';
import { timeAgo, uid } from '../../lib/util';
import type { DomainRecord } from '../../types';
import { Badge, Card, Empty, PageHead, Text } from '../../components/ui';

function Copy({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button className="link" onClick={() => navigator.clipboard?.writeText(text).then(() => { setDone(true); setTimeout(() => setDone(false), 1500); })}>
      {done ? 'Copied' : 'Copy'}
    </button>
  );
}

const STATUS: Record<DomainRecord['status'], ['good' | 'warn' | 'bad', string]> = {
  verified: ['good', 'Connected'],
  pending: ['warn', 'Waiting for DNS'],
  failed: ['bad', 'Check failed'],
};

export function DomainsTab() {
  const { site, update, toast } = useSite();
  const [host, setHost] = useState('');
  const [checking, setChecking] = useState<string>();
  const dom = site.domains;

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    const h = host.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    if (!isValidHost(h)) return toast('Enter a domain like example.com or www.example.com', 'err');
    if (dom.domains.some((d) => d.host === h)) return toast('That domain is already added', 'err');
    update((d) => {
      d.domains.domains.push({ id: uid('dom'), host: h, primary: d.domains.domains.length === 0, status: 'pending' });
      // Suggest the matching www / apex pair as well.
      const pair = pairOf(h);
      if (pair && !d.domains.domains.some((x) => x.host === pair)) d.domains.domains.push({ id: uid('dom'), host: pair, primary: false, status: 'pending' });
    });
    setHost('');
  };

  const verify = async (d: DomainRecord) => {
    setChecking(d.id);
    const r = await verifyDomain(site, d);
    update((s) => { Object.assign(s.domains.domains.find((x) => x.id === d.id)!, r); });
    setChecking(undefined);
    toast(r.status === 'verified' ? `${d.host} is connected 🎉` : r.message ?? 'Not connected yet', r.status === 'verified' ? 'ok' : 'err');
  };

  return (
    <div className="tab-page">
      <PageHead title="Domains" subtitle="Connect a domain you own. We show the exact DNS records to add and verify them live." />
      <Card title="Connect a domain">
        <form className="row" onSubmit={add}>
          <input className="grow" value={host} onChange={(e) => setHost(e.target.value)} placeholder="yourbusiness.com" aria-label="Domain" />
          <button className="btn">Add domain</button>
        </form>
        <p className="hint">Don’t own one yet? Register it at any registrar (Namecheap, Cloudflare, GoDaddy, your local registrar…) and come back.</p>
      </Card>

      {site.hosting.provider === 'self' && (
        <Card title="DNS targets" subtitle="Where your TDV hosting server is reachable on the internet.">
          <div className="grid2">
            <Text label="Server public IPv4" value={dom.targetIp} onChange={(v) => update((d) => { d.domains.targetIp = v.trim(); }, 'dns-ip')} placeholder="203.0.113.10" />
            <Text label="CNAME target (optional)" value={dom.targetCname} onChange={(v) => update((d) => { d.domains.targetCname = v.trim(); }, 'dns-cname')} placeholder="hosting.yourcompany.com" hint="Used for subdomains like www." />
          </div>
        </Card>
      )}
      {site.hosting.provider === 'zip' && <p className="warn-box">With ZIP export, point your domain at whichever host you upload to — the records below are only a guide.</p>}

      {dom.domains.length === 0 ? (
        <Empty icon="🌐" title="No domains yet">
          <p className="muted">Until you connect one, your site is available on its free address after launch.</p>
        </Empty>
      ) : (
        dom.domains.map((d) => {
          const [tone, label] = STATUS[d.status];
          const records = expectedRecords(site, d);
          return (
            <Card
              key={d.id}
              title={<span className="row">{d.host} {d.primary && <Badge tone="info">Primary</Badge>}</span>}
              subtitle={d.lastChecked ? `Checked ${timeAgo(d.lastChecked)}${d.message ? ` — ${d.message}` : ''}` : 'Add the records below at your registrar, then verify.'}
              actions={
                <>
                  <Badge tone={tone}>{label}</Badge>
                  {!d.primary && <button className="btn sm ghost" onClick={() => update((s) => { s.domains.domains.forEach((x) => (x.primary = x.id === d.id)); })}>Make primary</button>}
                  <button className="btn sm" disabled={checking === d.id} onClick={() => verify(d)}>{checking === d.id ? 'Checking…' : 'Verify DNS'}</button>
                  <button className="icon-btn sm danger" aria-label={`Remove ${d.host}`} onClick={() => update((s) => {
                    s.domains.domains = s.domains.domains.filter((x) => x.id !== d.id);
                    if (d.primary && s.domains.domains[0]) s.domains.domains[0].primary = true;
                  })}>✕</button>
                </>
              }
            >
              <div className="table-wrap">
                <table className="table dns">
                  <thead><tr><th>Type</th><th>Name / Host</th><th>Value / Points to</th><th>TTL</th><th /></tr></thead>
                  <tbody>
                    {records.map((r, i) => (
                      <tr key={i}>
                        <td><code>{r.type}</code></td>
                        <td><code>{r.name}</code></td>
                        <td><code>{r.value}</code><div className="tiny muted">{r.note}</div></td>
                        <td>3600 / Auto</td>
                        <td><Copy text={r.value} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {d.primary && <p className="hint">The primary domain is used for canonical URLs, the sitemap and social sharing. Other domains serve the same site.</p>}
            </Card>
          );
        })
      )}

      <Card title="How it works">
        <ol className="steps">
          <li>Add your domain above (we add the <code>www</code> version too).</li>
          <li>Sign in at your domain registrar and open its DNS settings.</li>
          <li>Create each record exactly as shown. Remove any old A/CNAME records for the same name.</li>
          <li>Click <strong>Verify DNS</strong>. Changes usually appear within minutes but can take up to 48 hours.</li>
          <li>Launch — HTTPS certificates are issued automatically ({site.hosting.provider === 'netlify' ? 'by Netlify' : 'by Caddy on your server'}).</li>
        </ol>
      </Card>
    </div>
  );
}
