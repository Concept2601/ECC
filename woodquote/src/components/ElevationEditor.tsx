import { useRef, useState, type ReactNode } from 'react';
import { elevation, topThickness } from '../lib/generate';
import type { Catalog, PanelStyle, Unit, UnitBuild } from '../lib/types';

export interface Sel {
  bay: number;
  section: number;
}

export type EditorView = 'front' | 'left' | 'right' | 'back' | 'top';
export type SidePick = 'left' | 'right' | 'back' | 'top' | 'base';

interface Props {
  unit: Unit;
  catalog: Catalog;
  build?: UnitBuild;
  view?: EditorView;
  sel: Sel | null;
  onSelect: (s: Sel | null) => void;
  onChange: (fn: (u: Unit) => void) => void;
  onSidePick?: (s: SidePick) => void;
  background?: string | null; // optional traced diagram
}

type Drag = { kind: 'bay'; index: number } | { kind: 'section'; bay: number; index: number };
const MIN = 80;

/** hatch / pattern fill for exposed finish panels */
function panelPattern(id: string, style: PanelStyle, color: string, vertical = true): ReactNode {
  return (
    <pattern id={id} width={style === 'slatted' ? 55 : 30} height={30} patternUnits="userSpaceOnUse" patternTransform={vertical ? undefined : 'rotate(90)'}>
      <rect width="60" height="30" fill={color} />
      {style === 'fluted' && <line x1="15" x2="15" y1="0" y2="30" stroke="#000" strokeOpacity="0.3" strokeWidth="4" />}
      {style === 'slatted' && <rect x="40" width="15" height="30" fill="#000" fillOpacity="0.45" />}
    </pattern>
  );
}

/**
 * Interactive 2D drawing of a unit. Front: tap a compartment to select it and
 * drag the handles on dividers / fixed shelves to resize. Sides, back and top
 * show finish panels, overhangs, kick boards and appliances; tap to edit them.
 */
