// What to buy and what it costs for a Ceilings or Tiling section: the material
// schedule (boxes, bags, lengths…), labour, markup, add-ons and the total.
import { useMoney } from '../hooks';
import type { TradeCalc } from '../lib/trades';
import { Card, Row } from './ui';

export default function TradeSummary({ calc, accent }: { calc: TradeCalc; accent: string }) {
  const fmt = useMoney();
  const labour = calc.lines.filter((l) => l.kind !== 'material');
  return (
    <div className="grid gap-3 lg:grid-cols-[1fr_320px]">
      <Card title="Materials to buy">
        {calc.schedule.length ? (
          <div className="-mx-2 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-[11px] uppercase tracking-wide text-stone-500">
                <tr>
                  <th className="px-2 py-1.5 font-semibold">Item</th>
                  <th className="px-2 py-1.5 text-right font-semibold">Qty</th>
                  <th className="px-2 py-1.5 text-right font-semibold">Price</th>
                  <th className="px-2 py-1.5 text-right font-semibold">Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {calc.schedule.map((l) => (
                  <tr key={l.description + l.unitPrice}>
                    <td className="px-2 py-1.5">{l.description}</td>
                    <td className="whitespace-nowrap px-2 py-1.5 text-right font-semibold tabular-nums">
                      {l.qty} {l.unit}
                      {l.qty === 1 || /s$/.test(l.unit) ? '' : l.unit === 'box' ? 'es' : 's'}
                    </td>
                    <td className="whitespace-nowrap px-2 py-1.5 text-right tabular-nums text-stone-500">{fmt(l.unitPrice)}</td>
                    <td className="whitespace-nowrap px-2 py-1.5 text-right tabular-nums">{fmt(l.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-stone-500">Add a room to see the materials.</p>
        )}
        {labour.length > 0 && (
          <>
            <div className="label mt-4">Labour & work</div>
            <ul className="divide-y divide-stone-100 text-sm">
              {labour.map((l, i) => (
                <li key={i} className="flex justify-between gap-2 py-1.5">
                  <span>
                    {l.area ? <span className="text-stone-500">{l.area} · </span> : null}
                    {l.description}{' '}
                    <span className="text-stone-500">
                      {l.qty} {l.unit} × {fmt(l.unitPrice)}
                    </span>
                  </span>
                  <span className="shrink-0 tabular-nums">{fmt(l.total)}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>
      <Card title={`${calc.title} total`}>
        <div className="space-y-1 text-sm">
          <Row label="Area" value={`${calc.size} m²`} />
          <Row label="Materials" value={fmt(calc.materials)} />
          <Row label="Labour & work" value={fmt(calc.labour)} />
          <Row label={`Markup (${calc.markupPercent}%)`} value={fmt(calc.markup)} />
          <Row label="Add-ons & services" value={fmt(calc.services)} />
          <div className="my-2 border-t" />
          <div className="flex items-baseline justify-between rounded-xl px-3 py-2 text-white" style={{ background: accent }}>
            <span className="text-sm font-semibold">Section total</span>
            <span className="text-lg font-bold tabular-nums">{fmt(calc.sell)}</span>
          </div>
          {calc.size > 0 && <p className="pt-1 text-right text-xs text-stone-500">{fmt(calc.sell / calc.size)} per m²</p>}
          {calc.warnings.length > 0 && (
            <ul className="mt-2 space-y-1 rounded-lg bg-amber-50 p-2 text-xs text-amber-900">
              {calc.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          )}
        </div>
      </Card>
    </div>
  );
}
