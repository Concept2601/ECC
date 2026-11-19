import { useState } from 'react';
import type { Unit } from '../lib/types';
import SinkDesigner from './SinkDesigner';
import { useStore } from '../store';
import { uid } from '../lib/util';
import ApplianceSelect from './ApplianceSelect';
import { Field } from './ui';

/**
 * Quick hob / sink picker for a floor cabinet (kitchen slot or a cabinet in a
 * group). The first hob or sink on the cabinet is shown; more can be added and
 * positioned in the cabinet designer's Appliances tab.
 */
export default function TopApplianceField({ unit, up, label = 'Hob or sink in the worktop above' }: { unit: Unit; up: (fn: (u: Unit) => void) => void; label?: string }) {
  const first = unit.topAppliances[0];
  const appliances = useStore((s) => s.catalog.appliances);
  const hob = appliances.find((a) => a.id === first?.applianceId && a.category === 'hob');
  const sink = appliances.find((a) => a.id === first?.applianceId && a.category === 'sink');
  const [designing, setDesigning] = useState<'new' | 'edit' | null>(null);
  const useSink = (id: string) =>
    up((u) => {
      if (u.topAppliances[0]) {
        u.topAppliances[0].applianceId = id;
        u.topAppliances[0].downdraftId = null;
      } else u.topAppliances.push({ id: uid('ta'), applianceId: id, bay: Math.floor(u.bays.length / 2), frontGap: null, xOffset: null, downdraftId: null });
    });
  // downdraft closest in width to the hob
  const matching = hob ? appliances.filter((a) => a.category === 'downdraft').sort((x, y) => Math.abs(x.width - hob.width) - Math.abs(y.width - hob.width))[0] : undefined;
  return (
    <>
    <Field label={label}>
      <ApplianceSelect
        value={first?.applianceId ?? null}
        none="None"
        filter={(a) => a.placement === 'top' && a.category !== 'downdraft'}
        onChange={(v) =>
          up((u) => {
            if (!v) u.topAppliances = u.topAppliances.slice(1);
            else if (u.topAppliances[0]) {
              u.topAppliances[0].applianceId = v;
              if (appliances.find((a) => a.id === v)?.category !== 'hob') u.topAppliances[0].downdraftId = null;
            }
            // centred over the middle bay, kept back from the worktop front edge
            else u.topAppliances.push({ id: uid('ta'), applianceId: v, bay: Math.floor(u.bays.length / 2), frontGap: null, xOffset: null, downdraftId: null });
          })
        }
      />
      {unit.topAppliances.length > 1 && <span className="mt-1 block text-[11px] text-stone-500">+{unit.topAppliances.length - 1} more on this cabinet (cabinet designer › Appliances)</span>}
      <span className="mt-1 flex gap-3">
        <button type="button" className="text-xs font-semibold text-brand-700" onClick={() => setDesigning('new')}>
          + Custom sink…
        </button>
        {sink && (
          <button type="button" className="text-xs font-semibold text-brand-700" onClick={() => setDesigning('edit')}>
            Edit this sink’s layout
          </button>
        )}
      </span>
    </Field>
    {designing && <SinkDesigner open onClose={() => setDesigning(null)} base={designing === 'edit' ? (sink ?? null) : null} onSaved={useSink} />}
    {hob && (
      <Field label="Downdraft extractor behind the hob">
        <ApplianceSelect value={first?.downdraftId ?? null} none="None" filter={(a) => a.category === 'downdraft'} onChange={(v) => up((u) => u.topAppliances[0] && (u.topAppliances[0].downdraftId = v))} />
        {!first?.downdraftId && matching && (
          <button type="button" className="mt-1 text-xs font-semibold text-brand-700" onClick={() => up((u) => u.topAppliances[0] && (u.topAppliances[0].downdraftId = matching.id))}>
            + Add matching downdraft ({matching.name})
          </button>
        )}
      </Field>
    )}
    </>
  );
}
