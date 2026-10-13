import { Camera, FileUp, KeyRound, Loader2, PencilRuler, ScanLine, Sparkles } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { fileToBase64, itemToUnit, prepareImage, readDiagram, type Reading, type ReaderInput } from '../ai/vision';
import { Card, Field, PageHeader, TextInput } from '../components/ui';
import UnitThumb from '../components/UnitThumb';
import { useMoney } from '../hooks';
import { buildUnit } from '../lib/generate';
import { createUnit } from '../lib/presets';
import { calculateQuote } from '../lib/pricing';
import type { Quote } from '../lib/types';
import { todayISO } from '../lib/util';
import { useStore } from '../store';

export default function Reader() {
  const { settings, catalog, createQuote, updateQuote, quotes } = useStore();
  const nav = useNavigate();
  const fmt = useMoney();
  const fileRef = useRef<HTMLInputElement>(null);
  const camRef = useRef<HTMLInputElement>(null);
  const [input, setInput] = useState<ReaderInput | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [fileName, setFileName] = useState('');
  const [hint, setHint] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [reading, setReading] = useState<Reading | null>(null);
  const [picked, setPicked] = useState<boolean[]>([]);
  const [target, setTarget] = useState('new');
  const hasKey = !!settings.ai.apiKey;

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    setError('');
    setReading(null);
    setFileName(f.name);
    try {
      if (f.type === 'application/pdf') {
        setPreview(null);
        setInput({ kind: 'pdf', base64: await fileToBase64(f), mediaType: 'application/pdf', hint });
      } else {
        const img = await prepareImage(f);
        setPreview(img.dataUrl);
        setInput({ kind: 'image', base64: img.base64, mediaType: img.mediaType, hint });
      }
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const analyse = async () => {
    if (!input) return;
    setBusy(true);
    setError('');
    try {
      const r = await readDiagram({ ...input, hint }, settings.ai.apiKey, settings.ai.model);
      setReading(r);
      setPicked(r.items.map(() => true));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const units = useMemo(() => (reading ? reading.items.map((it) => itemToUnit(it, catalog)) : []), [reading, catalog]);
  const builds = useMemo(() => units.map((u) => buildUnit(u, catalog, settings.pricing)), [units, catalog, settings.pricing]);
  const estimate = useMemo(() => {
    if (!units.length) return null;
    const q: Quote = {
      id: 'est', number: '', title: '', date: todayISO(), status: 'draft', client: { name: '', phone: '', email: '', address: '' },
      units: units.filter((_, i) => picked[i]), runs: [], attachments: [], includeAppliances: true, extras: [], transportId: null, transportCustom: 0, installation: false,
      markupPercent: settings.pricing.markupPercent, discountType: 'percent', discountValue: 0, applyTax: settings.pricing.taxRate > 0,
      notes: '', sourceImage: null, createdAt: 0, updatedAt: 0,
    };
    return calculateQuote(q, catalog, settings);
  }, [units, picked, catalog, settings]);

  const create = () => {
    const chosen = units.filter((_, i) => picked[i]);
    if (target === 'new') {
      const id = createQuote({ title: reading?.summary.slice(0, 60) || 'Quotation from diagram', units: chosen, sourceImage: preview, notes: '' });
      nav(`/quotes/${id}`);
    } else {
      updateQuote(target, (q) => {
        q.units.push(...chosen);
        if (preview && !q.sourceImage) q.sourceImage = preview;
      });
      nav(`/quotes/${target}`);
    }
  };

  const manual = () => {
    const u = createUnit('custom');
    const id = createQuote({ title: fileName ? `Design from ${fileName}` : 'Quotation from diagram', units: [u], sourceImage: preview });
    nav(`/quotes/${id}/units/${u.id}`);
  };

  return (
    <div>
      <PageHeader title="Diagram reader" subtitle="Plans, sketches, photos & 3D renders → render + quotation" back="/" />
      <div className="mx-auto max-w-5xl space-y-3 p-3">
        {!hasKey && (
          <div className="card flex items-start gap-3 border-amber-200 bg-amber-50 p-4">
            <KeyRound className="mt-0.5 shrink-0 text-amber-700" size={20} />
            <div className="text-sm text-amber-900">
              Automatic reading needs an Anthropic API key. <Link to="/settings" className="font-bold underline">Add it in Settings → Diagram reader</Link>. Without a key you can still trace over the image manually in the visual designer.
            </div>
          </div>
        )}

        <Card title="1 · Upload a drawing">
          <div className="grid gap-3 sm:grid-cols-2">
            <button className="card flex flex-col items-center gap-2 border-dashed p-6 hover:border-brand-400" onClick={() => fileRef.current?.click()}>
              <FileUp className="text-brand-600" />
              <span className="font-semibold">Choose image or PDF</span>
              <span className="text-xs text-stone-500">Plan, elevation, sketch, render or photo</span>
            </button>
            <button className="card flex flex-col items-center gap-2 border-dashed p-6 hover:border-brand-400" onClick={() => camRef.current?.click()}>
              <Camera className="text-brand-600" />
              <span className="font-semibold">Take a photo</span>
              <span className="text-xs text-stone-500">Snap a hand sketch or site photo</span>
            </button>
          </div>
          <input ref={fileRef} type="file" accept="image/*,application/pdf" hidden onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ''; }} />
          <input ref={camRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ''; }} />
          {preview && <img src={preview} className="mt-3 max-h-80 w-full rounded-xl border border-stone-200 object-contain" />}
          {input?.kind === 'pdf' && <p className="mt-3 rounded-xl bg-stone-50 p-3 text-sm">📄 {fileName}</p>}
        </Card>

        {input && (
          <Card title="2 · Read it">
            <Field label="Notes for the reader (optional)">
              <TextInput multiline value={hint} placeholder="e.g. Ceiling height is 2600. Wardrobe doors should slide. Use white carcass with oak doors." onChange={setHint} />
            </Field>
            <div className="mt-3 flex flex-wrap gap-2">
              <button className="btn-primary" disabled={!hasKey || busy} onClick={analyse}>
                {busy ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />} {busy ? 'Reading drawing…' : 'Read drawing & build units'}
              </button>
              {preview && (
                <button className="btn-secondary" onClick={manual}>
                  <PencilRuler size={16} /> Trace manually instead
                </button>
              )}
            </div>
            {busy && <p className="mt-2 text-xs text-stone-500">This can take up to a minute for detailed plans.</p>}
            {error && <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          </Card>
        )}

        {reading && (
          <Card title="3 · Review units">
            <p className="text-sm">{reading.summary}</p>
            <p className="mt-1 text-xs text-stone-500">Dimensions: {reading.scaleSource}</p>
            {reading.assumptions.length > 0 && (
              <ul className="mt-2 list-disc space-y-0.5 pl-5 text-xs text-stone-600">
                {reading.assumptions.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            )}
            {!units.length && (
              <div className="mt-3 flex flex-col items-center gap-2 p-6 text-center text-sm text-stone-500">
                <ScanLine />
                No joinery units were found in this file.
              </div>
            )}
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {units.map((u, i) => (
                <label key={u.id} className={`card flex cursor-pointer gap-3 p-3 ${picked[i] ? 'border-brand-400 ring-2 ring-brand-100' : 'opacity-60'}`}>
                  <input type="checkbox" className="mt-1 h-5 w-5 accent-brand-600" checked={!!picked[i]} onChange={(e) => setPicked(picked.map((p, k) => (k === i ? e.target.checked : p)))} />
                  <UnitThumb unit={u} build={builds[i]} catalog={catalog} className="h-24 w-28 shrink-0" />
                  <div className="min-w-0 text-sm">
                    <div className="font-bold">
                      {u.name}
                      {u.qty > 1 ? ` × ${u.qty}` : ''}
                    </div>
                    <div className="text-xs text-stone-500">
                      {u.width}×{u.height}×{u.depth}mm · {u.bays.length} bay(s)
                    </div>
                    <div className="mt-1 text-xs">
                      confidence: <b className={reading.items[i].confidence === 'low' ? 'text-red-600' : reading.items[i].confidence === 'medium' ? 'text-amber-600' : 'text-emerald-700'}>{reading.items[i].confidence}</b>
                    </div>
                    {reading.items[i].notes && <div className="mt-1 line-clamp-2 text-xs text-stone-500">{reading.items[i].notes}</div>}
                  </div>
                </label>
              ))}
            </div>
            {estimate && units.length > 0 && (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-brand-50 p-3">
                <div>
                  <div className="text-xs font-semibold uppercase text-brand-800">Estimated quotation</div>
                  <div className="text-xl font-bold">{fmt(estimate.total)}</div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <select className="input w-auto" value={target} onChange={(e) => setTarget(e.target.value)}>
                    <option value="new">New quotation</option>
                    {quotes.map((q) => (
                      <option key={q.id} value={q.id}>
                        Add to {q.number} – {q.title}
                      </option>
                    ))}
                  </select>
                  <button className="btn-primary" disabled={!picked.some(Boolean)} onClick={create}>
                    Create quotation
                  </button>
                </div>
              </div>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}
