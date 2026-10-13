import type { ReactNode } from 'react';
import type { DoorFit, DoorMaterial, FrontKind, Opening, PanelStyle, SlideDir } from '../lib/types';

const S = ({ children }: { children: ReactNode }) => (
  <svg viewBox="0 0 48 48" className="h-9 w-9" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    {children}
  </svg>
);
const door = <rect x="12" y="6" width="24" height="36" rx="1.5" />;

export const OPENING_ICONS: Record<Opening, ReactNode> = {
  left: (
    <S>
      {door}
      <path d="M36 6 L12 24 L36 42" strokeDasharray="3 3" strokeWidth={1.5} />
      <path d="M12 12h-3M12 36h-3" />
    </S>
  ),
  right: (
    <S>
      {door}
      <path d="M12 6 L36 24 L12 42" strokeDasharray="3 3" strokeWidth={1.5} />
      <path d="M36 12h3M36 36h3" />
    </S>
  ),
  pair: (
    <S>
      <rect x="6" y="6" width="17" height="36" rx="1.5" />
      <rect x="25" y="6" width="17" height="36" rx="1.5" />
      <path d="M23 6 L6 24 L23 42M25 6 L42 24 L25 42" strokeDasharray="3 3" strokeWidth={1.5} />
    </S>
  ),
  up: (
    <S>
      <rect x="6" y="12" width="36" height="24" rx="1.5" />
      <path d="M6 36 L24 12 L42 36" strokeDasharray="3 3" strokeWidth={1.5} />
      <path d="M24 8V2M20 5l4-4 4 4" />
    </S>
  ),
  down: (
    <S>
      <rect x="6" y="12" width="36" height="24" rx="1.5" />
      <path d="M6 12 L24 36 L42 12" strokeDasharray="3 3" strokeWidth={1.5} />
      <path d="M24 40v6M20 43l4 4 4-4" />
    </S>
  ),
};

export const OPENING_LABELS: Record<Opening, string> = { left: 'Hinged left', right: 'Hinged right', pair: 'Pair', up: 'Flap up', down: 'Flap down' };

export const MATERIAL_ICONS: Record<DoorMaterial, ReactNode> = {
  wood: (
    <S>
      {door}
      <path d="M18 10c2 8-2 16 0 28M24 10c-2 9 2 18 0 28M30 10c2 7-1 18 0 28" strokeWidth={1} />
    </S>
  ),
  glass: (
    <S>
      <rect x="12" y="6" width="24" height="36" rx="1.5" strokeWidth={3} />
      <rect x="15" y="9" width="18" height="30" fill="#bfe3ee" stroke="none" />
      <path d="M18 18l6-6M18 26l12-12" stroke="#fff" />
    </S>
  ),
  frameless: (
    <S>
      <rect x="12" y="6" width="24" height="36" rx="1" fill="#bfe3ee" strokeWidth={1} />
      <path d="M16 16l8-8M16 24l14-14" stroke="#fff" />
      <rect x="10" y="10" width="4" height="5" fill="currentColor" />
      <rect x="10" y="33" width="4" height="5" fill="currentColor" />
    </S>
  ),
};
export const MATERIAL_LABELS: Record<DoorMaterial, string> = { wood: 'Wood / board', glass: 'Glass (alu frame)', frameless: 'Frameless glass' };

export const FIT_ICONS: Record<DoorFit, ReactNode> = {
  overlay: (
    <S>
      <path d="M10 10v30M38 10v30" strokeWidth={4} />
      <rect x="6" y="40" width="36" height="4" fill="currentColor" />
    </S>
  ),
  half: (
    <S>
      <path d="M10 8v30M38 8v30" strokeWidth={4} />
      <rect x="10" y="38" width="28" height="4" fill="currentColor" />
    </S>
  ),
  inset: (
    <S>
      <path d="M10 8v34M38 8v34" strokeWidth={4} />
      <rect x="13" y="36" width="22" height="4" fill="currentColor" />
    </S>
  ),
};
export const FIT_LABELS: Record<DoorFit, string> = { overlay: 'Full overlay', half: 'Half overlay', inset: 'Inset' };

