// Finish library: colours and photo textures (PNG / JPG) for fronts, carcasses,
// panels and worktops. Import one image, several, or a whole folder at once.
import { ChevronDown, FolderInput, ImagePlus, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { finishBin, remove, write } from '../app/db';
import { useSaves } from '../app/savepoints';
import { useMoney } from '../hooks';
import type { Finish, SurfaceFinish } from '../lib/types';
import { uid } from '../lib/util';
import { dropFinishTexture, preloadFinishTextures } from '../render/finishTextures';
import { useStore } from '../store';
import { confirmAction, Field, NumInput, TextInput } from './ui';

export const FINISH_TYPES: { value: SurfaceFinish; label: string }[] = [
  { value: 'gloss', label: 'High gloss' },
  { value: 'satin', label: 'Satin / silk' },
  { value: 'matte', label: 'Matt / super matt' },
  { value: 'textured', label: 'Textured / woodgrain feel' },
  { value: 'metallic', label: 'Metallic' },
];

const guessType = (name: string): SurfaceFinish => (/gloss|marble|polish|lacquer/i.test(name) ? 'gloss' : /metal|brass|steel|gold|copper|chrome/i.test(name) ? 'metallic' : /satin|silk/i.test(name) ? 'satin' : /wood|oak|walnut|ash|teak|pine|grain|stone|slate|concrete/i.test(name) ? 'textured' : 'matte');

/** Shrink a photo to at most 2048 px (keeps the library light), make a thumbnail and find its average colour. */
async function prepareImage(file: File): Promise<{ blob: Blob; thumb: string; color: string }> {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, 2048 / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * k);
  c.height = Math.round(bmp.height * k);
  c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
  const png = file.type === 'image/png';
  const blob = await new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('could not read image'))), png ? 'image/png' : 'image/jpeg', 0.9));
  const t = document.createElement('canvas');
  t.width = t.height = 96;
  const g = t.getContext('2d')!;
  const s = Math.min(bmp.width, bmp.height);
  g.drawImage(bmp, (bmp.width - s) / 2, (bmp.height - s) / 2, s, s, 0, 0, 96, 96);
  const px = g.getImageData(0, 0, 96, 96).data;
  let r = 0;
  let gg = 0;
  let b = 0;
  for (let i = 0; i < px.length; i += 4) {
    r += px[i];
    gg += px[i + 1];
    b += px[i + 2];
  }
  const n = px.length / 4;
  const hex = (v: number) => Math.round(v / n).toString(16).padStart(2, '0');
  bmp.close();
  return { blob, thumb: t.toDataURL('image/jpeg', 0.8), color: `#${hex(r)}${hex(gg)}${hex(b)}` };
}

