import { useMemo, useState } from 'react';
import { useSite } from '../../store';
import { deploy } from '../../lib/deploy';
import { blockers, launchChecklist } from '../../lib/launch';
import { primaryDomain } from '../../lib/render';
import { formatBytes, timeAgo, uid } from '../../lib/util';
import { href } from '../../router';
import { Badge, Card, PageHead } from '../../components/ui';
import type { Deployment } from '../../types';

const TARGET = { self: 'TDV hosting server', netlify: 'Netlify', zip: 'ZIP download' };

export function LaunchTab() {
  const { site, update, snapshot, toast } = useSite();
  const [log, setLog] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Deployment>();
  const block = useMemo(() => blockers(launchChecklist(site)), [site]);
  const h = site.hosting;
  const domain = primaryDomain(site);
  const last = site.deployments[0];

  const launch = async () => {
    if (block.length && !window.confirm(`${block.length} checklist blocker(s) remain:\n\n• ${block.map((b) => b.label).join('\n• ')}\n\nLaunch anyway?`)) return;
    setBusy(true);
    setLog([]);
    setResult(undefined);
    const lines: string[] = [];
    const push = (l: string) => {
      lines.push(l);
      setLog([...lines]);
    };
    const version = snapshot(`Launch ${new Date().toLocaleString()}`);
    let dep: Deployment;
    try {
      const r = await deploy(site, push);
      dep = { id: uid('dep'), at: Date.now(), provider: h.provider, url: r.url, status: 'success', message: r.message, versionId: version.id, bytes: r.bytes };
      update((d) => {
        if (r.netlifySiteId) d.hosting.netlifySiteId = r.netlifySiteId;
        if (r.netlifyHost) d.hosting.netlifyHost = r.netlifyHost;
      });
      push(h.provider === 'zip' ? '✓ Export complete.' : `✓ Live at ${r.url}`);
      toast(h.provider === 'zip' ? 'Site exported' : 'Your site is live 🚀');
    } catch (err) {
      const msg = (err as Error).message === 'Failed to fetch' ? 'Could not reach the TDV hosting server. Is it running? (npm run dev / npm start)' : (err as Error).message;
      push(`✕ ${msg}`);
      dep = { id: uid('dep'), at: Date.now(), provider: h.provider, status: 'failed', message: msg, versionId: version.id, bytes: 0 };
      toast('Launch failed', 'err');
    }
    update((d) => {
      d.deployments = [dep, ...d.deployments].slice(0, 50);
    });
    setResult(dep);
    setBusy(false);
  };

  return (
    <div className="tab-page">
      <PageHead title="Launch" subtitle="Build an optimised production version of your site and put it online." />
      <div className="launch-hero">
        <div>
          <p className="eyebrow">Ready for take-off</p>
          <h2>{site.name}</h2>
          <dl className="kv">
            <dt>Target</dt><dd>{TARGET[h.provider]} <a className="link" href={href({ name: 'studio', siteId: site.id, area: 'backend', tab: 'hosting' })}>change</a></dd>
            <dt>Address</dt>
            <dd>{domain && !site.domains.domains.some((d) => d.primary && d.status === 'verified') && <Badge tone="warn">DNS pending</Badge>} {domain ?? (h.provider === 'self' ? `${h.serverUrl || window.location.origin}/sites/${h.slug}/` : h.provider === 'netlify' ? `${h.slug}.netlify.app` : 'Your host')}{' '}<a className="link" href={href({ name: 'studio', siteId: site.id, area: 'backend', tab: 'domains' })}>{domain ? 'domains' : 'connect a domain'}</a></dd>
            <dt>Pages</dt><dd>{site.pages.length}</dd>
            <dt>Checklist</dt><dd>{block.length ? <Badge tone="bad">{block.length} blocker(s)</Badge> : <Badge tone="good">Ready</Badge>} <a className="link" href={href({ name: 'studio', siteId: site.id, area: 'delivery', tab: 'checklist' })}>review</a></dd>
          </dl>
        </div>
        <button className="btn xl launch" onClick={launch} disabled={busy}>
          {busy ? 'Launching…' : h.provider === 'zip' ? '⇩ Export site' : last?.status === 'success' ? '🚀 Publish update' : '🚀 Launch website'}
        </button>
      </div>

      {log.length > 0 && (
        <Card title="Launch log">
          <ol className="log" aria-live="polite">{log.map((l, i) => <li key={i} className={l.startsWith('✕') ? 'bad' : l.startsWith('✓') ? 'good' : ''}>{l}</li>)}</ol>
          {result?.status === 'success' && result.url && (
            <div className="success">
              <h3>🎉 You’re live!</h3>
              <p><a href={result.url} target="_blank" rel="noopener">{result.url}</a></p>
              <div className="row">
                <a className="btn" href={result.url} target="_blank" rel="noopener">Visit site ↗</a>
                <a className="btn ghost" href={href({ name: 'studio', siteId: site.id, area: 'delivery', tab: 'growth' })}>Next: get found on Google →</a>
              </div>
            </div>
          )}
        </Card>
      )}

      <Card title="Deployment history">
        {site.deployments.length === 0 ? (
          <p className="muted">No launches yet.</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>When</th><th>Target</th><th>Status</th><th>Size</th><th>Details</th></tr></thead>
              <tbody>
                {site.deployments.map((d) => (
                  <tr key={d.id}>
                    <td className="nowrap">{timeAgo(d.at)}</td>
                    <td>{TARGET[d.provider]}</td>
                    <td>{d.status === 'success' ? <Badge tone="good">Success</Badge> : <Badge tone="bad">Failed</Badge>}</td>
                    <td>{d.bytes ? formatBytes(d.bytes) : '—'}</td>
                    <td>{d.url ? <a href={d.url} target="_blank" rel="noopener">{d.url}</a> : d.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="hint">Every launch saves a version — roll back any time from Versions.</p>
      </Card>
    </div>
  );
}
