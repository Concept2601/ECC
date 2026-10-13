import { Box, Columns2, DoorOpen, Map as MapIcon, Plus, RotateCw, SquareDashed, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import { Card, Field, NumInput, PageHeader, Select, Tabs, TextInput, Toggle } from '../components/ui';
import Viewer3D from '../components/Viewer3D';
import { useQuoteCalc } from '../hooks';
import type { ItemPrice } from '../lib/pricing';
import { autoPlace, defaultRoom, footprints, newOpening, OPENING_LABELS, roomWarnings, snapToWall, WALL_NAMES, wallLength } from '../lib/room';
import type { Catalog, Room, RoomOpening, RoomPlacement, WallSide } from '../lib/types';
import { useStore } from '../store';

type Tab = 'room' | 'openings' | 'items';

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button onClick={onClick} className={`rounded-xl border px-3 py-1.5 text-xs font-semibold ${active ? 'border-brand-600 bg-brand-600 text-white' : 'border-stone-300 bg-white text-stone-700'}`}>
      {children}
    </button>
  );
}

/** Top-down plan: walls, openings and draggable items. */
function PlanView({ room, items, catalog, selected, onSelect, onMove }: { room: Room; items: ItemPrice[]; catalog: Catalog; selected: string | null; onSelect: (id: string | null) => void; onMove: (id: string, p: RoomPlacement) => void }) {
  const svg = useRef<SVGSVGElement>(null);
  const drag = useRef<{ id: string; start: [number, number]; orig: RoomPlacement } | null>(null);
  const T = room.wallThickness;
  const W = room.width;
  const D = room.depth;
  const pad = Math.max(W, D) * 0.1;
  const fs = Math.max(W, D) / 40;
  const toMm = (e: React.PointerEvent): [number, number] => {
    const s = svg.current!;
    const pt = s.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const p = pt.matrixTransform(s.getScreenCTM()!.inverse());
    return [p.x, p.y];
  };
  const wallRect = (w: WallSide) => (w === 0 ? { x: -T, y: -T, width: W + 2 * T, height: T } : w === 1 ? { x: W, y: -T, width: T, height: D + 2 * T } : w === 2 ? { x: -T, y: D, width: W + 2 * T, height: T } : { x: -T, y: -T, width: T, height: D + 2 * T });
  const along = (w: WallSide, u0: number, u1: number) => (w === 0 ? { x: u0, y: -T, width: u1 - u0, height: T } : w === 1 ? { x: W, y: u0, width: T, height: u1 - u0 } : w === 2 ? { x: u0, y: D, width: u1 - u0, height: T } : { x: -T, y: u0, width: T, height: u1 - u0 });

  return (
    <svg
      ref={svg}
      viewBox={`${-T - pad} ${-T - pad} ${W + 2 * T + 2 * pad} ${D + 2 * T + 2 * pad}`}
      className="h-full w-full touch-none select-none"
      onPointerMove={(e) => {
        if (!drag.current) return;
        const [x, z] = toMm(e);
        const d = drag.current;
        onMove(d.id, { ...d.orig, x: Math.round(d.orig.x + x - d.start[0]), z: Math.round(d.orig.z + z - d.start[1]) });
      }}
      onPointerUp={() => (drag.current = null)}
      onPointerLeave={() => (drag.current = null)}
      onClick={(e) => e.target === svg.current && onSelect(null)}
    >
      <rect x={0} y={0} width={W} height={D} fill={room.floorColor} opacity={0.35} />
      {([0, 1, 2, 3] as WallSide[]).map((w) => (
        <rect key={w} {...wallRect(w)} fill={room.showWalls[w] ? '#57534e' : '#d6d3d1'} />
      ))}
      {room.openings.map((o) => {
        const r = along(o.wall, o.offset, o.offset + o.width);
        const horiz = o.wall === 0 || o.wall === 2;
        return (
          <g key={o.id}>
            <rect {...r} fill="#fff" />
            {o.kind === 'window' && (horiz ? <line x1={r.x} x2={r.x + r.width} y1={r.y + T / 2} y2={r.y + T / 2} stroke="#38bdf8" strokeWidth={T / 4} /> : <line y1={r.y} y2={r.y + r.height} x1={r.x + T / 2} x2={r.x + T / 2} stroke="#38bdf8" strokeWidth={T / 4} />)}
            {o.kind === 'door' && (() => {
              const inward = o.wall === 0 || o.wall === 3 ? 1 : -1;
              const hx = o.wall === 0 ? r.x : o.wall === 2 ? r.x : o.wall === 1 ? W : 0;
              const hz = o.wall === 0 ? 0 : o.wall === 2 ? D : r.y;
              const path = horiz
                ? `M${hx} ${hz} L${hx} ${hz + inward * o.width} A${o.width} ${o.width} 0 0 ${inward > 0 ? 0 : 1} ${hx + o.width} ${hz}`
                : `M${hx} ${hz} L${hx + inward * o.width} ${hz} A${o.width} ${o.width} 0 0 ${inward > 0 ? 1 : 0} ${hx} ${hz + o.width}`;
              return <path d={path} fill="none" stroke="#8b6b4a" strokeWidth={fs / 6} />;
            })()}
            {o.kind === 'opening' && o.beam && (horiz ? <rect x={r.x} y={o.wall === 0 ? 0 : D - 300} width={r.width} height={300} fill="none" stroke="#78716c" strokeDasharray={`${fs} ${fs / 2}`} strokeWidth={fs / 8} /> : <rect x={o.wall === 3 ? 0 : W - 300} y={r.y} width={300} height={r.height} fill="none" stroke="#78716c" strokeDasharray={`${fs} ${fs / 2}`} strokeWidth={fs / 8} />)}
            <text x={r.x + r.width / 2} y={r.y + r.height / 2} fontSize={fs * 0.7} textAnchor="middle" dominantBaseline="middle" fill="#1c1917" transform={horiz ? undefined : `rotate(-90 ${r.x + r.width / 2} ${r.y + r.height / 2})`}>
              {o.kind === 'opening' ? (o.beam ? 'RC beam over' : 'open') : ''}
            </text>
          </g>
        );
      })}
      {room.placements.map((p) => {
        const it = items.find((i) => i.id === p.itemId);
        if (!it) return null;
        const polys = footprints(it, catalog, p);
        const pts = polys[0];
        const cx = pts.reduce((a, q) => a + q[0], 0) / 4;
        const cz = pts.reduce((a, q) => a + q[1], 0) / 4;
        const sel = selected === it.id;
        return (
          <g
            key={p.itemId}
            className="cursor-move"
            onPointerDown={(e) => {
              e.stopPropagation();
              (e.target as Element).setPointerCapture?.(e.pointerId);
              onSelect(it.id);
              drag.current = { id: it.id, start: toMm(e), orig: p };
            }}
          >
            {polys.map((poly, k) => (
              <polygon key={k} points={poly.map((q) => q.join(',')).join(' ')} fill={it.kind === 'run' ? '#ddd6fe' : '#e9c99f'} fillOpacity={0.85} stroke={sel ? '#ea580c' : '#57534e'} strokeWidth={sel ? fs / 3 : fs / 10} />
            ))}
            <text x={cx} y={cz} fontSize={fs * 0.8} textAnchor="middle" dominantBaseline="middle" fill="#1c1917" fontWeight={600}>
              {it.name.length > 24 ? `${it.name.slice(0, 22)}…` : it.name}
            </text>
          </g>
        );
      })}
      <g fill="#333" fontSize={fs} fontWeight={700} textAnchor="middle">
        <text x={W / 2} y={-T - pad * 0.35}>
          {W} mm · {WALL_NAMES[0]}
        </text>
        <text x={-T - pad * 0.35} y={D / 2} transform={`rotate(-90 ${-T - pad * 0.35} ${D / 2})`}>
          {D} mm
        </text>
        <text x={W / 2} y={D + T + pad * 0.6} fontSize={fs * 0.8} fill="#78716c">
          {WALL_NAMES[2]}
          {room.showWalls[2] ? '' : ' (cut away for viewing)'}
        </text>
      </g>
    </svg>
  );
}

