// Plan reader: a floor plan (PDF, drawing, photo) → room outline with
// measurements, the BICs / kitchen / island / sink / stove positions, design
// checks and ideas → a room layout and quote.
import { Camera, CheckCircle2, ClipboardCopy, ExternalLink, FileUp, KeyRound, Lightbulb, Loader2, Map as MapIcon, Ruler, Sparkles, TriangleAlert } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { chatGptPrompt, designChecks, parsePlanJson, PLAN_JSON_EXAMPLE, planRoomToRoom, readPlanAnthropic, readPlanOpenAI, roomMeasurements, scaleReading, type PlanInput, type PlanReading, type PlanRoom } from '../ai/plan';
import { fileToBase64, prepareImage } from '../ai/vision';
import { Card, Field, NumInput, PageHeader, Tabs, TextInput } from '../components/ui';
import { fitKitchen, fitUnit } from '../lib/fit';
import type { Assembly, Quote, Run, Unit } from '../lib/types';
import { applianceGroup, islandGroup, syncAssembly } from '../lib/assembly';
import { placeXZ } from '../lib/room';
import { useStore } from '../store';

type Mode = 'auto' | 'chatgpt';

const FIX_COLORS: Record<string, string> = { bic: '#c4b5fd', baseRun: '#fcd34d', wallRun: '#fde68a', tall: '#fdba74', island: '#86efac', sink: '#7dd3fc', stove: '#fca5a5', hob: '#fca5a5', fridge: '#cbd5e1', other: '#e7e5e4' };
const FIX_NAMES: Record<string, string> = { bic: 'BIC', baseRun: 'Base cabinets', wallRun: 'Wall cabinets', tall: 'Tall unit', island: 'Island', sink: 'Sink', stove: 'Stove', hob: 'Hob', fridge: 'Fridge', other: 'Other' };

/** Measured outline of one room with its openings and joinery. */
function RoomOutline({ room }: { room: PlanRoom }) {
  const pts = room.outline;
  if (pts.length < 3) return <p className="p-6 text-center text-sm text-stone-500">No outline for this room.</p>;
  const xs = [...pts.map((p) => p.x), ...room.fixtures.flatMap((f) => [f.x, f.x + f.width])];
  const ys = [...pts.map((p) => p.y), ...room.fixtures.flatMap((f) => [f.y, f.y + f.depth])];
  const x0 = Math.min(...xs);
  const y0 = Math.min(...ys);
  const W = Math.max(...xs) - x0;
  const H = Math.max(...ys) - y0;
  const pad = Math.max(W, H) * 0.12;
  const fs = Math.max(W, H) / 36;
  return (
    <svg viewBox={`${x0 - pad} ${y0 - pad} ${W + 2 * pad} ${H + 2 * pad}`} className="h-72 w-full rounded-xl bg-[#f7f5f2] md:h-96">
      <polygon points={pts.map((p) => `${p.x},${p.y}`).join(' ')} fill="#efe6da" stroke="#44403c" strokeWidth={fs / 3} strokeLinejoin="round" />
      {room.openings.map((o, i) => {
        const a = pts[o.edge];
        const b = pts[(o.edge + 1) % pts.length];
        if (!a || !b) return null;
        const L = Math.hypot(b.x - a.x, b.y - a.y) || 1;
        const ux = (b.x - a.x) / L;
        const uy = (b.y - a.y) / L;
        return <line key={i} x1={a.x + ux * o.offset} y1={a.y + uy * o.offset} x2={a.x + ux * (o.offset + o.width)} y2={a.y + uy * (o.offset + o.width)} stroke={o.kind === 'window' ? '#38bdf8' : o.kind === 'door' ? '#ffffff' : '#a8a29e'} strokeWidth={fs / 2} />;
      })}
      {room.fixtures.map((f, i) => (
        <g key={i}>
          <rect x={f.x} y={f.y} width={f.width} height={f.depth} fill={FIX_COLORS[f.kind] ?? '#eee'} fillOpacity={0.85} stroke="#57534e" strokeWidth={fs / 10} strokeDasharray={f.kind === 'wallRun' ? `${fs / 2} ${fs / 4}` : undefined} />
          <text x={f.x + f.width / 2} y={f.y + f.depth / 2} fontSize={fs * 0.6} textAnchor="middle" dominantBaseline="middle" fill="#1c1917" fontWeight={600}>
            {(f.label || FIX_NAMES[f.kind]).slice(0, 18)}
          </text>
        </g>
      ))}
      {pts.map((p, i) => {
        const q = pts[(i + 1) % pts.length];
        const L = Math.round(Math.hypot(q.x - p.x, q.y - p.y));
        const mx = (p.x + q.x) / 2;
        const my = (p.y + q.y) / 2;
        let a = (Math.atan2(q.y - p.y, q.x - p.x) * 180) / Math.PI;
        if (a > 90 || a <= -90) a += 180;
        // label just outside the wall (outline is clockwise: outside is to the left)
        const nx = (q.y - p.y) / (L || 1);
        const ny = -(q.x - p.x) / (L || 1);
        return (
          <text key={i} x={mx + nx * fs * 1.1} y={my + ny * fs * 1.1} fontSize={fs * 0.75} textAnchor="middle" dominantBaseline="middle" fill="#44403c" fontWeight={700} transform={`rotate(${a} ${mx + nx * fs * 1.1} ${my + ny * fs * 1.1})`}>
            {L} mm
          </text>
        );
      })}
    </svg>
  );
}

