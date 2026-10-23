import { Box, Columns2, DoorOpen, Map as MapIcon, Plus, RotateCw, SquareDashed, Trash2, Undo2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import RoomPalette from '../components/RoomPalette';
import { Card, confirmAction, Field, NumInput, PageHeader, Select, Tabs, TextInput, Toggle } from '../components/ui';
import Viewer3D from '../components/Viewer3D';
import { useQuoteCalc } from '../hooks';
import type { ItemPrice } from '../lib/pricing';
import { autoPlace, placeXZ, closeRoom, defaultRoom, footprints, inwardNormal, isClosed, newOpening, newWall, OPENING_LABELS, ROOM_SHAPES, roomExtents, roomShape, roomWarnings, snapToWall, vertices, wallDir, wallName, type RoomShape } from '../lib/room';
import type { Catalog, Room, RoomOpening, RoomPlacement } from '../lib/types';
import { useStore } from '../store';

type Tab = 'room' | 'openings' | 'items';

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button onClick={onClick} className={`rounded-xl border px-3 py-1.5 text-xs font-semibold ${active ? 'border-brand-600 bg-brand-600 text-white' : 'border-stone-300 bg-white text-stone-700'}`}>
      {children}
    </button>
  );
}

type P = [number, number];
const add = (a: P, b: P, k = 1): P => [a[0] + b[0] * k, a[1] + b[1] * k];
const pts = (ps: P[]) => ps.map((q) => q.join(',')).join(' ');

