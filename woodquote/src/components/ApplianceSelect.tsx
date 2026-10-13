import { useMoney } from '../hooks';
import { APPLIANCE_CATEGORIES, APPLIANCE_LABELS, type Appliance, type ApplianceCategory } from '../lib/types';
import { useStore } from '../store';

/** Appliance picker grouped by type (stoves, hobs, fridges, microwaves …). */
export default function ApplianceSelect({ value, onChange, filter, none }: { value: string | null | undefined; onChange: (v: string | null) => void; filter: (a: Appliance) => boolean; none?: string }) {
  const appliances = useStore((s) => s.catalog.appliances);
  const fmt = useMoney();
  const groups = APPLIANCE_CATEGORIES.map((c) => [c, appliances.filter((a) => a.category === c && filter(a))] as [ApplianceCategory, Appliance[]]).filter(([, l]) => l.length);
  return (
    <select className="input" value={value ?? ''} onChange={(e) => onChange(e.target.value || null)}>
      {none !== undefined && <option value="">{none}</option>}
      {groups.map(([c, list]) => (
        <optgroup key={c} label={APPLIANCE_LABELS[c]}>
          {list.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name} ({a.width}mm) – {fmt(a.price)}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}
