import { useRef, useState } from 'react';
import { elevation } from '../lib/generate';
import type { Catalog, Unit } from '../lib/types';

export interface Sel {
  bay: number;
  section: number;
}

interface Props {
  unit: Unit;
  catalog: Catalog;
  sel: Sel | null;
  onSelect: (s: Sel | null) => void;
  onChange: (fn: (u: Unit) => void) => void;
  background?: string | null; // optional traced diagram
}

type Drag = { kind: 'bay'; index: number } | { kind: 'section'; bay: number; index: number };

const MIN = 80;

/**
 * Interactive front elevation. Tap a compartment to select it, drag the
 * handles on dividers / fixed shelves to resize bays and sections.
 */
export default function ElevationEditor({ unit, catalog, sel, onSelect, onChange, background }: Props) {
  const svg = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const e = elevation(unit, catalog);
  const W = unit.width;
  const H = unit.height;
  const pad = Math.max(W, H) * 0.09;
  const vb = `${-pad} ${-pad * 0.9} ${W + pad * 1.6} ${H + pad * 1.9}`;
  const Y = (mm: number) => H - mm;
  const fs = Math.max(W, H) / 45;
  const front = catalog.boards.find((b) => b.id === unit.frontMaterialId)?.color ?? '#ddd';
  const carcass = catalog.boards.find((b) => b.id === unit.carcassMaterialId)?.color ?? '#eee';

  const toMm = (ev: React.PointerEvent) => {
    const s = svg.current!;
    const pt = s.createSVGPoint();
    pt.x = ev.clientX;
    pt.y = ev.clientY;
    const p = pt.matrixTransform(s.getScreenCTM()!.inverse());
    return { x: p.x, y: H - p.y };
  };

  const onMove = (ev: React.PointerEvent) => {
    if (!drag) return;
    const p = toMm(ev);
    if (drag.kind === 'bay') {
      const a = e.bays[drag.index];
      const b = e.bays[drag.index + 1];
      const total = a.w + b.w;
      const aw = Math.min(total - MIN, Math.max(MIN, p.x - a.x - e.t / 2));
      onChange((u) => {
        e.bays.forEach((bb, i) => (u.bays[i].size = Math.round(bb.w)));
        u.bays[drag.index].size = Math.round(aw);
        u.bays[drag.index + 1].size = Math.round(total - aw);
      });
    } else {
      const bay = e.bays[drag.bay];
      const a = bay.sections[drag.index];
      const b = bay.sections[drag.index + 1];
      const total = a.h + b.h;
      const ah = Math.min(total - MIN, Math.max(MIN, p.y - a.y - e.t / 2));
      onChange((u) => {
        bay.sections.forEach((ss, j) => (u.bays[drag.bay].sections[j].size = Math.round(ss.h)));
        u.bays[drag.bay].sections[drag.index].size = Math.round(ah);
        u.bays[drag.bay].sections[drag.index + 1].size = Math.round(total - ah);
      });
    }
  };

  const handleR = Math.max(W, H) / 55;

  return (
    <svg
      ref={svg}
      viewBox={vb}
      className="h-full w-full touch-none select-none"
      onPointerMove={onMove}
      onPointerUp={() => setDrag(null)}
      onPointerLeave={() => setDrag(null)}
      onClick={(ev) => ev.target === svg.current && onSelect(null)}
    >
      {background && <image href={background} x={0} y={0} width={W} height={H} opacity={0.35} preserveAspectRatio="none" />}
      {/* countertop */}
      {unit.countertopId && <rect x={-5} y={0} width={W + 10} height={H - e.topY} fill={catalog.countertops.find((c) => c.id === unit.countertopId)?.color ?? '#999'} stroke="#333" strokeWidth={2} />}
      {/* carcass */}
      <rect x={0} y={Y(e.topY)} width={W} height={e.topY - e.baseH} fill={carcass} stroke="#333" strokeWidth={3} />
      {unit.base === 'plinth' && e.baseH > 0 && <rect x={0} y={Y(e.baseH)} width={W} height={e.baseH} fill="#9a948c" stroke="#333" strokeWidth={2} />}
      {unit.base === 'legs' && e.baseH > 0 && [40, W - 40].map((x) => <rect key={x} x={x - 10} y={Y(e.baseH)} width={20} height={e.baseH} fill="#333" />)}

      {e.bays.map((b) => {
        const bay = unit.bays[b.index];
        return (
          <g key={bay.id}>
            {b.sections.map((s) => {
              const sec = bay.sections[s.index];
              const selected = sel?.bay === b.index && sel?.section === s.index;
              const kind = unit.sliding.enabled && sec.front !== 'drawer' ? 'open' : sec.front;
              const x0 = b.x;
              const y0 = Y(s.y + s.h);
              const fill = kind === 'open' ? '#fbfaf8' : kind === 'glassDoor' ? '#d5ebf2' : front;
              return (
                <g key={sec.id} onClick={(ev) => { ev.stopPropagation(); onSelect({ bay: b.index, section: s.index }); }} className="cursor-pointer">
                  <rect x={x0} y={y0} width={b.w} height={s.h} fill={fill} opacity={background ? 0.6 : 1} stroke={selected ? '#c2410c' : '#555'} strokeWidth={selected ? 10 : 2} />
                  {kind === 'open' &&
                    Array.from({ length: sec.shelves }).map((_, k) => {
                      const yy = Y(s.y + (s.h * (k + 1)) / (sec.shelves + 1));
                      return <rect key={k} x={x0} y={yy - e.t / 2} width={b.w} height={e.t} fill="#b9a68f" />;
                    })}
                  {sec.hangingRail && (kind === 'open' || unit.sliding.enabled) && <line x1={x0 + 10} x2={x0 + b.w - 10} y1={y0 + 70} y2={y0 + 70} stroke="#777" strokeWidth={14} strokeLinecap="round" />}
                  {kind === 'drawer' &&
                    Array.from({ length: sec.drawerCount }).map((_, k) => {
                      const dh = s.h / sec.drawerCount;
                      const yy = y0 + k * dh;
                      return (
                        <g key={k}>
                          <rect x={x0 + 4} y={yy + 4} width={b.w - 8} height={dh - 8} fill="none" stroke="#444" strokeWidth={3} />
                          <line x1={x0 + b.w / 2 - Math.min(80, b.w / 5)} x2={x0 + b.w / 2 + Math.min(80, b.w / 5)} y1={yy + Math.min(40, dh / 4)} y2={yy + Math.min(40, dh / 4)} stroke="#222" strokeWidth={8} strokeLinecap="round" />
                        </g>
                      );
                    })}
                  {(kind === 'door' || kind === 'glassDoor') &&
                    Array.from({ length: sec.doorCount }).map((_, k) => {
                      const dw = b.w / sec.doorCount;
                      const dx = x0 + k * dw;
                      const handleRight = sec.doorCount === 2 ? k === 0 : b.index < e.bays.length / 2;
                      const hx = handleRight ? dx + dw - 35 : dx + 35;
                      const hl = Math.min(200, s.h / 4);
                      return (
                        <g key={k}>
                          <rect x={dx + 4} y={y0 + 4} width={dw - 8} height={s.h - 8} fill="none" stroke="#444" strokeWidth={3} />
                          <line x1={hx} x2={hx} y1={y0 + s.h / 2 - hl / 2} y2={y0 + s.h / 2 + hl / 2} stroke="#222" strokeWidth={8} strokeLinecap="round" />
                          <path d={handleRight ? `M${dx + dw - 6} ${y0 + 6} L${dx + 8} ${y0 + s.h / 2} L${dx + dw - 6} ${y0 + s.h - 6}` : `M${dx + 6} ${y0 + 6} L${dx + dw - 8} ${y0 + s.h / 2} L${dx + 6} ${y0 + s.h - 6}`} fill="none" stroke="#777" strokeWidth={2} strokeDasharray="18 12" />
                        </g>
                      );
                    })}
                  {kind === 'flap' && <path d={`M${x0 + 6} ${y0 + s.h - 6} L${x0 + b.w / 2} ${y0 + 6} L${x0 + b.w - 6} ${y0 + s.h - 6}`} fill="none" stroke="#777" strokeWidth={2} strokeDasharray="18 12" />}
                  {kind !== 'open' && sec.shelves > 0 && (
                    <text x={x0 + b.w / 2} y={y0 + s.h - fs * 0.6} fontSize={fs * 0.8} textAnchor="middle" fill="#555">
                      {sec.shelves} shelf{sec.shelves > 1 ? 'ves' : ''}
                    </text>
                  )}
                  <text x={x0 + b.w - 12} y={y0 + fs * 1.2} fontSize={fs * 0.8} textAnchor="end" fill="#7c2d12" fontWeight={600}>
                    {Math.round(s.h)}
                  </text>
                </g>
              );
            })}
            {/* section drag handles */}
            {b.sections.slice(0, -1).map((s) => (
              <circle
                key={`sh${s.index}`}
                cx={b.x + b.w / 2}
                cy={Y(s.y + s.h + e.t / 2)}
                r={handleR}
                fill="#ea580c"
                stroke="#fff"
                strokeWidth={handleR / 4}
                className="cursor-ns-resize"
                onPointerDown={(ev) => {
                  ev.stopPropagation();
                  (ev.target as Element).setPointerCapture?.(ev.pointerId);
                  setDrag({ kind: 'section', bay: b.index, index: s.index });
                }}
              />
            ))}
            {/* bay width label */}
            <text x={b.x + b.w / 2} y={-fs * 0.6} fontSize={fs} textAnchor="middle" fill="#7c2d12" fontWeight={700}>
              {Math.round(b.w)}
            </text>
          </g>
        );
      })}
      {/* bay drag handles */}
      {e.bays.slice(0, -1).map((b) => (
        <circle
          key={`bh${b.index}`}
          cx={b.x + b.w + e.t / 2}
          cy={Y((e.baseH + e.topY) / 2)}
          r={handleR}
          fill="#2563eb"
          stroke="#fff"
          strokeWidth={handleR / 4}
          className="cursor-ew-resize"
          onPointerDown={(ev) => {
            ev.stopPropagation();
            (ev.target as Element).setPointerCapture?.(ev.pointerId);
            setDrag({ kind: 'bay', index: b.index });
          }}
        />
      ))}
      {unit.sliding.enabled &&
        Array.from({ length: unit.sliding.panels - 1 }).map((_, k) => {
          const x = (W * (k + 1)) / unit.sliding.panels;
          return <line key={k} x1={x} x2={x} y1={Y(e.topY)} y2={Y(e.baseH)} stroke="#8a5a2b" strokeWidth={8} strokeDasharray="40 20" />;
        })}
      {/* overall dimensions */}
      <g stroke="#555" strokeWidth={3} fill="#333" fontSize={fs * 1.1} fontWeight={700}>
        <line x1={0} x2={W} y1={H + pad * 0.45} y2={H + pad * 0.45} />
        <line x1={0} x2={0} y1={H + pad * 0.3} y2={H + pad * 0.6} />
        <line x1={W} x2={W} y1={H + pad * 0.3} y2={H + pad * 0.6} />
        <text x={W / 2} y={H + pad * 0.45 + fs * 1.4} textAnchor="middle" stroke="none">
          {W} mm
        </text>
        <line x1={-pad * 0.45} x2={-pad * 0.45} y1={0} y2={H} />
        <line x1={-pad * 0.6} x2={-pad * 0.3} y1={0} y2={0} />
        <line x1={-pad * 0.6} x2={-pad * 0.3} y1={H} y2={H} />
        <text x={-pad * 0.45 - fs * 0.6} y={H / 2} textAnchor="middle" stroke="none" transform={`rotate(-90 ${-pad * 0.45 - fs * 0.6} ${H / 2})`}>
          {H} mm
        </text>
      </g>
    </svg>
  );
}
