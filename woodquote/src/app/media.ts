// Renders library and saving images / videos to the device.
//
// Captured views and photo renders are kept in their own storage bin
// (enquote-renders) with the camera position they were taken from, so a
// capture can be rendered again in the render studio or used in a video.
// "Save to device" writes the file to Documents/En-Quote/Renders (Windows and
// Android), the Files app (iPhone) or the Downloads folder (browser).
import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { create } from 'zustand';
import { listEntries, read, remove, renderBin, write } from './db';

export interface CameraView {
  position: [number, number, number];
  target: [number, number, number];
  fov: number;
}

export interface RenderRecord {
  id: string;
  kind: 'capture' | 'render' | 'video';
  title: string;
  quoteId: string | null;
  createdAt: number;
  width: number;
  height: number;
  mime: string;
  blob: Blob;
  camera?: CameraView;
  /** studio settings used for a photo render */
  settings?: Record<string, unknown>;
}

/** Bumped whenever the library changes, so open galleries refresh. */
export const useRenders = create<{ version: number }>(() => ({ version: 0 }));
const bump = () => useRenders.setState((s) => ({ version: s.version + 1 }));

export async function addRender(r: Omit<RenderRecord, 'id' | 'createdAt'>): Promise<RenderRecord> {
  const rec: RenderRecord = { ...r, id: `r${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, createdAt: Date.now() };
  await write(renderBin, rec.id, rec);
  bump();
  return rec;
}

export async function listRenders(quoteId?: string | null): Promise<RenderRecord[]> {
  const all = (await listEntries<RenderRecord>(renderBin)).map(([, v]) => v).filter(Boolean);
  return all.filter((r) => quoteId === undefined || r.quoteId === quoteId).sort((a, b) => b.createdAt - a.createdAt);
}

export const getRender = (id: string) => read<RenderRecord>(renderBin, id);

export async function deleteRender(id: string) {
  await remove(renderBin, [id]);
  bump();
}

const ext = (mime: string) => (mime.includes('png') ? 'png' : mime.includes('jpeg') ? 'jpg' : mime.includes('mp4') ? 'mp4' : mime.includes('webm') ? 'webm' : 'bin');
export const fileName = (r: Pick<RenderRecord, 'title' | 'createdAt' | 'mime'>) => `${r.title.replace(/[^\w-]+/g, '_').slice(0, 40) || 'render'}-${new Date(r.createdAt).toISOString().slice(0, 16).replace(/[:T]/g, '')}.${ext(r.mime)}`;

async function toBase64(blob: Blob): Promise<string> {
  const buf = new Uint8Array(await blob.arrayBuffer());
  let s = '';
  for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(s);
}

/** Write an image or video to the device's En-Quote/Renders folder. Returns where it went. */
export async function saveToDevice(blob: Blob, name: string): Promise<string> {
  if (window.woodquoteDesktop?.saveMedia) {
    const file = await window.woodquoteDesktop.saveMedia(name, await blob.arrayBuffer());
    void window.woodquoteDesktop.showFile?.(file);
    return `Saved to ${file}`;
  }
  if (Capacitor.isNativePlatform()) {
    const data = await toBase64(blob);
    if (Capacitor.getPlatform() === 'ios') {
      await Filesystem.writeFile({ path: `Renders/${name}`, data, directory: Directory.Documents, recursive: true });
      return `Saved to Files › On My iPhone › En-Quote › Renders › ${name}`;
    }
    try {
      await Filesystem.requestPermissions().catch(() => undefined);
      await Filesystem.writeFile({ path: `En-Quote/Renders/${name}`, data, directory: Directory.Documents, recursive: true });
      return `Saved to Documents/En-Quote/Renders/${name}`;
    } catch {
      const res = await Filesystem.writeFile({ path: `En-Quote/Renders/${name}`, data, directory: Directory.External, recursive: true });
      return `Saved to ${res.uri.replace('file://', '')}`;
    }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  return `Downloaded ${name}`;
}

/** Share sheet on phones (WhatsApp, email…), the default app on Windows, a download elsewhere. */
export async function shareMedia(blob: Blob, name: string): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    const res = await Filesystem.writeFile({ path: name, data: await toBase64(blob), directory: Directory.Cache });
    await Share.share({ title: name, url: res.uri, dialogTitle: 'Share' });
    return;
  }
  if (window.woodquoteDesktop) {
    await window.woodquoteDesktop.openFile(name, await blob.arrayBuffer());
    return;
  }
  const file = new File([blob], name, { type: blob.type });
  const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean };
  if (nav.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: name });
  else await saveToDevice(blob, name);
}

export const blobFromCanvas = (c: HTMLCanvasElement, mime = 'image/jpeg', q = 0.92) => new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('Could not read the picture'))), mime, q));
