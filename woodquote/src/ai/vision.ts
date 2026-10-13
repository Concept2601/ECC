// Diagram reader: sends a plan / sketch / photo / 3D render (image or PDF) to
// Claude and gets back structured joinery units that the app can render & price.
import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';
import { createUnit, sec } from '../lib/presets';
import type { Catalog, FrontKind, ProductType, Unit } from '../lib/types';
import { uid } from '../lib/util';

const PRODUCT_TYPES = ['tv_stand', 'kitchen_base', 'kitchen_wall', 'kitchen_tall', 'island', 'built_in', 'wardrobe', 'sliding_wardrobe', 'bookshelf', 'vanity', 'custom'] as const;
const FRONTS = ['open', 'door', 'glassDoor', 'drawer', 'flap'] as const;

const SectionZ = z.object({
  heightRatio: z.number().describe('relative height of this compartment within its bay'),
  front: z.enum(FRONTS),
  doorCount: z.number().int().describe('1 or 2 doors for door/glassDoor fronts'),
  drawerCount: z.number().int().describe('number of stacked drawers when front = drawer'),
  shelves: z.number().int().describe('adjustable shelves inside this compartment'),
  hangingRail: z.boolean(),
});

const ItemZ = z.object({
  name: z.string().describe('short name, e.g. "Main bedroom wardrobe" or "Sink base unit"'),
  productType: z.enum(PRODUCT_TYPES),
  quantity: z.number().int(),
  width: z.number().describe('overall width in millimetres'),
  height: z.number().describe('overall height in millimetres including base and countertop'),
  depth: z.number().describe('overall depth in millimetres (carcass + doors, excluding countertop overhang)'),
  base: z.enum(['none', 'plinth', 'legs']),
  baseHeight: z.number().describe('plinth or leg height in mm, 0 when none'),
  countertop: z.boolean(),
  countertopOverhang: z.number().describe('mm, front overhang or island seating overhang'),
  slidingDoors: z.boolean(),
  slidingPanels: z.number().int(),
  slidingStyle: z.enum(['board', 'glass', 'mirror']),
  carcassFinish: z.string().describe('material / colour of the carcass if visible, e.g. "white melamine"'),
  frontFinish: z.string().describe('material / colour of doors & drawer fronts, e.g. "oak", "grey high gloss"'),
  bays: z.array(z.object({ widthRatio: z.number(), sections: z.array(SectionZ).describe('ordered bottom to top') })).describe('vertical bays ordered left to right'),
  notes: z.string().describe('anything the joiner should check or know'),
  confidence: z.enum(['high', 'medium', 'low']),
});

export const ReadingZ = z.object({
  summary: z.string(),
  scaleSource: z.string().describe('how dimensions were determined: written dimensions, scale bar, standard sizes, or estimated'),
  assumptions: z.array(z.string()),
  items: z.array(ItemZ),
});
export type Reading = z.infer<typeof ReadingZ>;
export type ReadingItem = z.infer<typeof ItemZ>;

const SYSTEM = `You are an experienced cabinet maker and estimator. You read furniture and joinery drawings — architectural plans, elevations, hand sketches, photos of existing furniture and 3D renders — and convert them into a structured list of cabinet units for a quotation app.

Model every piece as one or more rectangular carcass units. Each unit is split into vertical bays (left → right). Each bay is split into compartments stacked bottom → top. Each compartment has a front: open, door (1 or 2), glassDoor (aluminium-framed glass, 1 or 2), drawer (with a drawer count) or flap (lift-up). Compartments can also have adjustable shelves and a wardrobe hanging rail.

Guidance:
- Use dimensions written on the drawing whenever present (convert cm/m/inches to mm). If there is a scale bar or known reference, use it. Otherwise use standard sizes: kitchen base 870-900 H incl. top × 560-600 D, wall cabinets 720 H × 320 D, tall units 2100-2400 H, wardrobes 2400 H × 600 D, TV stands 450-550 H × 400 D, vanities 850 H × 480 D. Say what you estimated in assumptions.
- A run of kitchen cabinets should usually be several units (one per cabinet, or group identical cabinets with quantity). A plan view of a kitchen: produce base units along the walls, wall units if shown, tall units and the island.
- Use sliding_wardrobe with slidingDoors=true when doors slide; then the bays describe the interior.
- widthRatio / heightRatio are relative proportions (they may be the actual mm values).
- Height includes plinth/legs and countertop. Use base "plinth" for kitchen and built-in units, "legs" for free-standing furniture with legs, "none" for wall-hung units.
- Only include joinery that should be quoted. If the image is unrelated to furniture, return an empty items list and explain in summary.`;

async function blobToBase64(file: Blob): Promise<string> {
  const buf = new Uint8Array(await file.arrayBuffer());
  let s = '';
  for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(s);
}

