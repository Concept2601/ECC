// Plan reader: reads an architectural plan (PDF, photo, sketch) into rooms with
// their measured outline, doors / windows, and the joinery on them (built-in
// cupboards, kitchen runs, islands, sinks, stoves…), plus design ideas. Works
// with an Anthropic or OpenAI key, or by pasting the answer from ChatGPT.
import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';
import { newWall, OPENING_LABELS } from '../lib/room';
import type { FixtureKind, Room, RoomFixture, RoomOpening } from '../lib/types';
import { uid } from '../lib/util';

const FIXTURE_KINDS = ['bic', 'baseRun', 'wallRun', 'tall', 'island', 'sink', 'stove', 'hob', 'fridge', 'other'] as const;

const PointZ = z.object({ x: z.number(), y: z.number() });
const OpeningZ = z.object({
  kind: z.enum(['window', 'door', 'opening']),
  edge: z.number().int().describe('index of the outline edge it is in: edge i runs from point i to point i+1 (the last edge closes back to point 0)'),
  offset: z.number().describe('mm from the start of that edge to the near side of the opening'),
  width: z.number().describe('mm'),
});
const FixtureZ = z.object({
  kind: z.enum(FIXTURE_KINDS).describe('bic = built-in cupboard / wardrobe; baseRun = run of floor kitchen cabinets with worktop; wallRun = wall-hung kitchen cabinets; tall = tall pantry / oven / fridge housing; island = kitchen island or peninsula'),
  label: z.string(),
  x: z.number().describe('left edge of its rectangle on the plan, mm'),
  y: z.number().describe('top edge of its rectangle on the plan, mm'),
  width: z.number().describe('horizontal size on the plan, mm'),
  depth: z.number().describe('vertical size on the plan, mm'),
  against: z.enum(['top', 'right', 'bottom', 'left', 'none']).describe('which side of the rectangle is against a wall (its back); none for islands'),
});
const RoomZ = z.object({
  name: z.string(),
  outline: z.array(PointZ).describe('room corners in mm, plan coordinates (x right, y down), going clockwise, starting top-left'),
  ceilingHeight: z.number().describe('mm, 2700 if not shown'),
  openings: z.array(OpeningZ),
  fixtures: z.array(FixtureZ),
});
export const PlanZ = z.object({
  summary: z.string(),
  scaleSource: z.string().describe('written dimensions, scale bar, door widths, or estimated'),
  rooms: z.array(RoomZ),
  designIdeas: z.array(z.object({ title: z.string(), detail: z.string() })),
  assumptions: z.array(z.string()),
});
export type PlanReading = z.infer<typeof PlanZ>;
export type PlanRoom = PlanReading['rooms'][number];

export const PLAN_PROMPT = `You are an experienced kitchen & built-in cupboard designer and estimator. Read the floor plan (architectural PDF, drawing, photo or sketch) and return:
1. Every room that matters for joinery (kitchens, bedrooms, dressing rooms, laundries, living rooms with TV walls): its outline as corner points in millimetres in plan coordinates (x to the right, y downwards), clockwise from the top-left corner, measured to the inside face of the walls.
2. Doors, windows and open-plan openings in each room, by the outline edge they sit in.
3. The joinery drawn on the plan as rectangles: built-in cupboards (BICs / wardrobes), kitchen base runs, wall cabinets, tall units, islands, and the sink, stove / cooker, hob and fridge positions.
4. Practical design ideas for this layout: kitchen work triangle, storage, island clearances, BIC layout, lighting, and anything a joiner should suggest to the client.

Rules:
- Use written dimensions first; otherwise a scale bar; otherwise standard door widths (800–900 mm) to set the scale. Say which in scaleSource.
- All values in millimetres. Kitchen base runs are about 600 deep, wall cabinets 320–350, BICs 600, islands 900–1200 deep.
- Every room's coordinates use the same plan origin so rooms line up.
- If something is unclear, make a sensible assumption and list it in assumptions.`;

/** The JSON shape, for pasting into ChatGPT. */
export const PLAN_JSON_EXAMPLE = {
  summary: 'Open-plan kitchen and two bedrooms',
  scaleSource: 'written dimensions',
  rooms: [
    {
      name: 'Kitchen',
      outline: [
        { x: 0, y: 0 },
        { x: 4200, y: 0 },
        { x: 4200, y: 3600 },
        { x: 0, y: 3600 },
      ],
      ceilingHeight: 2700,
      openings: [{ kind: 'window', edge: 0, offset: 1500, width: 1200 }],
      fixtures: [
        { kind: 'baseRun', label: 'Main kitchen run', x: 0, y: 0, width: 3600, depth: 600, against: 'top' },
        { kind: 'sink', label: 'Sink', x: 1800, y: 0, width: 900, depth: 600, against: 'top' },
        { kind: 'island', label: 'Island', x: 1200, y: 1800, width: 2000, depth: 1000, against: 'none' },
      ],
    },
  ],
  designIdeas: [{ title: 'Work triangle', detail: 'Keep sink, hob and fridge 1.2–2.7 m apart.' }],
  assumptions: ['Ceiling height not shown, 2700 mm assumed'],
};