export default function PlanReader() {
  const { settings, updateSettings, quotes, createQuote, updateQuote, catalog } = useStore();
  const nav = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const camRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<Mode>(settings.ai.apiKey || settings.ai.openaiKey ? 'auto' : 'chatgpt');
  const [input, setInput] = useState<PlanInput | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [fileName, setFileName] = useState('');
  const [hint, setHint] = useState('');
  const [pasted, setPasted] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [reading, setReading] = useState<PlanReading | null>(null);
  const [ri, setRi] = useState(0);
  const [cal, setCal] = useState<{ edge: number; mm: number }>({ edge: 0, mm: 0 });
  const [target, setTarget] = useState('new');
  const [quoteJoinery, setQuoteJoinery] = useState(true);
  const provider = settings.ai.provider ?? (settings.ai.openaiKey && !settings.ai.apiKey ? 'openai' : 'anthropic');
  const key = provider === 'openai' ? settings.ai.openaiKey : settings.ai.apiKey;

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    setError('');
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

  const done = (r: PlanReading) => {
    setReading(r);
    setRi(0);
    setCal({ edge: 0, mm: 0 });
    if (!r.rooms.length) setError('No rooms were found on this plan.');
  };
  const readAuto = async () => {
    if (!input || !key) return;
    setBusy(true);
    setError('');
    try {
      done(provider === 'openai' ? await readPlanOpenAI({ ...input, hint }, key, settings.ai.openaiModel ?? 'gpt-5') : await readPlanAnthropic({ ...input, hint }, key, settings.ai.model));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const readPasted = () => {
    setError('');
    try {
      done(parsePlanJson(pasted));
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(chatGptPrompt() + (hint.trim() ? `\n\nNotes: ${hint.trim()}` : ''));
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setError('Could not copy — select the prompt text below and copy it.');
    }
  };

  const room = reading?.rooms[ri] ?? null;
  const m = useMemo(() => (room ? roomMeasurements(room) : null), [room]);
  const checks = useMemo(() => (room ? designChecks(room) : []), [room]);

  const createFromRoom = () => {
    if (!room) return;
    const r = planRoomToRoom(room);
    const units: Unit[] = [];
    const runs: Run[] = [];
    const groups: Assembly[] = [];
    const places: { itemId: string; x: number; z: number; rot: number }[] = [];
    if (quoteJoinery) {
      const box = (f: { x: number; z: number; w: number; d: number; rot: number }) => {
        const ps = [[0, 0], [f.w, 0], [f.w, f.d], [0, f.d]].map(([a, b]) => placeXZ(a, b, { itemId: '', x: f.x, z: f.z, rot: f.rot }));
        return { x0: Math.min(...ps.map((q) => q[0])), x1: Math.max(...ps.map((q) => q[0])), z0: Math.min(...ps.map((q) => q[1])), z1: Math.max(...ps.map((q) => q[1])) };
      };
      const runs0 = (r.fixtures ?? []).filter((f) => f.kind === 'baseRun' || f.kind === 'tall').map(box);
      const inRun = (f: Parameters<typeof box>[0]) => {
        const b = box(f);
        return runs0.some((o) => Math.min(o.x1, b.x1) - Math.max(o.x0, b.x0) > 50 && Math.min(o.z1, b.z1) - Math.max(o.z0, b.z0) > 50);
      };
      for (const f of r.fixtures ?? []) {
        const H = room.ceilingHeight || 2700;
        // islands become cabinet groups (cupboards on 4, 2 or 1 side by size); stand-alone fridges / stoves become loose appliances
        if (f.kind === 'island' || ((f.kind === 'fridge' || f.kind === 'stove') && !inRun(f))) {
          let g: Assembly | null = null;
          if (f.kind === 'island') {
            const sides = f.d >= 1000 && f.w >= 1800 ? 4 : f.d >= 850 ? 2 : 1;
            g = islandGroup({ width: Math.round(f.w), depth: Math.round(f.d), height: 900, sides, countertopId: catalog.countertops[0]?.id ?? null, seatingOverhang: sides === 1 ? 300 : 0 });
          } else {
            const a = catalog.appliances.find((x) => x.category === (f.kind === 'fridge' ? 'fridge' : 'cooker') && x.placement === 'freestanding');
            if (a) g = applianceGroup(a);
          }
          if (g) {
            if (f.label) g.name = f.label;
            syncAssembly(g, catalog);
            groups.push(g);
            places.push({ itemId: g.id, x: Math.round(f.x), z: Math.round(f.z), rot: f.rot });
          }
          continue;
        }
        let made: Unit | Run | null = null;
        if (f.kind === 'bic') made = fitUnit('wardrobe', { width: f.w, height: Math.min(2400, H), depth: f.d, sideGap: 0, topGap: 0 });
        else if (f.kind === 'tall') made = fitUnit('kitchen_tall', { width: f.w, height: Math.min(2200, H), depth: f.d, sideGap: 0, topGap: 0 });
        else if (f.kind === 'wallRun') made = fitUnit('kitchen_wall', { width: f.w, height: 720, depth: f.d, sideGap: 0, topGap: 0 });
        else if (f.kind === 'baseRun') made = fitKitchen({ width: f.w, height: H, depth: f.d + 40, sideGap: 0, topGap: 0 });
        if (!made) continue;
        if ('legs' in made) {
          made.name = f.label || made.name;
          runs.push(made);
        } else {
          if (f.label) made.name = f.label;
          units.push(made);
        }
        places.push({ itemId: made.id, x: Math.round(f.x), z: Math.round(f.z), rot: f.rot });
      }
    }
    r.placements = places;
    let qid = target;
    if (target === 'new') qid = createQuote({ title: `${room.name} – from plan` });
    updateQuote(qid, (q: Quote) => {
      q.units.push(...units);
      q.runs.push(...runs);
      (q.assemblies ??= []).push(...groups);
      q.room = r;
    });
    nav(`/quotes/${qid}/room`);
  };

  return (
    <div>
      <PageHeader title="Plan reader" subtitle="PDF or drawing → room, BICs & kitchen layout" back />
      <div className="mx-auto max-w-5xl space-y-3 p-3">
        <Card title="1. The plan">
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <button className="btn-primary" onClick={() => fileRef.current?.click()}>
                <FileUp size={16} /> Choose PDF or image
              </button>
              <button className="btn-secondary" onClick={() => camRef.current?.click()}>
                <Camera size={16} /> Take a photo
              </button>
              <input ref={fileRef} type="file" accept="image/*,application/pdf" hidden onChange={(e) => (onFile(e.target.files?.[0]), (e.target.value = ''))} />
              <input ref={camRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => (onFile(e.target.files?.[0]), (e.target.value = ''))} />
            </div>
            {fileName && <p className="text-sm text-stone-600">📄 {fileName}</p>}
            {preview && <img src={preview} className="max-h-64 rounded-xl border border-stone-200 object-contain" />}
            <Field label="Notes for the reader (optional)">
              <TextInput value={hint} onChange={setHint} placeholder="e.g. only the kitchen and main bedroom; ceiling is 2600" />
            </Field>
          </div>
        </Card>

        <Card title="2. Read it">
          <Tabs<Mode>
            value={mode}
            onChange={setMode}
            tabs={[
              { value: 'auto', label: 'Automatic (API key)' },
              { value: 'chatgpt', label: 'With my ChatGPT' },
            ]}
          />
          {mode === 'auto' ? (
            <div className="mt-3 space-y-3 text-sm">
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="AI service">
                  <select className="input" value={provider} onChange={(e) => updateSettings((s) => (s.ai.provider = e.target.value as 'anthropic' | 'openai'))}>
                    <option value="anthropic">Anthropic (Claude) key</option>
                    <option value="openai">OpenAI API key</option>
                  </select>
                </Field>
                {!key && (
                  <div className="flex items-end">
                    <Link to="/settings" className="btn-secondary w-full">
                      <KeyRound size={16} /> Add your {provider === 'openai' ? 'OpenAI' : 'Anthropic'} key in Settings
                    </Link>
                  </div>
                )}
              </div>
              <p className="text-xs text-stone-500">An OpenAI API key is billed by OpenAI separately from a ChatGPT Plus / Pro subscription. To use your subscription instead, choose “With my ChatGPT”.</p>
              <button className="btn-primary w-full" disabled={!input || !key || busy} onClick={readAuto}>
                {busy ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />} {busy ? 'Reading the plan…' : 'Read the plan'}
              </button>
            </div>
          ) : (
            <div className="mt-3 space-y-3 text-sm">
              <ol className="list-decimal space-y-1 pl-5 text-stone-700">
                <li>Copy the instructions below.</li>
                <li>Open ChatGPT, attach your plan, paste the instructions and send.</li>
                <li>Copy ChatGPT’s whole reply and paste it in the box below.</li>
              </ol>
              <div className="flex flex-wrap gap-2">
                <button className="btn-primary" onClick={copyPrompt}>
                  <ClipboardCopy size={16} /> {copied ? 'Copied!' : 'Copy instructions'}
                </button>
                <a className="btn-secondary" href="https://chatgpt.com/" target="_blank" rel="noreferrer">
                  <ExternalLink size={16} /> Open ChatGPT
                </a>
              </div>
              <details className="rounded-xl border border-stone-200 p-2 text-xs">
                <summary className="cursor-pointer font-semibold">Show the instructions</summary>
                <pre className="mt-2 max-h-60 overflow-auto whitespace-pre-wrap text-[11px] text-stone-600">{chatGptPrompt()}</pre>
              </details>
              <Field label="ChatGPT’s reply">
                <textarea className="input min-h-[140px] font-mono text-xs" value={pasted} onChange={(e) => setPasted(e.target.value)} placeholder='{ "summary": … }' />
              </Field>
              <div className="flex gap-2">
                <button className="btn-primary flex-1" disabled={!pasted.trim()} onClick={readPasted}>
                  <MapIcon size={16} /> Show the layout
                </button>
                <button className="btn-ghost text-xs" onClick={() => setPasted(JSON.stringify(PLAN_JSON_EXAMPLE, null, 1))}>
                  Try an example
                </button>
              </div>
            </div>
          )}
          {error && <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        </Card>

        {reading && room && m && (
          <>
            <Card title={`3. ${reading.rooms.length} room${reading.rooms.length === 1 ? '' : 's'} found`}>
              <p className="mb-2 text-sm text-stone-700">{reading.summary}</p>
              <p className="mb-3 text-xs text-stone-500">Scale from: {reading.scaleSource}</p>
              {reading.rooms.length > 1 && (
                <div className="no-scrollbar mb-3 flex gap-2 overflow-x-auto">
                  {reading.rooms.map((r, i) => (
                    <button key={i} className={`shrink-0 rounded-xl border px-3 py-1.5 text-xs font-semibold ${ri === i ? 'border-brand-600 bg-brand-600 text-white' : 'border-stone-300 bg-white'}`} onClick={() => setRi(i)}>
                      {r.name}
                    </button>
                  ))}
                </div>
              )}
              <RoomOutline room={room} />
              <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                {[...new Set(room.fixtures.map((f) => f.kind))].map((k) => (
                  <span key={k} className="flex items-center gap-1">
                    <span className="h-3 w-3 rounded-sm border border-stone-400" style={{ background: FIX_COLORS[k] }} /> {FIX_NAMES[k]}
                  </span>
                ))}
              </div>
            </Card>

            <div className="grid gap-3 md:grid-cols-2">
              <Card title={`Measurements – ${room.name}`}>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                  <dt className="text-stone-500">Floor area</dt>
                  <dd className="font-semibold">{m.floorArea.toFixed(2)} m²</dd>
                  <dt className="text-stone-500">Overall size</dt>
                  <dd className="font-semibold">{m.size.w} × {m.size.d} mm</dd>
                  <dt className="text-stone-500">Perimeter</dt>
                  <dd className="font-semibold">{m.perimeter.toFixed(2)} m</dd>
                  <dt className="text-stone-500">Wall area (less openings)</dt>
                  <dd className="font-semibold">{m.wallArea.toFixed(1)} m²</dd>
                  <dt className="text-stone-500">Ceiling height</dt>
                  <dd className="font-semibold">{room.ceilingHeight} mm</dd>
                  {m.bicMetres > 0 && (
                    <>
                      <dt className="text-stone-500">BICs</dt>
                      <dd className="font-semibold">{m.bicMetres.toFixed(2)} lin. m</dd>
                    </>
                  )}
                  {m.baseMetres > 0 && (
                    <>
                      <dt className="text-stone-500">Base cabinets</dt>
                      <dd className="font-semibold">{m.baseMetres.toFixed(2)} lin. m</dd>
                    </>
                  )}
                  {m.wallMetres > 0 && (
                    <>
                      <dt className="text-stone-500">Wall cabinets</dt>
                      <dd className="font-semibold">{m.wallMetres.toFixed(2)} lin. m</dd>
                    </>
                  )}
                  {m.worktopArea > 0 && (
                    <>
                      <dt className="text-stone-500">Worktop (approx.)</dt>
                      <dd className="font-semibold">{m.worktopArea.toFixed(2)} m²</dd>
                    </>
                  )}
                </dl>
                <div className="mt-2 text-xs text-stone-500">Walls: {m.walls.map((w, i) => `W${i + 1} ${w}`).join(' · ')} mm</div>
                <div className="mt-3 rounded-xl border border-stone-200 p-2">
                  <span className="label">
                    <Ruler size={12} className="mr-1 inline" /> Correct the scale from one known wall
                  </span>
                  <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
                    <select className="input" value={cal.edge} onChange={(e) => setCal({ ...cal, edge: Number(e.target.value) })}>
                      {m.walls.map((w, i) => (
                        <option key={i} value={i}>
                          W{i + 1} (read as {w} mm)
                        </option>
                      ))}
                    </select>
                    <NumInput value={cal.mm} min={0} suffix="mm" onChange={(v) => setCal({ ...cal, mm: v })} />
                    <button className="btn-secondary" disabled={!cal.mm || !m.walls[cal.edge]} onClick={() => setReading(scaleReading(reading, cal.mm / m.walls[cal.edge]))}>
                      Apply
                    </button>
                  </div>
                </div>
              </Card>
              <Card title="Design checks & ideas">
                <div className="space-y-2 text-sm">
                  {checks.map((c, i) => (
                    <div key={i} className={`flex gap-2 rounded-xl p-2 ${c.ok ? 'bg-emerald-50 text-emerald-900' : 'bg-amber-50 text-amber-900'}`}>
                      {c.ok ? <CheckCircle2 size={16} className="mt-0.5 shrink-0" /> : <TriangleAlert size={16} className="mt-0.5 shrink-0" />}
                      <span>{c.text}</span>
                    </div>
                  ))}
                  {reading.designIdeas.map((d, i) => (
                    <div key={`i${i}`} className="flex gap-2 rounded-xl bg-stone-50 p-2">
                      <Lightbulb size={16} className="mt-0.5 shrink-0 text-brand-600" />
                      <span>
                        <b>{d.title}</b>
                        {d.detail ? ` — ${d.detail}` : ''}
                      </span>
                    </div>
                  ))}
                  {reading.assumptions.length > 0 && <p className="text-xs text-stone-500">Assumed: {reading.assumptions.join('; ')}</p>}
                </div>
              </Card>
            </div>

            <Card title="4. Use it">
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Quotation">
                  <select className="input" value={target} onChange={(e) => setTarget(e.target.value)}>
                    <option value="new">New quotation</option>
                    {quotes.slice(0, 30).map((q) => (
                      <option key={q.id} value={q.id}>
                        {q.number} · {q.title}
                      </option>
                    ))}
                  </select>
                </Field>
                <label className="flex items-end gap-2 pb-2 text-sm">
                  <input type="checkbox" checked={quoteJoinery} onChange={(e) => setQuoteJoinery(e.target.checked)} /> Also quote the BICs, kitchen, island and tall units found ({room.fixtures.filter((f) => ['bic', 'baseRun', 'wallRun', 'tall', 'island'].includes(f.kind)).length})
                </label>
              </div>
              <button className="btn-primary mt-3 w-full" onClick={createFromRoom}>
                <MapIcon size={16} /> Open as room layout{quoteJoinery ? ' with the joinery quoted' : ''}
              </button>
              <p className="mt-2 text-xs text-stone-500">The room keeps the read outline, doors and windows; the plan’s joinery shows as coloured outlines so you can line up the quoted units.</p>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
