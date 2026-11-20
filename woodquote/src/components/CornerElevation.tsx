// Front drawing of a corner cupboard, unfolded: the main wall and the side wall
// (or the single diagonal front) with every door, hinge side and handle position.
// Uses the same door rules as the 3D build, so the two always agree.
import { cornerDoorCount } from '../lib/corner';
import { boardColour } from '../lib/finishes';
import type { Catalog, Unit } from '../lib/types';

const GAP = 3;

export default function CornerElevation({ unit, catalog }: { unit: Unit; catalog: Catalog }) {
  const c = unit.corner!;
  const front = catalog.boards.find((b) => b.id === unit.frontMaterialId);
  const fill = c.doorMaterial === 'glass' || c.doorMaterial === 'frameless' ? '#d5ebf2' : boardColour(catalog, front, unit.frontFinishId);
  const ft = front?.thickness ?? 18;
  const wall = unit.mount === 'wall';
  const baseH = wall || unit.base === 'none' ? 0 : unit.baseHeight;
  const ct = wall ? 0 : unit.countertopId ? (catalog.countertops.find((x) => x.id === unit.countertopId)?.thickness ?? 30) : 0;
  const H = unit.height;
  const D = unit.depth;
  const Dc = D - ft;
  const A = unit.width;
  const B = c.widthB;
  // the fronts: [label, width, doors, corner end]
  const blindW = Math.min(A - 200, D + 50);
  const fronts: { label: string; w: number; n: number; corner: 'start' | 'end' | 'none'; blind?: number }[] =
    c.style === 'blind'
      ? [{ label: `Main wall · A ${A} (blind ${Math.round(blindW)} at the corner)`, w: A - 2 * GAP, n: cornerDoorCount(A - blindW - 2 * GAP, c.doorsA), corner: c.hand === 'right' ? 'end' : 'start', blind: blindW }]
      : c.style === 'L' || c.style === 'square'
      ? [
          { label: `Main wall · A ${A}`, w: A - Dc - ft - 2 * GAP, n: cornerDoorCount(A - Dc - ft - 2 * GAP, c.doorsA), corner: c.hand === 'right' ? 'end' : 'start' },
          { label: `Side wall · B ${B}`, w: B - Dc - 2 * GAP, n: cornerDoorCount(B - Dc - 2 * GAP, c.doorsB), corner: c.hand === 'right' ? 'start' : 'end' },
        ]
      : [{ label: 'Diagonal front', w: Math.hypot(A - Dc, B - Dc) - 2 * GAP, n: cornerDoorCount(Math.hypot(A - Dc, B - Dc) - 2 * GAP, c.doorsA), corner: 'none' }];
  if ((c.style === 'L' || c.style === 'square') && c.hand === 'left') fronts.reverse();
  const gapBetween = 120;
  const totalW = fronts.reduce((a, f) => a + f.w, 0) + gapBetween * (fronts.length - 1);
  const doorH = (wall ? H : H - ct - baseH) - GAP;
  const pad = 160;
  let x = 0;
  return (
    <svg viewBox={`${-pad} ${-pad} ${totalW + 2 * pad} ${H + 2 * pad}`} className="h-full w-full bg-[#f7f5f2]">
      {fronts.map((f, i) => {
        const fx = x;
        x += f.w + gapBetween;
        // a blind panel takes the corner end; the doors share the rest
        const blindAtStart = !!f.blind && f.corner === 'start';
        const x0 = blindAtStart ? fx + f.blind! + GAP : fx;
        const doorsW = f.blind ? f.w - f.blind - GAP : f.w;
        const dw = (doorsW - (f.n - 1) * GAP) / f.n;
        return (
          <g key={i}>
            {!wall && ct > 0 && <rect x={fx - 10} y={0} width={f.w + 20} height={ct} fill="#3f3f46" />}
            {!wall && baseH > 0 && <rect x={fx} y={H - baseH} width={f.w} height={baseH} fill="#a8a29e" />}
            {f.blind && (
              <g>
                <rect x={blindAtStart ? fx : fx + f.w - f.blind} y={ct + GAP / 2} width={f.blind} height={doorH} fill={fill} stroke="#57534e" strokeWidth={4} />
                <text x={(blindAtStart ? fx : fx + f.w - f.blind) + f.blind / 2} y={ct + doorH / 2} textAnchor="middle" fontSize={44} fill="#57534e">
                  blind panel
                </text>
              </g>
            )}
            {c.open ? (
              <rect x={x0} y={ct} width={doorsW} height={doorH} fill="#fbfaf8" stroke="#78716c" strokeWidth={4} />
            ) : (
              Array.from({ length: f.n }, (_, k) => {
                let side: 'left' | 'right' = k < f.n / 2 ? 'left' : 'right';
                if (f.n % 2 === 1 && k === (f.n - 1) / 2) side = f.corner === 'start' ? 'right' : 'left';
                if (f.corner === 'start' && k === 0) side = 'right';
                if (f.corner === 'end' && k === f.n - 1) side = 'left';
                const dx = x0 + k * (dw + GAP);
                const y = ct + GAP / 2;
                const hx = side === 'left' ? dx : dx + dw;
                const ox = side === 'left' ? dx + dw : dx;
                return (
                  <g key={k}>
                    <rect x={dx} y={y} width={dw} height={doorH} fill={fill} stroke="#57534e" strokeWidth={4} />
                    {/* opening triangle: points to the hinge side */}
                    <polyline points={`${ox},${y} ${hx},${y + doorH / 2} ${ox},${y + doorH}`} fill="none" stroke="#57534e" strokeWidth={3} strokeDasharray="20 14" />
                    <rect x={ox + (side === 'left' ? -40 : 28)} y={y + doorH * 0.12} width={12} height={Math.min(160, doorH * 0.3)} rx={5} fill="#44403c" />
                    <text x={dx + dw / 2} y={y + doorH + (wall ? 70 : baseH + 70)} textAnchor="middle" fontSize={48} fill="#57534e">
                      {Math.round(dw)}
                    </text>
                  </g>
                );
              })
            )}
            <text x={fx + f.w / 2} y={-50} textAnchor="middle" fontSize={56} fontWeight={600} fill="#44403c">
              {f.label}
            </text>
          </g>
        );
      })}
      <text x={totalW / 2} y={H + 140} textAnchor="middle" fontSize={50} fill="#78716c">
        Corner cupboard unfolded · {H} mm high · door widths in mm
      </text>
    </svg>
  );
}
