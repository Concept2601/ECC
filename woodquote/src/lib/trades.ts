// Shared maths for the Ceilings and Tiling sections: lines per room, a
// combined material schedule, markup and the section total.
import type { ExtraLine, Trade } from './types';
import { round2, sum } from './util';

export interface TradeLine {
  area?: string;
  kind: 'material' | 'labour' | 'service';
  group: string;
  description: string;
  qty: number;
  unit: string;
  unitPrice: number;
  total: number;
  note?: string;
}

export interface TradeArea {
  id: string;
  name: string;
  /** m² */
  size: number;
  summary: string;
  lines: TradeLine[];
  /** selling price of this room (materials + labour with markup) */
  sell?: number;
}

export interface TradeCalc {
  trade: Trade;
  title: string;
  areas: TradeArea[];
  lines: TradeLine[];
  /** materials added up across rooms (what to buy) */
  schedule: TradeLine[];
  extras: ExtraLine[];
  materials: number;
  labour: number;
  services: number;
  markupPercent: number;
  markup: number;
  /** total for the section (materials + labour with markup, plus services as entered) */
  sell: number;
  /** m² across all rooms */
  size: number;
  warnings: string[];
}

export function tradeTotals(trade: Trade, title: string, areas: TradeArea[], lines: TradeLine[], extras: ExtraLine[], markupPercent: number, warnings: string[]): TradeCalc {
  const mk = 1 + Math.max(0, markupPercent) / 100;
  const materials = sum(lines.filter((l) => l.kind === 'material').map((l) => l.total));
  const labour = sum(lines.filter((l) => l.kind !== 'material').map((l) => l.total));
  const services = sum(extras.map((e) => e.qty * e.unitPrice));
  for (const a of areas) a.sell = round2(sum(a.lines.map((l) => l.total)) * mk);
  const byKey = new Map<string, TradeLine>();
  for (const l of lines) {
    if (l.kind !== 'material') continue;
    const k = `${l.description}|${l.unit}|${l.unitPrice}`;
    const e = byKey.get(k);
    if (e) {
      e.qty += l.qty;
      e.total = round2(e.total + l.total);
    } else byKey.set(k, { ...l, area: undefined, note: undefined });
  }
  return {
    trade,
    title,
    areas,
    lines,
    schedule: [...byKey.values()],
    extras,
    materials: round2(materials),
    labour: round2(labour),
    services: round2(services),
    markupPercent,
    markup: round2((materials + labour) * (mk - 1)),
    sell: round2((materials + labour) * mk + services),
    size: round2(sum(areas.map((a) => a.size))),
    warnings,
  };
}

export const TRADE_LABELS: Record<Trade, string> = { joinery: 'Joinery', ceilings: 'Ceilings', tiling: 'Tiling' };
