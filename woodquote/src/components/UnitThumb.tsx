import { useEffect, useState } from 'react';
import type { RunBuild } from '../lib/runs';
import type { AssemblyBuild } from '../lib/assembly';
import type { Assembly, Catalog, Run, Unit, UnitBuild } from '../lib/types';
import { renderAssemblyImage, renderRunImage, renderUnitImage } from '../render/scene';

// Thumbnails are cached by design and drawn one at a time, so long quote lists
// don't flood the graphics memory.
const cache = new WeakMap<Catalog, Map<string, string>>();
let queue: Promise<unknown> = Promise.resolve();
function thumb(key: string, cat: Catalog, make: () => string | null): Promise<string | null> {
  let m = cache.get(cat);
  if (!m) cache.set(cat, (m = new Map()));
  const hit = m.get(key);
  if (hit) return Promise.resolve(hit);
  const job = queue.then(
    () =>
      new Promise<string | null>((res) =>
        setTimeout(() => {
          const v = make();
          if (v) {
            m!.set(key, v);
            if (m!.size > 80) m!.delete(m!.keys().next().value as string);
          }
          res(v);
        }, 16),
      ),
  );
  queue = job.catch(() => undefined);
  return job;
}

/** Static render thumbnail (cheap: renders once per change, off the main 3D view). */
export default function UnitThumb({ unit, build, run, runBuild, assembly, assemblyBuild, catalog, className }: { unit?: Unit; build?: UnitBuild; run?: Run; runBuild?: RunBuild; assembly?: Assembly; assemblyBuild?: AssemblyBuild; catalog: Catalog; className?: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    const id = window.setTimeout(() => {
      const p = assembly && assemblyBuild ? thumb(`g${JSON.stringify(assembly)}`, catalog, () => renderAssemblyImage(assembly, assemblyBuild, catalog, 640, 420, 'image/jpeg')) : run && runBuild ? thumb(`r${JSON.stringify(run)}`, catalog, () => renderRunImage(run, runBuild, catalog, 640, 380, 'image/jpeg')) : unit && build ? thumb(`u${JSON.stringify(unit)}`, catalog, () => renderUnitImage(unit, build, catalog, 480, 380, 'image/jpeg')) : null;
      p?.then((v) => alive && setSrc(v));
    }, 120);
    return () => {
      alive = false;
      window.clearTimeout(id);
    };
  }, [unit, build, run, runBuild, assembly, assemblyBuild, catalog]);
  return (
    <div className={`overflow-hidden rounded-xl bg-white ${className ?? 'h-28 w-32'}`}>
      {src ? <img src={src} alt={unit?.name ?? run?.name ?? assembly?.name} className="h-full w-full object-contain" /> : <div className="h-full w-full animate-pulse bg-stone-100" />}
    </div>
  );
}
