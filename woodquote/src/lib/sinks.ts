// Sinks built from their layout: bowls, half bowls and drainers side by side.
// The same zones drive the 3D sink and the 2D drawings, so they always agree.
import type { Appliance, SinkSpec } from './types';

export const SINK_LAYOUTS: { value: string; label: string }[] = [
  { value: 'B', label: 'Single bowl' },
  { value: 'BD', label: 'Bowl + drainer (drainer right)' },
  { value: 'DB', label: 'Drainer + bowl (drainer left)' },
  { value: 'DBD', label: 'Two drainers with a bowl in the middle' },
  { value: 'BB', label: 'Double bowl' },
  { value: 'BBD', label: 'Double bowl + drainer' },
  { value: 'DBB', label: 'Drainer + double bowl' },
  { value: 'BHD', label: '1½ bowl + drainer' },
  { value: 'DHB', label: 'Drainer + 1½ bowl' },
  { value: 'BH', label: 'Bowl + half bowl' },
  { value: 'DBBD', label: 'Two drainers with a double bowl' },
];

export const SINK_MATERIALS: Record<SinkSpec['material'], string> = { stainless: 'Stainless steel', granite: 'Granite composite', ceramic: 'Ceramic' };

/** The sink's spec, worked out from its name for sinks made before layouts existed. */
export function sinkSpec(a: Appliance): SinkSpec {
  if (a.sink) return a.sink;
  const n = `${a.name} ${a.variant}`;
  const layout = /double/i.test(n) ? (/drainer/i.test(n) ? 'BBD' : 'BB') : /drainer/i.test(n) ? 'BD' : 'B';
  return { layout, material: /granite|composite/i.test(n) ? 'granite' : /ceramic|belfast/i.test(n) ? 'ceramic' : 'stainless', color: a.color, mount: /undermount/i.test(n) ? 'undermount' : 'inset', tap: 'centre' };
}

export interface SinkZone {
  kind: 'bowl' | 'half' | 'drainer';
  /** mm from the sink's left edge */
  x: number;
  w: number;
}

const WEIGHT = { B: 1, H: 0.55, D: 0.95 } as const;

/** Bowls and drainers laid out across the sink's width (rim 25 mm, 30 mm between zones). */
export function sinkZones(spec: SinkSpec, width: number): SinkZone[] {
  const codes = (spec.layout.toUpperCase().match(/[BHD]/g) ?? ['B']) as ('B' | 'H' | 'D')[];
  const rim = spec.mount === 'undermount' ? 0 : 25;
  const gap = 30;
  const free = Math.max(50, width - 2 * rim - gap * (codes.length - 1));
  const total = codes.reduce((s, c) => s + WEIGHT[c], 0);
  let x = rim;
  return codes.map((c) => {
    const w = (free * WEIGHT[c]) / total;
    const z = { kind: c === 'B' ? 'bowl' : c === 'H' ? 'half' : 'drainer', x, w } as SinkZone;
    x += w + gap;
    return z;
  });
}

/** Where the tap stands (mm from the left edge): behind the main bowl unless set otherwise. */
export function tapX(spec: SinkSpec, width: number): number | null {
  if (spec.tap === 'none') return null;
  if (spec.tap === 'left') return width * 0.15;
  if (spec.tap === 'right') return width * 0.85;
  const bowls = sinkZones(spec, width).filter((z) => z.kind !== 'drainer');
  if (!bowls.length) return width / 2;
  const a = bowls[0].x;
  const b = bowls[bowls.length - 1].x + bowls[bowls.length - 1].w;
  return (a + b) / 2;
}

export const sinkLabel = (spec: SinkSpec) => SINK_LAYOUTS.find((l) => l.value === spec.layout)?.label ?? spec.layout;
