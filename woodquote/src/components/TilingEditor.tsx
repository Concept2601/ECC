// Tiling section of a quotation: floors and walls per room, tile choice
// (type, size, colour, price per box), laying pattern, adhesive, grout,
// trims, skirting, waterproofing and renovation work, plus what to buy.
import { ChevronDown, Copy, Grid3x3, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { tradeMeta } from '../app/brand';
import { useMoney } from '../hooks';
import type { QuoteCalc } from '../lib/pricing';
import { fitSupplies, newTileArea, newTilingJob, supplies, TILE_PATTERNS, tiledArea, tileProduct, wastePercent } from '../lib/tiling';
import type { Quote, TileArea, TilePattern, TileSupplyKind, TilingJob } from '../lib/types';
import { deepClone, round2, uid } from '../lib/util';
import { useStore } from '../store';
import ExtrasEditor from './ExtrasEditor';
import TradeSummary from './TradeSummary';
import { Card, confirmAction, Field, NumInput, OptNumInput, Select, TextInput, Toggle } from './ui';

const meta = tradeMeta('tiling');

function TileSwatch({ colour, w, h }: { colour: string; w: number; h: number }) {
  const r = Math.min(28 / Math.max(w, h), 1) * 1;
  return <span className="inline-block shrink-0 rounded-[3px] border border-black/10 shadow-inner" style={{ background: colour, width: Math.max(10, w * r), height: Math.max(10, h * r) }} />;
}

function AreaCard({ a, i, open, onToggle, up, sell }: { a: TileArea; i: number; open: boolean; onToggle: () => void; up: (fn: (a: TileArea, job: TilingJob) => void) => void; sell: number }) {
  const catalog = useStore((s) => s.catalog);
  const fmt = useMoney();
  const tile = tileProduct(catalog, a.tileId);
  const opt = (k: TileSupplyKind) => supplies(catalog, k).map((p) => ({ value: p.id, label: `${p.name} – ${fmt(p.price)}/${p.unit}` }));
  const A = round2(tiledArea(a));
  return (
    <div className="card overflow-hidden">
      <button className="flex w-full items-center gap-3 p-3 text-left" onClick={onToggle}>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ background: meta.soft }}>
          {tile ? <TileSwatch colour={tile.colour} w={tile.width} h={tile.height} /> : <Grid3x3 size={16} style={{ color: meta.ink }} />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold">
            {a.name || 'Room'} <span className="font-normal text-stone-500">· {a.surface}</span>
          </div>
          <div className="truncate text-xs text-stone-500">
            {A} m² · {tile ? `${tile.width} × ${tile.height}` : 'no tile'} · {TILE_PATTERNS[a.pattern].label}
          </div>
        </div>
        <span className="font-bold tabular-nums">{fmt(sell)}</span>
        <ChevronDown size={18} className={`text-stone-400 transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="space-y-3 border-t border-stone-100 p-3">
          <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
            <Field label="Room / area">
              <TextInput value={a.name} onChange={(v) => up((x) => (x.name = v))} />
            </Field>
            <div>
              <span className="label">Surface</span>
              <div className="flex gap-1 rounded-xl bg-stone-100 p-1">
                {(['floor', 'wall'] as const).map((s) => (
                  <button key={s} className={`rounded-lg px-3 py-1.5 text-sm font-semibold capitalize ${a.surface === s ? 'bg-white shadow' : 'text-stone-600'}`} onClick={() => up((x) => (x.surface = s))}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Field label={a.surface === 'floor' ? 'Length' : 'Wall length'}>
              <NumInput value={a.length} min={100} suffix="mm" onChange={(v) => up((x) => (x.length = v))} />
            </Field>
            <Field label={a.surface === 'floor' ? 'Width' : 'Tiled height'}>
              <NumInput value={a.width} min={100} suffix="mm" onChange={(v) => up((x) => (x.width = v))} />
            </Field>
            <Field label="Less (doors, units)">
              <NumInput value={a.deduct} min={0} suffix="m²" onChange={(v) => up((x) => (x.deduct = v))} />
            </Field>
          </div>
          <Field label="Tile">
            <select className="input" value={a.tileId ?? ''} onChange={(e) => up((x) => ((x.tileId = e.target.value || null), fitSupplies(x, catalog)))}>
              <option value="">Choose a tile…</option>
              {(catalog.tiles ?? []).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} · {t.type} · {t.finish} – {fmt(t.price)}/box of {t.perBox}
                </option>
              ))}
            </select>
          </Field>
          {tile && (
            <div className="flex items-center gap-3 rounded-xl bg-stone-50 p-2 text-xs text-stone-600">
              <TileSwatch colour={tile.colour} w={tile.width} h={tile.height} />
              {tile.width} × {tile.height} × {tile.thickness} mm {tile.type}, {tile.finish} · {tile.perBox} per box ({round2((tile.perBox * tile.width * tile.height) / 1e6)} m²) · {fmt(tile.price / Math.max(0.01, (tile.perBox * tile.width * tile.height) / 1e6))}/m²
            </div>
          )}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Field label="Pattern">
              <Select<TilePattern> value={a.pattern} onChange={(v) => v && up((x) => (x.pattern = v))} options={(Object.keys(TILE_PATTERNS) as TilePattern[]).map((p) => ({ value: p, label: TILE_PATTERNS[p].label }))} />
            </Field>
            <Field label="Waste">
              <OptNumInput value={a.waste} min={0} max={60} suffix="%" placeholder={String(wastePercent({ ...a, waste: null }))} onChange={(v) => up((x) => (x.waste = v))} />
            </Field>
            <Field label="Joint">
              <NumInput value={a.joint} min={0.5} max={15} step={0.5} suffix="mm" onChange={(v) => up((x) => (x.joint = v))} />
            </Field>
            <Field label="Edge trims">
              <NumInput value={a.trimLength} min={0} suffix="m" onChange={(v) => up((x) => (x.trimLength = v))} />
            </Field>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <Field label="Adhesive">
              <Select value={a.adhesiveId} allowNone="None" onChange={(v) => up((x) => (x.adhesiveId = v))} options={opt('adhesive')} />
            </Field>
            <Field label="Grout (colour)">
              <Select value={a.groutId} allowNone="None" onChange={(v) => up((x) => (x.groutId = v))} options={opt('grout')} />
            </Field>
            <Field label="Spacers">
              <Select value={a.spacersId} allowNone="None" onChange={(v) => up((x) => (x.spacersId = v))} options={opt('spacers')} />
            </Field>
            {a.trimLength > 0 && (
              <Field label="Trim">
                <Select value={a.trimId} allowNone="None" onChange={(v) => up((x) => (x.trimId = v))} options={opt('trim')} />
              </Field>
            )}
          </div>
          <div className="grid gap-x-4 gap-y-1 sm:grid-cols-2">
            <Toggle label="Levelling clips (large tiles)" checked={a.levelling} onChange={(v) => up((x) => (x.levelling = v))} />
            {a.surface === 'floor' && <Toggle label="Tile skirting (cut from the same tile)" checked={a.skirting} onChange={(v) => up((x) => (x.skirting = v))} />}
            <Toggle label="Waterproofing (wet area)" checked={a.waterproof} onChange={(v) => up((x) => (x.waterproof = v))} />
            <Toggle label="Primer" checked={a.primer} onChange={(v) => up((x) => (x.primer = v))} />
            <Toggle label="Silicone joints" checked={a.silicone} onChange={(v) => up((x) => (x.silicone = v))} />
            {a.surface === 'floor' && <Toggle label="Screed / level the floor" checked={a.screed} onChange={(v) => up((x) => (x.screed = v))} />}
            <Toggle label="Renovation – remove old tiles" checked={a.demolish} onChange={(v) => up((x) => (x.demolish = v))} />
          </div>
          {a.surface === 'floor' && a.skirting && (
            <Field label="Skirting height" className="w-40">
              <NumInput value={a.skirtingHeight} min={40} max={300} suffix="mm" onChange={(v) => up((x) => (x.skirtingHeight = v))} />
            </Field>
          )}
          <Field label="Notes (shown on the quotation)">
            <TextInput value={a.notes} onChange={(v) => up((x) => (x.notes = v))} />
          </Field>
          <div className="flex justify-end gap-2">
            <button className="btn-secondary px-3 py-1.5 text-sm" onClick={() => up((_x, job) => job.areas.splice(i + 1, 0, { ...deepClone(a), id: uid('ta'), name: `${a.name} (copy)` }))}>
              <Copy size={14} /> Copy
            </button>
            <button className="btn-danger px-3 py-1.5 text-sm" onClick={() => confirmAction(`Remove ${a.name}?`) && up((_x, job) => job.areas.splice(i, 1))}>
              <Trash2 size={14} /> Remove
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function TilingEditor({ quote, calc, up }: { quote: Quote; calc: QuoteCalc; up: (fn: (q: Quote) => void) => void }) {
  const settings = useStore((s) => s.settings);
  const catalog = useStore((s) => s.catalog);
  const [open, setOpen] = useState<string | null>(quote.tiling?.areas[0]?.id ?? null);
  const job = quote.tiling;
  const upJob = (fn: (j: TilingJob) => void) =>
    up((q) => {
      q.tiling ??= newTilingJob(settings);
      fn(q.tiling);
    });
  const add = (surface: 'floor' | 'wall') => {
    const a = newTileArea(catalog, surface, surface === 'floor' ? `Floor ${(job?.areas.length ?? 0) + 1}` : `Wall ${(job?.areas.length ?? 0) + 1}`);
    upJob((j) => j.areas.push(a));
    setOpen(a.id);
  };
  const c = calc.tiling;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="mr-auto flex items-center gap-2 text-lg font-semibold">
          <Grid3x3 size={20} style={{ color: meta.accent }} /> Tiling
        </h2>
        <button className="btn-primary" style={{ background: meta.accent }} onClick={() => add('floor')}>
          <Plus size={16} /> Floor
        </button>
        <button className="btn-secondary" onClick={() => add('wall')}>
          <Plus size={16} /> Wall
        </button>
      </div>
      {!job?.areas.length && <div className="card p-6 text-center text-sm text-stone-500">Add a floor or wall: its size, the tile and the pattern. Boxes, adhesive, grout, spacers, trims and labour are worked out for you.</div>}
      {job?.areas.map((a, i) => (
        <AreaCard
          key={a.id}
          a={a}
          i={i}
          open={open === a.id}
          onToggle={() => setOpen(open === a.id ? null : a.id)}
          sell={c?.areas.find((x) => x.id === a.id)?.sell ?? 0}
          up={(fn) =>
            upJob((j) => {
              const x = j.areas.find((y) => y.id === a.id);
              if (x) fn(x, j);
            })
          }
        />
      ))}
      {job && (
        <Field label="Markup (tiling)" className="w-40">
          <NumInput value={job.markupPercent} min={0} suffix="%" onChange={(v) => upJob((j) => (j.markupPercent = v))} />
        </Field>
      )}
      <ExtrasEditor
        title="Tiling add-ons & services"
        hint="Transport, rubble removal, steps, shower niches, special cuts, sealing or anything else."
        lines={job?.extras ?? []}
        presets={settings.tilingExtras ?? []}
        accent={meta.accent}
        onChange={(fn) => upJob((j) => fn(j.extras))}
      />
      {c && <TradeSummary calc={c} accent={meta.accent} />}
      {!c && job && <Card title="Tiling total">Add a floor, a wall or an add-on to price the tiling.</Card>}
    </div>
  );
}
