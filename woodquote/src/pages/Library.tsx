import { ChevronDown, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { confirmAction, Field, NumInput, PageHeader, Tabs, Toggle } from '../components/ui';
import { useMoney } from '../hooks';
import { ACCESSORY_CATEGORIES, ACCESSORY_LABELS, type Catalog, type TransportOption } from '../lib/types';
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

type Tab = 'boards' | 'edging' | 'glass' | 'aluminium' | 'countertops' | 'accessories' | 'transport';

export default function Library() {
  const { catalog, updateCatalog, resetCatalog, settings, updateSettings } = useStore();
  const fmt = useMoney();
  const [tab, setTab] = useState<Tab>('boards');
  const [cat, setCat] = useState<string>('all');

  function listProps<K extends keyof Catalog>(key: K) {
    return {
      items: catalog[key] as Catalog[K],
      onChange: (i: number, patch: object) => updateCatalog((c) => Object.assign(c[key][i], patch)),
      onRemove: (i: number) => updateCatalog((c) => c[key].splice(i, 1)),
    };
  }

  return (
    <div>
      <PageHeader
        title="Price library"
        subtitle="Materials, accessories & services used for quoting"
        actions={
          <button className="btn-ghost px-2" title="Restore default library" onClick={() => confirmAction('Restore the default price library? Your edits will be lost.') && resetCatalog()}>
            <RotateCcw size={18} />
          </button>
        }
      />
      <div className="mx-auto max-w-5xl space-y-3 p-3">
        <Tabs<Tab>
          value={tab}
          onChange={setTab}
          tabs={[
            { value: 'boards', label: 'Boards' },
            { value: 'edging', label: 'Edging' },
            { value: 'glass', label: 'Glass' },
            { value: 'aluminium', label: 'Aluminium' },
            { value: 'countertops', label: 'Countertops' },
            { value: 'accessories', label: 'Accessories' },
            { value: 'transport', label: 'Transport' },
          ]}
        />

        {tab === 'boards' && (
          <EditableList
            {...listProps('boards')}
            swatch={(b) => b.color}
            summary={(b) => `${b.category} · ${b.sheetLength}×${b.sheetWidth}×${b.thickness}mm · ${fmt(b.pricePerSheet)}/sheet${b.grain ? ' · grain' : ''}`}
            fields={[
              { key: 'name', label: 'Name', type: 'text' },
              { key: 'category', label: 'Category', type: 'text', half: true },
              { key: 'pricePerSheet', label: 'Price per sheet', type: 'number', half: true },
              { key: 'sheetLength', label: 'Sheet length (grain)', type: 'number', suffix: 'mm' },
              { key: 'sheetWidth', label: 'Sheet width', type: 'number', suffix: 'mm' },
              { key: 'thickness', label: 'Thickness', type: 'number', suffix: 'mm' },
              { key: 'color', label: 'Colour (render)', type: 'color' },
              { key: 'texture', label: 'Render finish', type: 'select', options: [{ value: 'plain', label: 'Plain / solid colour' }, { value: 'wood', label: 'Wood grain' }] },
              { key: 'grain', label: 'Grain direction (no rotation when cutting)', type: 'bool' },
            ]}
            onAdd={() => updateCatalog((c) => c.boards.push({ id: uid('b-'), name: 'New board', category: 'MDF', thickness: 18, sheetLength: 2440, sheetWidth: 1220, pricePerSheet: 50, color: '#d9c3a0', grain: false, texture: 'plain' }))}
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
            summary={(c) => `${c.thickness}mm · ${fmt(c.pricePerSqm)}/m²`}
            fields={[
              { key: 'name', label: 'Name', type: 'text' },
              { key: 'pricePerSqm', label: 'Price per m²', type: 'number' },
              { key: 'thickness', label: 'Thickness', type: 'number', suffix: 'mm' },
              { key: 'color', label: 'Colour', type: 'color' },
            ]}
            onAdd={() => updateCatalog((c) => c.countertops.push({ id: uid('c-'), name: 'New top', thickness: 30, pricePerSqm: 100, color: '#cccccc' }))}
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
                { key: 'family', label: 'Family (runners auto-size within a family)', type: 'text' },
              ]}
              onAdd={() => updateCatalog((c) => c.accessories.push({ id: uid('x-'), category: cat === 'all' ? 'other' : (cat as never), name: 'New accessory', size: '', unit: 'pc', packQty: 1, price: 1 }))}
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
      </div>
    </div>
  );
}
