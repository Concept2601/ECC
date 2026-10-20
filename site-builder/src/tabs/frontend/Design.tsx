import { useCallback, useEffect, useState } from 'react';
import { useSite } from '../../store';
import type { Block, BlockType, Item, Theme } from '../../types';
import { BLOCKS, blockMeta, createBlock, newItem } from '../../lib/blocks';
import { FONT_OPTIONS } from '../../lib/defaults';
import { contrastRatio, readableOn } from '../../lib/color';
import { clone, uid } from '../../lib/util';
import { Preview, scrollPreviewTo, type Device } from '../../components/Preview';
import { RichText } from '../../components/RichText';
import { MediaField } from '../../components/MediaPicker';
import { Area, Color, Modal, Segmented, Select, Text, Toggle } from '../../components/ui';

const PALETTES: { name: string; theme: Partial<Theme> }[] = [
  { name: 'Think Different', theme: { primary: '#1d1d1f', accent: '#009ddc', background: '#ffffff', surface: '#f5f5f7', text: '#1d1d1f', muted: '#6e6e73', dark: '#000000' } },
  { name: 'Spectrum Blue', theme: { primary: '#0077a8', accent: '#61bb46', background: '#ffffff', surface: '#f2f8fb', text: '#1d1d1f', muted: '#5f6670', dark: '#000000' } },
  { name: 'Spectrum Purple', theme: { primary: '#963d97', accent: '#fdb827', background: '#ffffff', surface: '#f8f2f8', text: '#1d1d1f', muted: '#655d66', dark: '#120612' } },
  { name: 'Spectrum Red', theme: { primary: '#c9302c', accent: '#fdb827', background: '#ffffff', surface: '#fbf3f2', text: '#1d1d1f', muted: '#6b5d5c', dark: '#140606' } },
  { name: 'Indigo', theme: { primary: '#4f46e5', accent: '#f59e0b', background: '#ffffff', surface: '#f5f6fa', text: '#111827', muted: '#5b6475', dark: '#0f172a' } },
  { name: 'Ocean', theme: { primary: '#0e7490', accent: '#f97316', background: '#ffffff', surface: '#f0f9fb', text: '#0f1f2a', muted: '#4b6170', dark: '#082f3a' } },
  { name: 'Forest', theme: { primary: '#047857', accent: '#facc15', background: '#ffffff', surface: '#f1f7f3', text: '#11201a', muted: '#4f6158', dark: '#0b2219' } },
  { name: 'Ember', theme: { primary: '#c2410c', accent: '#0ea5e9', background: '#fffaf6', surface: '#fbeee4', text: '#24140b', muted: '#6b5547', dark: '#1f0f07' } },
  { name: 'Rose', theme: { primary: '#be185d', accent: '#22d3ee', background: '#ffffff', surface: '#fdf2f7', text: '#1f1020', muted: '#6b5463', dark: '#200a17' } },
  { name: 'Mono', theme: { primary: '#111111', accent: '#e11d48', background: '#ffffff', surface: '#f3f3f3', text: '#111111', muted: '#555555', dark: '#0a0a0a' } },
  { name: 'Midnight', theme: { primary: '#818cf8', accent: '#34d399', background: '#0b1020', surface: '#141a2e', text: '#e5e7f0', muted: '#a3a9bd', dark: '#05070f' } },
];

