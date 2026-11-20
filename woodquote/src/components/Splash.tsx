// Loading page: opens the saved data, loads the screens and works out every
// quotation's total in small steps before the app is shown, so nothing
// stalls once you start working.
import { useEffect, useRef, useState } from 'react';
import { APP_TAGLINE } from '../app/brand';
import { DEVELOPER } from '../app/developer';
import { warmTotals } from '../app/totals';
import { useStore } from '../store';
import { Mark, Wordmark } from './Logo';

const STEPS = ['Opening your data', 'Loading workspaces', 'Loading finish textures', 'Preparing quotations', 'Ready'];

export default function Splash({ preload, onDone }: { preload: () => Promise<unknown>[]; onDone: () => void }) {
  const hydrated = useStore((s) => s.hydrated);
  const [step, setStep] = useState(0);
  const [pct, setPct] = useState(4);
  const ran = useRef(false);

  useEffect(() => {
    if (!hydrated || ran.current) return;
    ran.current = true;
    const t0 = performance.now();
    void (async () => {
      setStep(1);
      setPct(15);
      const jobs = preload();
      let n = 0;
      await Promise.all(jobs.map((j) => j.then(() => setPct(15 + Math.round((++n / jobs.length) * 35))).catch(() => undefined)));
      setStep(2);
      // the finish library's photo textures, so 3D views show them straight away
      const texIds = (useStore.getState().catalog.finishes ?? []).map((f) => f.textureId).filter(Boolean);
      if (texIds.length) {
        const { preloadFinishTextures } = await import('../render/finishTextures');
        await preloadFinishTextures(texIds).catch(() => undefined);
      }
      setPct(55);
      setStep(3);
      await warmTotals((d, t) => setPct(55 + Math.round((t ? d / t : 1) * 40)));
      setStep(4);
      setPct(100);
      // short pause so the page does not flash past on fast machines
      const wait = Math.max(0, 700 - (performance.now() - t0));
      setTimeout(onDone, wait + 150);
    })();
  }, [hydrated, preload, onDone]);

  return (
    <div className="theme-fixed fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#12171C] text-white">
      <div className="pointer-events-none absolute inset-0 opacity-60" style={{ background: 'radial-gradient(120% 100% at 50% 0%, #26303B 0%, #12171C 55%, #0B0F13 100%)' }} />
      <div className="relative flex flex-col items-center gap-5 px-8">
        <Mark size={84} className="animate-[pulse_2.4s_ease-in-out_infinite]" />
        <div className="text-center">
          <Wordmark dark className="text-[44px]" />
          <p className="mt-3 text-[11px] uppercase tracking-[.32em] text-[#F2F4F6]/55" style={{ fontFamily: '"Outfit", system-ui, sans-serif', fontWeight: 300 }}>
            by Sir 2601 · Think Different
          </p>
          <p className="mt-2 text-sm text-stone-400">{APP_TAGLINE}</p>
        </div>
        <div className="mt-6 w-64">
          <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-gradient-to-r from-[#0A5C9C] via-[#4A9EE4] to-[#5CA6E6] transition-[width] duration-300" style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-3 text-center text-xs text-stone-400" role="status">
            {STEPS[step]}…
          </p>
        </div>
      </div>
      <p className="absolute bottom-6 text-[11px] text-stone-600">
        v{DEVELOPER.version} · {DEVELOPER.tagline}
      </p>
    </div>
  );
}
