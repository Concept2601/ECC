// En-Quote: one app for three trades. Names, colours and icons of each workspace.
import { Grid3x3, Hammer, Layers, type LucideIcon } from 'lucide-react';
import type { Trade } from '../lib/types';

export const APP_NAME = 'En-Quote';
export const APP_TAGLINE = 'Joinery · Ceilings · Tiling quotations';

export interface TradeMeta {
  id: Trade;
  label: string;
  blurb: string;
  icon: LucideIcon;
  /** accent colours: strong, soft background, text on soft */
  accent: string;
  soft: string;
  ink: string;
}

export const TRADES: TradeMeta[] = [
  { id: 'joinery', label: 'Joinery', blurb: 'Kitchens, BICs, wardrobes, TV units, islands and custom cabinets – designed in 3D with cut lists.', icon: Hammer, accent: '#a96f33', soft: '#f3e6d4', ink: '#6c4524' },
  { id: 'ceilings', label: 'Ceilings', blurb: 'Rhinoboard and PVC ceilings – brandering, cornices, designs, paint, lights and renovations.', icon: Layers, accent: '#2563eb', soft: '#dbeafe', ink: '#1e3a8a' },
  { id: 'tiling', label: 'Tiling', blurb: 'Floors and walls – tiles and boxes, adhesive, grout, trims, waterproofing and labour.', icon: Grid3x3, accent: '#0d9488', soft: '#ccfbf1', ink: '#134e4a' },
];

export const tradeMeta = (t: Trade | undefined) => TRADES.find((x) => x.id === t) ?? TRADES[0];
