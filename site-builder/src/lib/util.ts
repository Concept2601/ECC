export const uid = (prefix = 'id') =>
  `${prefix}_${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-4)}`;

export const escapeHtml = (s: string | undefined | null) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

export const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);

export const formatBytes = (n: number) => {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
};

export const stripTags = (html: string) =>
  html.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

export const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

/** Byte length of a data: URL's payload */
export const dataUrlBytes = (url: string) => {
  const i = url.indexOf(',');
  if (i < 0) return url.length;
  const meta = url.slice(0, i);
  const payload = url.slice(i + 1);
  if (meta.endsWith(';base64')) {
    const pad = payload.endsWith('==') ? 2 : payload.endsWith('=') ? 1 : 0;
    return Math.floor((payload.length * 3) / 4) - pad;
  }
  return decodeURIComponent(payload).length;
};

export const dataUrlToBytes = (url: string): Uint8Array => {
  const i = url.indexOf(',');
  const meta = url.slice(0, i);
  const payload = url.slice(i + 1);
  if (meta.endsWith(';base64')) {
    const bin = atob(payload);
    const out = new Uint8Array(bin.length);
    for (let k = 0; k < bin.length; k++) out[k] = bin.charCodeAt(k);
    return out;
  }
  return new TextEncoder().encode(decodeURIComponent(payload));
};

export const mimeExt = (mime: string) =>
  ({
    'image/webp': 'webp',
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/svg+xml': 'svg',
    'image/avif': 'avif',
    'video/mp4': 'mp4',
    'video/webm': 'webm',
    'video/quicktime': 'mov',
  })[mime] ?? 'bin';

export const timeAgo = (t: number) => {
  const s = Math.round((Date.now() - t) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return new Date(t).toLocaleDateString();
};
