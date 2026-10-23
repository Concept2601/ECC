// Cabinet groups: islands with cupboards on any side, peninsulas, back-to-back
// displays and any custom unit made of several cabinets. Every piece can sit
// anywhere and face any way; the group is quoted as one item.
import { Copy, Pencil, Plus, RotateCcw, RotateCw, Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import ApplianceSelect from '../components/ApplianceSelect';
import TopApplianceField from '../components/TopApplianceField';
import { IslandIcon } from '../components/AddGroupModal';
import { Card, confirmAction, Field, NumInput, PageHeader, Select, TextInput, Toggle } from '../components/ui';
import Viewer3D from '../components/Viewer3D';
import { usePageShortcuts } from '../app/shortcuts';
import { useMoney, useQuoteCalc } from '../hooks';
import { appliancePiece, assemblyBounds, FACINGS, slatCount, slatPiece, ISLAND_SIDES, islandGroup, nextSpot, pieceCentre, pieceFootprint, pieceName, pieceRect, setFacing, snapPiece, syncAssembly, turn, unitPiece } from '../lib/assembly';
import { createUnit, PRODUCT_LABELS, QUICK_TYPES, retypeUnit } from '../lib/presets';
import type { Assembly, AssemblyPiece, Catalog, ProductType, SlatWall } from '../lib/types';
import { deepClone, uid } from '../lib/util';
import { useStore } from '../store';

type P = [number, number];

/** Settings for wall slats: size, slat width and gap, board and an optional backing board. */
function SlatFields({ s, catalog, up }: { s: SlatWall; catalog: Catalog; up: (fn: (s: SlatWall) => void) => void }) {
  const n = slatCount(s);
  const gap = n > 1 ? (s.width - n * s.slatWidth) / (n - 1) : 0;
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-2">
        <Field label="Width">
          <NumInput value={s.width} min={50} suffix="mm" onChange={(v) => up((x) => (x.width = v))} />
        </Field>
        <Field label="Height">
          <NumInput value={s.height} min={50} suffix="mm" onChange={(v) => up((x) => (x.height = v))} />
        </Field>
        <Field label="From the floor">
          <NumInput value={s.bottom} min={0} suffix="mm" onChange={(v) => up((x) => (x.bottom = v))} />
        </Field>
        <Field label="Slat width">
          <NumInput value={s.slatWidth} min={5} suffix="mm" onChange={(v) => up((x) => (x.slatWidth = v))} />
        </Field>
        <Field label="Gap">
          <NumInput value={s.slatGap} min={0} suffix="mm" onChange={(v) => up((x) => (x.slatGap = v))} />
        </Field>
      </div>
      <Field label="Slat board">
        <Select value={s.materialId} onChange={(v) => v && up((x) => (x.materialId = v))} options={catalog.boards.map((b) => ({ value: b.id, label: b.name }))} />
      </Field>
      <Field label="Backing board behind the slats">
        <Select value={s.backerId} allowNone="None – slats straight on the wall" onChange={(v) => up((x) => (x.backerId = v))} options={catalog.boards.map((b) => ({ value: b.id, label: b.name }))} />
      </Field>
      <p className="text-xs text-stone-500">
        {n} slats, {Math.round(gap)} mm apart, fixed with silicone and wall anchors about every 500 mm{s.backerId ? '; the backing board is siliconed and anchored on a 400 mm grid' : ''}.
      </p>
    </div>
  );
}

/** "+" between cabinets in a row: pick what goes there. */
function RowInsert({ onAdd }: { onAdd: (t: ProductType) => void }) {
  return (
    <label className="relative flex w-7 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-dashed border-stone-300 text-stone-400 hover:border-brand-500 hover:text-brand-600" title="Add a cabinet here">
      <Plus size={14} />
      <select className="absolute inset-0 cursor-pointer opacity-0" value="" aria-label="Add a cabinet here" onChange={(e) => e.target.value && onAdd(e.target.value as ProductType)}>
        <option value="">Add here…</option>
        {QUICK_TYPES.map((q) => (
          <option key={q.type} value={q.type}>
            {PRODUCT_LABELS[q.type]}
          </option>
        ))}
      </select>
    </label>
  );
}
const pts = (ps: P[]) => ps.map((p) => p.join(',')).join(' ');