/** Top-down plan: walls, openings and draggable items. */
function PlanView({ room, items, catalog, selected, onSelect, onMove }: { room: Room; items: ItemPrice[]; catalog: Catalog; selected: string | null; onSelect: (id: string | null) => void; onMove: (id: string, p: RoomPlacement) => void }) {
  const svg = useRef<SVGSVGElement>(null);
  const drag = useRef<{ id: string; start: [number, number]; orig: RoomPlacement } | null>(null);
  // while dragging, the item moves on the plan only; it is saved once on release so the app never stalls
  const [live, setLive] = useState<RoomPlacement | null>(null);
  const placements = live ? room.placements.map((p) => (p.itemId === live.itemId ? live : p)) : room.placements;
  const endDrag = () => {
    if (drag.current && live) onMove(drag.current.id, live);
    drag.current = null;
    setLive(null);
  };
  const T = room.wallThickness;
  const ext = { ...roomExtents(room) };
  for (const pl of room.placements) {
    const it = items.find((i) => i.id === pl.itemId);
    if (!it) continue;
    for (const [px, pz] of footprints(it, catalog, pl).flat()) {
      ext.x0 = Math.min(ext.x0, px);
      ext.x1 = Math.max(ext.x1, px);
      ext.z0 = Math.min(ext.z0, pz);
      ext.z1 = Math.max(ext.z1, pz);
    }
  }
  const span = Math.max(ext.x1 - ext.x0, ext.z1 - ext.z0, 1000);
  const pad = span * 0.12 + T;
  const fs = span / 40;
  const v = vertices(room);
  const toMm = (e: React.PointerEvent): [number, number] => {
    const s = svg.current!;
    const pt = s.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const p = pt.matrixTransform(s.getScreenCTM()!.inverse());
    return [p.x, p.y];
  };
  /** Quad along wall i from u0..u1, from the inside face (0) outwards (t > 0) or inwards (t < 0). */
  const quad = (i: number, u0: number, u1: number, t0: number, t1: number): P[] => {
    const d = wallDir(room.walls[i]);
    const n = inwardNormal(room, i);
    const a = add(v[i], d, u0);
    const b = add(v[i], d, u1);
    return [add(a, n, -t0), add(b, n, -t0), add(b, n, -t1), add(a, n, -t1)];
  };

  return (
    <svg
      ref={svg}
      viewBox={`${ext.x0 - pad} ${ext.z0 - pad} ${ext.x1 - ext.x0 + 2 * pad} ${ext.z1 - ext.z0 + 2 * pad}`}
      className="h-full w-full touch-none select-none"
      onPointerMove={(e) => {
        if (!drag.current) return;
        const [x, z] = toMm(e);
        const d = drag.current;
        setLive({ ...d.orig, x: Math.round((d.orig.x + x - d.start[0]) / 5) * 5, z: Math.round((d.orig.z + z - d.start[1]) / 5) * 5 });
      }}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onClick={(e) => e.target === svg.current && onSelect(null)}
    >
      <polygon points={pts(v)} fill={room.floorColor} opacity={0.35} />
      {room.walls.map((w, i) => (
        <g key={w.id}>
          <polygon points={pts(quad(i, -T, w.length + T, 0, T))} fill={w.visible ? '#57534e' : '#d6d3d1'} />
        </g>
      ))}
      {v.slice(0, room.walls.length).map((p, i) => (
        <circle key={i} cx={p[0]} cy={p[1]} r={fs / 3} fill="#ea580c" />
      ))}
      {room.openings.map((o) => {
        const w = room.walls[o.wall];
        if (!w) return null;
        const d = wallDir(w);
        const n = inwardNormal(room, o.wall);
        const u0 = Math.max(0, o.offset);
        const u1 = Math.min(w.length, o.offset + o.width);
        const mid = add(v[o.wall], d, (u0 + u1) / 2);
        return (
          <g key={o.id}>
            <polygon points={pts(quad(o.wall, u0, u1, -1, T + 1))} fill="#fff" />
            {o.kind === 'window' && (() => {
              const [a, b] = [add(add(v[o.wall], d, u0), n, -T / 2), add(add(v[o.wall], d, u1), n, -T / 2)];
              return <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke="#38bdf8" strokeWidth={T / 4} />;
            })()}
            {o.kind === 'door' && (() => {
              const r = u1 - u0;
              const hinge = add(v[o.wall], d, u0);
              const open = add(hinge, n, r);
              const end = add(hinge, d, r);
              const sweep = n[0] * d[1] - n[1] * d[0] > 0 ? 1 : 0;
              return <path d={`M${hinge.join(' ')} L${open.join(' ')} A${r} ${r} 0 0 ${sweep} ${end.join(' ')}`} fill="none" stroke="#8b6b4a" strokeWidth={fs / 6} />;
            })()}
            {o.kind === 'opening' && o.beam && <polygon points={pts(quad(o.wall, u0, u1, 0, -300))} fill="none" stroke="#78716c" strokeDasharray={`${fs} ${fs / 2}`} strokeWidth={fs / 8} />}
            {o.kind === 'opening' && (() => {
              const p = add(mid, n, fs * 1.2);
              return (
                <text x={p[0]} y={p[1]} fontSize={fs * 0.7} textAnchor="middle" dominantBaseline="middle" fill="#1c1917">
                  {o.beam ? 'RC beam over' : 'open'}
                </text>
              );
            })()}
          </g>
        );
      })}
      {(room.fixtures ?? []).map((f) => {
        const poly = [
          [0, 0],
          [f.w, 0],
          [f.w, f.d],
          [0, f.d],
        ].map(([a, b]) => placeXZ(a, b, { itemId: '', x: f.x, z: f.z, rot: f.rot }));
        const cx = poly.reduce((a, q) => a + q[0], 0) / 4;
        const cz = poly.reduce((a, q) => a + q[1], 0) / 4;
        return (
          <g key={f.id} pointerEvents="none">
            <polygon points={pts(poly)} fill="#a78bfa" fillOpacity={0.12} stroke="#7c3aed" strokeWidth={fs / 10} strokeDasharray={`${fs / 2} ${fs / 3}`} />
            <text x={cx} y={cz + fs} fontSize={fs * 0.6} textAnchor="middle" fill="#6d28d9">
              plan: {f.label}
            </text>
          </g>
        );
      })}
      {placements.map((p) => {
        const it = items.find((i) => i.id === p.itemId);
        if (!it) return null;
        const polys = footprints(it, catalog, p);
        const ps = polys.flat();
        const cx = ps.reduce((a, q) => a + q[0], 0) / ps.length;
        const cz = ps.reduce((a, q) => a + q[1], 0) / ps.length;
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
              <polygon key={k} points={pts(poly)} fill={it.kind === 'run' ? '#ddd6fe' : it.kind === 'assembly' && !it.assembly?.pieces.some((x) => x.unit) ? '#bae6fd' : '#e9c99f'} fillOpacity={0.85} stroke={sel ? '#ea580c' : '#57534e'} strokeWidth={sel ? fs / 3 : fs / 10} />
            ))}
            <text x={cx} y={cz} fontSize={fs * 0.8} textAnchor="middle" dominantBaseline="middle" fill="#1c1917" fontWeight={600}>
              {it.name.length > 24 ? `${it.name.slice(0, 22)}…` : it.name}
            </text>
          </g>
        );
      })}
      {room.walls.map((w, i) => {
        const d = wallDir(w);
        const n = inwardNormal(room, i);
        const p = add(add(v[i], d, w.length / 2), n, -(T + fs * 1.1));
        let a = w.angle % 360;
        if (a > 90 && a <= 270) a -= 180;
        return (
          <text key={w.id} x={p[0]} y={p[1]} fontSize={fs} fontWeight={700} textAnchor="middle" dominantBaseline="middle" fill={w.visible ? '#333' : '#a8a29e'} transform={`rotate(${a} ${p[0]} ${p[1]})`}>
            W{i + 1} · {w.length} mm{w.visible ? '' : ' (cut away)'}
          </text>
        );
      })}
    </svg>
  );
}

