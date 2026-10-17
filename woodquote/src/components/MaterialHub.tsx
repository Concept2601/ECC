// Material hub: every material and fitting used in a quotation, grouped by
// what it is used for, with one place to change it for the whole job, and
// every appliance listed in drop-downs grouped by type.
import { useMoney } from '../hooks';
import type { QuoteCalc } from '../lib/pricing';
import { runUnits } from '../lib/runs';
import { leafSections } from '../lib/sections';
import type { Catalog, Quote, Unit } from '../lib/types';
import ApplianceSelect from './ApplianceSelect';
import { Card } from './ui';

type Field = 'carcassMaterialId' | 'frontMaterialId' | 'backMaterialId' | 'edgingId' | 'frontEdgingId' | 'glassId' | 'aluminiumId' | 'hingeId' | 'runnerId' | 'handleId' | 'legId' | 'countertopId';

interface Group {
  title: string;
  usage: string;
  field: Field;
  options: (c: Catalog) => { value: string; label: string }[];
  costKey: (id: string) => string;
  /** only units where this matters */
  applies?: (u: Unit) => boolean;
}

const acc = (cat: string) => (c: Catalog) => c.accessories.filter((a) => a.category === cat).map((a) => ({ value: a.id, label: `${a.name} ${a.size}`.trim() }));
const GROUPS: Group[] = [
  { title: 'Carcass board', usage: 'Sides, tops, bottoms, shelves, partitions', field: 'carcassMaterialId', options: (c) => c.boards.map((b) => ({ value: b.id, label: b.name })), costKey: (id) => `board:${id}` },
  { title: 'Fronts', usage: 'Doors, drawer fronts, flaps, finish panels', field: 'frontMaterialId', options: (c) => c.boards.map((b) => ({ value: b.id, label: `${b.name} (${b.finish})` })), costKey: (id) => `board:${id}` },
  { title: 'Back panels', usage: 'Cabinet backs', field: 'backMaterialId', options: (c) => c.boards.map((b) => ({ value: b.id, label: b.name })), costKey: (id) => `board:${id}`, applies: (u) => !!u.backMaterialId },
  { title: 'Edge banding – carcass', usage: 'Visible carcass edges', field: 'edgingId', options: (c) => c.edging.map((e) => ({ value: e.id, label: e.name })), costKey: (id) => `edge:${id}` },
  { title: 'Edge banding – fronts', usage: 'Door and drawer front edges', field: 'frontEdgingId', options: (c) => c.edging.map((e) => ({ value: e.id, label: e.name })), costKey: (id) => `edge:${id}` },
  { title: 'Worktops & tops', usage: 'Countertops on base units and islands', field: 'countertopId', options: (c) => c.countertops.map((t) => ({ value: t.id, label: t.name })), costKey: (id) => `counter:${id}`, applies: (u) => !!u.countertopId },
  { title: 'Glass', usage: 'Glass doors and shelves', field: 'glassId', options: (c) => c.glass.map((g) => ({ value: g.id, label: g.name })), costKey: (id) => `glass:${id}` },
  { title: 'Aluminium profiles', usage: 'Glass door frames', field: 'aluminiumId', options: (c) => c.aluminium.map((a) => ({ value: a.id, label: a.name })), costKey: (id) => `alu:${id}` },
  { title: 'Hinges', usage: 'Hinged doors and flaps', field: 'hingeId', options: acc('hinge'), costKey: (id) => `hw:${id}` },
  { title: 'Drawer runners', usage: 'Drawers and pull-outs', field: 'runnerId', options: acc('runner'), costKey: (id) => `hw:${id}` },
  { title: 'Handles', usage: 'Doors and drawers', field: 'handleId', options: acc('handle'), costKey: (id) => `hw:${id}` },
  { title: 'Legs', usage: 'Units standing on legs', field: 'legId', options: acc('leg'), costKey: (id) => `hw:${id}`, applies: (u) => u.base === 'legs' },
];

interface Slot {
  key: string;
  where: string;
  value: string | null;
  set: (q: Quote, v: string | null) => void;
}