/** Top view: drag cabinets around; the thick edge is the front (doors / drawers). */
function GroupPlan({ a, cat, selected, onSelect, onDrop }: { a: Assembly; cat: Catalog; selected: string | null; onSelect: (id: string | null) => void; onDrop: (id: string, x: number, z: number) => void }) {
  const svg = useRef<SVGSVGElement>(null);
  // the drag is drawn locally and saved once on release, so dragging never stalls the app
  const [drag, setDrag] = useState<{
    id: string;
    start: P;
    dx: number;
    dz: number;
  } | null>(null);
  const pieces = a.pieces.map((p) => (drag && drag.id === p.id ? { ...p, x: p.x + drag.dx, z: p.z + drag.dz } : p));
  const all = pieces.flatMap((p) => pieceFootprint(p, cat));
  const xs = all.map((q) => q[0]);
  const zs = all.map((q) => q[1]);
  const ext = all.length
    ? {
        x0: Math.min(...xs),
        x1: Math.max(...xs),
        z0: Math.min(...zs),
        z1: Math.max(...zs),
      }
    : { x0: 0, x1: 2000, z0: 0, z1: 1000 };
  const span = Math.max(ext.x1 - ext.x0, ext.z1 - ext.z0, 1200);
  const pad = span * 0.18;
  const fs = span / 32;
  const toMm = (e: React.PointerEvent): P => {
    const s = svg.current!;
    const pt = s.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const p = pt.matrixTransform(s.getScreenCTM()!.inverse());
    return [p.x, p.y];
  };
  const finish = () => {
    if (drag && (drag.dx || drag.dz)) onDrop(drag.id, drag.dx, drag.dz);
    setDrag(null);
  };
  return (
    <svg
      ref={svg}
      viewBox={`${ext.x0 - pad} ${ext.z0 - pad} ${ext.x1 - ext.x0 + 2 * pad} ${ext.z1 - ext.z0 + 2 * pad}`}
      className="h-full w-full touch-none select-none bg-white"
      onPointerMove={(e) => {
        if (!drag) return;
        const [x, z] = toMm(e);
        setDrag({
          ...drag,
          dx: Math.round((x - drag.start[0]) / 5) * 5,
          dz: Math.round((z - drag.start[1]) / 5) * 5,
        });
      }}
      onPointerUp={finish}
      onPointerCancel={finish}
      onClick={(e) => e.target === svg.current && onSelect(null)}
    >
      <text x={ext.x0 - pad + fs * 0.5} y={ext.z1 + pad - fs * 0.5} fontSize={fs * 0.7} fill="#78716c">
        ↓ front of the plan
      </text>
      {pieces.map((p) => {
        const poly = pieceFootprint(p, cat) as P[];
        const r = pieceRect(p, cat);
        const fa = turn(r.x0, r.z1, p);
        const fb = turn(r.x1, r.z1, p);
        const [cx, cz] = pieceCentre(p, cat);
        const sel = selected === p.id;
        const wall = p.unit?.mount === 'wall';
        const fill = p.slats ? '#a8a29e' : !p.unit ? '#bae6fd' : wall ? '#fde68a' : '#e9c99f';
        return (
          <g
            key={p.id}
            className="cursor-move"
            onPointerDown={(e) => {
              e.stopPropagation();
              (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
              onSelect(p.id);
              setDrag({ id: p.id, start: toMm(e), dx: 0, dz: 0 });
            }}
          >
            <polygon points={pts(poly)} fill={fill} fillOpacity={wall ? 0.55 : 0.9} stroke={sel ? '#ea580c' : '#57534e'} strokeWidth={sel ? fs / 4 : fs / 12} />
            <line x1={fa[0]} y1={fa[1]} x2={fb[0]} y2={fb[1]} stroke="#b45309" strokeWidth={fs / 3} strokeLinecap="round" />
            <text x={cx} y={cz} fontSize={fs * 0.62} textAnchor="middle" dominantBaseline="middle" fill="#1c1917" fontWeight={600} pointerEvents="none">
              {p.unit ? `${p.unit.width}` : pieceName(p, cat).slice(0, 14)}
            </text>
          </g>
        );
      })}
      {!a.pieces.length && (
        <text x={(ext.x0 + ext.x1) / 2} y={(ext.z0 + ext.z1) / 2} fontSize={fs} textAnchor="middle" fill="#a8a29e">
          Add a cabinet to start
        </text>
      )}
    </svg>
  );
}

export default function AssemblyDesigner() {
  const { id = '', gid = '' } = useParams();
  const nav = useNavigate();
  const quote = useStore((s) => s.quotes.find((q) => q.id === id));
  const { updateQuote, catalog } = useStore();
  const calc = useQuoteCalc(quote);
  const fmt = useMoney();
  const [selected, setSelected] = useState<string | null>(null);
  const [addType, setAddType] = useState<ProductType>('kitchen_base');
  const [addAppl, setAddAppl] = useState<string | null>(null);
  const keys = usePageShortcuts();

  const group = quote?.assemblies?.find((g) => g.id === gid);
  const item = calc?.items.find((it) => it.id === gid);
  if (!quote || !group || !item?.assemblyBuild) return <PageHeader title="Group not found" back={quote ? `/quotes/${quote.id}` : '/quotes'} />;

  const up = (fn: (g: Assembly) => void) =>
    updateQuote(quote.id, (q) => {
      const g = q.assemblies?.find((x) => x.id === gid);
      if (!g) return;
      fn(g);
      syncAssembly(g, catalog);
    });
  const upPiece = (pid: string, fn: (p: AssemblyPiece, g: Assembly) => void) =>
    up((g) => {
      const p = g.pieces.find((x) => x.id === pid);
      if (p) fn(p, g);
    });
  const sel = group.pieces.find((p) => p.id === selected) ?? null;
  const ab = item.assemblyBuild;
  const warnings = [...ab.extra.warnings, ...ab.pieces.flatMap((p) => (p.build ? p.build.warnings.map((w) => `${pieceName(p.piece, catalog)}: ${w}`) : []))];

  /** rows: a new cabinet at position i, matching the height of the cabinet next to it when it is the same kind */
  const insertAt = (i: number, t: ProductType) =>
    up((g) => {
      const u = createUnit(t);
      const near = g.pieces[i - 1]?.unit ?? g.pieces[i]?.unit;
      if (near && near.type === t) {
        u.height = near.height;
        u.depth = near.depth;
      }
      u.installType = near?.installType ?? u.installType;
      const p = unitPiece(u);
      p.underTop = false;
      g.pieces.splice(i, 0, p);
      setSelected(p.id);
    });
  const addPiece = (make: (g: Assembly) => AssemblyPiece) =>
    up((g) => {
      const p = make(g);
      g.pieces.push(p);
      setSelected(p.id);
    });
  const duplicate = (pid: string) =>
    up((g) => {
      const p = g.pieces.find((x) => x.id === pid);
      if (!p) return;
      const c = deepClone(p);
      c.id = uid('gp');
      if (c.unit) c.unit.id = uid('u');
      const r = pieceRect(p, catalog);
      // the copy goes next to the original, along its own front
      const [nx, nz] = turn(r.x1 - r.x0, 0, { x: 0, z: 0, rot: p.rot });
      c.x = Math.round(p.x + nx);
      c.z = Math.round(p.z + nz);
      g.pieces.push(c);
      setSelected(c.id);
    });
  const remove = (pid: string) => {
    if (!confirmAction('Remove this piece from the group?')) return;
    up((g) => (g.pieces = g.pieces.filter((x) => x.id !== pid)));
    setSelected(null);
  };
  const rotateBy = (pid: string, d: number) => upPiece(pid, (p) => setFacing(p, p.rot + d, catalog));
  const nudge = (pid: string, dx: number, dz: number) =>
    upPiece(pid, (p) => {
      p.x += dx;
      p.z += dz;
    });

  keys.current = {
    duplicate: () => sel && duplicate(sel.id),
    delete: () => sel && remove(sel.id),
    edit: () => sel?.unit && nav(`/quotes/${quote.id}/units/${sel.unit.id}`),
    prev: () => {
      const i = group.pieces.findIndex((p) => p.id === selected);
      const n = group.pieces[(i - 1 + group.pieces.length) % group.pieces.length];
      if (n) setSelected(n.id);
    },
    next: () => {
      const i = group.pieces.findIndex((p) => p.id === selected);
      const n = group.pieces[(i + 1) % group.pieces.length];
      if (n) setSelected(n.id);
    },
    moveLeft: () => sel && nudge(sel.id, -10, 0),
    moveRight: () => sel && nudge(sel.id, 10, 0),
  };

  const counter = catalog.countertops.find((c) => c.id === group.top.countertopId);
  const islandSides = (() => {
    const r = new Set(group.pieces.filter((p) => p.unit).map((p) => p.rot));
    return r.has(90) || r.has(270) ? 4 : r.has(180) ? 2 : 1;
  })();
  const b = ab.size;

  return (
    <div className="flex h-[100dvh] flex-col">
      <PageHeader
        title={group.name}
        subtitle={`${group.pieces.length} piece(s) · ${Math.round(b.x1 - b.x0)} × ${Math.round(b.z1 - b.z0)} × ${Math.round(b.h)} mm`}
        back={`/quotes/${quote.id}`}
        actions={
          <div className="text-right">
            <div className="text-sm font-bold tabular-nums">{fmt(item.sell)}</div>
            <div className="text-[11px] text-stone-500">cost {fmt(item.cost)}</div>
          </div>
        }
      />
      <div className="grid shrink-0 grid-rows-[100%] border-b border-stone-200 bg-stone-200 md:grid-cols-2" style={{ height: 'min(46vh, 520px)' }}>
        <div className="hidden h-full min-h-0 md:block">
          <Viewer3D
            catalog={catalog}
            assembly={group}
            assemblyBuild={ab}
            selectedUnitId={sel ? (sel.unit?.id ?? sel.id) : null}
            onPick={(p) => setSelected(group.pieces.find((x) => (x.unit?.id ?? x.id) === p.unitId)?.id ?? null)}
            className="h-full w-full"
          />
        </div>
        <div className="h-full min-h-0">
          <GroupPlan
            a={group}
            cat={catalog}
            selected={selected}
            onSelect={setSelected}
            onDrop={(pid, dx, dz) =>
              upPiece(pid, (p, g) => {
                // rows: dragging sideways reorders the cabinets
                if (g.layout === 'row') {
                  const from = g.pieces.indexOf(p);
                  const cx = pieceCentre(p, catalog)[0] + dx;
                  const others = g.pieces.filter((q) => q !== p && q.unit?.mount !== 'wall');
                  let to = others.filter((q) => pieceCentre(q, catalog)[0] < cx).length;
                  g.pieces.splice(from, 1);
                  const after = others[to - 1];
                  to = after ? g.pieces.indexOf(after) + 1 : 0;
                  g.pieces.splice(to, 0, p);
                  return;
                }
                p.x += dx;
                p.z += dz;
                Object.assign(p, snapPiece(g, p, catalog));
              })
            }
          />
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {warnings.length > 0 && <div className="bg-amber-50 px-4 py-2 text-xs text-amber-900">{warnings.slice(0, 4).join(' ')}</div>}
        <div className="mx-auto grid max-w-5xl gap-3 p-3 md:grid-cols-2">
          {group.layout === 'row' && (
            <Card
              title={`Cabinet layout – ${Math.round(b.x1 - b.x0)} mm long`}
              className="md:col-span-2"
              actions={
                <button className="btn-ghost px-2 py-1 text-xs" onClick={() => up((g) => (g.layout = 'free'))}>
                  Free layout
                </button>
              }
            >
              <div className="no-scrollbar flex items-stretch gap-1 overflow-x-auto pb-1">
                {group.pieces.map((p, i) => (
                  <div key={p.id} className="flex items-stretch gap-1">
                    <RowInsert onAdd={(t) => insertAt(i, t)} />
                    <button className={`min-w-[110px] rounded-xl border p-2 text-left ${selected === p.id ? 'border-brand-500 bg-brand-50' : 'border-stone-200 bg-white'}`} onClick={() => setSelected(p.id)}>
                      <div className="truncate text-xs font-bold">
                        {i + 1}. {pieceName(p, catalog)}
                      </div>
                      <div className="text-[11px] text-stone-500">
                        {p.unit ? `${p.unit.width} mm · ${p.unit.mount === 'wall' ? 'wall-hung (above)' : PRODUCT_LABELS[p.unit.type]}` : p.slats ? `${p.slats.width} mm · on the wall` : 'appliance'}
                        {p.gapBefore ? ` · gap ${p.gapBefore}` : ''}
                      </div>
                    </button>
                  </div>
                ))}
                <RowInsert onAdd={(t) => insertAt(group.pieces.length, t)} />
              </div>
              {sel && (
                <div className="mt-2 flex flex-wrap items-end gap-2">
                  <button
                    className="btn-secondary px-2 py-1.5 text-xs"
                    disabled={group.pieces.indexOf(sel) === 0}
                    onClick={() =>
                      up((g) => {
                        const i = g.pieces.findIndex((x) => x.id === sel.id);
                        [g.pieces[i - 1], g.pieces[i]] = [g.pieces[i], g.pieces[i - 1]];
                      })
                    }
                  >
                    ← Move left
                  </button>
                  <button
                    className="btn-secondary px-2 py-1.5 text-xs"
                    disabled={group.pieces.indexOf(sel) === group.pieces.length - 1}
                    onClick={() =>
                      up((g) => {
                        const i = g.pieces.findIndex((x) => x.id === sel.id);
                        [g.pieces[i + 1], g.pieces[i]] = [g.pieces[i], g.pieces[i + 1]];
                      })
                    }
                  >
                    Move right →
                  </button>
                  <Field label="Gap before" className="w-32">
                    <NumInput value={sel.gapBefore ?? 0} min={0} suffix="mm" onChange={(v) => upPiece(sel.id, (p) => (p.gapBefore = v))} />
                  </Field>
                </div>
              )}
              <p className="mt-2 text-xs text-stone-500">Cabinets stand side by side in this order, backs to the wall. Wall-hung pieces go above the cabinet before them. Tap + to add a cabinet at that spot.</p>
            </Card>
          )}
          <Card title={sel ? pieceName(sel, catalog) : 'Selected piece'}>
            {sel ? (
              <div className="space-y-3">
                {group.layout !== 'row' && (
                  <>
                    <div>
                      <span className="label">Faces</span>
                      <div className="grid grid-cols-4 gap-1">
                        {FACINGS.map((f) => (
                          <button
                            key={f.rot}
                            className={`rounded-lg px-2 py-2 text-xs font-semibold ${sel.rot === f.rot ? 'bg-brand-600 text-white' : 'bg-stone-100 text-stone-700 hover:bg-stone-200'}`}
                            onClick={() => upPiece(sel.id, (p) => setFacing(p, f.rot, catalog))}
                          >
                            {f.short}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="grid grid-cols-[auto_1fr_auto] items-end gap-2">
                      <button className="btn-secondary px-2 py-2" aria-label="Turn left" title="Turn 90° anticlockwise" onClick={() => rotateBy(sel.id, 90)}>
                        <RotateCcw size={16} />
                      </button>
                      <Field label="Angle (any)">
                        <NumInput value={sel.rot} min={0} max={359} step={15} suffix="°" onChange={(v) => upPiece(sel.id, (p) => setFacing(p, v, catalog))} />
                      </Field>
                      <button className="btn-secondary px-2 py-2" aria-label="Turn right" title="Turn 90° clockwise" onClick={() => rotateBy(sel.id, -90)}>
                        <RotateCw size={16} />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Field label="Across (X)">
                        <NumInput value={sel.x} step={10} suffix="mm" onChange={(v) => upPiece(sel.id, (p) => (p.x = v))} />
                      </Field>
                      <Field label="Front–back (Z)">
                        <NumInput value={sel.z} step={10} suffix="mm" onChange={(v) => upPiece(sel.id, (p) => (p.z = v))} />
                      </Field>
                    </div>
                  </>
                )}
                {sel.unit && (
                  <>
                    <div className="grid grid-cols-3 gap-2">
                      <Field label="Width">
                        <NumInput value={sel.unit.width} min={100} suffix="mm" onChange={(v) => upPiece(sel.id, (p) => (p.unit!.width = v))} />
                      </Field>
                      <Field label="Height">
                        {sel.underTop && counter && sel.unit.mount === 'floor' ? (
                          <div className="input bg-stone-50">{sel.unit.height}</div>
                        ) : (
                          <NumInput value={sel.unit.height} min={150} suffix="mm" onChange={(v) => upPiece(sel.id, (p) => (p.unit!.height = v))} />
                        )}
                      </Field>
                      <Field label="Depth">
                        <NumInput value={sel.unit.depth} min={100} suffix="mm" onChange={(v) => upPiece(sel.id, (p) => (p.unit!.depth = v))} />
                      </Field>
                    </div>
                    <div>
                      <span className="label">Switch to</span>
                      <div className="flex flex-wrap gap-1">
                        {QUICK_TYPES.map((q) => (
                          <button
                            key={q.type}
                            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${sel.unit!.type === q.type ? 'bg-brand-600 text-white' : 'bg-stone-100 text-stone-700 hover:bg-stone-200'}`}
                            onClick={() => upPiece(sel.id, (p) => (p.unit = retypeUnit(p.unit!, q.type)))}
                          >
                            {q.short}
                          </button>
                        ))}
                      </div>
                    </div>
                    {sel.unit.mount === 'floor' && <TopApplianceField unit={sel.unit} up={(fn) => upPiece(sel.id, (p) => p.unit && fn(p.unit))} label={sel.underTop && counter ? 'Hob or sink in the shared worktop' : 'Hob or sink on top'} />}
                    {sel.unit.mount === 'floor' && <Toggle label="Sits under the shared worktop" checked={sel.underTop} onChange={(v) => upPiece(sel.id, (p) => (p.underTop = v))} />}
                    {sel.unit.mount === 'wall' && (
                      <Field label="Bottom of wall cabinet above the floor">
                        <NumInput value={sel.unit.mountHeight} min={0} suffix="mm" onChange={(v) => upPiece(sel.id, (p) => (p.unit!.mountHeight = v))} />
                      </Field>
                    )}
                  </>
                )}
                {sel.slats && <SlatFields s={sel.slats} catalog={catalog} up={(fn) => upPiece(sel.id, (p) => p.slats && fn(p.slats))} />}
                {!sel.unit && !sel.slats && (
                  <Field label="Appliance">
                    <ApplianceSelect value={sel.applianceId} onChange={(v) => v && upPiece(sel.id, (p) => (p.applianceId = v))} filter={(x) => x.placement !== 'top'} />
                  </Field>
                )}
                <div className="flex flex-wrap gap-2">
                  {sel.unit && (
                    <Link className="btn-primary" to={`/quotes/${quote.id}/units/${sel.unit.id}`}>
                      <Pencil size={16} /> Design – fronts, drawers, hardware
                    </Link>
                  )}
                  <button className="btn-secondary" onClick={() => duplicate(sel.id)}>
                    <Copy size={16} /> Copy
                  </button>
                  <button className="btn-danger" onClick={() => remove(sel.id)}>
                    <Trash2 size={16} /> Remove
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-stone-500">Tap a cabinet on the plan (or in 3D) to move it, turn it to face front, back, left, right or any angle, resize it or change its type. Drag it on the plan; it pulls flush against its neighbours.</p>
            )}
          </Card>

          <Card title="Add to this group">
            <div className="space-y-3">
              <div className="flex gap-2">
                <div className="flex-1">
                  <Select<ProductType>
                    value={addType}
                    onChange={(v) => v && setAddType(v)}
                    options={QUICK_TYPES.map((q) => ({
                      value: q.type,
                      label: PRODUCT_LABELS[q.type],
                    }))}
                  />
                </div>
                <button
                  className="btn-primary"
                  onClick={() =>
                    addPiece((g) => {
                      const u = createUnit(addType);
                      u.installType = 'standalone';
                      const s = nextSpot(g, catalog);
                      return unitPiece(u, s.x, s.z, 0);
                    })
                  }
                >
                  <Plus size={16} /> Cabinet
                </button>
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <ApplianceSelect value={addAppl} none="Free-standing appliance…" onChange={setAddAppl} filter={(x) => x.placement !== 'top'} />
                </div>
                <button
                  className="btn-secondary"
                  disabled={!addAppl}
                  onClick={() =>
                    addPiece((g) => {
                      const s = nextSpot(g, catalog);
                      return appliancePiece(addAppl!, s.x, s.z, 0);
                    })
                  }
                >
                  <Plus size={16} /> Appliance
                </button>
              </div>
              <button
                className="btn-secondary w-full"
                onClick={() =>
                  addPiece((g) => {
                    // slats default to the width of the selected / last floor cabinet, floor to 2400
                    const host = sel?.unit ?? [...g.pieces].reverse().find((p) => p.unit && p.unit.mount === 'floor')?.unit;
                    const s = nextSpot(g, catalog);
                    const p = slatPiece(host?.width ?? 1800, 2400, 0);
                    if (g.layout !== 'row') Object.assign(p, s);
                    return p;
                  })
                }
              >
                <Plus size={16} /> Wall slats (fixed onto the wall)
              </button>
              <div>
                <span className="label">Rebuild as an island (replaces the pieces)</span>
                <div className="grid grid-cols-3 gap-2">
                  {ISLAND_SIDES.map((o) => (
                    <button
                      key={o.sides}
                      className={`card p-2 text-left ${islandSides === o.sides && group.name.startsWith('Island') ? 'border-brand-500' : ''}`}
                      onClick={() =>
                        (!group.pieces.length || confirmAction(`Rebuild as an island with cupboards on ${o.label.toLowerCase()}? The current pieces are replaced (you can undo).`)) &&
                        up((g) => {
                          // cabinet footprint only (not the worktop overhangs), so rebuilding never grows the island
                          const cb = g.pieces.length ? assemblyBounds(g, catalog) : { x0: 0, x1: 2400, z0: 0, z1: 1000 };
                          const w = Math.max(1200, Math.round(cb.x1 - cb.x0));
                          const d = Math.max(600, Math.round(cb.z1 - cb.z0));
                          const n = islandGroup({
                            width: w,
                            depth: d,
                            height: g.top.height || 900,
                            sides: o.sides,
                            countertopId: g.top.countertopId ?? catalog.countertops[0]?.id ?? null,
                            seatingOverhang: 300,
                          });
                          g.pieces = n.pieces;
                          g.top = n.top;
                          g.panels = n.panels;
                          if (g.name.startsWith('Island') || !g.name) g.name = n.name;
                          setSelected(null);
                        })
                      }
                    >
                      <IslandIcon sides={o.sides} />
                      <div className="text-xs font-bold">{o.label}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </Card>

          <Card title="Shared worktop">
            <div className="space-y-3">
              <Field label="Worktop over the cabinets marked “under the shared worktop”">
                <Select
                  value={group.top.countertopId}
                  allowNone="None (each cabinet keeps its own top)"
                  onChange={(v) => up((g) => (g.top.countertopId = v))}
                  options={catalog.countertops.map((c) => ({
                    value: c.id,
                    label: c.name,
                  }))}
                />
              </Field>
              {counter && (
                <>
                  <Field label="Worktop height (to the top surface)">
                    <NumInput value={group.top.height} min={300} suffix="mm" onChange={(v) => up((g) => (g.top.height = v))} />
                  </Field>
                  <div className="grid grid-cols-4 gap-2">
                    {(['front', 'back', 'left', 'right'] as const).map((s) => (
                      <Field key={s} label={`Overhang ${s}`}>
                        <NumInput value={group.top.overhang[s]} min={0} suffix="mm" onChange={(v) => up((g) => (g.top.overhang[s] = v))} />
                      </Field>
                    ))}
                  </div>
                  <p className="text-xs text-stone-500">Use a big back overhang (250–350 mm) for bar stools.</p>
                </>
              )}
            </div>
          </Card>

          <Card title="Exposed panels (one board each)">
            <div className="space-y-3">
              <p className="text-xs text-stone-500">Finished boards that run the whole length or depth of the group as one piece, floor to worktop, e.g. the two ends of a two-sided island.</p>
              <div className="grid grid-cols-2 gap-2">
                {(['left', 'right', 'back', 'front'] as const).map((s) => (
                  <Toggle
                    key={s}
                    label={s === 'left' ? 'Left end' : s === 'right' ? 'Right end' : s === 'back' ? 'Back' : 'Front'}
                    checked={!!group.panels?.[s]}
                    onChange={(v) =>
                      up(
                        (g) =>
                          (g.panels = {
                            ...(g.panels ?? {
                              left: false,
                              right: false,
                              back: false,
                              front: false,
                              materialId: null,
                            }),
                            [s]: v,
                          }),
                      )
                    }
                  />
                ))}
              </div>
              {group.panels && (
                <Field label="Panel board">
                  <Select
                    value={group.panels.materialId}
                    allowNone="Same as the cabinet fronts"
                    onChange={(v) => up((g) => g.panels && (g.panels.materialId = v))}
                    options={catalog.boards.map((b) => ({
                      value: b.id,
                      label: b.name,
                    }))}
                  />
                </Field>
              )}
            </div>
          </Card>

          <Card title="Group">
            <div className="space-y-3">
              <Field label="Name on quotation">
                <TextInput value={group.name} onChange={(v) => up((g) => (g.name = v))} />
              </Field>
              <Field label="Quantity">
                <NumInput value={group.qty} min={1} step={1} onChange={(v) => up((g) => (g.qty = Math.max(1, Math.round(v))))} />
              </Field>
              <Field label="Notes (shown on quotation)">
                <TextInput multiline value={group.notes} onChange={(v) => up((g) => (g.notes = v))} />
              </Field>
              <ul className="space-y-1 text-xs text-stone-600">
                {item.lines.map((l) => (
                  <li key={l}>{l}</li>
                ))}
              </ul>
            </div>
          </Card>

          <Card title={`Pieces (${group.pieces.length})`} className="md:col-span-2">
            <div className="divide-y divide-stone-100">
              {group.pieces.map((p) => (
                <button key={p.id} className={`flex w-full items-center justify-between gap-2 px-1 py-2 text-left text-sm ${selected === p.id ? 'bg-brand-50' : ''}`} onClick={() => setSelected(p.id)}>
                  <span className="truncate font-semibold">{pieceName(p, catalog)}</span>
                  <span className="shrink-0 text-xs text-stone-500">
                    {p.unit ? `${p.unit.width}×${p.unit.height}×${p.unit.depth}` : p.slats ? `${p.slats.width}×${p.slats.height} slats` : 'appliance'} · {FACINGS.find((f) => f.rot === p.rot)?.label ?? `${p.rot}°`}
                  </span>
                </button>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
