// Swatch picker for the finish library (colours and photo textures).
import { Ban } from 'lucide-react';
import { useState } from 'react';
import { useStore } from '../store';

export default function FinishPicker({ value, onChange, mixed, noneLabel = 'Board’s own look', boardId }: { value: string | null | undefined; onChange: (id: string | null) => void; mixed?: boolean; noneLabel?: string; boardId?: string | null }) {
  const all = useStore((s) => s.catalog.finishes ?? []);
  // only the colours that come on this board type (plus those not tied to a board)
  const finishes = all.filter((f) => !f.boardIds?.length || !boardId || f.boardIds.includes(boardId));
  const [group, setGroup] = useState('all');
  const [q, setQ] = useState('');
  const groups = [...new Set(finishes.map((f) => f.category || 'Other'))];
  const shown = finishes.filter((f) => (group === 'all' || (f.category || 'Other') === group) && (!q || f.name.toLowerCase().includes(q.toLowerCase())));
  const current = finishes.find((f) => f.id === value);
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm">
        <span className="h-6 w-6 shrink-0 rounded-md border border-black/10" style={{ background: current ? (current.thumb ? `url(${current.thumb}) center/cover` : current.color) : 'repeating-linear-gradient(45deg,#eee,#eee 4px,#fff 4px,#fff 8px)' }} />
        <span className="truncate font-medium">{mixed ? 'Mixed – choose one for all' : (current?.name ?? noneLabel)}</span>
      </div>
      {finishes.length > 24 && <input className="input py-1.5 text-sm" placeholder="Search colours…" value={q} onChange={(e) => setQ(e.target.value)} />}
      {groups.length > 1 && (
        <div className="no-scrollbar flex gap-1 overflow-x-auto">
          {['all', ...groups].map((g) => (
            <button key={g} className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${group === g ? 'bg-stone-800 text-white' : 'bg-stone-100 text-stone-600'}`} onClick={() => setGroup(g)}>
              {g === 'all' ? 'All' : g}
            </button>
          ))}
        </div>
      )}
      <div className="flex flex-wrap gap-1.5">
        <button title={noneLabel} aria-label={noneLabel} className={`flex h-9 w-9 items-center justify-center rounded-lg border bg-white text-stone-400 ${!value && !mixed ? 'ring-2 ring-brand-500 ring-offset-1' : 'border-stone-300'}`} onClick={() => onChange(null)}>
          <Ban size={15} />
        </button>
        {shown.map((f) => (
          <button key={f.id} title={`${f.name}${f.supplier ? ` – ${f.supplier}` : ''}`} aria-label={f.name} className={`h-9 w-9 rounded-lg border border-black/10 shadow-inner transition hover:scale-105 ${value === f.id && !mixed ? 'ring-2 ring-brand-500 ring-offset-1' : ''}`} style={{ background: f.thumb ? `url(${f.thumb}) center/cover` : f.color }} onClick={() => onChange(f.id)} />
        ))}
      </div>
    </div>
  );
}
