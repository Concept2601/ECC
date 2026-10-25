// Workspace chooser shown when the app opens: Joinery, Ceilings or Tiling.
import { ArrowRight } from 'lucide-react';
import { TRADES } from '../app/brand';
import { usePrefs } from '../app/prefs';
import type { Trade } from '../lib/types';
import { LogoMark, Wordmark } from './Logo';

export default function Launcher({ onPick }: { onPick: (t: Trade) => void }) {
  const last = usePrefs((s) => s.trade);
  const showLauncher = usePrefs((s) => s.showLauncher);
  const set = usePrefs((s) => s.set);
  return (
    <div className="fixed inset-0 z-[90] overflow-y-auto bg-[#111317] text-white">
      <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(70% 45% at 50% 0%, rgba(196,138,75,.18), transparent 70%)' }} />
      <div className="relative mx-auto flex min-h-full max-w-5xl flex-col justify-center px-5 py-10">
        <div className="mb-10 flex items-center gap-3">
          <LogoMark size={44} />
          <div>
            <Wordmark dark className="text-2xl" />
            <p className="text-sm text-stone-400">What are you quoting today?</p>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {TRADES.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => onPick(t.id)}
                className="group relative overflow-hidden rounded-3xl border border-white/10 bg-white/[.04] p-6 text-left transition hover:-translate-y-0.5 hover:border-white/25 hover:bg-white/[.07] focus:outline-none focus:ring-2"
                style={{ boxShadow: last === t.id ? `0 0 0 2px ${t.accent}` : undefined }}
              >
                <div className="absolute -right-10 -top-10 h-36 w-36 rounded-full opacity-30 blur-2xl transition group-hover:opacity-50" style={{ background: t.accent }} />
                <span className="relative flex h-12 w-12 items-center justify-center rounded-2xl" style={{ background: t.accent }}>
                  <Icon size={24} />
                </span>
                <h2 className="relative mt-5 text-2xl font-semibold tracking-tight">{t.label}</h2>
                <p className="relative mt-2 text-sm leading-relaxed text-stone-400">{t.blurb}</p>
                <span className="relative mt-6 inline-flex items-center gap-1.5 text-sm font-semibold" style={{ color: t.soft }}>
                  {last === t.id ? 'Continue' : 'Open'} <ArrowRight size={16} className="transition group-hover:translate-x-1" />
                </span>
              </button>
            );
          })}
        </div>
        <label className="mt-8 flex items-center gap-2 self-center text-xs text-stone-500">
          <input type="checkbox" checked={!showLauncher} onChange={(e) => set({ showLauncher: !e.target.checked })} className="accent-brand-500" />
          Skip this screen and open my last workspace next time (switch any time from the side bar)
        </label>
      </div>
    </div>
  );
}
