import { useMemo, useRef } from 'react';
import { useSite } from '../../store';
import { buildSite, filesSize, primaryDomain } from '../../lib/render';
import { createZip } from '../../lib/zip';
import { downloadBlob } from '../../lib/storage';
import { formatBytes, slugify } from '../../lib/util';
import { Card, PageHead } from '../../components/ui';
import type { Site } from '../../types';
import { ask } from '../../components/dialog';

export function ExportTab() {
  const { site, update, snapshot, toast } = useSite();
  const input = useRef<HTMLInputElement>(null);
  const files = useMemo(() => buildSite(site, primaryDomain(site)), [site]);
  const names = Object.keys(files).sort();
  const base = slugify(site.name) || 'site';

  const restoreFrom = async (file: File) => {
    try {
      const data = JSON.parse(await file.text()) as Site;
      if (!data.pages || !data.theme) throw new Error('Not a studio backup file.');
      if (!(await ask({ title: 'Restore backup?', message: `Replace this project with “${data.name}” from the backup? Your current work is saved as a version first.`, confirmLabel: 'Restore' }))) return;
      snapshot('Before backup restore');
      update((d) => {
        const keep = { id: d.id, versions: d.versions, deployments: d.deployments };
        Object.assign(d, data, keep);
      });
      toast('Backup restored');
    } catch (err) {
      toast((err as Error).message, 'err');
    }
  };

  return (
    <div className="tab-page">
      <PageHead title="Export & backup" subtitle="Your site, your files. Take them anywhere." />
      <div className="grid-2col">
        <Card title="Static website (ZIP)" subtitle={`${names.length} files · ${formatBytes(filesSize(files))}`} actions={<button className="btn" onClick={() => downloadBlob(createZip(files), `${base}.zip`, 'application/zip')}>Download ZIP</button>}>
          <ul className="file-list">
            {names.slice(0, 40).map((n) => <li key={n}><code>{n}</code></li>)}
            {names.length > 40 && <li className="muted">…and {names.length - 40} more</li>}
          </ul>
        </Card>
        <Card title="Project backup (JSON)" subtitle="Everything: pages, theme, media, settings and history. Import it into any copy of the studio.">
          <div className="row wrap">
            <button className="btn" onClick={() => downloadBlob(JSON.stringify(site), `${base}-backup-${new Date().toISOString().slice(0, 10)}.json`, 'application/json')}>Download backup</button>
            <input ref={input} type="file" accept="application/json" hidden onChange={(e) => e.target.files?.[0] && restoreFrom(e.target.files[0])} />
            <button className="btn ghost" onClick={() => input.current?.click()}>Restore from backup…</button>
          </div>
          <p className="hint">Projects are stored in this browser. Download a backup regularly or before clearing browser data.</p>
        </Card>
      </div>
    </div>
  );
}
