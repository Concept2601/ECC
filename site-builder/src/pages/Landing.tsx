import { href } from '../router';
import { BRAND, BrandLogo } from '../brand/BrandLogo';

// Card accents alternate the logo's orange and (a lifted, readable) blue.
const ACCENTS = [BRAND.orange, '#6F9AD4'];

const FEATURES = [
  { icon: '✦', title: 'Design from inspiration', text: 'Start from curated layouts inspired by world-class sites, or paste any URL and we extract its palette, fonts and structure.' },
  { icon: '✎', title: 'Visual editor', text: 'Click any section to edit it. Rich text, image and video uploads, drag-free reordering and a live desktop/tablet/mobile preview.' },
  { icon: '⚡', title: 'Speed built in', text: 'Automatic WebP conversion, responsive srcset, lazy loading, minified & inlined CSS and lite video embeds.' },
  { icon: '⌕', title: 'SEO that guides you', text: 'Per-page titles, descriptions and focus keywords with live scoring, Google previews, sitemaps, schema and social cards.' },
  { icon: '☁', title: 'Hosting & domains', text: 'Publish to your own server or Netlify, connect a custom domain with exact DNS records and live verification.' },
  { icon: '🚀', title: 'One-click launch', text: 'Pre-launch checklist, versioned releases, instant rollback, plus a ZIP export for any host.' },
];

const STEPS = [
  { area: 'Front-End', items: ['Inspiration', 'Design & theme', 'Pages & menus', 'Media library', 'Speed optimisation', 'Accessibility'] },
  { area: 'Back-End', items: ['Hosting', 'Domains & DNS', 'SEO', 'Forms & integrations', 'Analytics & cookies', 'Redirects & security'] },
  { area: 'Delivery', items: ['Launch checklist', 'Publish & go live', 'Versions & rollback', 'Post-launch growth', 'Export & backup'] },
];

// In-page links must not touch the hash, which the router owns.
const jump = (id: string) => (e: React.MouseEvent) => {
  e.preventDefault();
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
};

export function Landing() {
  return (
    <div className="landing">
      <div className="l-stripes" aria-hidden="true"><i style={{ background: BRAND.orange, flex: '0 0 32%' }} /><i style={{ background: BRAND.blue }} /></div>
      <header className="l-nav">
        <a className="l-brand" href="#/" aria-label={`${BRAND.name} Studio home`}><BrandLogo size={30} suffix="Studio" /></a>
        <nav aria-label="Main">
          <a href="#features" onClick={jump('features')}>Features</a>
          <a href="#workflow" onClick={jump('workflow')}>Workflow</a>
          <a className="btn sm" href={href({ name: 'projects' })}>Open studio</a>
        </nav>
      </header>

      <main>
        <section className="l-hero">
          <div className="l-wrap">
            <div className="l-hero-logo"><BrandLogo variant="stacked" size={150} /></div>
            <p className="l-eyebrow">Design · Optimise · Host · Launch</p>
            <h1>Inspiration in.<br /><span className="l-rainbow">Launch-ready</span> out.</h1>
            <p className="l-lead">Think Different Visuals Studio is a complete website module: design from sites you love, polish every page with a visual editor, and ship to your own domain with SEO and performance handled for you.</p>
            <div className="l-actions">
              <a className="btn lg" href={href({ name: 'projects' })}>Start building — it’s free</a>
              <a className="btn lg ghost" href="#workflow" onClick={jump('workflow')}>See how it works</a>
            </div>
            <ul className="l-proof">
              <li><b>8</b> pro inspirations</li>
              <li><b>14</b> section types</li>
              <li><b>3</b> launch targets</li>
              <li><b>100%</b> responsive</li>
            </ul>
          </div>
          <div className="l-shot" aria-hidden="true">
            <div className="l-shot-bar"><i /><i /><i /><span>Front-End · Design</span></div>
            <div className="l-shot-body">
              <div className="l-shot-side">{['Hero', 'Features', 'Stats', 'Testimonials', 'Pricing', 'Contact'].map((s, i) => <span key={s} className={i === 0 ? 'on' : ''}>{s}</span>)}</div>
              <div className="l-shot-canvas">
                <div className="l-shot-hero"><b /><b className="short" /><em /></div>
                <div className="l-shot-cards"><span /><span /><span /></div>
              </div>
              <div className="l-shot-panel"><span className="ring">94</span><i /><i /><i className="short" /></div>
            </div>
          </div>
        </section>

        <section id="features" className="l-section">
          <div className="l-wrap">
            <h2>Everything to go from idea to live website</h2>
            <div className="l-grid">
              {FEATURES.map((f, i) => (
                <article key={f.title} className="l-card" style={{ '--c': ACCENTS[i % ACCENTS.length] } as React.CSSProperties}>
                  <span className="l-icon" aria-hidden="true">{f.icon}</span>
                  <h3>{f.title}</h3>
                  <p>{f.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="workflow" className="l-section alt">
          <div className="l-wrap">
            <h2>Three workspaces. One clear path to launch.</h2>
            <div className="l-steps">
              {STEPS.map((s, i) => (
                <article key={s.area} className="l-step" style={{ '--g': [BRAND.orange, BRAND.blue, `linear-gradient(135deg, ${BRAND.orange} 0 45%, ${BRAND.blue} 45%)`][i] } as React.CSSProperties}>
                  <span className="l-step-n">{i + 1}</span>
                  <h3>{s.area}</h3>
                  <ul>{s.items.map((it) => <li key={it}>{it}</li>)}</ul>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="l-section l-cta">
          <div className="l-wrap">
            <h2>Think different. <span className="l-rainbow">Launch</span> visually.</h2>
            <p>No lock-in: export clean static HTML any time.</p>
            <a className="btn lg light" href={href({ name: 'projects' })}>Open the studio</a>
          </div>
        </section>
      </main>
      <footer className="l-foot"><div className="l-wrap">© {new Date().getFullYear()} {BRAND.name} · Works offline · Your projects stay in your browser until you publish.</div></footer>
    </div>
  );
}
