// What the render studio is showing: a way to rebuild the model, its size and
// the camera angle it was opened from. Kept free of three.js so any screen can
// open the studio without loading the 3D engine first.
import type { Object3D } from 'three';
import { create } from 'zustand';
import type { CameraView } from '../app/media';

export interface StudioScene {
  title: string;
  quoteId: string | null;
  /** rebuild the model; lit = LED lighting switched on */
  make: (lit?: boolean) => Object3D;
  bounds: { x0: number; x1: number; y0: number; y1: number; z0: number; z1: number };
  dir?: [number, number, number];
  camera: CameraView;
  night: boolean;
  /** room views have walls all round: light from inside */
  room: boolean;
}

export const useStudio = create<{ scene: StudioScene | null }>(() => ({ scene: null }));

/** The quotation in view (from the address), so captures are filed under it. */
export const currentQuoteId = () => /#\/quotes\/([^/?]+)/.exec(window.location.hash)?.[1] ?? null;
