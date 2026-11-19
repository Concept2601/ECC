// Finish texture images (your PNG / JPG library) for 3D views and renders.
// Images live in the finishes store and are loaded in the background; views
// redraw once a texture is ready, so nothing waits for big pictures.
import * as THREE from 'three';
import { create } from 'zustand';
import { finishBin, read } from '../app/db';

export const useFinishTex = create<{ version: number }>(() => ({ version: 0 }));

const images = new Map<string, ImageBitmap | HTMLImageElement>();
const loading = new Set<string>();
const textures = new Map<string, THREE.Texture>();

async function load(id: string) {
  if (images.has(id) || loading.has(id)) return;
  loading.add(id);
  try {
    const blob = await read<Blob>(finishBin, id);
    if (!blob) return;
    let img: ImageBitmap | HTMLImageElement;
    if (typeof createImageBitmap === 'function') img = await createImageBitmap(blob);
    else {
      img = new Image();
      img.src = URL.createObjectURL(blob);
      await img.decode();
    }
    images.set(id, img);
    useFinishTex.setState((s) => ({ version: s.version + 1 }));
  } catch (e) {
    console.warn('Finish texture could not be loaded', id, e);
  } finally {
    loading.delete(id);
  }
}

/** Load every texture a list of finishes uses (the loading page and the library call this). */
export async function preloadFinishTextures(ids: (string | null | undefined)[]) {
  await Promise.all(ids.filter(Boolean).map((id) => load(id!)));
}

/** The texture for an image id, or null while it is still loading. */
export function finishTexture(id: string): THREE.Texture | null {
  const hit = textures.get(id);
  if (hit) return hit;
  const img = images.get(id);
  if (!img) {
    void load(id);
    return null;
  }
  const t = new THREE.Texture(img as TexImageSource as HTMLImageElement);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  t.needsUpdate = true;
  t.userData.shared = true;
  textures.set(id, t);
  return t;
}

/** Forget an image (after it is replaced or deleted from the library). */
export function dropFinishTexture(id: string) {
  textures.get(id)?.dispose();
  textures.delete(id);
  images.delete(id);
  useFinishTex.setState((s) => ({ version: s.version + 1 }));
}