function ThemePanel() {
  const { site, update } = useSite();
  const t = site.theme;
  const set = <K extends keyof Theme>(k: K, v: Theme[K]) => update((d) => { d.theme[k] = v; }, `theme-${k}`);
  const textContrast = contrastRatio(t.text, t.background);
  const btnContrast = contrastRatio(readableOn(t.primary), t.primary);
  return (
    <div className="inspector-body">
      <h3>Theme</h3>
      <p className="muted small">Global styles applied to every page.</p>
      <div className="field">
        <span className="field-label">Palettes</span>
        <div className="palettes">
          {PALETTES.map((p) => (
            <button key={p.name} type="button" className="palette" title={p.name} onClick={() => update((d) => { Object.assign(d.theme, p.theme); })}>
              <span className="pal-dots">{[p.theme.primary, p.theme.accent, p.theme.dark].map((c) => <i key={c} style={{ background: c }} />)}</span>
              <span>{p.name}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="grid2">
        <Color label="Primary" value={t.primary} onChange={(v) => set('primary', v)} />
        <Color label="Accent" value={t.accent} onChange={(v) => set('accent', v)} />
        <Color label="Background" value={t.background} onChange={(v) => set('background', v)} />
        <Color label="Surface" value={t.surface} onChange={(v) => set('surface', v)} />
        <Color label="Text" value={t.text} onChange={(v) => set('text', v)} />
        <Color label="Muted text" value={t.muted} onChange={(v) => set('muted', v)} />
        <Color label="Dark sections" value={t.dark} onChange={(v) => set('dark', v)} />
      </div>
      {(textContrast < 4.5 || btnContrast < 4.5) && (
        <p className="warn-box">Low contrast: text {textContrast}:1, buttons {btnContrast}:1. WCAG AA needs 4.5:1.</p>
      )}
      <div className="grid2">
        <Select label="Heading font" value={t.headingFont} options={FONT_OPTIONS} onChange={(v) => set('headingFont', v)} />
        <Select label="Body font" value={t.bodyFont} options={FONT_OPTIONS} onChange={(v) => set('bodyFont', v)} />
        <Select label="Heading weight" value={t.headingWeight} options={[{ value: 500, label: 'Medium' }, { value: 600, label: 'Semibold' }, { value: 700, label: 'Bold' }, { value: 800, label: 'Extra bold' }]} onChange={(v) => set('headingWeight', v)} />
        <Select label="Body size" value={t.baseSize} options={[15, 16, 17, 18, 19, 20].map((n) => ({ value: n, label: `${n}px` }))} onChange={(v) => set('baseSize', v)} />
      </div>
      <label className="field">
        <span className="field-label">Corner radius — {t.radius}px</span>
        <input type="range" min={0} max={28} value={t.radius} onChange={(e) => set('radius', Number(e.target.value))} />
      </label>
      <label className="field">
        <span className="field-label">Content width — {t.maxWidth}px</span>
        <input type="range" min={960} max={1440} step={20} value={t.maxWidth} onChange={(e) => set('maxWidth', Number(e.target.value))} />
      </label>
      <Segmented label="Buttons" value={t.buttonStyle} onChange={(v) => set('buttonStyle', v)} options={[{ value: 'solid', label: 'Solid' }, { value: 'pill', label: 'Pill' }, { value: 'outline', label: 'Outline' }]} />
    </div>
  );
}

const ITEM_FIELD_LABEL: Partial<Record<keyof Item, string>> = { icon: 'Icon / emoji', title: 'Title', text: 'Text', price: 'Price', features: 'Features (one per line)', link: 'Link', mediaId: 'Image' };

function ItemsEditor({ block, onChange }: { block: Block; onChange: (items: Item[]) => void }) {
  const meta = blockMeta(block.type);
  const items = block.items ?? [];
  const [open, setOpen] = useState<string | undefined>(items[0]?.id);
  const labels: Partial<Record<keyof Item, string>> =
    block.type === 'testimonials' ? { text: 'Quote', title: 'Name', icon: 'Role / company', mediaId: 'Photo' }
      : block.type === 'stats' ? { title: 'Number', text: 'Label' }
        : block.type === 'faq' ? { title: 'Question', text: 'Answer' }
          : block.type === 'team' ? { title: 'Name', text: 'Role', mediaId: 'Photo' }
            : block.type === 'logos' ? { title: 'Company name', mediaId: 'Logo' }
              : block.type === 'gallery' ? { title: 'Caption' }
                : {};
  const set = (id: string, patch: Partial<Item>) => onChange(items.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  const move = (i: number, dir: -1 | 1) => {
    const next = [...items];
    const j = i + dir;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  return (
    <div className="items">
      <div className="row between">
        <span className="field-label">{meta.itemLabel}s ({items.length})</span>
        <button type="button" className="btn sm ghost" onClick={() => {
          const it = newItem(block.type);
          onChange([...items, it]);
          setOpen(it.id);
        }}>＋ Add {meta.itemLabel?.toLowerCase()}</button>
      </div>
      {items.map((it, i) => (
        <div key={it.id} className={`item${open === it.id ? ' open' : ''}`}>
          <div className="item-head">
            <button type="button" className="item-title" onClick={() => setOpen(open === it.id ? undefined : it.id)} aria-expanded={open === it.id}>
              {it.title || it.text?.slice(0, 30) || `${meta.itemLabel} ${i + 1}`}
            </button>
            <button type="button" className="icon-btn sm" onClick={() => move(i, -1)} aria-label="Move up">↑</button>
            <button type="button" className="icon-btn sm" onClick={() => move(i, 1)} aria-label="Move down">↓</button>
            <button type="button" className="icon-btn sm danger" onClick={() => onChange(items.filter((x) => x.id !== it.id))} aria-label="Remove">✕</button>
          </div>
          {open === it.id && (
            <div className="item-body">
              {meta.itemFields!.map((f) => {
                const label = labels[f] ?? ITEM_FIELD_LABEL[f] ?? f;
                if (f === 'mediaId') return <MediaField key={f} label={label} value={it.mediaId} onChange={(v) => set(it.id, { mediaId: v })} />;
                if (f === 'highlight') return <Toggle key={f} label="Highlight as most popular" checked={!!it.highlight} onChange={(v) => set(it.id, { highlight: v })} />;
                if (f === 'text' || f === 'features') return <Area key={f} label={label} value={it[f] as string} onChange={(v) => set(it.id, { [f]: v })} rows={f === 'features' ? 4 : 3} />;
                return <Text key={f} label={label} value={it[f] as string} onChange={(v) => set(it.id, { [f]: v })} placeholder={f === 'link' ? '/contact or https://…' : undefined} />;
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function BlockInspector({ block }: { block: Block }) {
  const { update, site } = useSite();
  const [tab, setTab] = useState<'content' | 'style'>('content');
  const meta = blockMeta(block.type);
  const set = (patch: Partial<Block>, group?: string) =>
    update((d) => {
      for (const p of d.pages) {
        const b = p.blocks.find((x) => x.id === block.id);
        if (b) Object.assign(b, patch);
      }
    }, group ?? `blk-${block.id}-${Object.keys(patch).join()}`);

  const hasCta = ['hero', 'cta'].includes(block.type);
  const pageOptions = site.pages.map((p) => `/${p.slug}`);

  return (
    <div className="inspector-body">
      <div className="row between">
        <h3><span aria-hidden="true">{meta.icon}</span> {meta.label}</h3>
        <Segmented value={tab} onChange={setTab} options={[{ value: 'content', label: 'Content' }, { value: 'style', label: 'Style' }]} />
      </div>
      {tab === 'content' ? (
        <>
          {block.type !== 'image' && block.type !== 'logos' && <Text label="Eyebrow" value={block.eyebrow} onChange={(v) => set({ eyebrow: v })} placeholder="Short label above the heading" />}
          <Text label={block.type === 'image' ? 'Caption' : 'Heading'} value={block.heading} onChange={(v) => set({ heading: v })} />
          {!['image', 'logos', 'stats'].includes(block.type) && (
            <div className="field">
              <span className="field-label">{block.type === 'richtext' ? 'Content' : 'Text'}</span>
              <RichText key={block.id} label="Section text" value={block.body ?? ''} onChange={(v) => set({ body: v })} minHeight={block.type === 'richtext' ? 220 : 90} />
            </div>
          )}
          {(block.type === 'hero' || block.type === 'image') && <MediaField label={block.type === 'hero' ? 'Hero image' : 'Image'} value={block.mediaId} onChange={(v) => set({ mediaId: v })} />}
          {block.type === 'video' && (
            <>
              <MediaField label="Uploaded video" kind="video" value={block.mediaId} onChange={(v) => set({ mediaId: v })} />
              <Text label="…or YouTube / Vimeo / MP4 link" value={block.videoUrl} onChange={(v) => set({ videoUrl: v })} placeholder="https://youtu.be/…" hint="YouTube links use a lightweight click-to-play embed for speed." />
            </>
          )}
          {hasCta && (
            <div className="grid2">
              <Text label="Button label" value={block.ctaLabel} onChange={(v) => set({ ctaLabel: v })} />
              <Text label="Button link" value={block.ctaLink} onChange={(v) => set({ ctaLink: v })} placeholder={pageOptions[1] ?? '/contact'} />
              <Text label="Second button" value={block.secondaryLabel} onChange={(v) => set({ secondaryLabel: v })} />
              <Text label="Second link" value={block.secondaryLink} onChange={(v) => set({ secondaryLink: v })} />
            </div>
          )}
          {block.type === 'contact' && <Text label="Submit button" value={block.ctaLabel} onChange={(v) => set({ ctaLabel: v })} hint="Submissions go to Back-End → Forms & Integrations." />}
          {meta.hasItems && <ItemsEditor block={block} onChange={(items) => set({ items }, `items-${block.id}`)} />}
          {hasCta && <p className="hint">Link to a page with “/slug” (e.g. {pageOptions.slice(1, 3).join(', ') || '/contact'}), to a section with “#contact”, or any https:// address.</p>}
        </>
      ) : (
        <>
          <Segmented label="Background" value={block.tone} onChange={(v) => set({ tone: v })} options={[{ value: 'default', label: 'Plain' }, { value: 'alt', label: 'Soft' }, { value: 'primary', label: 'Brand' }, { value: 'dark', label: 'Dark' }]} />
          <Segmented label="Spacing" value={block.spacing} onChange={(v) => set({ spacing: v })} options={[{ value: 'sm', label: 'Compact' }, { value: 'md', label: 'Normal' }, { value: 'lg', label: 'Roomy' }]} />
          <Segmented label="Alignment" value={block.align} onChange={(v) => set({ align: v })} options={[{ value: 'left', label: 'Left' }, { value: 'center', label: 'Center' }]} />
          {block.type === 'hero' && <Segmented label="Layout" value={block.layout ?? 'split'} onChange={(v) => set({ layout: v })} options={[{ value: 'split', label: 'Split' }, { value: 'stacked', label: 'Stacked' }, { value: 'cover', label: 'Full-bleed' }]} />}
          {block.type === 'contact' && <Segmented label="Layout" value={block.layout ?? 'split'} onChange={(v) => set({ layout: v })} options={[{ value: 'split', label: 'Side by side' }, { value: 'stacked', label: 'Stacked' }]} />}
          {meta.hasItems && block.type !== 'faq' && block.type !== 'logos' && (
            <Segmented label="Columns (desktop)" value={block.columns ?? 3} onChange={(v) => set({ columns: v })} options={[{ value: 2, label: '2' }, { value: 3, label: '3' }, { value: 4, label: '4' }]} />
          )}
          <p className="hint">Columns automatically collapse on tablets and phones.</p>
        </>
      )}
    </div>
  );
}

function AddSection({ onAdd, onClose }: { onAdd: (t: BlockType) => void; onClose: () => void }) {
  return (
    <Modal title="Add a section" onClose={onClose} wide>
      <div className="block-grid">
        {BLOCKS.map((b) => (
          <button key={b.type} className="block-tile" onClick={() => { onAdd(b.type); onClose(); }}>
            <span className="block-icon" aria-hidden="true">{b.icon}</span>
            <strong>{b.label}</strong>
            <span className="muted small">{b.description}</span>
          </button>
        ))}
      </div>
    </Modal>
  );
}

export function Design() {
  const { site, update } = useSite();
  const [pageId, setPageId] = useState(site.pages[0]?.id);
  const [selected, setSelected] = useState<string>();
  const [device, setDevice] = useState<Device>(() => (window.innerWidth < 700 ? 'mobile' : 'desktop'));
  const [adding, setAdding] = useState(false);
  const [panel, setPanel] = useState<'outline' | 'preview' | 'inspector'>('preview');
  const page = site.pages.find((p) => p.id === pageId) ?? site.pages[0];
  const block = page.blocks.find((b) => b.id === selected);

  useEffect(() => {
    if (!site.pages.some((p) => p.id === pageId)) setPageId(site.pages[0]?.id);
  }, [site.pages, pageId]);

  const editPage = (fn: (blocks: Block[]) => Block[]) =>
    update((d) => {
      const p = d.pages.find((x) => x.id === page.id)!;
      p.blocks = fn(p.blocks);
    });

  const add = (type: BlockType) => {
    const b = createBlock(type);
    editPage((blocks) => {
      const i = blocks.findIndex((x) => x.id === selected);
      const next = [...blocks];
      next.splice(i >= 0 ? i + 1 : next.length, 0, b);
      return next;
    });
    setSelected(b.id);
    setTimeout(() => scrollPreviewTo(b.id), 400);
  };

  const move = (id: string, dir: -1 | 1) =>
    editPage((blocks) => {
      const i = blocks.findIndex((b) => b.id === id);
      const j = i + dir;
      if (j < 0 || j >= blocks.length) return blocks;
      const next = [...blocks];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  const onSelect = useCallback((id: string) => {
    setSelected(id);
    setPanel('inspector');
  }, []);
  const onNavigate = useCallback((id: string) => {
    setPageId(id);
    setSelected(undefined);
  }, []);

  return (
    <div className={`design show-${panel}`}>
      <div className="mobile-switch">
        <Segmented value={panel} onChange={setPanel} options={[{ value: 'outline', label: 'Sections' }, { value: 'preview', label: 'Preview' }, { value: 'inspector', label: 'Edit' }]} />
      </div>
      <aside className="outline" aria-label="Page sections">
        <label className="field">
          <span className="field-label">Page</span>
          <select value={page.id} onChange={(e) => { setPageId(e.target.value); setSelected(undefined); }}>
            {site.pages.map((p) => <option key={p.id} value={p.id}>{p.name} {p.slug ? `(/${p.slug})` : '(home)'}</option>)}
          </select>
        </label>
        <button className={`outline-theme${!selected ? ' on' : ''}`} onClick={() => setSelected(undefined)}>🎨 Theme & styles</button>
        <ol className="outline-list">
          <li className="outline-fixed">Header & menu</li>
          {page.blocks.map((b, i) => {
            const meta = blockMeta(b.type);
            return (
              <li key={b.id} className={`${b.id === selected ? 'on' : ''}${b.hidden ? ' hidden' : ''}`}>
                <button className="outline-item" onClick={() => { setSelected(b.id); scrollPreviewTo(b.id); setPanel('inspector'); }}>
                  <span className="outline-icon" aria-hidden="true">{meta.icon}</span>
                  <span className="ellipsis">
                    <strong>{meta.label}</strong>
                    <small>{b.heading || '—'}</small>
                  </span>
                </button>
                <div className="outline-actions">
                  <button className="icon-btn sm" disabled={i === 0} onClick={() => move(b.id, -1)} aria-label="Move up" title="Move up">↑</button>
                  <button className="icon-btn sm" disabled={i === page.blocks.length - 1} onClick={() => move(b.id, 1)} aria-label="Move down" title="Move down">↓</button>
                  <button className="icon-btn sm" onClick={() => editPage((bl) => bl.map((x) => (x.id === b.id ? { ...x, hidden: !x.hidden } : x)))} aria-label={b.hidden ? 'Show' : 'Hide'} title={b.hidden ? 'Show' : 'Hide'}>{b.hidden ? '◌' : '◉'}</button>
                  <button className="icon-btn sm" onClick={() => editPage((bl) => {
                    const copy = { ...clone(b), id: uid('blk'), items: b.items?.map((it) => ({ ...it, id: uid('it') })) };
                    const next = [...bl];
                    next.splice(i + 1, 0, copy);
                    return next;
                  })} aria-label="Duplicate" title="Duplicate">⧉</button>
                  <button className="icon-btn sm danger" onClick={() => { editPage((bl) => bl.filter((x) => x.id !== b.id)); if (selected === b.id) setSelected(undefined); }} aria-label="Delete" title="Delete">✕</button>
                </div>
              </li>
            );
          })}
          <li className="outline-fixed">Footer</li>
        </ol>
        <button className="btn wide" onClick={() => setAdding(true)}>＋ Add section</button>
      </aside>

      <section className="canvas" aria-label="Live preview">
        <div className="canvas-bar">
          <Segmented value={device} onChange={setDevice} options={[{ value: 'desktop', label: '🖥 Desktop' }, { value: 'tablet', label: '▭ Tablet' }, { value: 'mobile', label: '📱 Mobile' }]} />
          <span className="muted small hide-sm">Click any section in the preview to edit it</span>
        </div>
        <Preview site={site} page={page} device={device} selectedId={selected} onSelect={onSelect} onNavigate={onNavigate} />
      </section>

      <aside className="inspector" aria-label="Inspector">
        {block ? <BlockInspector key={block.id} block={block} /> : <ThemePanel />}
      </aside>
      {adding && <AddSection onAdd={add} onClose={() => setAdding(false)} />}
    </div>
  );
}