export const chatGptPrompt = () =>
  `${PLAN_PROMPT}\n\nI have attached the plan. Reply with ONLY one JSON object (no other text) in exactly this format:\n${JSON.stringify(PLAN_JSON_EXAMPLE, null, 1)}`;

export interface PlanInput {
  kind: 'image' | 'pdf';
  base64: string;
  mediaType: string;
  hint: string;
}

const userText = (hint: string) => `Read this plan.${hint.trim() ? `\n\nNotes from the joiner: ${hint.trim()}` : ''}`;

export async function readPlanAnthropic(input: PlanInput, apiKey: string, model: string): Promise<PlanReading> {
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
  const media =
    input.kind === 'pdf'
      ? ({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: input.base64 } } as const)
      : ({ type: 'image', source: { type: 'base64', media_type: input.mediaType as 'image/jpeg', data: input.base64 } } as const);
  try {
    const res = await client.beta.messages.parse({
      model: model || 'claude-opus-5-5',
      max_tokens: 16000,
      system: PLAN_PROMPT,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'high', format: betaZodOutputFormat(PlanZ) },
      messages: [{ role: 'user', content: [media, { type: 'text', text: userText(input.hint) }] }],
    });
    if (res.stop_reason === 'refusal') throw new Error('The model declined to read this file.');
    if (res.stop_reason === 'max_tokens') throw new Error('The plan was too complex to read in one go. Crop it to fewer rooms and try again.');
    if (!res.parsed_output) throw new Error('Could not understand the response. Please try again.');
    return res.parsed_output;
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) throw new Error('Your Anthropic API key was rejected. Check it in Settings → AI readers.');
    if (err instanceof Anthropic.RateLimitError) throw new Error('Rate limited by the API — wait a minute and try again.');
    if (err instanceof Anthropic.APIConnectionError) throw new Error('No connection to the AI service. Check your internet connection.');
    throw err;
  }
}

export async function readPlanOpenAI(input: PlanInput, apiKey: string, model: string): Promise<PlanReading> {
  const media =
    input.kind === 'pdf'
      ? { type: 'file', file: { filename: 'plan.pdf', file_data: `data:application/pdf;base64,${input.base64}` } }
      : { type: 'image_url', image_url: { url: `data:${input.mediaType};base64,${input.base64}`, detail: 'high' } };
  let res: Response;
  try {
    res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: model || 'gpt-5',
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: `${PLAN_PROMPT}\n\nReply with one JSON object in exactly this format:\n${JSON.stringify(PLAN_JSON_EXAMPLE)}` },
          { role: 'user', content: [media, { type: 'text', text: userText(input.hint) }] },
        ],
      }),
    });
  } catch {
    throw new Error('No connection to OpenAI. Check your internet connection.');
  }
  if (res.status === 401) throw new Error('Your OpenAI API key was rejected. Check it in Settings → AI readers.');
  if (res.status === 429) throw new Error('OpenAI rate limit or no credit on this API key — check your OpenAI billing.');
  if (!res.ok) throw new Error(`OpenAI rejected the request (${res.status}): ${(await res.text()).slice(0, 300)}`);
  const j = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return parsePlanJson(j.choices?.[0]?.message?.content ?? '');
}

/** Accepts the JSON reply from ChatGPT (with or without ``` fences / extra text). */
export function parsePlanJson(text: string): PlanReading {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('No JSON found — paste ChatGPT’s whole reply.');
  let raw: unknown;
  try {
    raw = JSON.parse(text.slice(start, end + 1));
  } catch {
    throw new Error('The reply is not valid JSON. Ask ChatGPT to “reply with only the JSON object”.');
  }
  const r = raw as Partial<PlanReading>;
  // be forgiving about missing lists / fields
  const fixed = {
    summary: r.summary ?? '',
    scaleSource: r.scaleSource ?? 'not stated',
    assumptions: r.assumptions ?? [],
    designIdeas: (r.designIdeas ?? []).map((d) => (typeof d === 'string' ? { title: d, detail: '' } : d)),
    rooms: (r.rooms ?? []).map((room) => ({ ...room, name: room.name ?? 'Room', ceilingHeight: room.ceilingHeight ?? 2700, openings: room.openings ?? [], fixtures: room.fixtures ?? [] })),
  };
  const p = PlanZ.safeParse(fixed);
  if (!p.success) throw new Error(`The reply is missing some information: ${p.error.issues[0]?.path.join('.')} — ${p.error.issues[0]?.message}`);
  return p.data;
}

