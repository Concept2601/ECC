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