/** Downscale photos so uploads stay small (Claude reads ~1568px max anyway). */
export async function prepareImage(file: File): Promise<{ dataUrl: string; base64: string; mediaType: 'image/jpeg' | 'image/png' }> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => rej(new Error('Could not open this image'));
      i.src = url;
    });
    const sc = Math.min(1, 1568 / Math.max(img.width, img.height));
    const c = document.createElement('canvas');
    c.width = Math.round(img.width * sc);
    c.height = Math.round(img.height * sc);
    const g = c.getContext('2d')!;
    g.fillStyle = '#fff';
    g.fillRect(0, 0, c.width, c.height);
    g.drawImage(img, 0, 0, c.width, c.height);
    const dataUrl = c.toDataURL('image/jpeg', 0.88);
    return { dataUrl, base64: dataUrl.split(',')[1], mediaType: 'image/jpeg' };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export interface ReaderInput {
  kind: 'image' | 'pdf';
  base64: string;
  mediaType: string;
  hint: string;
}

export async function readDiagram(input: ReaderInput, apiKey: string, model: string): Promise<Reading> {
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
  const media =
    input.kind === 'pdf'
      ? ({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: input.base64 } } as const)
      : ({ type: 'image', source: { type: 'base64', media_type: input.mediaType as 'image/jpeg', data: input.base64 } } as const);

  try {
    const res = await client.beta.messages.parse({
      model: model || 'claude-opus-5-5',
      max_tokens: 16000,
      system: SYSTEM,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'high', format: betaZodOutputFormat(ReadingZ) },
      messages: [
        {
          role: 'user',
          content: [media, { type: 'text', text: `Read this drawing and list the joinery units to quote.${input.hint.trim() ? `\n\nNotes from the joiner: ${input.hint.trim()}` : ''}` }],
        },
      ],
    });
    if (res.stop_reason === 'refusal') throw new Error('The model declined to read this file. Try a different image.');
    if (res.stop_reason === 'max_tokens') throw new Error('The drawing was too complex to read in one go. Crop it to fewer units and try again.');
    if (!res.parsed_output) throw new Error('Could not understand the response. Please try again.');
    return res.parsed_output;
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) throw new Error('Your Anthropic API key was rejected. Check it in Settings → Diagram reader.');
    if (err instanceof Anthropic.RateLimitError) throw new Error('Rate limited by the API — wait a minute and try again.');
    if (err instanceof Anthropic.BadRequestError) throw new Error(`The API rejected the request: ${err.message}`);
    if (err instanceof Anthropic.APIConnectionError) throw new Error('No connection to the AI service. Check your internet connection.');
    throw err;
  }
}

export const fileToBase64 = blobToBase64;

/* ------------------------------------------------- reading -> app units */

function matchBoard(cat: Catalog, finish: string, fallback: string): string {
  const words = finish.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2);
  if (!words.length) return fallback;
  let best = fallback;
  let bestScore = 0;
  for (const b of cat.boards) {
    const hay = `${b.name} ${b.category}`.toLowerCase();
    const score = words.reduce((a, w) => a + (hay.includes(w) ? 1 : 0), 0);
    if (score > bestScore) {
      best = b.id;
      bestScore = score;
    }
  }
  return best;
}

const clampInt = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Math.round(n || 0)));

export function itemToUnit(item: ReadingItem, cat: Catalog): Unit {
  const type = (PRODUCT_TYPES as readonly string[]).includes(item.productType) ? (item.productType as ProductType) : 'custom';
  const u = createUnit(type);
  u.name = item.name || u.name;
  u.qty = clampInt(item.quantity, 1, 99);
  u.width = clampInt(item.width, 200, 6000);
  u.height = clampInt(item.height, 200, 3200);
  u.depth = clampInt(item.depth, 100, 1500);
  u.base = item.base;
  u.baseHeight = item.base === 'none' ? 0 : clampInt(item.baseHeight || 100, 20, 400);
  if (item.countertop && !u.countertopId) u.countertopId = cat.countertops[0]?.id ?? null;
  if (!item.countertop) u.countertopId = null;
  u.countertopOverhang = clampInt(item.countertopOverhang, 0, 600);
  u.sliding = { enabled: item.slidingDoors, panels: clampInt(item.slidingPanels || 2, 2, 6), style: item.slidingStyle };
  u.carcassMaterialId = matchBoard(cat, item.carcassFinish, u.carcassMaterialId);
  u.frontMaterialId = matchBoard(cat, item.frontFinish, u.frontMaterialId);
  u.notes = item.confidence === 'low' ? `Check: ${item.notes}`.trim() : '';
  if (item.bays.length) {
    u.bays = item.bays.slice(0, 12).map((b) => ({
      id: uid('b'),
      size: Math.max(0.05, b.widthRatio || 1),
      sections: (b.sections.length ? b.sections : [{ heightRatio: 1, front: 'door' as FrontKind, doorCount: 1, drawerCount: 1, shelves: 0, hangingRail: false }]).slice(0, 10).map((s) => ({
        ...sec(),
        size: Math.max(0.05, s.heightRatio || 1),
        front: (FRONTS as readonly string[]).includes(s.front) ? s.front : 'open',
        doorCount: s.doorCount >= 2 ? 2 : 1,
        drawerCount: clampInt(s.drawerCount || 1, 1, 8),
        shelves: clampInt(s.shelves, 0, 12),
        hangingRail: !!s.hangingRail,
      })),
    }));
  }
  return u;
}
