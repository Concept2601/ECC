import { useState } from 'react';
import { useSite } from '../../store';
import { fetchSubmissions, type FormSubmission } from '../../lib/deploy';
import { downloadBlob } from '../../lib/storage';
import type { IntegrationSettings } from '../../types';
import { Area, Card, Empty, PageHead, Segmented, Text, Toggle } from '../../components/ui';

const csvCell = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;

function Inbox() {
  const { site, toast } = useSite();
  const [rows, setRows] = useState<FormSubmission[]>();
  const [busy, setBusy] = useState(false);
  const load = async () => {
    setBusy(true);
    try {
      setRows(await fetchSubmissions(site));
    } catch (err) {
      toast((err as Error).message, 'err');
    } finally {
      setBusy(false);
    }
  };
  const exportCsv = () => {
    if (!rows) return;
    const head = ['Date', 'Page', 'Name', 'Email', 'Phone', 'Message'];
    const body = rows.map((r) => [new Date(r.at).toISOString(), r.page, r.name, r.email, r.phone, r.message].map(csvCell).join(','));
    downloadBlob([head.join(','), ...body].join('\n'), `${site.hosting.slug}-leads.csv`, 'text/csv');
  };
  return (
    <Card
      title="Form submissions"
      subtitle="Messages sent through contact forms on your live site (TDV hosting server)."
      actions={
        <>
          {rows?.length ? <button className="btn sm ghost" onClick={exportCsv}>Export CSV</button> : null}
          <button className="btn sm" onClick={load} disabled={busy}>{busy ? 'Loading…' : rows ? 'Refresh' : 'Load inbox'}</button>
        </>
      }
    >
      {rows === undefined ? (
        <p className="muted">Load the inbox to see enquiries.</p>
      ) : rows.length === 0 ? (
        <Empty icon="✉" title="No submissions yet" />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Date</th><th>From</th><th>Message</th><th>Page</th></tr></thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <td className="nowrap">{new Date(r.at).toLocaleString()}</td>
                  <td><strong>{r.name}</strong><br /><a href={`mailto:${r.email}`}>{r.email}</a>{r.phone && <><br />{r.phone}</>}</td>
                  <td className="pre-wrap">{r.message}</td>
                  <td>{r.page}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

export function IntegrationsTab() {
  const { site, update } = useSite();
  const i = site.integrations;
  const set = <K extends keyof IntegrationSettings>(k: K, v: IntegrationSettings[K]) => update((d) => { d.integrations[k] = v; }, `int-${k}`);
  const hasTracking = !!(i.ga4Id || i.metaPixelId);

  return (
    <div className="tab-page">
      <PageHead title="Forms & Integrations" subtitle="Capture leads, measure traffic and connect the tools you already use." />
      <div className="grid-2col">
        <Card title="Contact forms" subtitle="Every Contact form section posts here. Spam is filtered with a honeypot and rate limiting.">
          <Segmented value={i.formEndpoint} onChange={(v) => set('formEndpoint', v)} options={[{ value: 'self', label: 'Studio inbox' }, { value: 'custom', label: 'Custom endpoint' }]} />
          {i.formEndpoint === 'self' ? (
            <p className="hint">Submissions are stored on your TDV hosting server and appear in the inbox below. Works even when the site itself is hosted on Netlify or elsewhere.</p>
          ) : (
            <Text label="Form action URL" value={i.customFormAction} onChange={(v) => set('customFormAction', v.trim())} placeholder="https://formspree.io/f/xxxx" hint="Any service that accepts standard form POSTs (Formspree, Basin, Getform, Zapier/Make webhooks, your CRM…)." />
          )}
        </Card>
        <Card title="Live chat">
          <Text label="WhatsApp number" value={i.whatsappNumber} onChange={(v) => set('whatsappNumber', v)} placeholder="+263 77 123 4567" hint="Adds a floating WhatsApp chat button to every page." />
        </Card>
      </div>
      {i.formEndpoint === 'self' && <Inbox />}
      <div className="grid-2col">
        <Card title="Analytics">
          <Text label="Google Analytics 4 measurement ID" value={i.ga4Id} onChange={(v) => set('ga4Id', v.trim())} placeholder="G-XXXXXXXXXX" />
          <Text label="Plausible domain (privacy-friendly, cookieless)" value={i.plausibleDomain} onChange={(v) => set('plausibleDomain', v.trim())} placeholder="yourbusiness.com" />
          <Text label="Meta (Facebook) Pixel ID" value={i.metaPixelId} onChange={(v) => set('metaPixelId', v.trim())} placeholder="1234567890" />
        </Card>
        <Card title="Privacy & cookies">
          <Toggle label="Show cookie consent banner" hint={hasTracking ? 'Google Analytics and Meta Pixel only load after visitors accept.' : 'Recommended once you add Google Analytics or a Meta Pixel.'} checked={i.cookieBanner} onChange={(v) => set('cookieBanner', v)} />
          {i.cookieBanner && <Area label="Banner text" value={i.cookieText} onChange={(v) => set('cookieText', v)} rows={2} />}
          {hasTracking && !i.cookieBanner && <p className="warn-box">You use cookie-based tracking without a consent banner. This may breach GDPR / POPIA-style privacy laws.</p>}
        </Card>
      </div>
      <Card title="Custom code" subtitle="For verification tags, chat widgets, booking tools or anything else. Inserted on every page of the live site (not in the editor preview).">
        <Area label="Before </head>" value={i.headCode} onChange={(v) => set('headCode', v)} rows={4} mono placeholder="<script src=…></script>" />
        <Area label="Before </body>" value={i.bodyCode} onChange={(v) => set('bodyCode', v)} rows={4} mono />
        <p className="hint">Only paste code from sources you trust — it runs on your live site.</p>
      </Card>
    </div>
  );
}