/** Every appliance position in the quotation. */
function applianceSlots(q: Quote): Slot[] {
  const out: Slot[] = [];
  const unitSlots = (u: Unit, where: string, find: (q: Quote) => Unit | undefined) => {
    for (const ta of u.topAppliances) out.push({ key: `${u.id}:${ta.id}`, where: `${where} – on top`, value: ta.applianceId, set: (qq, v) => { const t = find(qq)?.topAppliances.find((x) => x.id === ta.id); if (t && v) t.applianceId = v; } });
    for (const s of leafSections(u)) if (s.front === 'appliance') out.push({ key: `${u.id}:${s.id}`, where: `${where} – housing`, value: s.applianceId ?? null, set: (qq, v) => { const x = find(qq) && leafSections(find(qq)!).find((y) => y.id === s.id); if (x) x.applianceId = v; } });
  };
  for (const u of q.units) unitSlots(u, u.name, (qq) => qq.units.find((x) => x.id === u.id));
  for (const r of q.runs)
    for (const leg of r.legs)
      for (const m of leg) {
        const findRun = (qq: Quote) => qq.runs.find((x) => x.id === r.id);
        const findMod = (qq: Quote) => findRun(qq)?.legs.flat().find((x) => x.id === m.id);
        for (const u of [m.base, m.wall]) if (u) unitSlots(u, `${r.name} · ${u.name.replace(/^(Base|Tall|Wall) – /, '')}`, (qq) => runUnits(findRun(qq)!).find((x) => x.id === u.id));
        if (m.kind === 'gap') out.push({ key: `${m.id}:gap`, where: `${r.name} · ${m.gapLabel || 'space'}`, value: m.gapApplianceId, set: (qq, v) => { const x = findMod(qq); if (x) x.gapApplianceId = v; } });
        if (m.hoodId) out.push({ key: `${m.id}:hood`, where: `${r.name} · hood`, value: m.hoodId, set: (qq, v) => { const x = findMod(qq); if (x) x.hoodId = v; } });
      }
  return out;
}

export default function MaterialHub({ quote, calc, catalog, up }: { quote: Quote; calc: QuoteCalc; catalog: Catalog; up: (fn: (q: Quote) => void) => void }) {
  const fmt = useMoney();
  const units = [...quote.units, ...quote.runs.flatMap(runUnits)];
  const cost = (key: string) => calc.costLines.find((l) => l.key === key)?.total ?? 0;
  const setAll = (g: Group, v: string) =>
    up((q) => {
      for (const u of [...q.units, ...q.runs.flatMap(runUnits)]) if (!g.applies || g.applies(u)) (u as unknown as Record<Field, string | null>)[g.field] = v;
      if (g.field === 'countertopId') for (const r of q.runs) r.countertopId = v;
    });
  const slots = applianceSlots(quote);
  const appl = (id: string | null) => catalog.appliances.find((a) => a.id === id);
  if (!units.length) return <p className="p-6 text-center text-sm text-stone-500">Add units or a kitchen in Design to see their materials here.</p>;
  return (
    <div className="space-y-3">
      <p className="px-1 text-xs text-stone-500">Every material in this quotation, grouped by what it is used for. Choosing one here changes it on every unit and kitchen cabinet in the job (change single units in their designer).</p>
      <div className="grid gap-3 md:grid-cols-2">
        {GROUPS.map((g) => {
          const users = units.filter((u) => !g.applies || g.applies(u));
          const ids = new Map<string, number>();
          for (const u of users) {
            const id = u[g.field] as string | null;
            if (id) ids.set(id, (ids.get(id) ?? 0) + 1);
          }
          if (g.field === 'countertopId') for (const r of quote.runs) if (r.countertopId) ids.set(r.countertopId, (ids.get(r.countertopId) ?? 0) + 1);
          if (!ids.size) return null;
          const opts = g.options(catalog);
          const name = (id: string) => opts.find((o) => o.value === id)?.label ?? id;
          const one = ids.size === 1 ? [...ids.keys()][0] : '';
          return (
            <Card key={g.title} title={g.title} actions={<span className="text-sm font-bold tabular-nums">{fmt([...ids.keys()].reduce((a, id) => a + cost(g.costKey(id)), 0))}</span>}>
              <p className="mb-2 text-xs text-stone-500">{g.usage}</p>
              <div className="mb-2 flex flex-wrap gap-1">
                {[...ids.entries()].map(([id, n]) => (
                  <span key={id} className="chip bg-stone-100 text-stone-700">
                    {name(id)} · {n} unit{n === 1 ? '' : 's'}
                  </span>
                ))}
              </div>
              <select className="input" value={one} onChange={(e) => e.target.value && setAll(g, e.target.value)}>
                <option value="">{one ? '' : 'Mixed — choose one for all…'}</option>
                {opts.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </Card>
          );
        })}
      </div>
      {slots.length > 0 && (
        <Card title={`Appliances (${slots.length})`} actions={<span className="text-sm font-bold tabular-nums">{fmt(calc.appliancesCost)}</span>}>
          <div className="space-y-2">
            {slots.map((s) => {
              const a = appl(s.value);
              return (
                <div key={s.key} className="grid items-center gap-2 md:grid-cols-[1fr_1.4fr]">
                  <div className="min-w-0 text-sm">
                    <div className="truncate font-medium">{s.where}</div>
                    <div className="text-xs text-stone-500">{a ? `${a.width}×${a.height}×${a.depth} mm` : 'none chosen'}</div>
                  </div>
                  <ApplianceSelect value={s.value} none="None" onChange={(v) => up((q) => s.set(q, v))} filter={(x) => !a || x.placement === a.placement} />
                </div>
              );
            })}
            {!quote.includeAppliances && <p className="text-xs text-amber-700">Appliances are not included in this quotation’s price (Costing tab).</p>}
          </div>
        </Card>
      )}
    </div>
  );
}
