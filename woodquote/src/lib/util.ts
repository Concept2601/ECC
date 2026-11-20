export const uid = (prefix = ''): string =>
  prefix + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);

export const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

export const money = (n: number, currency: string): string =>
  `${currency}${round2(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const todayISO = (): string => new Date().toISOString().slice(0, 10);

export const addDaysISO = (iso: string, days: number): string => {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

export const fmtDate = (iso: string): string => {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

export const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n));

/**
 * Copy plain data. Walks the objects directly instead of turning everything into
 * text and back, so big kitchens copy quickly and photos / logos (long strings)
 * are shared rather than duplicated on every edit. Like JSON, undefined fields are dropped.
 */
export function deepClone<T>(v: T): T {
  if (v === null || typeof v !== 'object') return v;
  if (Array.isArray(v)) return v.map((x) => (x === undefined ? null : deepClone(x))) as T;
  const out: Record<string, unknown> = {};
  for (const k in v as Record<string, unknown>) {
    const x = (v as Record<string, unknown>)[k];
    if (x !== undefined && typeof x !== 'function') out[k] = deepClone(x);
  }
  return out as T;
}

export const sum = (xs: number[]): number => xs.reduce((a, b) => a + b, 0);

/** Approximate colour of a white light at a colour temperature (Kelvin). */
export function kelvinToHex(k: number): string {
  const t = clamp(k, 1500, 12000) / 100;
  const r = t <= 66 ? 255 : 329.698727446 * Math.pow(t - 60, -0.1332047592);
  const g = t <= 66 ? 99.4708025861 * Math.log(t) - 161.1195681661 : 288.1221695283 * Math.pow(t - 60, -0.0755148492);
  const b = t >= 66 ? 255 : t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  const h = (v: number) => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}

export const LIGHT_TEMPS: { k: number; label: string }[] = [
  { k: 2700, label: '2700K warm white' },
  { k: 3000, label: '3000K soft white' },
  { k: 4000, label: '4000K neutral white' },
  { k: 5000, label: '5000K daylight' },
  { k: 6500, label: '6500K cool white' },
  { k: 0, label: 'RGB colour' },
];

/**
 * Works out a sum typed into a measurement box: 600+18, 2400-2*18, (3000-60)/3,
 * 1200x2 or 1200×2. Only numbers, + − × ÷ and brackets; anything else gives null.
 */
export function evalSum(text: string): number | null {
  const src = text.replace(/,/g, '.').replace(/[x×]/gi, '*').replace(/÷/g, '/').replace(/−/g, '-').replace(/\s+/g, '');
  if (!src || !/^[0-9.+\-*/()]+$/.test(src)) return null;
  let i = 0;
  const peek = () => src[i];
  const num = (): number | null => {
    if (peek() === '(') {
      i++;
      const v = expr();
      if (peek() !== ')') return null;
      i++;
      return v;
    }
    if (peek() === '-') {
      i++;
      const v = num();
      return v == null ? null : -v;
    }
    if (peek() === '+') {
      i++;
      return num();
    }
    const m = /^\d*\.?\d+|^\d+\.?/.exec(src.slice(i));
    if (!m) return null;
    i += m[0].length;
    return Number(m[0]);
  };
  const term = (): number | null => {
    let v = num();
    while (v != null && (peek() === '*' || peek() === '/')) {
      const op = src[i++];
      const r = num();
      if (r == null) return null;
      v = op === '*' ? v * r : r === 0 ? null : v / r;
    }
    return v;
  };
  const expr = (): number | null => {
    let v = term();
    while (v != null && (peek() === '+' || peek() === '-')) {
      const op = src[i++];
      const r = term();
      if (r == null) return null;
      v = op === '+' ? v + r : v - r;
    }
    return v;
  };
  const v = expr();
  return v != null && i === src.length && Number.isFinite(v) ? Math.round(v * 1000) / 1000 : null;
}

/** True when the text is a sum still being typed (has an operator after the first character). */
export const isSum = (text: string) => /[0-9.)]\s*[+\-*/x×÷−(]/i.test(text) || /^\(/.test(text.trim());
