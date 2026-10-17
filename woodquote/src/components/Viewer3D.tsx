import { DoorClosed, DoorOpen, Eye, EyeOff, Lightbulb, LightbulbOff } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { RunBuild } from '../lib/runs';
import type { Box3, Catalog, Room, Run, SectionRef, Unit, UnitBuild } from '../lib/types';
import { addUnitRoom, buildRoomObject, buildRunObject, buildUnitObject, createStage, ROOM_VIEW_DIR, roomBounds, runBounds, runViewDir, unitBounds, type ViewName } from '../render/scene';
import type { ItemPrice } from '../lib/pricing';
import { RENDER_QUALITY, usePrefs } from '../app/prefs';
import { unitExtents } from '../lib/generate';

export interface Pick {
  unitId: string | null;
  itemId?: string | null;
  ref: SectionRef | null;
}

interface Props {
  catalog: Catalog;
  unit?: Unit;
  build?: UnitBuild;
  run?: Run;
  runBuild?: RunBuild;
  highlight?: SectionRef | null;
  selectedUnitId?: string | null;
  onPick?: (p: Pick) => void;
  className?: string;
  compact?: boolean;
  /** context shown around a unit, e.g. the kitchen worktop for a run cabinet */
  extraBoxes?: { box: Box3; color: string }[];
  room?: Room;
  roomItems?: ItemPrice[];
  selectedItemId?: string | null;
}

const VIEWS: { v: ViewName; label: string }[] = [
  { v: '3d', label: '3D' },
  { v: 'front', label: 'Front' },
  { v: 'left', label: 'Left' },
  { v: 'right', label: 'Right' },
  { v: 'back', label: 'Back' },
  { v: 'top', label: 'Top' },
];

/** Interactive orbitable 3D render. Tap a compartment to select it. */
export default function Viewer3D(props: Props) {
  // a new quality setting needs a new WebGL renderer
  const quality = usePrefs((s) => s.renderQuality);
  const [gen, setGen] = useState(0);
  const [lost, setLost] = useState(false);
  return (
    <div className={`relative min-w-0 ${props.className ?? 'h-72 w-full'}`}>
      <ViewerInner key={`${quality}|${gen}`} {...props} className="h-full w-full" onLost={() => setLost(true)} />
      {lost && (
        <button className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-stone-100/95 text-sm font-semibold text-stone-700" onClick={() => (setLost(false), setGen((g) => g + 1))}>
          3D view paused to save memory
          <span className="text-xs font-normal text-stone-500">Tap to show it again</span>
        </button>
      )}
    </div>
  );
}

