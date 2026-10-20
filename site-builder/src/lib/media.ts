import type { MediaAsset, PerformanceSettings } from '../types';
import { uid } from './util';

export const VARIANT_WIDTHS = [480, 960, 1440];
const MAX_VIDEO_BYTES = 200 * 1024 * 1024;

const readAsDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not read image'));
    img.src = src;
  });

function encode(img: HTMLImageElement, width: number, mime: string, quality: number): Promise<Blob> {
  const height = Math.round((img.naturalHeight / img.naturalWidth) * width);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, width, height);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Encoding failed'))), mime, quality),
  );
}

/** Resize, re-encode (WebP by default) and create responsive variants for an image. */
export async function optimiseImage(source: string, name: string, perf: PerformanceSettings, originalSize: number) {
  const img = await loadImage(source);
  const isVector = source.startsWith('data:image/svg+xml');
  const isGif = source.startsWith('data:image/gif');
  if (isVector || isGif) {
    // SVG is already tiny and resolution-free; re-encoding a GIF would drop its animation.
    return { src: source, mime: isVector ? 'image/svg+xml' : 'image/gif', width: img.naturalWidth || undefined, height: img.naturalHeight || undefined, size: originalSize, variants: {} };
  }
  const srcMime = /^data:([^;]+)/.exec(source)?.[1] ?? 'image/jpeg';
  const mime = perf.convertToWebp ? 'image/webp' : srcMime === 'image/png' ? 'image/png' : 'image/jpeg';
  const width = Math.min(img.naturalWidth, perf.maxImageWidth);
  let blob = await encode(img, width, mime, perf.imageQuality);
  // Never make a file bigger than what the user uploaded at the same size.
  if (blob.size > originalSize && width === img.naturalWidth) blob = new Blob([await (await fetch(source)).blob()], { type: srcMime });
  const variants: Record<number, string> = {};
  if (perf.responsiveImages) {
    for (const w of VARIANT_WIDTHS) {
      if (w < width * 0.85) variants[w] = await readAsDataUrl(await encode(img, w, mime, perf.imageQuality));
    }
  }
  return {
    src: await readAsDataUrl(blob),
    mime: blob.type || mime,
    width,
    height: Math.round((img.naturalHeight / img.naturalWidth) * width),
    size: blob.size,
    variants,
    name,
  };
}

async function videoPoster(src: string, perf: PerformanceSettings): Promise<{ src: string; size: number; width: number; height: number } | undefined> {
  try {
    const v = document.createElement('video');
    v.muted = true;
    v.preload = 'auto';
    v.src = src;
    await new Promise((res, rej) => {
      v.onloadeddata = res;
      v.onerror = rej;
    });
    v.currentTime = Math.min(1, (v.duration || 2) / 2);
    await new Promise((res) => (v.onseeked = res));
    const width = Math.min(v.videoWidth, 1280);
    const height = Math.round((v.videoHeight / v.videoWidth) * width);
    const c = document.createElement('canvas');
    c.width = width;
    c.height = height;
    c.getContext('2d')!.drawImage(v, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((r) => c.toBlob(r, perf.convertToWebp ? 'image/webp' : 'image/jpeg', perf.imageQuality));
    if (!blob) return undefined;
    return { src: await readAsDataUrl(blob), size: blob.size, width, height };
  } catch {
    return undefined;
  }
}

/** Turn uploaded files into optimised media assets (a video also yields a poster image). */
export async function importFiles(files: FileList | File[], perf: PerformanceSettings): Promise<{ assets: MediaAsset[]; errors: string[] }> {
  const assets: MediaAsset[] = [];
  const errors: string[] = [];
  for (const file of Array.from(files)) {
    const base = file.name.replace(/\.[^.]+$/, '');
    const alt = base.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
    try {
      if (file.type.startsWith('image/')) {
        const raw = await readAsDataUrl(file);
        const o = await optimiseImage(raw, file.name, perf, file.size);
        assets.push({ id: uid('img'), name: file.name, kind: 'image', mime: o.mime, src: o.src, variants: o.variants, width: o.width, height: o.height, size: o.size, originalSize: file.size, alt: '', createdAt: Date.now() });
      } else if (file.type.startsWith('video/')) {
        if (file.size > MAX_VIDEO_BYTES) {
          errors.push(`${file.name}: videos over 200 MB should be hosted on YouTube or Vimeo and embedded.`);
          continue;
        }
        const src = await readAsDataUrl(file);
        const poster = await videoPoster(src, perf);
        let posterId: string | undefined;
        if (poster) {
          posterId = uid('img');
          assets.push({ id: posterId, name: `${base}-poster`, kind: 'image', mime: /^data:([^;]+)/.exec(poster.src)?.[1] ?? 'image/jpeg', src: poster.src, width: poster.width, height: poster.height, size: poster.size, originalSize: poster.size, alt: `${alt} (video poster)`, createdAt: Date.now() });
        }
        assets.push({ id: uid('vid'), name: file.name, kind: 'video', mime: file.type, src, size: file.size, originalSize: file.size, alt, posterId, createdAt: Date.now() });
      } else {
        errors.push(`${file.name}: unsupported file type.`);
      }
    } catch (err) {
      errors.push(`${file.name}: ${(err as Error).message}`);
    }
  }
  return { assets, errors };
}

/** Re-run optimisation on an existing image with the current speed settings. */
export async function reoptimise(m: MediaAsset, perf: PerformanceSettings): Promise<MediaAsset> {
  if (m.kind !== 'image') return m;
  const o = await optimiseImage(m.src, m.name, perf, m.size);
  return { ...m, src: o.src, mime: o.mime, width: o.width, height: o.height, size: o.size, variants: o.variants };
}
