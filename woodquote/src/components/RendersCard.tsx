// The quotation's renders library: captured views, photo renders and videos.
// Save or share any of them, add pictures to the quotation PDF, or delete them.
import { Clapperboard, Download, FilePlus2, Share2, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { deleteRender, fileName, listRenders, saveToDevice, shareMedia, useRenders, type RenderRecord } from '../app/media';
import { useSaves } from '../app/savepoints';
import type { Quote } from '../lib/types';
import { uid } from '../lib/util';
import { Card, confirmAction } from './ui';

const toDataUrl = (b: Blob) => new Promise<string>((res) => {
  const r = new FileReader();
  r.onload = () => res(String(r.result));
  r.readAsDataURL(b);
});

function Tile({ rec, onAdd }: { rec: RenderRecord; onAdd?: () => void }) {
  const url = useMemo(() => URL.createObjectURL(rec.blob), [rec]);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);
  const msg = (m: string) => useSaves.setState({ message: m });
  return (
    <div className="overflow-hidden rounded-xl border border-stone-200 bg-white">
      <div className="relative aspect-video bg-stone-100">
        {rec.kind === 'video' ? <video src={url} className="h-full w-full object-cover" muted loop playsInline onMouseEnter={(e) => void e.currentTarget.play()} onMouseLeave={(e) => e.currentTarget.pause()} /> : <img src={url} className="h-full w-full object-cover" loading="lazy" />}
        <span className="absolute left-1.5 top-1.5 rounded-md bg-black/55 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-white">{rec.kind === 'video' ? 'Video' : rec.kind === 'render' ? 'Render' : 'Capture'}</span>
      </div>
      <div className="flex items-center gap-1 p-1.5">
        <span className="min-w-0 flex-1 truncate text-[11px] text-stone-500">
          {rec.width}×{rec.height} · {new Date(rec.createdAt).toLocaleDateString()}
        </span>
        {onAdd && rec.kind !== 'video' && (
          <button className="btn-ghost px-1.5 py-1" title="Add to the quotation PDF" aria-label="Add to quotation PDF" onClick={onAdd}>
            <FilePlus2 size={14} />
          </button>
        )}
        <button className="btn-ghost px-1.5 py-1" title="Save to device" aria-label="Save to device" onClick={() => void saveToDevice(rec.blob, fileName(rec)).then(msg)}>
          <Download size={14} />
        </button>
        <button className="btn-ghost px-1.5 py-1" title="Share" aria-label="Share" onClick={() => void shareMedia(rec.blob, fileName(rec))}>
          <Share2 size={14} />
        </button>
        <button className="btn-ghost px-1.5 py-1 text-red-600" title="Delete" aria-label="Delete render" onClick={() => confirmAction('Delete this from the renders library?') && void deleteRender(rec.id)}>
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}

export default function RendersCard({ quote, up }: { quote: Quote; up: (fn: (q: Quote) => void) => void }) {
  const version = useRenders((s) => s.version);
  const [list, setList] = useState<RenderRecord[]>([]);
  useEffect(() => {
    void listRenders(quote.id).then(setList);
  }, [quote.id, version]);
  return (
    <Card title={`Renders (${list.length})`}>
      {!list.length ? (
        <p className="flex items-center gap-2 text-sm text-stone-500">
          <Clapperboard size={16} /> Use the camera button on any 3D view to capture it, or the ✦ button to open the render studio for photo-quality pictures and videos. They are kept here.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {list.map((r) => (
            <Tile
              key={r.id}
              rec={r}
              onAdd={() =>
                void toDataUrl(r.blob).then((dataUrl) => {
                  up((q) => q.attachments.push({ id: uid('at'), name: r.title, dataUrl, caption: r.title, includeInPdf: true }));
                  useSaves.setState({ message: 'Added to the quotation PDF' });
                })
              }
            />
          ))}
        </div>
      )}
    </Card>
  );
}
