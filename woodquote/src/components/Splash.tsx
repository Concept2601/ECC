// Loading page: opens the saved data, loads the screens and works out every
// quotation's total in small steps before the app is shown, so nothing
// stalls once you start working.
import { useEffect, useRef, useState } from 'react';
import { APP_TAGLINE } from '../app/brand';
import { DEVELOPER } from '../app/developer';
import { warmTotals } from '../app/totals';
import { useStore } from '../store';
import { LogoMark, Wordmark } from './Logo';

const STEPS = ['Opening your data', 'Loading workspaces', 'Preparing quotations', 'Ready'];

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
      await warmTotals((d, t) => setPct(50 + Math.round((t ? d / t : 1) * 45)));
      setStep(3);
      setPct(100);
      // short pause so the page does not flash past on fast machines
      const wait = Math.max(0, 700 - (performance.now() - t0));
      setTimeout(onDone, wait + 150);
    })();
  }, [hydrated, preload, onDone]);

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#111317] text-white">
      <div className="pointer-events-none absolute inset-0 opacity-60" style={{ background: 'radial-gradient(60% 50% at 50% 35%, rgba(196,138,75,.25), transparent 70%)' }} />
      <div className="relative flex flex-col items-center gap-5 px-8">
        <LogoMark size={76} className="animate-[pulse_2.4s_ease-in-out_infinite] drop-shadow-xl" />
        <div className="text-center">
          <Wordmark dark className="text-4xl" />
          <p className="mt-1 text-sm text-stone-400">{APP_TAGLINE}</p>
        </div>
        <div className="mt-6 w-64">
          <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-gradient-to-r from-brand-400 via-sky-400 to-teal-400 transition-[width] duration-300" style={{ width: `${pct}%` }} />
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
