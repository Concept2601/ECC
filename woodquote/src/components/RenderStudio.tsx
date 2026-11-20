// Render studio: set up light, shadows, reflections and the camera, then
// render a polished picture (studio or photoreal) or a video for the client.
import { Camera, Clapperboard, Download, ImageIcon, Loader2, Share2, Sparkles, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { addRender, blobFromCanvas, fileName, listRenders, saveToDevice, shareMedia, type CameraView, type RenderRecord } from '../app/media';
import { useSaves } from '../app/savepoints';
import { DEFAULT_LOOK, LOOKS, Studio, type Background, type FloorKind, type Look } from '../render/studio';
import { useStudio } from '../render/studioState';
import { renderVideo, type VideoPath } from '../render/video';

const SIZES: { id: string; label: string; w: number; h: number }[] = [
  { id: 'hd', label: 'HD 1280 × 720', w: 1280, h: 720 },
  { id: 'fhd', label: 'Full HD 1920 × 1080', w: 1920, h: 1080 },
  { id: 'qhd', label: '2K 2560 × 1440', w: 2560, h: 1440 },
  { id: 'uhd', label: '4K 3840 × 2160', w: 3840, h: 2160 },
  { id: 'sq', label: 'Square 2048 × 2048', w: 2048, h: 2048 },
  { id: 'portrait', label: 'Portrait 1440 × 1800 (phone / social)', w: 1440, h: 1800 },
];

function Slider({ label, value, min, max, step, onChange, fmt }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; fmt?: (v: number) => string }) {
  return (
    <label className="block">
      <span className="flex justify-between text-[11px] font-semibold uppercase tracking-wide text-stone-500">
        {label}
        <span className="font-normal normal-case text-stone-400">{fmt ? fmt(value) : value}</span>
      </span>
      <input type="range" className="w-full accent-brand-600" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  );
}

