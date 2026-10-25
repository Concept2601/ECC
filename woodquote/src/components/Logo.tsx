import { APP_NAME } from '../app/brand';

/** En-Quote mark: an "E" built from three bars (joinery, ceilings, tiling) beside a quotation sheet. */
export function LogoMark({ size = 36, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="eq-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#c48a4b" />
          <stop offset="1" stopColor="#8a5a2b" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="44" height="44" rx="12" fill="url(#eq-g)" />
      <rect x="13" y="12" width="5" height="24" rx="2.5" fill="#fff" />
      <rect x="13" y="12" width="20" height="5" rx="2.5" fill="#fff" />
      <rect x="13" y="21.5" width="15" height="5" rx="2.5" fill="#dbeafe" />
      <rect x="13" y="31" width="20" height="5" rx="2.5" fill="#ccfbf1" />
      <circle cx="36" cy="24" r="2.6" fill="#fff" opacity=".85" />
    </svg>
  );
}

export function Wordmark({ dark = false, className }: { dark?: boolean; className?: string }) {
  return (
    <span className={`font-semibold tracking-tight ${dark ? 'text-white' : 'text-stone-900'} ${className ?? ''}`}>
      {APP_NAME.split('-')[0]}
      <span className={dark ? 'text-brand-300' : 'text-brand-600'}>-{APP_NAME.split('-')[1]}</span>
    </span>
  );
}
