import { useSite } from '../../store';
import { primaryDomain } from '../../lib/render';
import { Card, PageHead } from '../../components/ui';

export function GrowthTab() {
  const { site } = useSite();
  const live = site.deployments.find((d) => d.status === 'success' && d.url)?.url;
  const domain = primaryDomain(site);
  const url = domain ? `${domain}/` : live;
  const enc = encodeURIComponent(url ?? '');
  const text = encodeURIComponent(`Check out our new website: ${site.name}`);

  const tasks: { title: string; text: string; href?: string; cta: string }[] = [
    { title: 'Submit to Google Search Console', text: 'Verify your domain (paste the code in SEO → Site-wide), then submit your sitemap so Google indexes every page.', href: 'https://search.google.com/search-console', cta: 'Open Search Console' },
    { title: 'Submit to Bing Webmaster Tools', text: 'Covers Bing, Yahoo, DuckDuckGo and ChatGPT search. You can import straight from Google Search Console.', href: 'https://www.bing.com/webmasters', cta: 'Open Bing Webmaster' },
    { title: 'Test real-world speed', text: 'Run Google PageSpeed Insights on the live URL to confirm Core Web Vitals.', href: url ? `https://pagespeed.web.dev/analysis?url=${enc}` : undefined, cta: 'Run PageSpeed' },
    { title: 'Validate rich results', text: 'Check your structured data (business details, FAQs, breadcrumbs).', href: url ? `https://search.google.com/test/rich-results?url=${enc}` : undefined, cta: 'Rich Results Test' },
    { title: 'Claim your Google Business Profile', text: 'Essential for local businesses: appear on Maps and the local pack, and link to your new site.', href: 'https://business.google.com', cta: 'Open Business Profile' },
    { title: 'Check social cards', text: 'Preview and refresh how your links look when shared on LinkedIn.', href: url ? `https://www.linkedin.com/post-inspector/inspect/${enc}` : undefined, cta: 'Post Inspector' },
  ];

  return (
    <div className="tab-page">
      <PageHead title="Post-launch" subtitle="Launching is the start. These steps get you traffic and keep the site healthy." />
      {!url && <p className="warn-box">Launch your site (or connect a domain) to unlock URL-specific tools below.</p>}
      {url && (
        <Card title="Share your launch" subtitle={url}>
          <div className="row wrap">
            <a className="btn ghost" target="_blank" rel="noopener" href={`https://wa.me/?text=${text}%20${enc}`}>WhatsApp</a>
            <a className="btn ghost" target="_blank" rel="noopener" href={`https://www.linkedin.com/sharing/share-offsite/?url=${enc}`}>LinkedIn</a>
            <a className="btn ghost" target="_blank" rel="noopener" href={`https://www.facebook.com/sharer/sharer.php?u=${enc}`}>Facebook</a>
            <a className="btn ghost" target="_blank" rel="noopener" href={`https://x.com/intent/post?text=${text}&url=${enc}`}>X</a>
            <a className="btn ghost" href={`mailto:?subject=${text}&body=${enc}`}>Email</a>
          </div>
        </Card>
      )}
      <div className="task-grid">
        {tasks.map((t, i) => (
          <Card key={t.title} className="task">
            <span className="step">{i + 1}</span>
            <h3>{t.title}</h3>
            <p className="muted small">{t.text}</p>
            {t.href ? <a className="btn sm" href={t.href} target="_blank" rel="noopener">{t.cta} ↗</a> : <span className="tiny muted">Available after launch</span>}
          </Card>
        ))}
      </div>
      <Card title="Keep it healthy">
        <ul className="ticks">
          <li>Review form submissions weekly in Back-End → Forms & Integrations.</li>
          <li>Publish fresh content monthly — new pages and FAQs help rankings.</li>
          <li>Re-run the launch checklist before every major update.</li>
          <li>Download a backup after big changes (Export & backup).</li>
          {site.domains.domains.length > 0 && <li>Renew <strong>{site.domains.domains[0].host}</strong> before it expires — turn on auto-renew at your registrar.</li>}
        </ul>
      </Card>
    </div>
  );
}