export default function RoomDesigner() {
  const { id = '' } = useParams();
  const quote = useStore((s) => s.quotes.find((q) => q.id === id));
  const { updateQuote, catalog } = useStore();
  const calc = useQuoteCalc(quote);
  const [tab, setTab] = useState<Tab>('room');
  const [mode, setMode] = useState<'3d' | 'plan' | 'both'>(typeof window !== 'undefined' && window.innerWidth >= 900 ? 'both' : '3d');
  const [selected, setSelected] = useState<string | null>(null);
  const items = useMemo(() => calc?.items ?? [], [calc]);

  // create the room (or add newly quoted items) on first open
  useEffect(() => {
    if (!quote || !calc) return;
    const missing = calc.items.some((i) => !quote.room?.placements.some((p) => p.itemId === i.id));
    if (!quote.room || missing) updateQuote(quote.id, (q) => (q.room = autoPlace(q.room ?? defaultRoom(), calc.items, catalog)));
  }, [quote, calc, catalog, updateQuote]);

  if (!quote || !calc || !quote.room) return <PageHeader title="Room layout" back />;
  const room = quote.room;
  const up = (fn: (r: Room) => void) => updateQuote(quote.id, (q) => q.room && fn(q.room));
  const sel = room.placements.find((p) => p.itemId === selected);
  const selItem = items.find((i) => i.id === selected);
  const warnings = roomWarnings(room);

  const viewer = <Viewer3D catalog={catalog} room={room} roomItems={items} selectedItemId={selected} onPick={(p) => p.itemId && (setSelected(p.itemId), setTab('items'))} className="h-full w-full" />;
  const plan = (
    <div className="h-full w-full bg-[#f7f5f2]">
      <PlanView room={room} items={items} catalog={catalog} selected={selected} onSelect={(i) => (setSelected(i), i && setTab('items'))} onMove={(itemId, p) => up((r) => Object.assign(r.placements.find((x) => x.itemId === itemId)!, p))} />
    </div>
  );

  return (
    <div className="flex h-[100dvh] flex-col">
      <PageHeader title="Room layout" subtitle={`${quote.title} · ${room.width} × ${room.depth} mm`} back={`/quotes/${quote.id}`} />
      <div className="relative shrink-0 overflow-hidden border-b border-stone-200 bg-stone-200">
        <div className={`grid h-[42vh] min-h-[260px] grid-rows-[100%] md:h-[50vh] ${mode === 'both' ? 'md:grid-cols-2' : ''}`}>
          {(mode === '3d' || mode === 'both') && <div className={`${mode === 'both' ? 'hidden md:block' : ''} h-full min-h-0 min-w-0 overflow-hidden`}>{viewer}</div>}
          {(mode === 'plan' || mode === 'both') && <div className="h-full min-h-0 min-w-0 overflow-hidden">{plan}</div>}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1 border-b border-stone-200 bg-white px-3 py-1.5">
        <Chip active={mode === '3d'} onClick={() => setMode('3d')}>
          <Box size={13} className="inline" /> 3D
        </Chip>
        <Chip active={mode === 'plan'} onClick={() => setMode('plan')}>
          <MapIcon size={13} className="inline" /> Plan
        </Chip>
        <Chip active={mode === 'both'} onClick={() => setMode('both')}>
          <Columns2 size={13} className="inline" /> Both
        </Chip>
        <span className="ml-auto truncate text-[11px] text-stone-500">{mode === '3d' ? 'Tap an item · drag to look around' : 'Drag items to place them'}</span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {warnings.map((w) => (
          <div key={w} className="bg-amber-50 px-4 py-1.5 text-xs text-amber-900">
            {w}
          </div>
        ))}
        <div className="sticky top-0 z-10 border-b border-stone-200 bg-stone-100/95 px-3 backdrop-blur">
          <div className="mx-auto max-w-5xl">
            <Tabs<Tab>
              value={tab}
              onChange={setTab}
              tabs={[
                { value: 'room', label: 'Room & walls' },
                { value: 'openings', label: `Windows, doors & openings (${room.openings.length})` },
                { value: 'items', label: 'Place items' },
              ]}
            />
          </div>
        </div>
        <div className="mx-auto max-w-5xl space-y-3 p-3">
          {tab === 'room' && (
            <div className="grid gap-3 md:grid-cols-2">
              <Card title="Room size">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Width (back wall)">
                    <NumInput value={room.width} min={1000} suffix="mm" onChange={(v) => up((r) => (r.width = v))} />
                  </Field>
                  <Field label="Depth (side walls)">
                    <NumInput value={room.depth} min={1000} suffix="mm" onChange={(v) => up((r) => (r.depth = v))} />
                  </Field>
                  <Field label="Wall thickness">
                    <NumInput value={room.wallThickness} min={50} suffix="mm" onChange={(v) => up((r) => (r.wallThickness = v))} />
                  </Field>
                  <Field label="All wall heights">
                    <NumInput value={room.wallHeights[0]} min={1800} suffix="mm" onChange={(v) => up((r) => (r.wallHeights = [v, v, v, v]))} />
                  </Field>
                  <Field label="Wall colour">
                    <input type="color" className="h-10 w-full rounded-xl border border-stone-300" value={room.wallColor} onChange={(e) => up((r) => (r.wallColor = e.target.value))} />
                  </Field>
                  <Field label="Floor colour">
                    <input type="color" className="h-10 w-full rounded-xl border border-stone-300" value={room.floorColor} onChange={(e) => up((r) => (r.floorColor = e.target.value))} />
                  </Field>
                </div>
              </Card>
              <Card title="Each wall">
                <div className="space-y-2">
                  {([0, 1, 2, 3] as WallSide[]).map((w) => (
                    <div key={w} className="grid grid-cols-[1fr_120px] items-center gap-2">
                      <Toggle label={`${WALL_NAMES[w]} (${wallLength(room, w)}mm)`} checked={room.showWalls[w]} onChange={(v) => up((r) => (r.showWalls[w] = v))} />
                      <NumInput value={room.wallHeights[w]} min={1000} suffix="mm" onChange={(v) => up((r) => (r.wallHeights[w] = v))} />
                    </div>
                  ))}
                  <p className="text-xs text-stone-500">Switch a wall off to cut it away in the 3D view so the client can see in (it still appears as a low outline).</p>
                </div>
              </Card>
            </div>
          )}

          {tab === 'openings' && (
            <div className="space-y-3">
              {room.openings.map((o, i) => (
                <Card
                  key={o.id}
                  title={o.label || OPENING_LABELS[o.kind]}
                  actions={
                    <button className="btn-ghost px-2 text-red-600" aria-label="Remove opening" onClick={() => up((r) => r.openings.splice(i, 1))}>
                      <Trash2 size={16} />
                    </button>
                  }
                >
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                    <Field label="Type">
                      <Select<RoomOpening['kind']> value={o.kind} onChange={(v) => v && up((r) => Object.assign(r.openings[i], { kind: v, beam: v === 'opening' ? r.openings[i].beam : false }))} options={(Object.keys(OPENING_LABELS) as RoomOpening['kind'][]).map((k) => ({ value: k, label: OPENING_LABELS[k] }))} />
                    </Field>
                    <Field label="Wall">
                      <select className="input" value={o.wall} onChange={(e) => up((r) => (r.openings[i].wall = Number(e.target.value) as WallSide))}>
                        {WALL_NAMES.map((n, w) => (
                          <option key={w} value={w}>
                            {n}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label={o.wall === 0 || o.wall === 2 ? 'From left corner' : 'From back corner'}>
                      <NumInput value={o.offset} min={0} suffix="mm" onChange={(v) => up((r) => (r.openings[i].offset = v))} />
                    </Field>
                    <Field label="Width">
                      <NumInput value={o.width} min={100} suffix="mm" onChange={(v) => up((r) => (r.openings[i].width = v))} />
                    </Field>
                    <Field label={o.kind === 'opening' ? 'Opening height' : 'Head height'}>
                      <NumInput value={o.height} min={300} suffix="mm" onChange={(v) => up((r) => (r.openings[i].height = v))} />
                    </Field>
                    {o.kind === 'window' && (
                      <Field label="Sill height">
                        <NumInput value={o.sill} min={0} suffix="mm" onChange={(v) => up((r) => (r.openings[i].sill = v))} />
                      </Field>
                    )}
                    {o.kind === 'opening' && (
                      <>
                        <div className="flex items-end">
                          <Toggle label="RC beam over" checked={o.beam} onChange={(v) => up((r) => (r.openings[i].beam = v))} />
                        </div>
                        {o.beam && (
                          <Field label="Beam depth (drop)">
                            <NumInput value={o.beamDepth} min={50} suffix="mm" onChange={(v) => up((r) => (r.openings[i].beamDepth = v))} />
                          </Field>
                        )}
                      </>
                    )}
                    <Field label="Label" className="col-span-2">
                      <TextInput value={o.label} onChange={(v) => up((r) => (r.openings[i].label = v))} />
                    </Field>
                  </div>
                </Card>
              ))}
              <div className="flex flex-wrap gap-2">
                <button className="btn-secondary" onClick={() => up((r) => r.openings.push(newOpening('window', 0, r)))}>
                  <Plus size={16} /> Window
                </button>
                <button className="btn-secondary" onClick={() => up((r) => r.openings.push(newOpening('door', 3, r)))}>
                  <DoorOpen size={16} /> Door
                </button>
                <button className="btn-secondary" onClick={() => up((r) => r.openings.push(newOpening('opening', 1, r)))}>
                  <SquareDashed size={16} /> Open-plan opening / RC beam
                </button>
              </div>
            </div>
          )}

          {tab === 'items' && (
            <div className="space-y-3">
              <div className="no-scrollbar flex gap-2 overflow-x-auto">
                {items.map((it) => (
                  <Chip key={it.id} active={selected === it.id} onClick={() => setSelected(it.id)}>
                    {it.name}
                  </Chip>
                ))}
              </div>
              {sel && selItem ? (
                <Card title={selItem.name}>
                  <div className="space-y-3">
                    <div className="grid grid-cols-3 gap-3">
                      <Field label="From left wall (X)">
                        <NumInput value={sel.x} suffix="mm" onChange={(v) => up((r) => (r.placements.find((p) => p.itemId === sel.itemId)!.x = v))} />
                      </Field>
                      <Field label="From back wall (Z)">
                        <NumInput value={sel.z} suffix="mm" onChange={(v) => up((r) => (r.placements.find((p) => p.itemId === sel.itemId)!.z = v))} />
                      </Field>
                      <Field label="Facing">
                        <button className="btn-secondary w-full" onClick={() => up((r) => { const p = r.placements.find((x) => x.itemId === sel.itemId)!; p.rot = (((p.rot + 90) % 360) as RoomPlacement['rot']); })}>
                          <RotateCw size={14} /> {sel.rot}°
                        </button>
                      </Field>
                    </div>
                    <span className="label">Push against a wall</span>
                    <div className="flex flex-wrap gap-2">
                      {([0, 1, 2, 3] as WallSide[]).map((w) => (
                        <button key={w} className="btn-secondary px-3 py-1.5 text-xs" onClick={() => up((r) => { const i = r.placements.findIndex((x) => x.itemId === sel.itemId); r.placements[i] = snapToWall(r, selItem, catalog, r.placements[i], w); })}>
                          {WALL_NAMES[w]}
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-stone-500">Kitchen runs are placed from their back-left corner; an L or U kitchen fits into the back-left corner of the room when X and Z are 0.</p>
                  </div>
                </Card>
              ) : (
                <p className="p-4 text-center text-sm text-stone-500">Select an item (tap it in 3D or on the plan) to move, rotate or push it against a wall.</p>
              )}
            </div>
          )}
          <div className="h-6" />
        </div>
      </div>
    </div>
  );
}