const lowPower = () => /Android|iPhone|iPad/i.test(navigator.userAgent) && ((navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4) < 8;

export default function RenderStudio() {
  const scene = useStudio((s) => s.scene)!;
  const host = useRef<HTMLDivElement>(null);
  const studio = useRef<Studio | null>(null);
  const [look, setLook] = useState<Look>({ ...DEFAULT_LOOK, lightsOn: scene.night, ...(scene.night ? LOOKS.find((l) => l.id === 'night')!.look : {}) });
  const [preset, setPreset] = useState(scene.night ? 'night' : 'daylight');
  const [tab, setTab] = useState<'image' | 'video'>('image');
  const [size, setSize] = useState(lowPower() ? 'fhd' : 'qhd');
  const [mode, setMode] = useState<'studio' | 'photoreal'>('studio');
  const [samples, setSamples] = useState(lowPower() ? 96 : 256);
  const [path, setPath] = useState<VideoPath>('turntable');
  const [seconds, setSeconds] = useState(10);
  const [vsize, setVsize] = useState(lowPower() ? 'hd' : 'fhd');
  const [captures, setCaptures] = useState<RenderRecord[]>([]);
  const [chosen, setChosen] = useState<string[]>([]);
  const [busy, setBusy] = useState<{ what: string; p: number } | null>(null);
  const cancel = useRef(false);
  const [result, setResult] = useState<{ rec: RenderRecord; url: string } | null>(null);
  const redraw = useRef<() => void>(() => undefined);

  useEffect(() => {
    const el = host.current!;
    let s: Studio;
    try {
      s = new Studio(el, scene);
    } catch {
      el.innerHTML = '<div class="p-6 text-sm text-stone-300">3D rendering is not supported on this device.</div>';
      return;
    }
    studio.current = s;
    let dirty = true;
    let raf = 0;
    s.enableControls(() => (dirty = true));
    redraw.current = () => (dirty = true);
    const size = () => {
      s.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      s.resize(el.clientWidth || 600, el.clientHeight || 400);
      dirty = true;
    };
    const ro = new ResizeObserver(size);
    ro.observe(el);
    size();
    const loop = () => {
      const moving = s.controls?.update();
      if ((dirty || moving) && !rendering.current) {
        s.preview();
        dirty = false;
      }
      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      s.dispose();
      studio.current = null;
    };
  }, [scene]);
  const rendering = useRef(false);

  useEffect(() => {
    studio.current?.setLook(look);
    redraw.current();
  }, [look]);

  useEffect(() => {
    void listRenders(scene.quoteId).then((l) => setCaptures(l.filter((r) => r.camera && r.kind !== 'video')));
  }, [scene.quoteId]);

  useEffect(() => () => void (result && URL.revokeObjectURL(result.url)), [result]);

  const set = (p: Partial<Look>) => setLook((l) => ({ ...l, ...p }));
  const close = () => useStudio.setState({ scene: null });
  const views = useMemo(() => chosen.map((id) => captures.find((c) => c.id === id)?.camera).filter(Boolean) as CameraView[], [chosen, captures]);

  /** Run a heavy job with the live preview paused; the preview size comes back afterwards. */
  const job = async (what: string, fn: (s: Studio) => Promise<RenderRecord>) => {
    const s = studio.current;
    if (!s || busy) return;
    cancel.current = false;
    rendering.current = true;
    setBusy({ what, p: 0 });
    const start = s.view();
    try {
      const rec = await fn(s);
      setResult({ rec, url: URL.createObjectURL(rec.blob) });
      useSaves.setState({ message: `${rec.kind === 'video' ? 'Video' : 'Render'} saved to the quotation’s Renders` });
    } catch (e) {
      if ((e as Error).message !== 'cancelled') {
        console.error('Render failed', e);
        useSaves.setState({ message: `Render failed: ${(e as Error).message}` });
      }
    } finally {
      s.setView(start);
      const el = host.current;
      s.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      if (el) s.resize(el.clientWidth || 600, el.clientHeight || 400);
      rendering.current = false;
      setBusy(null);
      redraw.current();
    }
  };

  const renderImage = () =>
    job(mode === 'photoreal' ? 'Path tracing' : 'Rendering', async (s) => {
      const z = SIZES.find((x) => x.id === size)!;
      const v = s.view();
      if (mode === 'photoreal') await s.renderPhotoreal(z.w, z.h, samples, (p) => setBusy({ what: 'Path tracing', p }), () => cancel.current);
      else {
        setBusy({ what: 'Rendering', p: 0.3 });
        await new Promise((r) => setTimeout(r, 30));
        s.renderStudioFrame(z.w, z.h, lowPower() ? 2 : 3);
      }
      if (cancel.current && mode !== 'photoreal') throw new Error('cancelled');
      const transparent = look.background === 'transparent';
      const blob = await blobFromCanvas(s.picture(), transparent ? 'image/png' : 'image/jpeg', 0.95);
      return addRender({ kind: 'render', title: scene.title, quoteId: scene.quoteId, width: z.w, height: z.h, mime: blob.type, blob, camera: v, settings: { ...look, mode, samples } });
    });

  const exportVideo = () =>
    job('Rendering video', async (s) => {
      const z = SIZES.find((x) => x.id === vsize)!;
      const start = s.view();
      const out = await renderVideo(s, { path, seconds, fps: 30, width: z.w, height: z.h, quality: lowPower() ? 0 : 1, start, views }, (p) => setBusy({ what: 'Rendering video', p }), () => cancel.current);
      return addRender({ kind: 'video', title: `${scene.title} – ${path === 'views' ? 'walk-through' : 'turntable'}`, quoteId: scene.quoteId, width: out.width, height: out.height, mime: out.mime, blob: out.blob, camera: start });
    });

  const capture = () =>
    job('Capturing', async (s) => {
      const blob = await blobFromCanvas(s.picture(), 'image/jpeg', 0.92);
      const rec = await addRender({ kind: 'capture', title: scene.title, quoteId: scene.quoteId, width: s.canvas().width, height: s.canvas().height, mime: 'image/jpeg', blob, camera: s.view() });
      setCaptures((c) => [rec, ...c]);
      return rec;
    });

  const field = 'block text-[11px] font-semibold uppercase tracking-wide text-stone-500';
  return (
    <div className="theme-fixed fixed inset-0 z-[80] flex flex-col bg-[#12171C] text-stone-200 md:flex-row">
      <div className="relative min-h-[45vh] flex-1">
        <div ref={host} className="absolute inset-0" />
        <div className="absolute left-3 top-3 flex items-center gap-2">
          <span className="flex items-center gap-1.5 rounded-xl bg-black/50 px-3 py-1.5 text-sm font-semibold text-white backdrop-blur">
            <Sparkles size={15} className="text-brand-300" /> Render studio · {scene.title}
          </span>
        </div>
        <div className="absolute right-3 top-3 flex gap-2">
          <button className="rounded-xl bg-black/50 p-2 text-white backdrop-blur hover:bg-black/70" title="Capture this view" aria-label="Capture this view" onClick={() => void capture()}>
            <Camera size={18} />
          </button>
          <button className="rounded-xl bg-black/50 p-2 text-white backdrop-blur hover:bg-black/70" aria-label="Close studio" onClick={close}>
            <X size={18} />
          </button>
        </div>
        <p className="pointer-events-none absolute bottom-3 left-3 rounded-lg bg-black/40 px-2 py-1 text-[11px] text-stone-300">Drag to turn · scroll / pinch zooms to the pointer · right-drag or two fingers to move</p>
        {busy && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/55 backdrop-blur-sm">
            <Loader2 className="animate-spin text-brand-300" size={30} />
            <div className="text-sm font-semibold text-white">
              {busy.what}… {Math.round(busy.p * 100)}%
            </div>
            <div className="h-1.5 w-64 overflow-hidden rounded-full bg-white/10">
              <div className="h-full bg-gradient-to-r from-brand-400 to-amber-300 transition-[width]" style={{ width: `${busy.p * 100}%` }} />
            </div>
            <button className="mt-1 rounded-lg bg-white/10 px-3 py-1 text-xs hover:bg-white/20" onClick={() => (cancel.current = true)}>
              {busy.what === 'Path tracing' ? 'Stop and keep' : 'Cancel'}
            </button>
          </div>
        )}
        {result && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/80 p-4">
            {result.rec.kind === 'video' ? <video src={result.url} controls autoPlay loop className="max-h-[70%] max-w-full rounded-xl shadow-2xl" /> : <img src={result.url} className="max-h-[70%] max-w-full rounded-xl shadow-2xl" />}
            <div className="text-xs text-stone-400">
              {result.rec.width} × {result.rec.height} · saved in this quotation’s Renders
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              <button className="btn-primary" onClick={() => void saveToDevice(result.rec.blob, fileName(result.rec)).then((m) => useSaves.setState({ message: m }))}>
                <Download size={16} /> Save to device
              </button>
              <button className="btn-secondary" onClick={() => void shareMedia(result.rec.blob, fileName(result.rec))}>
                <Share2 size={16} /> Share
              </button>
              <button className="btn-ghost text-stone-200 hover:bg-white/10" onClick={() => setResult(null)}>
                Back to the studio
              </button>
            </div>
          </div>
        )}
      </div>

      <aside className="max-h-[55vh] w-full shrink-0 space-y-4 overflow-y-auto border-white/5 bg-[#1A2028] p-4 md:max-h-none md:w-[340px] md:border-l">
        <div className="flex gap-1 rounded-xl bg-white/5 p-1">
          {(
            [
              ['image', 'Image', ImageIcon],
              ['video', 'Video', Clapperboard],
            ] as const
          ).map(([id, label, Icon]) => (
            <button key={id} className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-sm font-semibold ${tab === id ? 'bg-white/10 text-white' : 'text-stone-400'}`} onClick={() => setTab(id)}>
              <Icon size={15} /> {label}
            </button>
          ))}
        </div>

        <section className="space-y-2">
          <span className={field}>Look</span>
          <div className="flex flex-wrap gap-1.5">
            {LOOKS.map((l) => (
              <button
                key={l.id}
                className={`rounded-full px-2.5 py-1 text-xs font-semibold ${preset === l.id ? 'bg-brand-500 text-white' : 'bg-white/5 text-stone-300 hover:bg-white/10'}`}
                onClick={() => {
                  setPreset(l.id);
                  setLook({ ...DEFAULT_LOOK, ...l.look });
                }}
              >
                {l.label}
              </button>
            ))}
          </div>
        </section>

        <section className="space-y-2">
          <span className={field}>Sun & light</span>
          <Slider label="Sun direction" value={look.sunAzimuth} min={-180} max={180} step={5} fmt={(v) => `${v}°`} onChange={(v) => set({ sunAzimuth: v })} />
          <Slider label="Sun height" value={look.sunElevation} min={5} max={85} step={1} fmt={(v) => `${v}°`} onChange={(v) => set({ sunElevation: v })} />
          <Slider label="Sun strength" value={look.sunIntensity} min={0} max={5} step={0.1} onChange={(v) => set({ sunIntensity: v })} />
          <Slider label="Light colour" value={look.sunKelvin} min={2400} max={7500} step={100} fmt={(v) => `${v} K${v < 3600 ? ' warm' : v > 5800 ? ' cool' : ''}`} onChange={(v) => set({ sunKelvin: v })} />
          <Slider label="Room / sky light" value={look.ambient} min={0} max={2.5} step={0.05} onChange={(v) => set({ ambient: v })} />
          <Slider label="Exposure" value={look.exposure} min={0.4} max={2} step={0.05} onChange={(v) => set({ exposure: v })} />
          <label className="flex items-center justify-between text-sm">
            Cabinet LED lights on
            <input type="checkbox" className="accent-brand-500" checked={look.lightsOn} onChange={(e) => set({ lightsOn: e.target.checked })} />
          </label>
        </section>

        <section className="space-y-2">
          <span className={field}>Shadows & reflections</span>
          <Slider label="Shadow softness" value={look.shadowSoftness} min={0} max={1} step={0.05} onChange={(v) => set({ shadowSoftness: v })} />
          <Slider label="Shadow darkness" value={look.shadowDarkness} min={0} max={0.8} step={0.02} onChange={(v) => set({ shadowDarkness: v })} />
          <Slider label="Corner shading (ambient occlusion)" value={look.occlusion} min={0} max={1.5} step={0.05} onChange={(v) => set({ occlusion: v })} />
          <Slider label="Reflections" value={look.reflections} min={0} max={2} step={0.05} onChange={(v) => set({ reflections: v })} />
          <div className="grid grid-cols-2 gap-2">
            <label>
              <span className={field}>Floor</span>
              <select className="input mt-1 border-white/10 bg-white/5 py-1.5 text-sm text-stone-200" value={look.floor} onChange={(e) => set({ floor: e.target.value as FloorKind })}>
                <option value="shadow">Shadow only</option>
                <option value="matte">Matte floor</option>
                <option value="gloss">Polished floor</option>
                <option value="none">None</option>
              </select>
            </label>
            <label>
              <span className={field}>Floor colour</span>
              <input type="color" className="mt-1 h-[34px] w-full rounded-lg border border-white/10 bg-transparent" value={look.floorColor} onChange={(e) => set({ floorColor: e.target.value })} />
            </label>
          </div>
          <label className="block">
            <span className={field}>Background</span>
            <select className="input mt-1 border-white/10 bg-white/5 py-1.5 text-sm text-stone-200" value={look.background} onChange={(e) => set({ background: e.target.value as Background })}>
              <option value="white">White</option>
              <option value="light">Light grey</option>
              <option value="warm">Warm</option>
              <option value="gradient">Soft gradient</option>
              <option value="dark">Dark</option>
              <option value="transparent">Transparent (PNG)</option>
            </select>
          </label>
          <label className="flex items-center justify-between text-sm">
            Panel outlines
            <input type="checkbox" className="accent-brand-500" checked={look.outlines} onChange={(e) => set({ outlines: e.target.checked })} />
          </label>
        </section>

        {captures.length > 0 && (
          <section className="space-y-2">
            <span className={field}>Saved views {tab === 'video' && path === 'views' ? '– tick them in order' : '– tap to jump'}</span>
            <div className="grid grid-cols-3 gap-1.5">
              {captures.slice(0, 18).map((c) => {
                const n = chosen.indexOf(c.id);
                return <CaptureTile key={c.id} rec={c} order={tab === 'video' && path === 'views' && n >= 0 ? n + 1 : null} onClick={() => (tab === 'video' && path === 'views' ? setChosen((l) => (l.includes(c.id) ? l.filter((x) => x !== c.id) : [...l, c.id])) : (studio.current?.setView(c.camera!), redraw.current()))} />;
              })}
            </div>
          </section>
        )}

        {tab === 'image' ? (
          <section className="space-y-2 border-t border-white/5 pt-3">
            <span className={field}>Output</span>
            <select className="input border-white/10 bg-white/5 py-1.5 text-sm text-stone-200" value={size} onChange={(e) => setSize(e.target.value)}>
              {SIZES.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.label}
                </option>
              ))}
            </select>
            <div className="grid grid-cols-2 gap-1 rounded-xl bg-white/5 p-1">
              {(
                [
                  ['studio', 'Studio', 'Fast · soft shadows, AO'],
                  ['photoreal', 'Photoreal', 'Path traced · true reflections'],
                ] as const
              ).map(([id, label, hint]) => (
                <button key={id} className={`rounded-lg px-2 py-1.5 text-left ${mode === id ? 'bg-white/10 text-white' : 'text-stone-400'}`} onClick={() => setMode(id)}>
                  <div className="text-sm font-semibold">{label}</div>
                  <div className="text-[10px] leading-tight opacity-70">{hint}</div>
                </button>
              ))}
            </div>
            {mode === 'photoreal' && <Slider label="Samples (more = cleaner, slower)" value={samples} min={32} max={1024} step={32} onChange={setSamples} />}
            <button className="btn-primary w-full" disabled={!!busy} onClick={() => void renderImage()}>
              <Sparkles size={16} /> Render image
            </button>
          </section>
        ) : (
          <section className="space-y-2 border-t border-white/5 pt-3">
            <span className={field}>Camera path</span>
            <select className="input border-white/10 bg-white/5 py-1.5 text-sm text-stone-200" value={path} onChange={(e) => setPath(e.target.value as VideoPath)}>
              <option value="turntable">Turntable – full turn around the design</option>
              <option value="half-turn">Half turn – sweep across the front</option>
              <option value="views">Walk-through – glide between saved views</option>
            </select>
            {path === 'views' && <p className="text-xs text-stone-400">{views.length < 2 ? 'Capture two or more views (camera button), then tick them above in the order to visit them.' : `${views.length} views in order.`}</p>}
            <Slider label="Length" value={seconds} min={4} max={60} step={1} fmt={(v) => `${v} s`} onChange={setSeconds} />
            <select className="input border-white/10 bg-white/5 py-1.5 text-sm text-stone-200" value={vsize} onChange={(e) => setVsize(e.target.value)}>
              {SIZES.filter((z) => z.w * z.h <= 3840 * 2160).map((z) => (
                <option key={z.id} value={z.id}>
                  {z.label}
                </option>
              ))}
            </select>
            <button className="btn-primary w-full" disabled={!!busy || (path === 'views' && views.length < 2)} onClick={() => void exportVideo()}>
              <Clapperboard size={16} /> Render video (30 fps)
            </button>
            <p className="text-[11px] text-stone-500">Saved as MP4 where the device supports it (WebM otherwise).</p>
          </section>
        )}
      </aside>
    </div>
  );
}

function CaptureTile({ rec, order, onClick }: { rec: RenderRecord; order: number | null; onClick: () => void }) {
  const url = useMemo(() => URL.createObjectURL(rec.blob), [rec]);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);
  return (
    <button className="relative aspect-[4/3] overflow-hidden rounded-lg border border-white/10 hover:border-brand-400" onClick={onClick} title={new Date(rec.createdAt).toLocaleString()}>
      <img src={url} className="h-full w-full object-cover" />
      {order && <span className="absolute left-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-brand-500 text-[11px] font-bold text-white">{order}</span>}
    </button>
  );
}
