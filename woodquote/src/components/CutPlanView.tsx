import { useState } from 'react';
import { useMoney } from '../hooks';
import type { BarPlan, BoardPlan } from '../lib/optimizer';
import { Row } from './ui';

const PALETTE = ['#e9c99f', '#c7dfc5', '#bcd3ea', '#f1c6c0', '#d9c8ec', '#f3e1a6', '#c5e3e3', '#e8cfb4'];

export function SheetSvg({ plan, index }: { plan: BoardPlan; index: number }) {
  const s = plan.sheets[index];
  const L = plan.material.sheetLength;
  const W = plan.material.sheetWidth;
  const labels = [...new Set(s.placements.map((p) => p.piece.label))];
  return (
    <svg viewBox={`0 0 ${L} ${W}`} className="w-full rounded-lg border border-stone-300 bg-stone-200" preserveAspectRatio="xMidYMid meet">
      <defs>
        <pattern id="waste" width="40" height="40" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="40" height="40" fill="#d6d3d1" />
          <line x1="0" y1="0" x2="0" y2="40" stroke="#a8a29e" strokeWidth="10" />
        </pattern>
      </defs>
      <rect x="0" y="0" width={L} height={W} fill="url(#waste)" />
      {s.offcuts.map((o, i) => (
        <g key={`o${i}`}>
          <rect x={o.x} y={o.y} width={o.w} height={o.h} fill="#fef9c3" stroke="#ca8a04" strokeWidth="4" strokeDasharray="20 12" />
          {o.w > 250 && o.h > 120 && (
            <text x={o.x + o.w / 2} y={o.y + o.h / 2} fontSize={Math.min(60, o.h / 3)} textAnchor="middle" dominantBaseline="middle" fill="#854d0e">
              offcut {Math.round(o.w)}×{Math.round(o.h)}
            </text>
          )}
        </g>
      ))}
      {s.placements.map((p, i) => {
        const color = PALETTE[labels.indexOf(p.piece.label) % PALETTE.length];
        const fs = Math.max(26, Math.min(70, Math.min(p.l, p.w) / 4));
        return (
          <g key={i}>
            <rect x={p.x} y={p.y} width={p.l} height={p.w} fill={color} stroke="#57534e" strokeWidth="4" />
            {p.l > 180 && p.w > 80 && (
              <>
                <text x={p.x + p.l / 2} y={p.y + p.w / 2 - (p.w > 2.6 * fs ? fs * 0.6 : 0)} fontSize={fs} textAnchor="middle" dominantBaseline="middle" fill="#1c1917" fontWeight="700">
                  {p.rotated ? `${p.piece.width}×${p.piece.length}` : `${p.piece.length}×${p.piece.width}`}
                </text>
                {p.w > 2.6 * fs && (
                  <text x={p.x + p.l / 2} y={p.y + p.w / 2 + fs * 0.7} fontSize={fs * 0.7} textAnchor="middle" dominantBaseline="middle" fill="#44403c">
                    {p.piece.label.split('–').pop()?.trim().slice(0, Math.floor(p.l / (fs * 0.45)))}
                  </text>
                )}
              </>
            )}
          </g>
        );
      })}
    </svg>
  );
}

export function BoardPlanCard({ plan }: { plan: BoardPlan }) {
  const fmt = useMoney();
  const [i, setI] = useState(0);
  const idx = Math.min(i, plan.sheets.length - 1);
  const s = plan.sheets[idx];
  return (
    <div className="card p-4">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <h3 className="font-bold">{plan.material.name}</h3>
          <p className="text-xs text-stone-500">
            {plan.material.sheetLength}×{plan.material.sheetWidth}×{plan.material.thickness}mm · {fmt(plan.material.pricePerSheet)}/sheet{plan.material.grain ? ' · grain locked' : ''}
          </p>
        </div>
        <span className="chip bg-brand-100 text-brand-800">{plan.sheets.length} sheet{plan.sheets.length === 1 ? '' : 's'}</span>
      </div>
      <div className="mb-3 grid grid-cols-2 gap-x-6 md:grid-cols-4">
        <Row label="Utilisation" value={`${Math.round(plan.utilisation * 100)}%`} />
        <Row label="Sheets cost" value={fmt(plan.fullSheetsCost)} />
        <Row label="Used in parts" value={fmt(plan.usedCost)} />
        <Row label={<span className="text-amber-700">Reusable offcuts</span>} value={fmt(plan.offcutValue)} />
        <Row label={<span className="text-red-700">Lost (waste)</span>} value={fmt(plan.wasteCost)} />
        <Row label="Charged on quote" value={<b>{fmt(plan.chargedCost)}</b>} />
      </div>
      {plan.oversize.length > 0 && (
        <p className="mb-2 rounded-lg bg-red-50 p-2 text-xs text-red-700">
          {plan.oversize.length} part(s) do not fit on this sheet: {plan.oversize.map((p) => `${p.length}×${p.width}`).join(', ')}
        </p>
      )}
      {s && (
        <>
          <SheetSvg plan={plan} index={idx} />
          <div className="mt-2 flex items-center justify-between text-xs text-stone-600">
            <span>
              Sheet {idx + 1}/{plan.sheets.length} · {s.placements.length} parts · {Math.round((s.usedArea / plan.sheetArea) * 100)}% used
            </span>
            {plan.sheets.length > 1 && (
              <div className="flex gap-1">
                <button className="btn-secondary px-3 py-1" disabled={idx === 0} onClick={() => setI(idx - 1)}>
                  ‹
                </button>
                <button className="btn-secondary px-3 py-1" disabled={idx >= plan.sheets.length - 1} onClick={() => setI(idx + 1)}>
                  ›
                </button>
              </div>
            )}
          </div>
          <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-stone-500">
            <span className="flex items-center gap-1"><i className="inline-block h-3 w-3 rounded-sm border border-stone-500 bg-[#e9c99f]" /> parts</span>
            <span className="flex items-center gap-1"><i className="inline-block h-3 w-3 rounded-sm border border-dashed border-yellow-600 bg-yellow-100" /> reusable offcut (≥ min size)</span>
            <span className="flex items-center gap-1"><i className="inline-block h-3 w-3 rounded-sm bg-stone-400" /> waste / kerf / trim</span>
          </div>
        </>
      )}
    </div>
  );
}

export function BarPlanCard({ plan }: { plan: BarPlan }) {
  const fmt = useMoney();
  const L = plan.profile.stockLength;
  return (
    <div className="card p-4">
      <div className="mb-2 flex items-start justify-between">
        <div>
          <h3 className="font-bold">{plan.profile.name}</h3>
          <p className="text-xs text-stone-500">
            {L / 1000}m lengths · {fmt(plan.profile.pricePerLength)} each · {(plan.offcut / 1000).toFixed(2)}m offcut
          </p>
        </div>
        <span className="chip bg-brand-100 text-brand-800">{plan.bars.length} length(s) · {fmt(plan.cost)}</span>
      </div>
      <div className="space-y-1.5">
        {plan.bars.map((b, i) => (
          <div key={i} className="flex h-6 overflow-hidden rounded bg-stone-300">
            {b.map((c, j) => (
              <div key={j} className="flex items-center justify-center border-r-2 border-stone-500 bg-slate-200 text-[10px] font-semibold" style={{ width: `${(c / L) * 100}%` }}>
                {c}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
