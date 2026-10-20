import { useSite } from '../../store';
import type { SiteSettings } from '../../types';
import { uid } from '../../lib/util';
import { Area, Card, PageHead, Text, Toggle } from '../../components/ui';
import { MediaField } from '../../components/MediaPicker';

const NETWORKS = ['facebook', 'instagram', 'x', 'linkedin', 'youtube', 'tiktok', 'github'];

export function SettingsTab() {
  const { site, update } = useSite();
  const s = site.settings;
  const set = <K extends keyof SiteSettings>(k: K, v: SiteSettings[K]) => update((d) => { d.settings[k] = v; }, `set-${k}`);

  return (
    <div className="tab-page">
      <PageHead title="Site settings" subtitle="Branding, navigation extras, redirects and access control." />
      <div className="grid-2col">
        <Card title="Branding">
          <MediaField label="Logo" value={s.logoId} onChange={(v) => set('logoId', v)} />
          <Text label="Logo text" value={s.logoText} onChange={(v) => set('logoText', v)} hint="Shown next to (or instead of) the logo image." />
          <MediaField label="Favicon (square, 512×512 ideal)" value={s.favicon} onChange={(v) => set('favicon', v)} />
          <Text label="Announcement bar" value={s.announcement} onChange={(v) => set('announcement', v)} placeholder="Free delivery this week only!" />
          <Text label="Footer text" value={s.footerText} onChange={(v) => set('footerText', v)} />
        </Card>
        <Card title="Social profiles" actions={<button className="btn sm ghost" onClick={() => update((d) => { d.settings.socials.push({ id: uid('soc'), network: 'instagram', url: '' }); })}>＋ Add</button>}>
          {s.socials.length === 0 && <p className="muted">Links appear in the footer and in your structured data.</p>}
          {s.socials.map((x) => (
            <div key={x.id} className="row">
              <select value={x.network} onChange={(e) => update((d) => { d.settings.socials.find((y) => y.id === x.id)!.network = e.target.value; })} aria-label="Network">
                {NETWORKS.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
              <input className="grow" value={x.url} placeholder="https://…" onChange={(e) => update((d) => { d.settings.socials.find((y) => y.id === x.id)!.url = e.target.value; }, `soc-${x.id}`)} aria-label="Profile URL" />
              <button className="icon-btn sm danger" onClick={() => update((d) => { d.settings.socials = d.settings.socials.filter((y) => y.id !== x.id); })} aria-label="Remove">✕</button>
            </div>
          ))}
        </Card>
      </div>

      <div className="grid-2col">
        <Card title="Redirects" subtitle="Keep old links and search rankings working when URLs change." actions={<button className="btn sm ghost" onClick={() => update((d) => { d.redirects.push({ id: uid('rd'), from: '/old-page', to: '/', code: 301 }); })}>＋ Add</button>}>
          {site.redirects.length === 0 && <p className="muted">No redirects.</p>}
          {site.redirects.map((r) => (
            <div key={r.id} className="row">
              <input value={r.from} onChange={(e) => update((d) => { d.redirects.find((x) => x.id === r.id)!.from = e.target.value; }, `rd-${r.id}`)} aria-label="From path" />
              <span aria-hidden="true">→</span>
              <input className="grow" value={r.to} onChange={(e) => update((d) => { d.redirects.find((x) => x.id === r.id)!.to = e.target.value; }, `rd-${r.id}`)} aria-label="To URL" />
              <select value={r.code} onChange={(e) => update((d) => { d.redirects.find((x) => x.id === r.id)!.code = Number(e.target.value) as 301 | 302; })} aria-label="Redirect type">
                <option value={301}>301 permanent</option>
                <option value={302}>302 temporary</option>
              </select>
              <button className="icon-btn sm danger" onClick={() => update((d) => { d.redirects = d.redirects.filter((x) => x.id !== r.id); })} aria-label="Remove">✕</button>
            </div>
          ))}
        </Card>
        <Card title="404 page" subtitle="Shown when a visitor follows a broken link.">
          <Text label="Heading" value={s.notFoundHeading} onChange={(v) => set('notFoundHeading', v)} />
          <Area label="Message" value={s.notFoundBody} onChange={(v) => set('notFoundBody', v)} rows={2} />
        </Card>
      </div>

      <Card title="Access & security">
        <Toggle label="Maintenance / coming-soon mode" hint="Publishes a single “launching soon” page and hides the site from search engines." checked={s.maintenanceMode} onChange={(v) => set('maintenanceMode', v)} />
        <Toggle label="Password-protect the site" hint={site.hosting.provider === 'self' ? 'Visitors must enter the password (HTTP authentication, enforced by your Launchpad server).' : 'Only enforced on the Launchpad server. Netlify requires its paid plan; ZIP hosts need their own protection.'} checked={s.passwordProtect} onChange={(v) => set('passwordProtect', v)} />
        {s.passwordProtect && <Text label="Site password" type="password" value={s.password} onChange={(v) => set('password', v)} hint="Visitors can enter any username." />}
      </Card>
    </div>
  );
}
