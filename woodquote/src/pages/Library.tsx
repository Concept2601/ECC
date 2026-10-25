import { ChevronDown, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { confirmAction, Field, NumInput, PageHeader, Tabs, Toggle } from '../components/ui';
import { useMoney } from '../hooks';
import { ACCESSORY_CATEGORIES, ACCESSORY_LABELS, APPLIANCE_CATEGORIES, APPLIANCE_LABELS, type Catalog, type CeilingProduct, type CeilingRates, type PresetItem, type ServiceItem, type TileProduct, type TilePattern, type TileSupply, type TilingRates, type Trade, type TransportOption } from '../lib/types';
import { TRADES } from '../app/brand';
import { usePrefs } from '../app/prefs';
import { ceilingRates } from '../lib/ceilings';
import { TILE_PATTERNS, tilingRates } from '../lib/tiling';
import { uid } from '../lib/util';
import { useStore } from '../store';

type FieldSpec<T> = { key: keyof T & string; label: string; type: 'text' | 'number' | 'color' | 'bool' | 'select'; options?: { value: string; label: string }[]; suffix?: string; half?: boolean };

function EditableList<T extends { id: string; name: string }>({
  items,
  fields,
  summary,
  onChange,
  onAdd,
  onRemove,
  swatch,
}: {
  items: T[];
  fields: FieldSpec<T>[];
  summary: (t: T) => string;
  onChange: (index: number, patch: Partial<T>) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
  swatch?: (t: T) => string | undefined;
}) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <div className="space-y-2">
      {items.map((it, i) => {
        const isOpen = open === it.id;
        return (
          <div key={it.id} className="card overflow-hidden">
            <button className="flex w-full items-center gap-3 p-3 text-left" onClick={() => setOpen(isOpen ? null : it.id)}>
              {swatch && <span className="h-8 w-8 shrink-0 rounded-lg border border-stone-300" style={{ background: swatch(it) }} />}
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold">{it.name}</div>
                <div className="truncate text-xs text-stone-500">{summary(it)}</div>
              </div>
              <ChevronDown size={18} className={`transition ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            {isOpen && (
              <div className="grid grid-cols-2 gap-3 border-t border-stone-100 p-3">
                {fields.map((f) => {
                  const v = it[f.key] as unknown;
                  return (
                    <Field key={f.key} label={f.label} className={f.half ? '' : f.type === 'text' ? 'col-span-2' : ''}>
                      {f.type === 'text' && <input className="input" value={String(v ?? '')} onChange={(e) => onChange(i, { [f.key]: e.target.value } as Partial<T>)} />}
                      {f.type === 'number' && <NumInput value={Number(v ?? 0)} suffix={f.suffix} onChange={(n) => onChange(i, { [f.key]: n } as Partial<T>)} />}
                      {f.type === 'color' && <input type="color" className="h-10 w-full rounded-xl border border-stone-300" value={String(v)} onChange={(e) => onChange(i, { [f.key]: e.target.value } as Partial<T>)} />}
                      {f.type === 'bool' && <Toggle label="" checked={Boolean(v)} onChange={(b) => onChange(i, { [f.key]: b } as Partial<T>)} />}
                      {f.type === 'select' && (
                        <select className="input" value={String(v ?? '')} onChange={(e) => onChange(i, { [f.key]: e.target.value } as Partial<T>)}>
                          {f.options!.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      )}
                    </Field>
                  );
                })}
                <button className="btn-danger col-span-2" onClick={() => confirmAction(`Delete ${it.name}?`) && onRemove(i)}>
                  <Trash2 size={16} /> Delete
                </button>
              </div>
            )}
          </div>
        );
      })}
      <button className="card flex w-full items-center justify-center gap-2 border-dashed p-4 font-semibold text-brand-700" onClick={onAdd}>
        <Plus size={18} /> Add
      </button>
    </div>
  );
}

type Tab = 'boards' | 'edging' | 'glass' | 'aluminium' | 'countertops' | 'accessories' | 'appliances' | 'transport' | 'services' | 'cProducts' | 'cDesigns' | 'cExtras' | 'cRates' | 'tTiles' | 'tSupplies' | 'tExtras' | 'tRates';

const FIRST_TAB: Record<Trade, Tab> = { joinery: 'boards', ceilings: 'cProducts', tiling: 'tTiles' };

export default function Library({ embedded = false }: { embedded?: boolean }) {
  const { catalog, updateCatalog, resetCatalog, settings, updateSettings } = useStore();
  const fmt = useMoney();
  const prefTrade = usePrefs((s) => s.trade);
  const [trade, setTrade] = useState<Trade>(prefTrade);
  const [tab, setTab] = useState<Tab>(FIRST_TAB[prefTrade]);
  const [cat, setCat] = useState<string>('all');
  const [appCat, setAppCat] = useState<string>('all');

  function listProps<K extends keyof Catalog>(key: K) {
    return {
      items: (catalog[key] ?? []) as NonNullable<Catalog[K]>,
      onChange: (i: number, patch: object) => updateCatalog((c) => Object.assign((c[key] as object[])[i], patch)),
      onRemove: (i: number) => updateCatalog((c) => void (c[key] as object[]).splice(i, 1)),
    };
  }

  return (
    <div>
      {!embedded && (
        <PageHeader
          title="Price library"
          subtitle="Materials, accessories & services used for quoting"
          actions={
            <button className="btn-ghost px-2" title="Restore default library" onClick={() => confirmAction('Restore the default price library? Your edits will be lost.') && resetCatalog()}>
              <RotateCcw size={18} />
            </button>
          }
        />
      )}
      <div className={embedded ? 'space-y-3' : 'mx-auto max-w-5xl space-y-3 p-3'}>
        {embedded && (
          <div className="flex justify-end">
            <button className="btn-ghost px-2 text-xs" onClick={() => confirmAction('Restore the default price library? Your edits will be lost.') && resetCatalog()}>
              <RotateCcw size={14} /> Restore default prices
            </button>
          </div>
        )}
        <div className="flex gap-1 rounded-2xl bg-stone-200/70 p-1">
          {TRADES.map((t) => (
            <button key={t.id} className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-sm font-semibold ${trade === t.id ? 'bg-white shadow' : 'text-stone-600'}`} style={trade === t.id ? { color: t.ink } : undefined} onClick={() => (setTrade(t.id), setTab(FIRST_TAB[t.id]))}>
              <t.icon size={16} /> {t.label}
            </button>
          ))}
        </div>
        {trade === 'ceilings' && (
          <Tabs<Tab>
            value={tab}
            onChange={setTab}
            tabs={[
              { value: 'cProducts', label: 'Boards, PVC & materials' },
              { value: 'cDesigns', label: 'Designs' },
              { value: 'cExtras', label: 'Add-ons & services' },
              { value: 'cRates', label: 'Labour & markup' },
            ]}
          />
        )}
        {trade === 'tiling' && (
          <Tabs<Tab>
            value={tab}
            onChange={setTab}
            tabs={[
              { value: 'tTiles', label: 'Tiles' },
              { value: 'tSupplies', label: 'Adhesive, grout & supplies' },
              { value: 'tExtras', label: 'Add-ons & services' },
              { value: 'tRates', label: 'Labour & markup' },
            ]}
          />
        )}
        {trade === 'joinery' && <Tabs<Tab>
          value={tab}
          onChange={setTab}
          tabs={[
            { value: 'boards', label: 'Boards' },
            { value: 'edging', label: 'Edging' },
            { value: 'glass', label: 'Glass' },
            { value: 'aluminium', label: 'Aluminium' },
            { value: 'countertops', label: 'Countertops' },
            { value: 'accessories', label: 'Accessories' },
            { value: 'appliances', label: 'Appliances' },
            { value: 'transport', label: 'Transport' },
            { value: 'services', label: 'Services' },
          ]}
        />}

        {tab === 'boards' && (
          <EditableList
            {...listProps('boards')}
            swatch={(b) => b.color}
            summary={(b) => `${b.category} · ${b.sheetLength}×${b.sheetWidth}×${b.thickness}mm · ${b.finish} · ${fmt(b.pricePerSheet)}/sheet${b.grain ? ' · grain' : ''}`}
            fields={[
              { key: 'name', label: 'Name', type: 'text' },
              { key: 'category', label: 'Category', type: 'text', half: true },
              { key: 'pricePerSheet', label: 'Price per sheet', type: 'number', half: true },
              { key: 'sheetLength', label: 'Sheet length (grain)', type: 'number', suffix: 'mm' },
              { key: 'sheetWidth', label: 'Sheet width', type: 'number', suffix: 'mm' },
              { key: 'thickness', label: 'Thickness', type: 'number', suffix: 'mm' },
              { key: 'color', label: 'Colour (render)', type: 'color' },
              { key: 'texture', label: 'Render finish', type: 'select', options: [{ value: 'plain', label: 'Plain / solid colour' }, { value: 'wood', label: 'Wood grain' }] },
              { key: 'finish', label: 'Surface finish (render)', type: 'select', options: [{ value: 'matte', label: 'Matte' }, { value: 'satin', label: 'Satin' }, { value: 'gloss', label: 'High gloss' }, { value: 'textured', label: 'Textured' }] },
              { key: 'grain', label: 'Grain direction (no rotation when cutting)', type: 'bool' },
            ]}
            onAdd={() => updateCatalog((c) => c.boards.push({ id: uid('b-'), name: 'New board', category: 'MDF', thickness: 18, sheetLength: 2440, sheetWidth: 1220, pricePerSheet: 50, color: '#d9c3a0', grain: false, texture: 'plain', finish: 'matte' }))}
          />
        )}
        {tab === 'edging' && (
          <EditableList
            {...listProps('edging')}
            swatch={(e) => e.color}
            summary={(e) => `${fmt(e.pricePerMeter)} per metre`}
            fields={[
              { key: 'name', label: 'Name', type: 'text' },
              { key: 'pricePerMeter', label: 'Price per metre', type: 'number' },
              { key: 'color', label: 'Colour', type: 'color' },
            ]}
            onAdd={() => updateCatalog((c) => c.edging.push({ id: uid('e-'), name: 'New edging', pricePerMeter: 0.8, color: '#ffffff' }))}
          />
        )}
        {tab === 'glass' && (
          <EditableList
            {...listProps('glass')}
            swatch={(g) => g.color}
            summary={(g) => `${g.thickness}mm · ${fmt(g.pricePerSqm)}/m²`}
            fields={[
              { key: 'name', label: 'Name', type: 'text' },
              { key: 'pricePerSqm', label: 'Price per m²', type: 'number' },
              { key: 'thickness', label: 'Thickness', type: 'number', suffix: 'mm' },
              { key: 'color', label: 'Tint', type: 'color' },
              { key: 'opacity', label: 'Opacity (0-1)', type: 'number' },
            ]}
            onAdd={() => updateCatalog((c) => c.glass.push({ id: uid('g-'), name: 'New glass', thickness: 4, pricePerSqm: 30, color: '#cfe8ef', opacity: 0.3 }))}
          />
        )}
        {tab === 'aluminium' && (
          <EditableList
            {...listProps('aluminium')}
            swatch={(a) => a.color}
            summary={(a) => `${a.stockLength / 1000}m length · ${fmt(a.pricePerLength)}`}
            fields={[
              { key: 'name', label: 'Name', type: 'text' },
              { key: 'pricePerLength', label: 'Price per length', type: 'number' },
              { key: 'stockLength', label: 'Stock length', type: 'number', suffix: 'mm' },
              { key: 'color', label: 'Colour', type: 'color' },
            ]}
            onAdd={() => updateCatalog((c) => c.aluminium.push({ id: uid('a-'), name: 'New profile', stockLength: 6000, pricePerLength: 30, color: '#c0c4c8' }))}
          />
        )}
        {tab === 'countertops' && (
          <EditableList
            {...listProps('countertops')}
            swatch={(c) => c.color}
            summary={(c) => `${c.thickness}mm · ${fmt(c.pricePerSqm)}/m² · ${c.finish}`}
            fields={[
              { key: 'name', label: 'Name', type: 'text' },
              { key: 'pricePerSqm', label: 'Price per m²', type: 'number' },
              { key: 'thickness', label: 'Thickness', type: 'number', suffix: 'mm' },
              { key: 'color', label: 'Colour', type: 'color' },
              { key: 'finish', label: 'Surface finish (render)', type: 'select', options: [{ value: 'matte', label: 'Matte' }, { value: 'satin', label: 'Satin' }, { value: 'gloss', label: 'High gloss' }, { value: 'textured', label: 'Textured' }] },
            ]}
            onAdd={() => updateCatalog((c) => c.countertops.push({ id: uid('c-'), name: 'New top', thickness: 30, pricePerSqm: 100, color: '#cccccc', finish: 'satin' }))}
          />
        )}
        {tab === 'accessories' && (
          <>
            <div className="no-scrollbar flex gap-1 overflow-x-auto">
              {['all', ...ACCESSORY_CATEGORIES].map((c) => (
                <button key={c} className={`chip whitespace-nowrap py-1.5 ${cat === c ? 'bg-brand-600 text-white' : 'border border-stone-300 bg-white text-stone-700'}`} onClick={() => setCat(c)}>
                  {c === 'all' ? 'All' : ACCESSORY_LABELS[c as keyof typeof ACCESSORY_LABELS]}
                </button>
              ))}
            </div>
            <EditableList
              items={catalog.accessories.filter((a) => cat === 'all' || a.category === cat)}
              onChange={(i, patch) => {
                const id = catalog.accessories.filter((a) => cat === 'all' || a.category === cat)[i].id;
                updateCatalog((c) => Object.assign(c.accessories.find((a) => a.id === id)!, patch));
              }}
              onRemove={(i) => {
                const id = catalog.accessories.filter((a) => cat === 'all' || a.category === cat)[i].id;
                updateCatalog((c) => (c.accessories = c.accessories.filter((a) => a.id !== id)));
              }}
              summary={(a) => `${ACCESSORY_LABELS[a.category]} · ${a.size} · ${fmt(a.price)} per ${a.unit === 'm' ? 'metre' : a.packQty > 1 ? `pack of ${a.packQty}` : a.unit}`}
              fields={[
                { key: 'name', label: 'Name', type: 'text' },
                { key: 'category', label: 'Category', type: 'select', options: ACCESSORY_CATEGORIES.map((c) => ({ value: c, label: ACCESSORY_LABELS[c] })) },
                { key: 'size', label: 'Size / spec', type: 'text', half: true },
                { key: 'price', label: 'Price (per pack / unit / metre)', type: 'number' },
                { key: 'unit', label: 'Sold as', type: 'select', options: [{ value: 'pc', label: 'Piece' }, { value: 'pair', label: 'Pair' }, { value: 'set', label: 'Set' }, { value: 'm', label: 'Metre' }] },
                { key: 'packQty', label: 'Pieces per pack', type: 'number' },
                { key: 'lengthMm', label: 'Length (runners)', type: 'number', suffix: 'mm' },
                { key: 'family', label: 'Family (runners auto-size, hinges auto-fit within a family)', type: 'text' },
                { key: 'fit', label: 'Hinge overlay', type: 'select', options: [{ value: '', label: '—' }, { value: 'overlay', label: 'Full overlay' }, { value: 'half', label: 'Half overlay' }, { value: 'inset', label: 'Inset' }] },
                { key: 'style', label: 'Handle style (render)', type: 'select', options: [{ value: '', label: '—' }, ...['bar', 'tbar', 'knob', 'roman', 'notchRound', 'notchOval', 'notchTrapezium', 'finger', 'appliance', 'profile', 'push'].map((v) => ({ value: v, label: v }))] },
              ]}
              onAdd={() => updateCatalog((c) => c.accessories.push({ id: uid('x-'), category: cat === 'all' ? 'other' : (cat as never), name: 'New accessory', size: '', unit: 'pc', packQty: 1, price: 1 }))}
            />
          </>
        )}
        {tab === 'appliances' && (
          <>
          <div className="no-scrollbar flex gap-1 overflow-x-auto">
            {['all', ...APPLIANCE_CATEGORIES].map((c) => (
              <button key={c} className={`chip whitespace-nowrap py-1.5 ${appCat === c ? 'bg-brand-600 text-white' : 'border border-stone-300 bg-white text-stone-700'}`} onClick={() => setAppCat(c)}>
                {c === 'all' ? 'All' : APPLIANCE_LABELS[c as keyof typeof APPLIANCE_LABELS]}
              </button>
            ))}
          </div>
          <EditableList
            items={catalog.appliances.filter((a) => appCat === 'all' || a.category === appCat)}
            onChange={(i, patch) => {
              const id = catalog.appliances.filter((a) => appCat === 'all' || a.category === appCat)[i].id;
              updateCatalog((c) => Object.assign(c.appliances.find((a) => a.id === id)!, patch));
            }}
            onRemove={(i) => {
              const id = catalog.appliances.filter((a) => appCat === 'all' || a.category === appCat)[i].id;
              updateCatalog((c) => (c.appliances = c.appliances.filter((a) => a.id !== id)));
            }}
            swatch={(a) => a.color}
            summary={(a) => `${APPLIANCE_LABELS[a.category]} · ${a.variant} · ${a.width}×${a.height}×${a.depth}mm · ${fmt(a.price)}`}
            fields={[
              { key: 'name', label: 'Name', type: 'text' },
              { key: 'category', label: 'Type', type: 'select', options: APPLIANCE_CATEGORIES.map((c) => ({ value: c, label: APPLIANCE_LABELS[c] })) },
              { key: 'variant', label: 'Variant (gas, electric, side-by-side…)', type: 'text', half: true },
              { key: 'price', label: 'Price', type: 'number' },
              { key: 'placement', label: 'Fitted', type: 'select', options: [{ value: 'top', label: 'Into the worktop' }, { value: 'inbuilt', label: 'Inside a cabinet' }, { value: 'freestanding', label: 'Free-standing' }] },
              { key: 'width', label: 'Width', type: 'number', suffix: 'mm' },
              { key: 'height', label: 'Height', type: 'number', suffix: 'mm' },
              { key: 'depth', label: 'Depth', type: 'number', suffix: 'mm' },
              { key: 'plates', label: 'Plates / burners (hobs)', type: 'number' },
              { key: 'color', label: 'Colour', type: 'color' },
            ]}
            onAdd={() => updateCatalog((c) => c.appliances.push({ id: uid('ap-'), category: appCat === 'all' ? 'other' : (appCat as never), name: 'New appliance', variant: '', width: 600, height: 600, depth: 550, price: 300, color: '#d4d4d8', placement: appCat === 'hob' || appCat === 'sink' || appCat === 'downdraft' ? 'top' : 'inbuilt' }))}
          />
          </>
        )}
        {tab === 'transport' && (
          <EditableList<TransportOption>
            items={settings.pricing.transportOptions}
            summary={(t) => fmt(t.price)}
            fields={[
              { key: 'name', label: 'Name', type: 'text' },
              { key: 'price', label: 'Price', type: 'number' },
            ]}
            onChange={(i, patch) => updateSettings((s) => Object.assign(s.pricing.transportOptions[i], patch))}
            onRemove={(i) => updateSettings((s) => s.pricing.transportOptions.splice(i, 1))}
            onAdd={() => updateSettings((s) => s.pricing.transportOptions.push({ id: uid('tr-'), name: 'New transport option', price: 50 }))}
          />
        )}
        {tab === 'cProducts' && (
          <EditableList<CeilingProduct>
            {...listProps('ceilingProducts')}
            swatch={(p) => p.colour}
            summary={(p) => `${p.kind} · ${fmt(p.price)} per ${p.unit}${p.length ? ` · ${p.length}${p.width ? ` × ${p.width}` : ''} mm` : ''}${p.coverage ? ` · covers ${p.coverage}` : ''} · ${p.system === 'pvc' ? 'PVC' : p.system === 'rhino' ? 'Rhinoboard' : 'both'}`}
            fields={[
              { key: 'name', label: 'Name', type: 'text' },
              { key: 'kind', label: 'What it is', type: 'select', half: true, options: ['board', 'pvc', 'brandering', 'cornice', 'trim', 'fixing', 'tape', 'filler', 'adhesive', 'paint', 'insulation', 'other'].map((v) => ({ value: v, label: v })) },
              { key: 'system', label: 'Used for', type: 'select', half: true, options: [{ value: 'rhino', label: 'Rhinoboard' }, { value: 'pvc', label: 'PVC' }, { value: 'both', label: 'Both' }] },
              { key: 'unit', label: 'Sold per (sheet, strip, length, box…)', type: 'text', half: true },
              { key: 'price', label: 'Price', type: 'number', half: true },
              { key: 'length', label: 'Length', type: 'number', suffix: 'mm', half: true },
              { key: 'width', label: 'Width', type: 'number', suffix: 'mm', half: true },
              { key: 'coverage', label: 'Covers (m² paint/insulation/filler · m tape/adhesive · pcs per box)', type: 'number' },
              { key: 'colour', label: 'Colour', type: 'color', half: true },
            ]}
            onAdd={() => updateCatalog((c) => (c.ceilingProducts ??= []).push({ id: uid('c-'), kind: 'board', name: 'New ceiling product', unit: 'sheet', price: 10, length: 3000, width: 1200, system: 'rhino', colour: '#f5f5f4' }))}
          />
        )}
        {(tab === 'cDesigns' || tab === 'cExtras' || tab === 'tExtras') && (
          <EditableList<PresetItem>
            items={(tab === 'cDesigns' ? settings.ceilingDesigns : tab === 'cExtras' ? settings.ceilingExtras : settings.tilingExtras) ?? []}
            summary={(t) => `${fmt(t.price)} per ${t.unit}`}
            fields={[
              { key: 'name', label: 'Name', type: 'text' },
              { key: 'unit', label: 'Charged per (m, m², item, trip…)', type: 'text', half: true },
              { key: 'price', label: 'Price', type: 'number', half: true },
            ]}
            onChange={(i, patch) => updateSettings((s) => Object.assign((tab === 'cDesigns' ? (s.ceilingDesigns ??= []) : tab === 'cExtras' ? (s.ceilingExtras ??= []) : (s.tilingExtras ??= []))[i], patch))}
            onRemove={(i) => updateSettings((s) => (tab === 'cDesigns' ? (s.ceilingDesigns ??= []) : tab === 'cExtras' ? (s.ceilingExtras ??= []) : (s.tilingExtras ??= [])).splice(i, 1))}
            onAdd={() => updateSettings((s) => (tab === 'cDesigns' ? (s.ceilingDesigns ??= []) : tab === 'cExtras' ? (s.ceilingExtras ??= []) : (s.tilingExtras ??= [])).push({ id: uid('p-'), name: 'New item', unit: tab === 'cDesigns' ? 'm' : 'item', price: 0 }))}
          />
        )}
        {tab === 'cRates' && (
          <RatesForm<CeilingRates>
            values={ceilingRates(settings)}
            onChange={(k, v) => updateSettings((s) => (s.ceilingRates = { ...ceilingRates(s), [k]: v }))}
            fields={[
              ['rhinoPerM2', 'Install rhinoboard ceiling incl. brandering', 'per m²'],
              ['pvcPerM2', 'Install PVC ceiling incl. brandering', 'per m²'],
              ['cornicePerM', 'Fit cornice / wall trim', 'per m'],
              ['paintPerM2', 'Paint ceiling', 'per m²'],
              ['insulationPerM2', 'Lay insulation', 'per m²'],
              ['demolitionPerM2', 'Remove old ceiling (renovations)', 'per m²'],
              ['downlightEach', 'Light cut-out', 'each'],
              ['markupPercent', 'Default markup on new ceiling quotations', '%'],
              ['wastePercent', 'Default waste on boards / strips', '%'],
            ]}
          />
        )}
        {tab === 'tTiles' && (
          <EditableList<TileProduct>
            {...listProps('tiles')}
            swatch={(t) => t.colour}
            summary={(t) => `${t.width} × ${t.height} × ${t.thickness} mm ${t.type}, ${t.finish} · ${t.perBox} per box (${Math.round(((t.perBox * t.width * t.height) / 1e6) * 100) / 100} m²) · ${fmt(t.price)}/box`}
            fields={[
              { key: 'name', label: 'Name', type: 'text' },
              { key: 'type', label: 'Type', type: 'select', half: true, options: ['ceramic', 'porcelain', 'stone', 'mosaic', 'vinyl', 'other'].map((v) => ({ value: v, label: v })) },
              { key: 'finish', label: 'Finish', type: 'select', half: true, options: ['matt', 'gloss', 'polished', 'textured'].map((v) => ({ value: v, label: v })) },
              { key: 'width', label: 'Width', type: 'number', suffix: 'mm', half: true },
              { key: 'height', label: 'Length', type: 'number', suffix: 'mm', half: true },
              { key: 'thickness', label: 'Thickness', type: 'number', suffix: 'mm', half: true },
              { key: 'perBox', label: 'Tiles per box', type: 'number', half: true },
              { key: 'price', label: 'Price per box', type: 'number', half: true },
              { key: 'colour', label: 'Colour', type: 'color', half: true },
            ]}
            onAdd={() => updateCatalog((c) => (c.tiles ??= []).push({ id: uid('t-'), name: 'New tile', type: 'porcelain', width: 600, height: 600, thickness: 9, perBox: 4, price: 20, colour: '#d6d3d1', finish: 'matt' }))}
          />
        )}
        {tab === 'tSupplies' && (
          <EditableList<TileSupply>
            {...listProps('tileSupplies')}
            summary={(t) => `${t.kind} · ${fmt(t.price)} per ${t.unit} · ${t.coverage} ${t.kind === 'adhesive' || t.kind === 'grout' ? 'kg' : t.kind === 'spacers' || t.kind === 'levelling' ? 'pcs' : t.kind === 'trim' || t.kind === 'silicone' ? 'm' : 'm²'} per ${t.unit}`}
            fields={[
              { key: 'name', label: 'Name', type: 'text' },
              { key: 'kind', label: 'What it is', type: 'select', half: true, options: ['adhesive', 'grout', 'spacers', 'levelling', 'trim', 'waterproofing', 'primer', 'silicone', 'screed', 'other'].map((v) => ({ value: v, label: v })) },
              { key: 'unit', label: 'Sold per (bag, pack, length…)', type: 'text', half: true },
              { key: 'price', label: 'Price', type: 'number', half: true },
              { key: 'coverage', label: 'Contents (kg per bag · pcs per pack · m per length/tube · m² per tub)', type: 'number' },
            ]}
            onAdd={() => updateCatalog((c) => (c.tileSupplies ??= []).push({ id: uid('ts-'), kind: 'other', name: 'New tiling supply', unit: 'each', price: 0, coverage: 1 }))}
          />
        )}
        {tab === 'tRates' && (
          <>
            <RatesForm<Omit<TilingRates, 'patternExtra'>>
              values={tilingRates(settings)}
              onChange={(k, v) => updateSettings((s) => (s.tilingRates = { ...tilingRates(s), [k]: v }))}
              fields={[
                ['floorPerM2', 'Lay floor tiles', 'per m²'],
                ['wallPerM2', 'Lay wall tiles', 'per m²'],
                ['skirtingPerM', 'Cut and fix tile skirting', 'per m'],
                ['demolitionPerM2', 'Remove old tiles (renovations)', 'per m²'],
                ['screedPerM2', 'Screed / level floor', 'per m²'],
                ['waterproofPerM2', 'Waterproofing', 'per m²'],
                ['largeFormatExtra', 'Extra labour for tiles 600 mm and larger', '%'],
                ['markupPercent', 'Default markup on new tiling quotations', '%'],
              ]}
            />
            <RatesForm<Record<TilePattern, number>>
              title="Extra labour by laying pattern"
              values={tilingRates(settings).patternExtra}
              onChange={(k, v) => updateSettings((s) => (s.tilingRates = { ...tilingRates(s), patternExtra: { ...tilingRates(s).patternExtra, [k]: v } }))}
              fields={(Object.keys(TILE_PATTERNS) as TilePattern[]).map((p) => [p, TILE_PATTERNS[p].label, '%'])}
            />
          </>
        )}
        {tab === 'services' && (
          <EditableList<ServiceItem>
            items={settings.services ?? []}
            summary={(t) => `${fmt(t.price)} per ${t.unit}`}
            fields={[
              { key: 'name', label: 'Service / item', type: 'text' },
              { key: 'unit', label: 'Charged per (day, trip, m²…)', type: 'text', half: true },
              { key: 'price', label: 'Price', type: 'number', half: true },
            ]}
            onChange={(i, patch) => updateSettings((s) => Object.assign((s.services ??= [])[i], patch))}
            onRemove={(i) => updateSettings((s) => (s.services ??= []).splice(i, 1))}
            onAdd={() => updateSettings((s) => (s.services ??= []).push({ id: uid('svc-'), name: 'New service', unit: 'job', price: 0 }))}
          />
        )}
      </div>
    </div>
  );
}

/** A short form of labour rates / percentages. */
function RatesForm<T extends object>({ values, fields, onChange, title = 'Labour rates' }: { values: T; fields: [keyof T & string, string, string][]; onChange: (k: keyof T & string, v: number) => void; title?: string }) {
  return (
    <div className="card p-4">
      <div className="label mb-3">{title}</div>
      <div className="grid gap-3 sm:grid-cols-2">
        {fields.map(([k, label, unit]) => (
          <Field key={k} label={label}>
            <NumInput value={Number(values[k] ?? 0)} min={0} suffix={unit} onChange={(v) => onChange(k, v)} />
          </Field>
        ))}
      </div>
    </div>
  );
}
