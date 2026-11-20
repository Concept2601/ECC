// En-Quote brand: the Folio mark (a finished quote sheet with a slashed quotation
// mark and an orange full stop) and the "En/Quote" wordmark in Outfit.
// Geometry and colours follow the En-Quote Brand Guide v1.0 (brand/mark.mjs).
import '@fontsource/outfit/300.css';
import '@fontsource/outfit/500.css';
import '@fontsource/jetbrains-mono/400.css';
import { useId } from 'react';

const ORANGE = '#E8732A';

/** The bare mark. `tone` dark = white mark for dark backgrounds, light = graphite mark with TD blue for white. */
export function Mark({ size = 36, tone = 'dark', className }: { size?: number; tone?: 'dark' | 'light'; className?: string }) {
  const id = useId().replace(/:/g, '');
  const ink = tone === 'dark' ? '#F2F4F6' : '#1F2731';
  const stroke = size < 32 ? 7 : 6;
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={`bl${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#4A9EE4" />
          <stop offset="1" stopColor="#0A5C9C" />
        </linearGradient>
      </defs>
      <g fill="none" stroke={ink} strokeWidth={stroke} strokeLinejoin="round" strokeLinecap="round">
        <path d="M74 24H40a6 6 0 0 0-6 6v60a6 6 0 0 0 6 6h40a6 6 0 0 0 6-6V36Z" />
        <path d="M74 24V36H86Z" fill={ink} />
      </g>
      <path d="M49 45h9l-8 28h-9Z" fill={ink} />
      <path d="M64 45h9l-8 28h-9Z" fill={tone === 'dark' ? `url(#bl${id})` : '#004577'} />
      <circle cx="75" cy="68.5" r="4.5" fill={ORANGE} />
    </svg>
  );
}

/** App icon: the mark on the graphite tile (used wherever the old square logo was). */
export function LogoMark({ size = 36, className }: { size?: number; className?: string }) {
  const id = useId().replace(/:/g, '');
  const stroke = size < 32 ? 7 : 6;
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={`t${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2A333E" />
          <stop offset="1" stopColor="#11161C" />
        </linearGradient>
        <linearGradient id={`r${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFFFFF" stopOpacity=".22" />
          <stop offset=".35" stopColor="#FFFFFF" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`b${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#4A9EE4" />
          <stop offset="1" stopColor="#0A5C9C" />
        </linearGradient>
      </defs>
      <rect width="120" height="120" rx="27" fill={`url(#t${id})`} />
      <rect x=".5" y=".5" width="119" height="119" rx="26.5" fill="none" stroke={`url(#r${id})`} />
      <g transform="translate(7.5 7.5) scale(.875)">
        <g fill="none" stroke="#F2F4F6" strokeWidth={stroke} strokeLinejoin="round" strokeLinecap="round">
          <path d="M74 24H40a6 6 0 0 0-6 6v60a6 6 0 0 0 6 6h40a6 6 0 0 0 6-6V36Z" />
          <path d="M74 24V36H86Z" fill="#F2F4F6" />
        </g>
        <path d="M49 45h9l-8 28h-9Z" fill="#F2F4F6" />
        <path d="M64 45h9l-8 28h-9Z" fill={`url(#b${id})`} />
        <circle cx="75" cy="68.5" r="4.5" fill={ORANGE} />
      </g>
    </svg>
  );
}

/** "En/Quote": En light, the slash in blue (same angle as the quote strokes), Quote medium. */
export function Wordmark({ dark = false, className }: { dark?: boolean; className?: string }) {
  return (
    <span className={`whitespace-nowrap leading-none tracking-[.02em] ${dark ? 'text-[#F2F4F6]' : 'text-[#1F2731] dark:text-stone-900'} ${className ?? ''}`} style={{ fontFamily: '"Outfit", "Segoe UI", system-ui, sans-serif' }}>
      <span style={{ fontWeight: 300 }}>En</span>
      <span style={{ fontWeight: 300, color: dark ? '#5CA6E6' : '#004577' }}>/</span>
      <span style={{ fontWeight: 500 }}>Quote</span>
    </span>
  );
}