export const SLIDE_ICONS: Record<SlideDir, ReactNode> = {
  left: (
    <S>
      <rect x="18" y="8" width="22" height="32" rx="1.5" />
      <path d="M14 24H4M8 20l-4 4 4 4" />
    </S>
  ),
  right: (
    <S>
      <rect x="8" y="8" width="22" height="32" rx="1.5" />
      <path d="M34 24h10M40 20l4 4-4 4" />
    </S>
  ),
  bypass: (
    <S>
      <rect x="6" y="8" width="20" height="32" rx="1.5" />
      <rect x="22" y="12" width="20" height="28" rx="1.5" strokeDasharray="3 2" />
      <path d="M12 46h-8M30 46h12" strokeWidth={1.5} />
    </S>
  ),
};
export const SLIDE_LABELS: Record<SlideDir, string> = { left: 'Slides left', right: 'Slides right', bypass: 'By-pass pair' };

export const FRONT_ICONS: Record<FrontKind, ReactNode> = {
  open: (
    <S>
      <rect x="8" y="6" width="32" height="36" rx="1.5" />
      <path d="M8 18h32M8 30h32" />
    </S>
  ),
  door: (
    <S>
      {door}
      <circle cx="31" cy="24" r="1.6" fill="currentColor" />
    </S>
  ),
  drawer: (
    <S>
      <rect x="8" y="6" width="32" height="36" rx="1.5" />
      <path d="M8 18h32M8 30h32M20 12h8M20 24h8M20 36h8" />
    </S>
  ),
  sliding: SLIDE_ICONS.bypass,
  appliance: (
    <S>
      <rect x="8" y="8" width="32" height="32" rx="2" />
      <rect x="13" y="16" width="22" height="18" rx="1" fill="#30353b" stroke="none" />
      <path d="M14 12h20" />
    </S>
  ),
};
export const FRONT_LABELS: Record<FrontKind, string> = { open: 'Open', door: 'Door / flap', drawer: 'Drawers', sliding: 'Sliding', appliance: 'Appliance' };

export const PANEL_ICONS: Record<PanelStyle, ReactNode> = {
  flat: (
    <S>
      <rect x="12" y="6" width="24" height="36" />
    </S>
  ),
  shaker: (
    <S>
      <rect x="12" y="6" width="24" height="36" />
      <rect x="17" y="11" width="14" height="26" />
    </S>
  ),
  fluted: (
    <S>
      <rect x="12" y="6" width="24" height="36" />
      <path d="M17 9v30M21 9v30M25 9v30M29 9v30M33 9v30" strokeWidth={1} />
    </S>
  ),
  slatted: (
    <S>
      <path d="M13 6v36M19 6v36M25 6v36M31 6v36" strokeWidth={4} />
    </S>
  ),
};
export const PANEL_LABELS: Record<PanelStyle, string> = { flat: 'Flat', shaker: 'Shaker', fluted: 'Fluted', slatted: 'Slatted' };

export function IconChoice<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; icon: ReactNode; label: string }[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`flex w-[76px] flex-col items-center gap-1 rounded-xl border px-1 py-2 text-[11px] font-semibold leading-tight ${value === o.value ? 'border-brand-600 bg-brand-50 text-brand-800 ring-2 ring-brand-200' : 'border-stone-300 bg-white text-stone-600'}`}
        >
          {o.icon}
          <span className="text-center">{o.label}</span>
        </button>
      ))}
    </div>
  );
}

export const choices = <T extends string>(icons: Record<T, ReactNode>, labels: Record<T, string>, keys?: T[]) => (keys ?? (Object.keys(labels) as T[])).map((k) => ({ value: k, icon: icons[k], label: labels[k] }));
