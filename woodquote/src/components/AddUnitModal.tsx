import { useMemo } from 'react';
import { buildUnit } from '../lib/generate';
import { createUnit, PRODUCT_LABELS, PRODUCT_ORDER } from '../lib/presets';
import type { ProductType, Unit } from '../lib/types';
import { useStore } from '../store';
import UnitThumb from './UnitThumb';
import { Modal } from './ui';

export default function AddUnitModal({ open, onClose, onAdd }: { open: boolean; onClose: () => void; onAdd: (u: Unit) => void }) {
  const catalog = useStore((s) => s.catalog);
  const pricing = useStore((s) => s.settings.pricing);
  const previews = useMemo(
    () =>
      open
        ? PRODUCT_ORDER.map((t) => {
            const u = createUnit(t);
            return { t, u, b: buildUnit(u, catalog, pricing) };
          })
        : [],
    [open, catalog, pricing],
  );
  return (
    <Modal open={open} onClose={onClose} title="Add a unit">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {previews.map(({ t, u, b }) => (
          <button
            key={t}
            className="card flex flex-col items-center gap-1 p-2 text-center hover:border-brand-400"
            onClick={() => {
              onAdd(createUnit(t as ProductType));
              onClose();
            }}
          >
            <UnitThumb unit={u} build={b} catalog={catalog} className="h-24 w-full" />
            <span className="text-sm font-semibold leading-tight">{PRODUCT_LABELS[t]}</span>
            <span className="text-[11px] text-stone-500">
              {u.width}×{u.height}×{u.depth}
            </span>
          </button>
        ))}
      </div>
    </Modal>
  );
}
