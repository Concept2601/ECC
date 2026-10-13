import { useEffect, useState } from 'react';
import type { RunBuild } from '../lib/runs';
import type { Catalog, Run, Unit, UnitBuild } from '../lib/types';
import { renderRunImage, renderUnitImage } from '../render/scene';

/** Static render thumbnail (cheap: renders once per change, off the main 3D view). */
export default function UnitThumb({ unit, build, run, runBuild, catalog, className }: { unit?: Unit; build?: UnitBuild; run?: Run; runBuild?: RunBuild; catalog: Catalog; className?: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    const id = window.setTimeout(() => {
      if (run && runBuild) setSrc(renderRunImage(run, runBuild, catalog, 640, 380));
      else if (unit && build) setSrc(renderUnitImage(unit, build, catalog, 480, 380));
    }, 30);
    return () => window.clearTimeout(id);
  }, [unit, build, run, runBuild, catalog]);
  return (
    <div className={`overflow-hidden rounded-xl bg-white ${className ?? 'h-28 w-32'}`}>
      {src ? <img src={src} alt={unit?.name ?? run?.name} className="h-full w-full object-contain" /> : <div className="h-full w-full animate-pulse bg-stone-100" />}
    </div>
  );
}