/* ----------------------------------------------------------- measurements */

const len = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(b.x - a.x, b.y - a.y);

export function roomMeasurements(r: PlanRoom) {
  const pts = r.outline;
  let a2 = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const q = pts[(i + 1) % pts.length];
    a2 += p.x * q.y - q.x * p.y;
  }
  const walls = pts.map((p, i) => Math.round(len(p, pts[(i + 1) % pts.length])));
  const perimeter = walls.reduce((s, w) => s + w, 0);
  const openingArea = r.openings.reduce((s, o) => s + o.width * (o.kind === 'window' ? 1200 : o.kind === 'door' ? 2100 : r.ceilingHeight), 0);
  const lm = (k: FixtureKind) => r.fixtures.filter((f) => f.kind === k).reduce((s, f) => s + Math.max(f.width, f.depth), 0);
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  return {
    floorArea: Math.abs(a2) / 2 / 1e6,
    perimeter: perimeter / 1000,
    walls,
    wallArea: Math.max(0, (perimeter * r.ceilingHeight - openingArea) / 1e6),
    size: { w: Math.round(Math.max(...xs) - Math.min(...xs)), d: Math.round(Math.max(...ys) - Math.min(...ys)) },
    bicMetres: lm('bic') / 1000,
    baseMetres: lm('baseRun') / 1000,
    wallMetres: lm('wallRun') / 1000,
    worktopArea: r.fixtures.filter((f) => f.kind === 'baseRun' || f.kind === 'island').reduce((s, f) => s + f.width * f.depth, 0) / 1e6,
  };
}

/** Scale every coordinate of a reading (calibrate from one known length). */
export function scaleReading(p: PlanReading, k: number): PlanReading {
  const s = (v: number) => Math.round(v * k);
  return {
    ...p,
    rooms: p.rooms.map((r) => ({
      ...r,
      outline: r.outline.map((q) => ({ x: s(q.x), y: s(q.y) })),
      openings: r.openings.map((o) => ({ ...o, offset: s(o.offset), width: s(o.width) })),
      fixtures: r.fixtures.map((f) => ({ ...f, x: s(f.x), y: s(f.y), width: s(f.width), depth: s(f.depth) })),
    })),
  };
}

/* ----------------------------------------------------------- design checks */

const centre = (f: PlanRoom['fixtures'][number]) => ({ x: f.x + f.width / 2, y: f.y + f.depth / 2 });
function gap(a: PlanRoom['fixtures'][number], b: PlanRoom['fixtures'][number]) {
  const dx = Math.max(0, Math.max(a.x, b.x) - Math.min(a.x + a.width, b.x + b.width));
  const dy = Math.max(0, Math.max(a.y, b.y) - Math.min(a.y + a.depth, b.y + b.depth));
  return Math.hypot(dx, dy);
}