function ViewerInner({ onLost, catalog, unit, build, run, runBuild, highlight, selectedUnitId, onPick, className, compact, extraBoxes, room, roomItems, selectedItemId }: Props & { onLost?: () => void }) {
  const host = useRef<HTMLDivElement>(null);
  const ctx = useRef<{ renderer: THREE.WebGLRenderer; stage: ReturnType<typeof createStage>; controls: OrbitControls; key: string; invalidate: () => void } | null>(null);
  const pickRef = useRef(onPick);
  const onLostRef = useRef(onLost);
  onLostRef.current = onLost;
  useEffect(() => {
    pickRef.current = onPick;
  }, [onPick]);
  const [view, setView] = useState<ViewName>('3d');
  const [fronts, setFronts] = useState(true);
  const [open, setOpen] = useState(false);
  const [lights, setLights] = useState(false);

  useEffect(() => {
    const el = host.current!;
    const q = RENDER_QUALITY[usePrefs.getState().renderQuality] ?? RENDER_QUALITY.balanced;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: q.antialias, preserveDrawingBuffer: false, powerPreference: q.gpu });
    } catch {
      el.innerHTML = '<div class="p-6 text-sm text-stone-500">3D preview is not supported on this device.</div>';
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, q.pixelRatio));
    el.appendChild(renderer.domElement);
    Object.assign(renderer.domElement.style, { touchAction: 'none', display: 'block', width: '100%', height: '100%' });
    const stage = createStage(renderer, q.shadows);
    const controls = new OrbitControls(stage.camera, renderer.domElement);
    controls.enableDamping = true;
    controls.maxPolarAngle = Math.PI / 2 - 0.02;
    // draw only when something changed, so an idle 3D view costs nothing
    let dirty = true;
    let visible = true;
    const invalidate = () => (dirty = true);
    controls.addEventListener('change', invalidate);
    ctx.current = { renderer, stage, controls, key: '', invalidate };
    // if the phone takes the graphics memory back, pause instead of crashing
    let raf = 0;
    const onLostCtx = (e: Event) => {
      e.preventDefault();
      cancelAnimationFrame(raf);
      onLostRef.current?.();
    };
    renderer.domElement.addEventListener('webglcontextlost', onLostCtx);
    const io = new IntersectionObserver(([e]) => ((visible = e.isIntersecting), invalidate()));
    io.observe(el);

    // tap (not drag) → pick the compartment / unit under the finger
    let down: { x: number; y: number } | null = null;
    const ray = new THREE.Raycaster();
    const onDown = (e: PointerEvent) => (down = { x: e.clientX, y: e.clientY });
    const onUp = (e: PointerEvent) => {
      if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6 || !pickRef.current) return;
      const r = renderer.domElement.getBoundingClientRect();
      ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), stage.camera);
      const hits = ray.intersectObjects(stage.scene.children, true).filter((h) => h.object.type === 'Mesh' && h.object.visible);
      for (const h of hits) {
        let o: THREE.Object3D | null = h.object;
        let ref: SectionRef | null = null;
        let unitId: string | null = null;
        let itemId: string | null = null;
        while (o) {
          itemId = itemId ?? (o.userData.itemId as string | undefined) ?? null;
          ref = ref ?? (o.userData.ref as SectionRef | undefined) ?? null;
          unitId = unitId ?? (o.userData.unitId as string | undefined) ?? null;
          o = o.parent;
        }
        if (ref || unitId || itemId) {
          pickRef.current({ unitId, ref, itemId });
          return;
        }
      }
    };
    renderer.domElement.addEventListener('pointerdown', onDown);
    renderer.domElement.addEventListener('pointerup', onUp);

    const loop = () => {
      const moving = controls.update();
      if ((dirty || moving) && visible) {
        renderer.render(stage.scene, stage.camera);
        dirty = false;
      }
      raf = requestAnimationFrame(loop);
    };
    const resize = () => {
      const w = el.clientWidth || 300;
      const h = el.clientHeight || 300;
      renderer.setSize(w, h, false);
      stage.camera.aspect = w / h;
      stage.camera.updateProjectionMatrix();
      invalidate();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    resize();
    loop();
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      renderer.domElement.removeEventListener('webglcontextlost', onLostCtx);
      stage.dispose();
      controls.removeEventListener('change', invalidate);
      renderer.domElement.removeEventListener('pointerdown', onDown);
      renderer.domElement.removeEventListener('pointerup', onUp);
      controls.dispose();
      renderer.dispose();
      el.removeChild(renderer.domElement);
      ctx.current = null;
    };
  }, []);

  useEffect(() => {
    const c = ctx.current;
    if (!c) return;
    const opt = { showFronts: fronts, openDoors: open, lightsOn: lights, highlight: highlight ?? null };
    let obj: THREE.Object3D;
    let bounds;
    let dir: [number, number, number] | undefined;
    if (room && roomItems) {
      obj = buildRoomObject(room, roomItems, catalog, { ...opt, selectedItemId: selectedItemId ?? null });
      bounds = roomBounds(room);
      dir = ROOM_VIEW_DIR;
    } else if (run && runBuild) {
      obj = buildRunObject(run, runBuild, catalog, { ...opt, selectedUnitId: selectedUnitId ?? null, room: view !== 'back' && view !== 'top' });
      bounds = runBounds(runBuild);
      dir = runViewDir(run);
    } else if (unit && build) {
      obj = buildUnitObject(unit, build, catalog, opt);
      for (const xb of extraBoxes ?? []) {
        const m = new THREE.Mesh(new THREE.BoxGeometry(xb.box.w, xb.box.h, xb.box.d), new THREE.MeshStandardMaterial({ color: xb.color, roughness: 0.4 }));
        m.position.set(xb.box.x + xb.box.w / 2, xb.box.y + xb.box.h / 2, xb.box.z + xb.box.d / 2);
        obj.add(m);
      }
      if (unit.installType === 'builtIn' && view !== 'back' && view !== 'top') addUnitRoom(obj as THREE.Group, unitExtents(unit, catalog));
      bounds = unitBounds(unit, catalog);
    } else return;
    c.stage.setNight(lights);
    c.stage.setContent(obj, bounds);
    const key = `${view}|${room ? 'room' : run?.shape ?? ''}|${Math.round(bounds.x1 - bounds.x0)}|${Math.round(bounds.y1)}|${Math.round(bounds.z1 - bounds.z0)}`;
    if (key !== c.key) {
      const el = host.current!;
      const target = c.stage.frame((el.clientWidth || 1) / (el.clientHeight || 1), view, dir);
      c.controls.target.copy(target);
      c.key = key;
    }
    c.controls.update();
    c.invalidate();
  }, [unit, build, run, runBuild, catalog, fronts, open, lights, highlight, selectedUnitId, view, extraBoxes, room, roomItems, selectedItemId]);

  const chip = (active: boolean) => `rounded-lg px-2 py-1 text-[11px] font-semibold ${active ? 'bg-brand-600 text-white' : 'bg-white/90 text-stone-700'}`;
  return (
    <div className={`relative min-w-0 overflow-hidden ${className ?? 'h-72 w-full'}`}>
      <div ref={host} className="h-full w-full" />
      <div className="no-scrollbar absolute left-1.5 right-1.5 top-1.5 flex gap-1 overflow-x-auto">
        {VIEWS.map((x) => (
          <button key={x.v} className={chip(view === x.v)} onClick={() => setView(x.v)}>
            {x.label}
          </button>
        ))}
      </div>
      {!compact && (
        <div className="absolute bottom-1.5 right-1.5 flex gap-1">
          <button className={chip(!fronts)} onClick={() => setFronts(!fronts)} title={fronts ? 'Hide doors' : 'Show doors'} aria-label="Toggle doors">
            {fronts ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
          <button className={chip(open)} onClick={() => setOpen(!open)} title="Open doors & drawers" aria-label="Open doors">
            {open ? <DoorOpen size={14} /> : <DoorClosed size={14} />}
          </button>
          <button className={chip(lights)} onClick={() => setLights(!lights)} title="Lights on (night view)" aria-label="Toggle lights">
            {lights ? <Lightbulb size={14} /> : <LightbulbOff size={14} />}
          </button>
        </div>
      )}
    </div>
  );
}
