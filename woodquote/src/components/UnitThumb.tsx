import { useEffect, useState } from 'react';
import type { Catalog, Unit, UnitBuild } from '../lib/types';
import { renderUnitImage } from '../render/scene';

/** Static render thumbnail (cheap: renders once per change, off the main 3D view). */
export default function UnitThumb({ unit, build, catalog, className }: { unit: Unit; build: UnitBuild; catalog: Catalog; className?: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    const id = window.setTimeout(() => setSrc(renderUnitImage(unit, build, catalog, 480, 380)), 30);
    return () => window.clearTimeout(id);
  }, [unit, build, catalog]);
  return (
    <div className={`overflow-hidden rounded-xl bg-white ${className ?? 'h-28 w-32'}`}>
      {src ? <img src={src} alt={unit.name} className="h-full w-full object-contain" /> : <div className="h-full w-full animate-pulse bg-stone-100" />}
    </div>
  );
}
