import { useState } from 'react';
import { useSite } from '../../store';
import type { Site } from '../../types';
import { Badge, Card, Empty, PageHead } from '../../components/ui';
import { formatBytes, timeAgo } from '../../lib/util';
import { ask } from '../../components/dialog';

export function VersionsTab() {
  const { site, snapshot, restore, update, toast } = useSite();
  const [label, setLabel] = useState('');
  const launched = new Set(site.deployments.filter((d) => d.status === 'success').map((d) => d.versionId));
  const liveVersion = site.deployments.find((d) => d.status === 'success')?.versionId;

  return (
    <div className="tab-page">
      <PageHead title="Versions" subtitle="Save checkpoints and roll back instantly. A version is saved automatically on every launch." />
      <Card title="Save a version">
        <form className="row" onSubmit={(e) => {
          e.preventDefault();
          snapshot(label.trim() || `Checkpoint ${new Date().toLocaleString()}`);
          setLabel('');
          toast('Version saved');
        }}>
          <input className="grow" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Before homepage redesign" aria-label="Version label" />
          <button className="btn">Save version</button>
        </form>
      </Card>
      {site.versions.length === 0 ? (
        <Empty icon="⟲" title="No versions yet" />
      ) : (
        <Card title={`History (${site.versions.length})`}>
          <ul className="versions">
            {site.versions.map((v) => {
              const data = JSON.parse(v.snapshot) as Site;
              return (
                <li key={v.id}>
                  <div>
                    <strong>{v.label}</strong>{' '}
                    {v.id === liveVersion ? <Badge tone="good">Live</Badge> : launched.has(v.id) ? <Badge tone="info">Launched</Badge> : null}
                    <p className="tiny muted">{timeAgo(v.at)} · {data.pages.length} pages · {data.media.length} media · {formatBytes(v.snapshot.length)}</p>
                  </div>
                  <div className="row">
                    <button className="btn sm ghost" onClick={async () => { if (await ask({ title: 'Restore version?', message: `Restore “${v.label}”? Your current work is saved as a version first.`, confirmLabel: 'Restore' })) { snapshot('Before restore'); restore(v); } }}>Restore</button>
                    <button className="icon-btn sm danger" aria-label="Delete version" onClick={() => update((d) => { d.versions = d.versions.filter((x) => x.id !== v.id); })}>✕</button>
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="hint">To roll back the live site: restore a version, then Publish update.</p>
        </Card>
      )}
    </div>
  );
}