export default function FinishLibrary() {
  const finishes = useStore((s) => s.catalog.finishes ?? []);
  const boards = useStore((s) => s.catalog.boards);
  const [q, setQ] = useState('');
  const updateCatalog = useStore((s) => s.updateCatalog);
  const fmt = useMoney();
  const [open, setOpen] = useState<string | null>(null);
  const [cat, setCat] = useState('all');
  const [busy, setBusy] = useState(false);
  const files = useRef<HTMLInputElement>(null);
  const folder = useRef<HTMLInputElement>(null);
  const replaceFor = useRef<string | null>(null);
  const replace = useRef<HTMLInputElement>(null);
  const categories = [...new Set(finishes.map((f) => f.category || 'Other'))];
  const list = finishes.filter((f) => (cat === 'all' || (f.category || 'Other') === cat) && (!q || `${f.name} ${f.supplier ?? ''} ${f.range ?? ''} ${f.category}`.toLowerCase().includes(q.toLowerCase())));
  const set = (id: string, patch: Partial<Finish>) => updateCatalog((c) => Object.assign((c.finishes ?? []).find((f) => f.id === id)!, patch));

  const importFiles = async (fl: FileList | null) => {
    const imgs = [...(fl ?? [])].filter((f) => /^image\/(png|jpe?g|webp)$/.test(f.type));
    if (!imgs.length) return;
    setBusy(true);
    const made: Finish[] = [];
    for (const file of imgs) {
      try {
        const { blob, thumb, color } = await prepareImage(file);
        const textureId = uid('tex-');
        await write(finishBin, textureId, blob);
        const name = file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
        const folderName = (file as File & { webkitRelativePath?: string }).webkitRelativePath?.split('/').slice(-2, -1)[0];
        made.push({ id: uid('fin-'), name: name.charAt(0).toUpperCase() + name.slice(1), color, finish: guessType(name), textureId, thumb, textureSize: /wood|oak|walnut|plank|grain/i.test(name) ? 1200 : 600, grain: 'length', surcharge: 0, category: folderName || 'Custom textures' });
      } catch (e) {
        useSaves.setState({ message: `${file.name}: ${(e as Error).message}` });
      }
    }
    updateCatalog((c) => (c.finishes ??= []).push(...made));
    await preloadFinishTextures(made.map((m) => m.textureId));
    setBusy(false);
    useSaves.setState({ message: `${made.length} finish${made.length === 1 ? '' : 'es'} added` });
    if (made[0]) setOpen(made[0].id);
  };

  const replaceImage = async (fl: FileList | null) => {
    const id = replaceFor.current;
    const file = fl?.[0];
    if (!id || !file) return;
    const f = finishes.find((x) => x.id === id);
    const { blob, thumb, color } = await prepareImage(file);
    const textureId = uid('tex-');
    await write(finishBin, textureId, blob);
    if (f?.textureId) {
      dropFinishTexture(f.textureId);
      await remove(finishBin, [f.textureId]);
    }
    set(id, { textureId, thumb, color });
    await preloadFinishTextures([textureId]);
  };

  return (
    <div className="space-y-3">
      <div className="card space-y-2 p-3">
        <p className="text-sm text-stone-600">Board colours and textures (decors) — for example PG Bison MelaWood, SupaGloss or your own supplier’s range — plus worktop looks. Import the supplier’s swatch photos (PNG / JPG) for the exact look, link each colour to the board types it comes on, and choose it per cabinet (Materials tab) or for the whole job (Material hub). Choosing a colour never changes the board type or its price.</p>
        <div className="flex flex-wrap gap-2">
          <button className="btn-primary" disabled={busy} onClick={() => files.current?.click()}>
            <ImagePlus size={16} /> {busy ? 'Importing…' : 'Import textures (PNG / JPG)'}
          </button>
          <button className="btn-secondary" disabled={busy} onClick={() => folder.current?.click()}>
            <FolderInput size={16} /> Import a folder
          </button>
          <button className="btn-secondary" onClick={() => updateCatalog((c) => (c.finishes ??= []).push({ id: uid('fin-'), name: 'New colour', color: '#b3261e', finish: 'gloss', textureId: null, thumb: null, textureSize: 600, grain: 'length', surcharge: 0, category: 'Custom colours' }))}>
            <Plus size={16} /> Colour only
          </button>
        </div>
        <input ref={files} type="file" accept="image/png,image/jpeg,image/webp" multiple hidden onChange={(e) => void importFiles(e.target.files).finally(() => (e.target.value = ''))} />
        <input ref={folder} type="file" accept="image/*" multiple hidden {...({ webkitdirectory: '' } as object)} onChange={(e) => void importFiles(e.target.files).finally(() => (e.target.value = ''))} />
        <input ref={replace} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => void replaceImage(e.target.files).finally(() => (e.target.value = ''))} />
      </div>

      <input className="input" placeholder="Search colours, e.g. oak, Storm Grey, SupaGloss…" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
        {['all', ...categories].map((c) => (
          <button key={c} className={`whitespace-nowrap rounded-full border px-3 py-1 text-xs font-semibold ${cat === c ? 'border-brand-600 bg-brand-600 text-white' : 'border-stone-300 bg-white text-stone-600'}`} onClick={() => setCat(c)}>
            {c === 'all' ? `All (${finishes.length})` : c}
          </button>
        ))}
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {list.map((f) => {
          const isOpen = open === f.id;
          return (
            <div key={f.id} className={`card overflow-hidden ${isOpen ? 'sm:col-span-2' : ''}`}>
              <button className="flex w-full items-center gap-3 p-2.5 text-left" onClick={() => setOpen(isOpen ? null : f.id)}>
                <span className="h-11 w-11 shrink-0 rounded-lg border border-black/10 shadow-inner" style={{ background: f.thumb ? `url(${f.thumb}) center/cover` : f.color }} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{f.name}</span>
                  <span className="block truncate text-xs text-stone-500">
                    {f.supplier ? `${f.supplier}${f.range ? ` ${f.range}` : ''} · ` : ''}
                    {FINISH_TYPES.find((t) => t.value === f.finish)?.label} · {f.textureId ? `photo ${f.textureSize} mm` : f.kind === 'woodgrain' ? 'woodgrain (no photo yet)' : 'colour'}
                    {f.surcharge ? ` · +${fmt(f.surcharge)}/m²` : ''}
                  </span>
                </span>
                <ChevronDown size={18} className={`text-stone-400 transition ${isOpen ? 'rotate-180' : ''}`} />
              </button>
              {isOpen && (
                <div className="grid gap-3 border-t border-stone-100 p-3 sm:grid-cols-[160px_1fr]">
                  <div className="space-y-2">
                    <div className="aspect-square w-full rounded-xl border border-black/10" style={{ background: f.thumb ? `url(${f.thumb}) center/cover` : f.color }} />
                    <button className="btn-secondary w-full px-2 py-1.5 text-xs" onClick={() => ((replaceFor.current = f.id), replace.current?.click())}>
                      <RefreshCw size={13} /> {f.textureId ? 'Replace image' : 'Add an image'}
                    </button>
                    {f.textureId && (
                      <button
                        className="btn-ghost w-full px-2 py-1 text-xs"
                        onClick={() => {
                          const t = f.textureId!;
                          dropFinishTexture(t);
                          void remove(finishBin, [t]);
                          set(f.id, { textureId: null, thumb: null });
                        }}
                      >
                        Use colour only
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="Name" className="col-span-2">
                      <TextInput value={f.name} onChange={(v) => set(f.id, { name: v })} />
                    </Field>
                    <Field label="Group">
                      <TextInput value={f.category} onChange={(v) => set(f.id, { category: v })} />
                    </Field>
                    <Field label="Type">
                      <select className="input" value={f.kind ?? 'solid'} onChange={(e) => set(f.id, { kind: e.target.value as Finish['kind'] })}>
                        <option value="solid">Solid colour</option>
                        <option value="woodgrain">Woodgrain</option>
                        <option value="stone">Stone / concrete</option>
                        <option value="other">Other pattern</option>
                      </select>
                    </Field>
                    <Field label="Supplier">
                      <TextInput value={f.supplier ?? ''} placeholder="e.g. PG Bison" onChange={(v) => set(f.id, { supplier: v })} />
                    </Field>
                    <Field label="Range">
                      <TextInput value={f.range ?? ''} placeholder="e.g. MelaWood, SupaGloss" onChange={(v) => set(f.id, { range: v })} />
                    </Field>
                    <div className="col-span-2">
                      <span className="label">Comes on these boards (none ticked = any board)</span>
                      <div className="mt-1 flex max-h-36 flex-wrap gap-1.5 overflow-y-auto">
                        {boards.map((b) => {
                          const on = !!f.boardIds?.includes(b.id);
                          return (
                            <button key={b.id} type="button" className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${on ? 'border-brand-600 bg-brand-600 text-white' : 'border-stone-300 bg-white text-stone-600'}`} onClick={() => set(f.id, { boardIds: on ? (f.boardIds ?? []).filter((x) => x !== b.id) : [...(f.boardIds ?? []), b.id] })}>
                              {b.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <Field label="Surface">
                      <select className="input" value={f.finish} onChange={(e) => set(f.id, { finish: e.target.value as SurfaceFinish })}>
                        {FINISH_TYPES.map((t) => (
                          <option key={t.value} value={t.value}>
                            {t.label}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label={f.textureId ? 'Colour (drawings)' : 'Colour'}>
                      <input type="color" className="h-10 w-full rounded-xl border border-stone-300" value={f.color} onChange={(e) => set(f.id, { color: e.target.value })} />
                    </Field>
                    <Field label="Finishing price">
                      <NumInput value={f.surcharge} min={0} suffix="/m²" onChange={(v) => set(f.id, { surcharge: v })} />
                    </Field>
                    {f.textureId && (
                      <>
                        <Field label="One image covers">
                          <NumInput value={f.textureSize} min={50} max={5000} step={50} suffix="mm" onChange={(v) => set(f.id, { textureSize: v })} />
                        </Field>
                        <Field label="Grain / pattern">
                          <select className="input" value={f.grain} onChange={(e) => set(f.id, { grain: e.target.value as Finish['grain'] })}>
                            <option value="length">Along each panel’s length</option>
                            <option value="vertical">Always upright</option>
                          </select>
                        </Field>
                      </>
                    )}
                    <div className="col-span-2 flex justify-end">
                      <button
                        className="btn-ghost px-2 py-1 text-xs text-red-600"
                        onClick={() => {
                          if (!confirmAction(`Delete ${f.name}? Cabinets using it go back to their board's own look.`)) return;
                          if (f.textureId) {
                            dropFinishTexture(f.textureId);
                            void remove(finishBin, [f.textureId]);
                          }
                          updateCatalog((c) => (c.finishes = (c.finishes ?? []).filter((x) => x.id !== f.id)));
                        }}
                      >
                        <Trash2 size={14} /> Delete
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
