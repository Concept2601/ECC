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

export const deepClone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

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
