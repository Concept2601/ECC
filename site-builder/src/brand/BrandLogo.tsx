/** Think Different Visuals logo, redrawn as vectors from the supplied artwork. */

export const BRAND = {
  name: 'Think Different Visuals',
  blue: '#1B4374',
  orange: '#E8983F',
  navy: '#2F3557',
} as const;

const D_PATH = 'M2 2H178C222 2 250 36 250 80C250 126 220 159 176 159H137V127H178C200 127 215 106 215 80C215 56 200 39 178 39H2Z';
const STEM_PATH = 'M53 68L88 48H98V159H53Z';

export function BrandMark({ size = 32, title }: { size?: number; title?: string }) {
  return (
    <svg className="brand-mark" width={size * 1.556} height={size} viewBox="0 0 252 162" role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      <path className="bm-d" d={D_PATH} />
      <path className="bm-t" d={STEM_PATH} />
    </svg>
  );
}

/** Mark + wordmark. `stacked` mirrors the original lock-up; `inline` suits top bars. */
export function BrandLogo({ variant = 'inline', size = 28, suffix }: { variant?: 'inline' | 'stacked'; size?: number; suffix?: string }) {
  return (
    <span className={`brand-logo ${variant}`} style={{ '--logo': `${size}px` } as React.CSSProperties}>
      <BrandMark size={size} />
      <span className="brand-words">
        <span className="bw-main"><span className="bw-think">Think</span> <span className="bw-diff">Different</span></span>
        <span className="bw-visuals">Visuals{suffix && <span className="bw-suffix"> · {suffix}</span>}</span>
      </span>
    </span>
  );
}
