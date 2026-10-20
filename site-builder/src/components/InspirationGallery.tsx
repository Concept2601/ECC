import { useState } from 'react';
import { INSPIRATIONS, type Inspiration, type InspectResult } from '../lib/inspirations';
import { readableOn } from '../lib/color';
import { DEFAULT_THEME } from '../lib/defaults';
import { DEMO, DEMO_NOTE } from '../demo';

export function InspirationCard({ insp, onUse, actionLabel = 'Use this' }: { insp: Inspiration; onUse: (i: Inspiration) => void; actionLabel?: string }) {
  const t = { ...DEFAULT_THEME, ...insp.theme };
  const heroDark = insp.pages[0].blocks[0][1]?.tone === 'dark' || insp.pages[0].blocks[0][1]?.layout === 'cover';
  return (
    <article className="insp">
      <div className="insp-mock" style={{ background: t.background, fontFamily: `"${t.bodyFont}", system-ui`, color: t.text }} aria-hidden="true">
        <div className="insp-nav"><b style={{ fontFamily: `"${t.headingFont}"` }}>Brand</b><i /><i /><i /></div>
        <div className="insp-hero" style={{ background: heroDark ? t.dark : t.background, color: heroDark ? readableOn(t.dark) : t.text }}>
          <span className="insp-h" style={{ fontFamily: `"${t.headingFont}"`, fontWeight: t.headingWeight }}>{insp.pages[0].blocks[0][1]?.heading?.slice(0, 34) ?? insp.name}</span>
          <span className="insp-btn" style={{ background: t.primary, color: readableOn(t.primary), borderRadius: t.buttonStyle === 'pill' ? 99 : t.radius / 2 }}>Button</span>
        </div>
        <div className="insp-cards">
          {[0, 1, 2].map((i) => <span key={i} style={{ background: t.surface, borderRadius: t.radius / 2 }}><em style={{ background: i === 1 ? t.accent : t.primary }} /></span>)}
        </div>
      </div>
      <div className="insp-body">
        <div className="row between">
          <h3>{insp.name}</h3>
          <span className="swatches">{[t.primary, t.accent, t.dark].map((c) => <i key={c} style={{ background: c }} />)}</span>
        </div>
        <p className="muted small">{insp.description}</p>
        <p className="tiny muted">Inspired by {insp.inspiredBy} · {insp.pages.length} pages · {t.headingFont}</p>
        <button className="btn sm" onClick={() => onUse(insp)}>{actionLabel}</button>
      </div>
    </article>
  );
}

export function InspirationGallery({ onUse, actionLabel }: { onUse: (i: Inspiration) => void; actionLabel?: string }) {
  const cats = ['All', ...new Set(INSPIRATIONS.map((i) => i.category))];
  const [cat, setCat] = useState('All');
  const list = INSPIRATIONS.filter((i) => cat === 'All' || i.category === cat);
  return (
    <div>
      <div className="chips" role="tablist" aria-label="Categories">
        {cats.map((c) => (
          <button key={c} role="tab" aria-selected={c === cat} className={`chip${c === cat ? ' on' : ''}`} onClick={() => setCat(c)}>{c}</button>
        ))}
      </div>
      <div className="insp-grid">
        {list.map((i) => <InspirationCard key={i.id} insp={i} onUse={onUse} actionLabel={actionLabel} />)}
      </div>
    </div>
  );
}

/** Analyse a live site through the server and hand back its design DNA. */
export function UrlInspector({ onResult, serverUrl = '' }: { onResult: (r: InspectResult) => void; serverUrl?: string }) {
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<InspectResult>();

  const go = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`${serverUrl.replace(/\/$/, '')}/api/inspect?url=${encodeURIComponent(url.trim())}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Analysis failed');
      setResult(json);
    } catch (err) {
      setError(DEMO ? `Analysing a live website ${DEMO_NOTE} Try the curated inspirations instead.` : (err as Error).message === 'Failed to fetch' ? 'The studio server is not reachable. Start it with `npm run dev`.' : (err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="inspector">
      <form className="row" onSubmit={go}>
        <input className="grow" type="url" inputMode="url" placeholder="https://a-site-you-love.com" value={url} onChange={(e) => setUrl(e.target.value)} aria-label="Inspiration website URL" />
        <button className="btn" disabled={busy}>{busy ? 'Analysing…' : 'Analyse'}</button>
      </form>
      {error && <p className="error">{error}</p>}
      {result && (
        <div className="inspect-result">
          <div>
            <h4>{result.title || result.url}</h4>
            {result.description && <p className="muted small">{result.description}</p>}
          </div>
          <dl className="kv">
            <dt>Palette</dt>
            <dd className="swatches lg">{result.colors.length ? result.colors.map((c) => <i key={c} style={{ background: c }} title={c} />) : <span className="muted">No brand colours found</span>}</dd>
            <dt>Fonts</dt>
            <dd>{result.fonts.join(', ') || <span className="muted">System fonts</span>}</dd>
            <dt>Navigation</dt>
            <dd>{result.navLabels.join(' · ') || <span className="muted">—</span>}</dd>
            <dt>Layout</dt>
            <dd className="chips">{result.sections.map((s, i) => <span className="chip on static" key={i}>{s}</span>)}</dd>
          </dl>
          <p className="tiny muted">We recreate the structure and style with your own content — never copy another site’s text or images.</p>
          <button className="btn" onClick={() => onResult(result)}>Use this as inspiration</button>
        </div>
      )}
    </div>
  );
}