/** Rule-of-thumb checks a kitchen / BIC designer would make. */
export function designChecks(r: PlanRoom): { ok: boolean; text: string }[] {
  const out: { ok: boolean; text: string }[] = [];
  const f = (k: FixtureKind) => r.fixtures.find((x) => x.kind === k);
  const sink = f('sink');
  const cook = f('hob') ?? f('stove');
  const fridge = f('fridge');
  if (sink && cook && fridge) {
    const legs = [len(centre(sink), centre(cook)), len(centre(cook), centre(fridge)), len(centre(fridge), centre(sink))].map((v) => v / 1000);
    const total = legs.reduce((s, v) => s + v, 0);
    const good = legs.every((v) => v >= 1.2 && v <= 2.7) && total >= 4 && total <= 7.9;
    out.push({ ok: good, text: `Work triangle: sink–cooker ${legs[0].toFixed(1)} m, cooker–fridge ${legs[1].toFixed(1)} m, fridge–sink ${legs[2].toFixed(1)} m (total ${total.toFixed(1)} m). ${good ? 'Within the 4–7.9 m guideline.' : 'Aim for each side 1.2–2.7 m and a total of 4–7.9 m.'}` });
  }
  if (sink && cook) {
    const d = gap(sink, cook);
    if (d < 400) out.push({ ok: false, text: `Sink and cooker are only ${Math.round(d)} mm apart — leave at least 400 mm of worktop between them.` });
  }
  for (const isl of r.fixtures.filter((x) => x.kind === 'island')) {
    const others = r.fixtures.filter((x) => x !== isl && (x.kind === 'baseRun' || x.kind === 'tall' || x.kind === 'bic'));
    const min = Math.min(...others.map((o) => gap(isl, o)), Infinity);
    if (Number.isFinite(min)) out.push({ ok: min >= 1000, text: `${isl.label || 'Island'}: ${Math.round(min)} mm walkway to the nearest cabinets. ${min >= 1000 ? 'Good (1000–1200 mm recommended).' : 'Make it at least 1000 mm (1200 mm with two cooks).'}` });
    if (Math.min(isl.width, isl.depth) < 850) out.push({ ok: false, text: `${isl.label || 'Island'} is under 850 mm deep — fine for a breakfast bar, tight for cabinets on both sides.` });
  }
  for (const b of r.fixtures.filter((x) => x.kind === 'bic')) {
    const depth = b.against === 'top' || b.against === 'bottom' ? b.depth : b.width;
    if (depth < 550) out.push({ ok: false, text: `${b.label || 'BIC'} is ${Math.round(depth)} mm deep — hanging space needs about 600 mm (or use pull-out rails).` });
  }
  const base = r.fixtures.filter((x) => x.kind === 'baseRun').reduce((s, x) => s + Math.max(x.width, x.depth), 0);
  if (base && base < 2400) out.push({ ok: false, text: `Only ${(base / 1000).toFixed(1)} m of base cabinets — consider an L-shape or island for more worktop.` });
  if (!out.length) out.push({ ok: true, text: 'No layout problems found with the standard clearances.' });
  return out;
}

/* ----------------------------------------------------------- to the app */

/** A RoomFixture (back-left corner + rotation) from a plan rectangle. */
export function toFixture(fx: PlanRoom['fixtures'][number], ox: number, oy: number): RoomFixture {
  const x = fx.x - ox;
  const y = fx.y - oy;
  const base = { id: uid('fx'), kind: fx.kind as FixtureKind, label: fx.label };
  switch (fx.against) {
    case 'right':
      return { ...base, x: x + fx.width, z: y, w: fx.depth, d: fx.width, rot: 90 };
    case 'bottom':
      return { ...base, x: x + fx.width, z: y + fx.depth, w: fx.width, d: fx.depth, rot: 180 };
    case 'left':
      return { ...base, x, z: y + fx.depth, w: fx.depth, d: fx.width, rot: 270 };
    default:
      return { ...base, x, z: y, w: fx.width, d: fx.depth, rot: 0 };
  }
}

/** Build the app's room (walls, openings, fixture outlines) from one read room. */
export function planRoomToRoom(r: PlanRoom): Room {
  const pts = r.outline;
  const ox = pts[0]?.x ?? 0;
  const oy = pts[0]?.y ?? 0;
  const walls = pts.map((p, i) => {
    const q = pts[(i + 1) % pts.length];
    const ang = (((Math.atan2(q.y - p.y, q.x - p.x) * 180) / Math.PI) % 360 + 360) % 360;
    return newWall(Math.round(len(p, q)), Math.round(ang * 10) / 10, Math.round(r.ceilingHeight || 2700));
  });
  // cut away the wall nearest the viewer (largest y) so the 3D view looks in
  let front = 0;
  let maxY = -Infinity;
  pts.forEach((p, i) => {
    const q = pts[(i + 1) % pts.length];
    const my = (p.y + q.y) / 2;
    if (Math.abs(q.y - p.y) < Math.abs(q.x - p.x) && my > maxY) {
      maxY = my;
      front = i;
    }
  });
  if (walls[front]) walls[front].visible = false;
  const openings: RoomOpening[] = r.openings
    .filter((o) => o.edge >= 0 && o.edge < walls.length)
    .map((o) => ({ id: uid('op'), kind: o.kind, wall: o.edge, offset: Math.max(0, Math.round(o.offset)), width: Math.round(o.width), height: o.kind === 'opening' ? walls[o.edge].height : 2100, sill: o.kind === 'window' ? 1000 : 0, beam: o.kind === 'opening', beamDepth: 300, label: OPENING_LABELS[o.kind] }));
  return { walls, wallThickness: 150, wallColor: '#e9e4dc', floorColor: '#c9b49a', openings, placements: [], fixtures: r.fixtures.map((f) => toFixture(f, ox, oy)) };
}