export default function ElevationEditor({ unit, catalog, build, view = 'front', sel, onSelect, onChange, onSidePick, background }: Props) {
  const svg = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const e = elevation(unit, catalog);
  const W = unit.width;
  const H = unit.height;
  const D = unit.depth;
  const ct = topThickness(unit, catalog);
  const board = (id: string | null) => catalog.boards.find((b) => b.id === id);
  const front = board(unit.frontMaterialId)?.color ?? '#ddd';
  const carcass = board(unit.carcassMaterialId)?.color ?? '#eee';
  const topColor = catalog.countertops.find((c) => c.id === unit.countertopId)?.color ?? board(unit.topBoardId)?.color ?? '#999';
  const fp = unit.finishPanels;
  const fpT = (s: 'left' | 'right' | 'back') => (fp[s].enabled ? board(fp[s].materialId)?.thickness ?? 18 : 0);
  const hasTop = ct > 0;
  const ov = hasTop ? unit.overhang : { front: 0, back: 0, left: 0, right: 0 };
  const yo = unit.mount === 'wall' ? unit.mountHeight : 0;
  const totalH = H + yo;

  // horizontal extent of what we draw
  const span = view === 'left' || view === 'right' ? D + fpT('back') + ov.front + ov.back : W + fpT('left') + fpT('right') + ov.left + ov.right;
  const ext = view === 'top' ? D + ov.front + ov.back + fpT('back') : totalH;
  const pad = Math.max(span, ext) * 0.1;
  const x0v = view === 'left' ? -fpT('back') - ov.back : view === 'right' ? -ov.front : -fpT('left') - ov.left;
  const vb = `${x0v - pad} ${-pad * 0.9} ${span + pad * 1.7} ${ext + pad * 2}`;
  const Y = (mm: number) => ext - mm; // flip y (mm from floor)
  const fs = Math.max(span, ext) / 45;

  const toMm = (ev: React.PointerEvent) => {
    const s = svg.current!;
    const pt = s.createSVGPoint();
    pt.x = ev.clientX;
    pt.y = ev.clientY;
    const p = pt.matrixTransform(s.getScreenCTM()!.inverse());
    return { x: p.x, y: ext - p.y - yo };
  };
  const onMove = (ev: React.PointerEvent) => {
    if (!drag || view !== 'front') return;
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
  const handleR = Math.max(span, ext) / 55;
  const pick = (s: SidePick) => (ev: React.MouseEvent) => {
    ev.stopPropagation();
    onSidePick?.(s);
  };
  const dimH = (x0: number, x1: number, y: number, label: string) => (
    <g stroke="#555" strokeWidth={3} fill="#333" fontSize={fs} fontWeight={700}>
      <line x1={x0} x2={x1} y1={y} y2={y} />
      <line x1={x0} x2={x0} y1={y - fs * 0.4} y2={y + fs * 0.4} />
      <line x1={x1} x2={x1} y1={y - fs * 0.4} y2={y + fs * 0.4} />
      <text x={(x0 + x1) / 2} y={y + fs * 1.3} textAnchor="middle" stroke="none">
        {label}
      </text>
    </g>
  );
  const dimV = (y0: number, y1: number, x: number, label: string) => (
    <g stroke="#555" strokeWidth={3} fill="#333" fontSize={fs} fontWeight={700}>
      <line x1={x} x2={x} y1={y0} y2={y1} />
      <line x1={x - fs * 0.4} x2={x + fs * 0.4} y1={y0} y2={y0} />
      <line x1={x - fs * 0.4} x2={x + fs * 0.4} y1={y1} y2={y1} />
      <text x={x - fs * 0.6} y={(y0 + y1) / 2} textAnchor="middle" stroke="none" transform={`rotate(-90 ${x - fs * 0.6} ${(y0 + y1) / 2})`}>
        {label}
      </text>
    </g>
  );
  const floor = <line x1={x0v - pad} x2={x0v + span + pad * 0.6} y1={Y(0)} y2={Y(0)} stroke="#a8a29e" strokeWidth={4} />;
  const defs = (
    <defs>
      {(['left', 'right', 'back'] as const).map((s) => panelPattern(`fp-${s}`, fp[s].style, board(fp[s].materialId)?.color ?? '#999'))}
      <pattern id="wallhatch" width="40" height="40" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <line x1="0" y1="0" x2="0" y2="40" stroke="#a8a29e" strokeWidth="6" />
      </pattern>
    </defs>
  );

  /* -------------------------------------------------------------- side */
  if (view === 'left' || view === 'right') {
    const side = view;
    // map depth (z) to x: left view → front on the right; right view → front on the left
    const X = (z: number) => (side === 'left' ? z : D - z);
    const rx = (z0: number, z1: number) => ({ x: Math.min(X(z0), X(z1)), width: Math.abs(X(z1) - X(z0)) });
    const fpOn = fp[side].enabled;
    const sideColor = fpOn ? `url(#fp-${side})` : carcass;
    const panelY0 = fpOn && fp[side].toFloor && unit.mount === 'floor' ? 0 : e.baseH;
    const plinth = unit.mount === 'floor' && unit.base === 'plinth' && e.baseH > 0;
    const r = unit.plinthRecess;
    return (
      <svg ref={svg} viewBox={vb} className="h-full w-full select-none">
        {defs}
        {unit.installType === 'builtIn' && <rect {...rx(-fpT('back') - 40, -fpT('back'))} y={Y(Math.max(totalH + 200, 2400))} height={Math.max(totalH + 200, 2400)} fill="url(#wallhatch)" />}
        {floor}
        {/* carcass side / finish panel */}
        <rect {...rx(-fpT('back'), D)} y={Y(yo + e.topY)} height={e.topY - panelY0} fill={sideColor} stroke="#333" strokeWidth={3} onClick={pick(side)} className="cursor-pointer" />
        {/* door / front thickness */}
        <rect {...rx(D - 20, D)} y={Y(yo + e.topY)} height={e.topY - e.baseH} fill={front} stroke="#333" strokeWidth={2} />
        {/* top with overhang */}
        {hasTop && <rect {...rx(-fpT('back') - ov.back, D + ov.front)} y={Y(yo + H)} height={ct} fill={topColor} stroke="#333" strokeWidth={2} onClick={pick('top')} className="cursor-pointer" />}
        {/* base */}
        {plinth && (
          <g onClick={pick('base')} className="cursor-pointer">
            {unit.plinthSides[side] ? <rect {...rx(unit.plinthSides.back ? r : 40, unit.plinthSides.front ? D - r : D)} y={Y(e.baseH)} height={e.baseH} fill="#8f8a83" stroke="#333" strokeWidth={2} /> : <rect {...rx(D - r - 18, D - r)} y={Y(e.baseH)} height={e.baseH} fill="#8f8a83" stroke="#333" strokeWidth={2} />}
          </g>
        )}
        {unit.mount === 'floor' && unit.base === 'legs' && e.baseH > 0 && [60, D - 60].map((z) => <rect key={z} x={X(z) - 12} y={Y(e.baseH)} width={24} height={e.baseH} fill="#333" onClick={pick('base')} />)}
        {unit.mount === 'wall' && <text x={X(D / 2)} y={Y(yo) + fs * 1.4} fontSize={fs * 0.9} textAnchor="middle" fill="#555">wall hung · {yo}mm above floor</text>}
        {dimH(Math.min(X(-fpT('back') - ov.back), X(D + ov.front)), Math.max(X(-fpT('back') - ov.back), X(D + ov.front)), Y(0) + pad * 0.45, `${D + fpT('back') + ov.front + ov.back} mm`)}
        {dimV(Y(yo), Y(yo + H), x0v - pad * 0.45, `${H} mm`)}
        {hasTop && ov.front > 0 && <text x={X(D + ov.front / 2)} y={Y(yo + H) - fs * 0.5} fontSize={fs * 0.8} textAnchor="middle" fill="#7c2d12">{ov.front}</text>}
        {hasTop && ov.back > 0 && <text x={X(-ov.back / 2)} y={Y(yo + H) - fs * 0.5} fontSize={fs * 0.8} textAnchor="middle" fill="#7c2d12">{ov.back}</text>}
        <text x={X(D) + (side === 'left' ? 1 : -1) * fs * 0.4} y={Y(yo + H) - fs * 1.6} fontSize={fs * 0.8} textAnchor={side === 'left' ? 'end' : 'start'} fill="#7c2d12" fontWeight={700}>
          FRONT
        </text>
      </svg>
    );
  }

  /* -------------------------------------------------------------- top */
  if (view === 'top') {
    const zMin = -fpT('back') - ov.back;
    const Z = (z: number) => z - zMin; // back wall at the top, front at the bottom
    const appls = build?.appliances.filter((a) => unit.topAppliances.some((t) => t.applianceId === a.applianceId || t.downdraftId === a.applianceId)) ?? [];
    return (
      <svg ref={svg} viewBox={vb} className="h-full w-full select-none">
        {defs}
        {unit.installType === 'builtIn' && <rect x={x0v - 40} y={Z(zMin) - 40} width={span + 80} height={40} fill="url(#wallhatch)" />}
        <rect x={0} y={Z(0)} width={W} height={D} fill={carcass} stroke="#333" strokeWidth={3} />
        {(['left', 'right'] as const).map((s) => fp[s].enabled && <rect key={s} x={s === 'left' ? -fpT('left') : W} y={Z(-fpT('back'))} width={fpT(s)} height={D + fpT('back')} fill={board(fp[s].materialId)?.color} stroke="#333" strokeWidth={2} onClick={pick(s)} />)}
        {fp.back.enabled && <rect x={0} y={Z(-fpT('back'))} width={W} height={fpT('back')} fill={board(fp.back.materialId)?.color} stroke="#333" strokeWidth={2} onClick={pick('back')} />}
        {hasTop && (
          <rect x={-fpT('left') - ov.left} y={Z(zMin)} width={W + fpT('left') + fpT('right') + ov.left + ov.right} height={D + ov.front + ov.back + fpT('back')} fill={topColor} fillOpacity={0.55} stroke="#333" strokeWidth={3} strokeDasharray="30 14" onClick={pick('top')} className="cursor-pointer" />
        )}
        {e.bays.slice(1).map((b) => (
          <line key={b.index} x1={b.x - e.t / 2} x2={b.x - e.t / 2} y1={Z(0)} y2={Z(D)} stroke="#555" strokeWidth={2} strokeDasharray="12 10" />
        ))}
        {appls.map((a, i) => {
          const ap = catalog.appliances.find((x) => x.id === a.applianceId);
          return (
            <g key={i}>
              <rect x={a.box.x} y={Z(a.box.z)} width={a.box.w} height={a.box.d} rx={20} fill={ap?.category === 'sink' ? '#c9cdd2' : '#18181b'} stroke="#333" strokeWidth={3} />
              {ap?.category === 'hob' && [0.25, 0.75].flatMap((u) => [0.3, 0.7].map((v) => <circle key={`${u}${v}`} cx={a.box.x + a.box.w * u} cy={Z(a.box.z + a.box.d * v)} r={Math.min(a.box.w, a.box.d) / 7} fill="none" stroke="#999" strokeWidth={4} />))}
              <text x={a.box.x + a.box.w / 2} y={Z(a.box.z + a.box.d / 2)} fontSize={fs * 0.8} textAnchor="middle" fill={ap?.category === 'sink' ? '#333' : '#ddd'}>
                {ap?.category === 'sink' ? 'Sink' : 'Hob'}
              </text>
            </g>
          );
        })}
        <text x={W / 2} y={Z(D + ov.front) + fs * 1.6} fontSize={fs} textAnchor="middle" fill="#7c2d12" fontWeight={700}>
          FRONT
        </text>
        {dimH(-fpT('left') - ov.left, W + fpT('right') + ov.right, Z(zMin) - pad * 0.55, `${span} mm`)}
        {dimV(Z(zMin), Z(D + ov.front), x0v - pad * 0.45, `${D + ov.front + ov.back + fpT('back')} mm`)}
      </svg>
    );
  }

  /* -------------------------------------------------------- front / back */
  const isBack = view === 'back';
  const X = (x: number) => (isBack ? W - x : x); // back view is mirrored
  const rx = (x0: number, x1: number) => ({ x: Math.min(X(x0), X(x1)), width: Math.abs(X(x1) - X(x0)) });
  const plinth = unit.mount === 'floor' && unit.base === 'plinth' && e.baseH > 0;
  const lights = build?.lights ?? [];

  const sidePanels = (['left', 'right'] as const).map((s) => {
    if (!fp[s].enabled) return null;
    const pt = fpT(s);
    const y0 = fp[s].toFloor && unit.mount === 'floor' ? 0 : e.baseH;
    const [a, b] = s === 'left' ? [-pt, 0] : [W, W + pt];
    return <rect key={s} {...rx(a, b)} y={Y(yo + e.topY)} height={e.topY - y0} fill={`url(#fp-${s})`} stroke="#333" strokeWidth={2} onClick={pick(s)} className="cursor-pointer" />;
  });

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
      {defs}
      {floor}
      {background && !isBack && <image href={background} x={0} y={Y(yo + H)} width={W} height={H} opacity={0.35} preserveAspectRatio="none" />}
      {hasTop && <rect {...rx(-fpT('left') - ov.left, W + fpT('right') + ov.right)} y={Y(yo + H)} height={ct} fill={topColor} stroke="#333" strokeWidth={2} onClick={pick('top')} className="cursor-pointer" />}
      <rect {...rx(0, W)} y={Y(yo + e.topY)} height={e.topY - e.baseH} fill={isBack ? (fp.back.enabled ? 'url(#fp-back)' : board(unit.backMaterialId)?.color ?? carcass) : carcass} stroke="#333" strokeWidth={3} onClick={isBack ? pick('back') : undefined} className={isBack ? 'cursor-pointer' : ''} />
      {sidePanels}
      {plinth && (
        <g onClick={pick('base')} className="cursor-pointer">
          {(isBack ? unit.plinthSides.back : unit.plinthSides.front) || !isBack ? (
            <rect {...rx(unit.plinthSides.left ? unit.plinthRecess : 0, unit.plinthSides.right ? W - unit.plinthRecess : W)} y={Y(e.baseH)} height={e.baseH} fill={(isBack ? unit.plinthSides.back : unit.plinthSides.front) ? '#8f8a83' : '#cfcac3'} stroke="#333" strokeWidth={2} />
          ) : null}
        </g>
      )}
      {unit.mount === 'floor' && unit.base === 'legs' && e.baseH > 0 && [40, W - 40].map((x) => <rect key={x} x={X(x) - 10} y={Y(e.baseH)} width={20} height={e.baseH} fill="#333" onClick={pick('base')} />)}

      {!isBack &&
        e.bays.map((b) => {
          const bay = unit.bays[b.index];
          return (
            <g key={bay.id}>
              {b.sections.map((s) => {
                const sec = bay.sections[s.index];
                const selected = sel?.bay === b.index && sel?.section === s.index;
                const kind = unit.sliding.enabled && sec.front !== 'drawer' ? 'open' : sec.front;
                const x0 = b.x;
                const y0 = Y(yo + s.y + s.h);
                const glassy = (kind === 'door' || kind === 'sliding') && sec.doorMaterial !== 'wood';
                const appliance = kind === 'appliance' ? catalog.appliances.find((a) => a.id === sec.applianceId) : null;
                const integrated = appliance && /integrated/i.test(appliance.variant);
                const fill = kind === 'open' ? '#fbfaf8' : glassy ? '#d5ebf2' : kind === 'appliance' && !integrated ? '#26262a' : front;
                const ins = sec.insertId ? catalog.accessories.find((a) => a.id === sec.insertId) : null;
                return (
                  <g key={sec.id} onClick={(ev) => { ev.stopPropagation(); onSelect({ bay: b.index, section: s.index }); }} className="cursor-pointer">
                    <rect x={x0} y={y0} width={b.w} height={s.h} fill={fill} opacity={background ? 0.6 : 1} stroke={selected ? '#c2410c' : '#555'} strokeWidth={selected ? 10 : 2} />
                    {kind === 'open' && Array.from({ length: sec.shelves }).map((_, k) => <rect key={k} x={x0} y={Y(yo + s.y + (s.h * (k + 1)) / (sec.shelves + 1)) - e.t / 2} width={b.w} height={e.t} fill="#b9a68f" />)}
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
                    {kind === 'door' &&
                      (sec.opening === 'pair' ? (['left', 'right'] as const) : [sec.opening]).map((op, k, arr) => {
                        const dw = b.w / arr.length;
                        const dx = x0 + k * dw;
                        const yMid = y0 + s.h / 2;
                        const path =
                          op === 'left'
                            ? `M${dx + dw - 6} ${y0 + 6} L${dx + 8} ${yMid} L${dx + dw - 6} ${y0 + s.h - 6}`
                            : op === 'right'
                              ? `M${dx + 6} ${y0 + 6} L${dx + dw - 8} ${yMid} L${dx + 6} ${y0 + s.h - 6}`
                              : op === 'up'
                                ? `M${dx + 6} ${y0 + s.h - 6} L${dx + dw / 2} ${y0 + 8} L${dx + dw - 6} ${y0 + s.h - 6}`
                                : `M${dx + 6} ${y0 + 6} L${dx + dw / 2} ${y0 + s.h - 8} L${dx + dw - 6} ${y0 + 6}`;
                        const hl = Math.min(200, s.h / 4);
                        const handle =
                          op === 'left' ? [dx + dw - 35, yMid - hl / 2, dx + dw - 35, yMid + hl / 2] : op === 'right' ? [dx + 35, yMid - hl / 2, dx + 35, yMid + hl / 2] : op === 'up' ? [dx + dw / 2 - hl / 2, y0 + s.h - 35, dx + dw / 2 + hl / 2, y0 + s.h - 35] : [dx + dw / 2 - hl / 2, y0 + 35, dx + dw / 2 + hl / 2, y0 + 35];
                        return (
                          <g key={k}>
                            <rect x={dx + 4} y={y0 + 4} width={dw - 8} height={s.h - 8} fill="none" stroke={sec.doorMaterial === 'glass' ? '#666' : '#444'} strokeWidth={sec.doorMaterial === 'glass' ? 10 : 3} />
                            <path d={path} fill="none" stroke="#777" strokeWidth={2} strokeDasharray="18 12" />
                            <line x1={handle[0]} y1={handle[1]} x2={handle[2]} y2={handle[3]} stroke="#222" strokeWidth={8} strokeLinecap="round" />
                          </g>
                        );
                      })}
                    {kind === 'sliding' && (
                      <g>
                        {sec.slide === 'bypass' ? (
                          <>
                            <rect x={x0 + 4} y={y0 + 4} width={b.w / 2 + 10} height={s.h - 8} fill="none" stroke="#444" strokeWidth={3} />
                            <rect x={x0 + b.w / 2 - 10} y={y0 + 10} width={b.w / 2 + 6} height={s.h - 16} fill="none" stroke="#444" strokeWidth={3} strokeDasharray="14 8" />
                          </>
                        ) : (
                          <rect x={x0 + 4} y={y0 + 4} width={b.w - 8} height={s.h - 8} fill="none" stroke="#444" strokeWidth={3} />
                        )}
                        <text x={x0 + b.w / 2} y={y0 + s.h / 2} fontSize={fs * 1.4} textAnchor="middle" dominantBaseline="middle" fill="#333">
                          {sec.slide === 'left' ? '⟵' : sec.slide === 'right' ? '⟶' : '⟷'}
                        </text>
                      </g>
                    )}
                    {kind === 'appliance' && (
                      <text x={x0 + b.w / 2} y={y0 + s.h / 2} fontSize={fs * 0.85} textAnchor="middle" dominantBaseline="middle" fill={integrated ? '#333' : '#e5e5e5'} fontWeight={600}>
                        {appliance ? appliance.name.replace(/built-in /i, '') : 'choose appliance'}
                      </text>
                    )}
                    {ins && (
                      <text x={x0 + b.w / 2} y={y0 + s.h - fs * 0.6} fontSize={fs * 0.7} textAnchor="middle" fill="#1e3a8a" fontWeight={600}>
                        ▣ {ins.name.split(' ').slice(0, 2).join(' ')}
                      </text>
                    )}
                    {kind !== 'open' && kind !== 'appliance' && sec.shelves > 0 && (
                      <text x={x0 + b.w / 2} y={y0 + s.h - fs * (ins ? 1.6 : 0.6)} fontSize={fs * 0.75} textAnchor="middle" fill="#555">
                        {sec.shelves} shel{sec.shelves > 1 ? 'ves' : 'f'}
                      </text>
                    )}
                    <text x={x0 + b.w - 12} y={y0 + fs * 1.2} fontSize={fs * 0.8} textAnchor="end" fill="#7c2d12" fontWeight={600}>
                      {Math.round(s.h)}
                    </text>
                  </g>
                );
              })}
              {b.sections.slice(0, -1).map((s) => (
                <circle
                  key={`sh${s.index}`}
                  cx={b.x + b.w / 2}
                  cy={Y(yo + s.y + s.h + e.t / 2)}
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
              <text x={b.x + b.w / 2} y={Y(yo + H) - fs * 0.6} fontSize={fs} textAnchor="middle" fill="#7c2d12" fontWeight={700}>
                {Math.round(b.w)}
              </text>
            </g>
          );
        })}
      {!isBack &&
        e.bays.slice(0, -1).map((b) => (
          <circle
            key={`bh${b.index}`}
            cx={b.x + b.w + e.t / 2}
            cy={Y(yo + (e.baseH + e.topY) / 2)}
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
      {!isBack &&
        unit.sliding.enabled &&
        Array.from({ length: unit.sliding.panels - 1 }).map((_, k) => {
          const x = (W * (k + 1)) / unit.sliding.panels;
          return <line key={k} x1={x} x2={x} y1={Y(yo + e.topY)} y2={Y(yo + e.baseH)} stroke="#8a5a2b" strokeWidth={8} strokeDasharray="40 20" />;
        })}
      {!isBack &&
        build?.appliances
          .filter((a) => unit.topAppliances.some((t) => t.applianceId === a.applianceId || t.downdraftId === a.applianceId) && !a.ref)
          .map((a, i) => <rect key={i} x={a.box.x} y={Y(a.box.y + Math.min(a.box.h, 60))} width={a.box.w} height={Math.min(a.box.h, 60)} fill={catalog.appliances.find((x) => x.id === a.applianceId)?.category === 'sink' ? '#9ca3af' : '#111'} opacity={0.85} />)}
      {!isBack && lights.map((l, i) => <rect key={i} x={l.box.x} y={Y(l.box.y + l.box.h)} width={l.box.w} height={Math.max(l.box.h, 10)} fill={l.color} stroke="#eab308" strokeWidth={3} />)}
      {isBack && <text x={W / 2} y={Y(yo + e.topY / 2)} fontSize={fs * 1.2} textAnchor="middle" fill="#555" onClick={pick('back')}>{fp.back.enabled ? `Finished back (${fp.back.style})` : 'Back panel'} – tap to edit</text>}
      {dimH(Math.min(X(-fpT('left') - ov.left), X(W + fpT('right') + ov.right)), Math.max(X(-fpT('left') - ov.left), X(W + fpT('right') + ov.right)), Y(0) + pad * 0.45, `${span} mm`)}
      {dimV(Y(yo), Y(yo + H), x0v - pad * 0.45, `${H} mm`)}
      {unit.mount === 'wall' && dimV(Y(0), Y(yo), x0v - pad * 0.2, `${yo}`)}
    </svg>
  );
}
