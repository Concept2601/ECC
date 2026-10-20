import { useRef, useState } from 'react';
import { useSite } from '../store';
import { importFiles } from '../lib/media';
import type { MediaAsset } from '../types';
import { formatBytes } from '../lib/util';
import { Modal } from './ui';

export function useUpload() {
  const { site, update, toast } = useSite();
  const [busy, setBusy] = useState(false);
  const upload = async (files: FileList | File[]): Promise<MediaAsset[]> => {
    setBusy(true);
    try {
      const { assets, errors } = await importFiles(files, site.performance);
      if (assets.length) {
        update((d) => {
          d.media.unshift(...assets);
        });
        const saved = assets.reduce((n, a) => n + (a.originalSize - a.size), 0);
        toast(`Uploaded ${assets.length} file(s)${saved > 0 ? ` — saved ${formatBytes(saved)} by optimising` : ''}.`);
      }
      errors.forEach((e) => toast(e, 'err'));
      return assets;
    } finally {
      setBusy(false);
    }
  };
  return { upload, busy };
}

export function Thumb({ m, size = 56 }: { m?: MediaAsset; size?: number }) {
  if (!m) return <span className="thumb empty" style={{ width: size, height: size }}>＋</span>;
  if (m.kind === 'video') return <span className="thumb video" style={{ width: size, height: size }}>▶</span>;
  return <img className="thumb" src={m.variants?.[480] ?? m.src} alt="" style={{ width: size, height: size }} />;
}

export function MediaPicker({ kind, onPick, onClose }: { kind: 'image' | 'video'; onPick: (id: string) => void; onClose: () => void }) {
  const { site } = useSite();
  const { upload, busy } = useUpload();
  const input = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState('');
  const list = site.media.filter((m) => m.kind === kind && m.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <Modal
      title={`Choose ${kind}`}
      onClose={onClose}
      wide
      footer={
        <>
          <input ref={input} type="file" hidden multiple accept={kind === 'image' ? 'image/*' : 'video/*'} onChange={async (e) => {
            if (!e.target.files?.length) return;
            const added = (await upload(e.target.files)).filter((a) => a.kind === kind);
            if (added.length === 1) {
              onPick(added[0].id);
              onClose();
            }
          }} />
          <button className="btn" disabled={busy} onClick={() => input.current?.click()}>{busy ? 'Optimising…' : `Upload ${kind}`}</button>
        </>
      }
    >
      <input className="search" placeholder="Search media…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search media" />
      {list.length ? (
        <div className="media-grid">
          {list.map((m) => (
            <button key={m.id} className="media-tile" onClick={() => { onPick(m.id); onClose(); }}>
              {m.kind === 'image' ? <img src={m.variants?.[480] ?? m.src} alt={m.alt} loading="lazy" /> : <span className="video-tile">▶</span>}
              <span className="media-name">{m.name}</span>
            </button>
          ))}
        </div>
      ) : (
        <p className="muted center pad">No {kind}s yet — upload one below.</p>
      )}
    </Modal>
  );
}

/** Compact control: thumbnail + choose / remove. */
export function MediaField({ label, value, kind = 'image', onChange }: { label: string; value?: string; kind?: 'image' | 'video'; onChange: (id: string | undefined) => void }) {
  const { site } = useSite();
  const [open, setOpen] = useState(false);
  const m = site.media.find((x) => x.id === value);
  return (
    <div className="field">
      <span className="field-label">{label}</span>
      <div className="media-field">
        <button type="button" className="thumb-btn" onClick={() => setOpen(true)} aria-label={`Choose ${label}`}>
          <Thumb m={m} size={52} />
        </button>
        <div className="grow">
          <div className="ellipsis">{m ? m.name : <span className="muted">None</span>}</div>
          <div className="row">
            <button type="button" className="link" onClick={() => setOpen(true)}>{m ? 'Replace' : 'Choose'}</button>
            {m && <button type="button" className="link danger" onClick={() => onChange(undefined)}>Remove</button>}
          </div>
        </div>
      </div>
      {open && <MediaPicker kind={kind} onPick={onChange} onClose={() => setOpen(false)} />}
    </div>
  );
}