export default function RoomDesigner() {
  const { id = '' } = useParams();
  const quote = useStore((s) => s.quotes.find((q) => q.id === id));
  const { updateQuote, catalog } = useStore();
  const calc = useQuoteCalc(quote);
  const [search] = useSearchParams();
  const [tab, setTab] = useState<Tab>(search.get('start') ? 'items' : 'room');
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
  const ext = roomExtents(room);
  /** Remove wall i (openings on it go too; later walls keep theirs). */
  const deleteWall = (r: Room, i: number) => {
    r.walls.splice(i, 1);
    r.openings = r.openings.filter((o) => o.wall !== i).map((o) => (o.wall > i ? { ...o, wall: o.wall - 1 } : o));
  };
  const insertWall = (r: Room, i: number) => {
    const w = r.walls[i];
    r.walls.splice(i + 1, 0, newWall(1000, w.angle + 90, w.height));
    r.openings = r.openings.map((o) => (o.wall > i ? { ...o, wall: o.wall + 1 } : o));
  };
  const turn = (r: Room, i: number, by: number) => (r.walls[i].angle = (((r.walls[i].angle + by) % 360) + 360) % 360);

  const viewer = <Viewer3D catalog={catalog} room={room} roomItems={items} selectedItemId={selected} onPick={(p) => p.itemId && (setSelected(p.itemId), setTab('items'))} className="h-full w-full" />;
  const plan = (
    <div className="h-full w-full bg-[#f7f5f2]">
      <PlanView room={room} items={items} catalog={catalog} selected={selected} onSelect={(i) => (setSelected(i), i && setTab('items'))} onMove={(itemId, p) => up((r) => Object.assign(r.placements.find((x) => x.itemId === itemId)!, p))} />
    </div>
  );

  return (
    <div className="flex h-[100dvh] flex-col">
      <PageHeader title="Room layout" subtitle={`${quote.title} · ${Math.round(ext.x1 - ext.x0)} × ${Math.round(ext.z1 - ext.z0)} mm`} back={`/quotes/${quote.id}`} />
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
                { value: 'items', label: 'Add & place items' },
              ]}
            />
          </div>
        </div>
        <div className="mx-auto max-w-5xl space-y-3 p-3">
          {tab === 'room' && (
            <div className="grid gap-3 md:grid-cols-2">
              <Card title="Room shape & finish">
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {(Object.keys(ROOM_SHAPES) as RoomShape[]).map((k) => (
                      <button
                        key={k}
                        className="btn-secondary px-3 py-1.5 text-xs"
                        onClick={() =>
                          up((r) => {
                            r.walls = roomShape(k, r.walls[0]?.height ?? 2700);
                            r.walls[Math.min(2, r.walls.length - 1)].visible = false;
                            r.openings = r.openings.filter((o) => o.wall < r.walls.length);
                          })
                        }
                      >
                        {ROOM_SHAPES[k]}
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Wall thickness">
                      <NumInput value={room.wallThickness} min={50} suffix="mm" onChange={(v) => up((r) => (r.wallThickness = v))} />
                    </Field>
                    <Field label="All wall heights">
                      <NumInput value={room.walls[0]?.height ?? 2700} min={1800} suffix="mm" onChange={(v) => up((r) => r.walls.forEach((w) => (w.height = v)))} />
                    </Field>
                    <Field label="Wall colour">
                      <input type="color" className="h-10 w-full rounded-xl border border-stone-300" value={room.wallColor} onChange={(e) => up((r) => (r.wallColor = e.target.value))} />
                    </Field>
                    <Field label="Floor colour">
                      <input type="color" className="h-10 w-full rounded-xl border border-stone-300" value={room.floorColor} onChange={(e) => up((r) => (r.floorColor = e.target.value))} />
                    </Field>
                  </div>
                  <p className="text-xs text-stone-500">
                    Walls are drawn one after another from the first corner. Direction is the way a wall runs on the plan: 0° → right, 90° ↓ towards the front, 180° ← left, 270° ↑ towards the back; any angle in between makes a slanted wall.
                  </p>
                  {!isClosed(room) && (
                    <button className="btn-primary w-full" onClick={() => up((r) => Object.assign(r, closeRoom(r)))}>
                      <Undo2 size={16} /> Close the room (fit the last wall)
                    </button>
                  )}
                </div>
              </Card>
              <Card title={`Walls (${room.walls.length})`}>
                <div className="space-y-3">
                  {room.walls.map((w, i) => (
                    <div key={w.id} className="rounded-xl border border-stone-200 p-2" data-wall={i}>
                      <div className="mb-2 flex items-center gap-2">
                        <span className="text-sm font-bold">{wallName(room, i)}</span>
                        <span className="ml-auto" />
                        <button className="btn-ghost px-2 py-1 text-xs" aria-label={`Add wall after wall ${i + 1}`} onClick={() => up((r) => insertWall(r, i))}>
                          <Plus size={14} /> After
                        </button>
                        {room.walls.length > 3 && (
                          <button className="btn-ghost px-2 text-red-600" aria-label={`Remove wall ${i + 1}`} onClick={() => up((r) => deleteWall(r, i))}>
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <Field label="Length">
                          <NumInput value={w.length} min={100} suffix="mm" onChange={(v) => up((r) => (r.walls[i].length = v))} />
                        </Field>
                        <Field label="Direction">
                          <NumInput value={w.angle} min={0} max={359.9} step={0.5} suffix="°" onChange={(v) => up((r) => (r.walls[i].angle = ((v % 360) + 360) % 360))} />
                        </Field>
                        <Field label="Height">
                          <NumInput value={w.height} min={1000} suffix="mm" onChange={(v) => up((r) => (r.walls[i].height = v))} />
                        </Field>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-1">
                        {[-90, -45, 45, 90].map((by) => (
                          <button key={by} className="btn-secondary px-2 py-1 text-xs" onClick={() => up((r) => turn(r, i, by))}>
                            {by > 0 ? `↻ ${by}°` : `↺ ${-by}°`}
                          </button>
                        ))}
                        <span className="ml-auto">
                          <Toggle label="Show" checked={w.visible} onChange={(v) => up((r) => (r.walls[i].visible = v))} />
                        </span>
                      </div>
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
                      <select className="input" value={o.wall} onChange={(e) => up((r) => (r.openings[i].wall = Number(e.target.value)))}>
                        {room.walls.map((_, w) => (
                          <option key={w} value={w}>
                            {wallName(room, w)}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="From wall start">
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
                <button className="btn-secondary" onClick={() => up((r) => r.openings.push(newOpening('door', Math.min(3, r.walls.length - 1), r)))}>
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
              <RoomPalette
                quote={quote}
                room={room}
                catalog={catalog}
                items={items}
                up={(fn) => updateQuote(quote.id, fn)}
                onAdded={(itemId, t) => {
                  if (itemId) setSelected(itemId);
                  if (t) setTab(t);
                }}
              />
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
                      <Field label="Across (X)">
                        <NumInput value={sel.x} suffix="mm" onChange={(v) => up((r) => (r.placements.find((p) => p.itemId === sel.itemId)!.x = v))} />
                      </Field>
                      <Field label="Down the plan (Z)">
                        <NumInput value={sel.z} suffix="mm" onChange={(v) => up((r) => (r.placements.find((p) => p.itemId === sel.itemId)!.z = v))} />
                      </Field>
                      <Field label="Angle">
                        <NumInput value={sel.rot} min={0} max={359} step={15} suffix="°" onChange={(v) => up((r) => (r.placements.find((p) => p.itemId === sel.itemId)!.rot = Math.round(v) % 360))} />
                      </Field>
                    </div>
                    <div className="grid grid-cols-5 gap-1">
                      {(
                        [
                          [0, '↓ Front'],
                          [180, '↑ Back'],
                          [90, '← Left'],
                          [270, '→ Right'],
                        ] as const
                      ).map(([r0, label]) => (
                        <button key={r0} className={`rounded-lg px-1 py-2 text-xs font-semibold ${sel.rot === r0 ? 'bg-brand-600 text-white' : 'bg-stone-100 text-stone-700'}`} onClick={() => up((r) => (r.placements.find((p) => p.itemId === sel.itemId)!.rot = r0))}>
                          {label}
                        </button>
                      ))}
                      <button className="rounded-lg bg-stone-100 px-1 py-2 text-xs font-semibold text-stone-700" aria-label="Turn 90°" onClick={() => up((r) => { const p = r.placements.find((x) => x.itemId === sel.itemId)!; p.rot = (p.rot + 90) % 360; })}>
                        <RotateCw size={14} className="inline" /> 90°
                      </button>
                    </div>
                    <span className="label">Push against a wall</span>
                    <div className="flex flex-wrap gap-2">
                      {room.walls.map((_, w) => (
                        <button key={w} className="btn-secondary px-3 py-1.5 text-xs" onClick={() => up((r) => { const i = r.placements.findIndex((x) => x.itemId === sel.itemId); r.placements[i] = snapToWall(r, selItem, catalog, r.placements[i], w); })}>
                          {wallName(room, w)}
                        </button>
                      ))}
                    </div>
                    <Link className="btn-secondary w-full" to={selItem.kind === 'run' ? `/quotes/${quote.id}/runs/${selItem.id}` : selItem.kind === 'assembly' ? `/quotes/${quote.id}/groups/${selItem.id}` : `/quotes/${quote.id}/units/${selItem.id}`}>
                      Design / change this item
                    </Link>
                    <button
                      className="btn-ghost w-full text-red-600"
                      onClick={() =>
                        confirmAction(`Remove ${selItem.name} from the quotation?`) &&
                        (updateQuote(quote.id, (q) => {
                          q.units = q.units.filter((u) => u.id !== selItem.id);
                          q.runs = q.runs.filter((r) => r.id !== selItem.id);
                          q.assemblies = (q.assemblies ?? []).filter((a) => a.id !== selItem.id);
                          if (q.room) q.room.placements = q.room.placements.filter((p) => p.itemId !== selItem.id);
                        }),
                        setSelected(null))
                      }
                    >
                      <Trash2 size={14} className="inline" /> Remove from quotation
                    </button>
                    <p className="text-xs text-stone-500">Kitchen runs are placed from their back-left corner; an L or U kitchen fits into the first corner of the room when X and Z are 0.</p>
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
