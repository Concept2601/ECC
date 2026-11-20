import { Camera, DoorClosed, DoorOpen, Eye, EyeOff, Lightbulb, LightbulbOff, Sparkles } from 'lucide-react';
import { addRender, blobFromCanvas } from '../app/media';
import { useSaves } from '../app/savepoints';
import { currentQuoteId, useStudio } from '../render/studioState';
import { useFinishTex } from '../render/finishTextures';
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { RunBuild } from '../lib/runs';
import type { AssemblyBuild } from '../lib/assembly';
import type { Assembly, Box3, Catalog, Room, Run, SectionRef, Unit, UnitBuild } from '../lib/types';
import { worktopForUnit, addUnitRoom, assemblyBounds3, buildAssemblyObject, buildRoomObject, buildRunObject, buildUnitObject, createStage, ROOM_VIEW_DIR, roomBounds, runBounds, runViewDir, unitBounds, type ViewName } from '../render/scene';
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
  assembly?: Assembly;
  assemblyBuild?: AssemblyBuild;
  highlight?: SectionRef | null;
  selectedUnitId?: string | null;
  onPick?: (p: Pick) => void;
  className?: string;
  compact?: boolean;
  /** open the render studio as soon as the scene is ready */
  autoStudio?: boolean;
  /** context shown around a unit, e.g. the kitchen worktop for a run cabinet */
  extraBoxes?: { box: Box3; color: string }[];
  room?: Room;
  roomItems?: ItemPrice[];
  selectedItemId?: string | null;
  /** name used for captures and renders */
  title?: string;
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
/** The graphics card WebGL runs on (for Settings), and whether it is a slow software fallback. */
export function graphicsName(r: THREE.WebGLRenderer): string {
  try {
    const gl = r.getContext();
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    return String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
  } catch {
    return 'unknown';
  }
}
function softwareGraphics(r: THREE.WebGLRenderer): boolean {
  const name = graphicsName(r);
  try {
    localStorage.setItem('enquote-gpu', name);
  } catch {
    /* private mode */
  }
  return /swiftshader|software|basic render|llvmpipe|softpipe/i.test(name);
}

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

function ViewerInner({ onLost, catalog, unit, build, run, runBuild, assembly, assemblyBuild, highlight, selectedUnitId, onPick, className, compact, extraBoxes, room, roomItems, selectedItemId, title, autoStudio }: Props & { onLost?: () => void }) {
  const host = useRef<HTMLDivElement>(null);
  const ctx = useRef<{ renderer: THREE.WebGLRenderer; stage: ReturnType<typeof createStage>; controls: OrbitControls; key: string; invalidate: () => void } | null>(null);
  /** rebuilds the model shown, for the render studio */
  const autoStudioDone = useRef(false);
  const openStudioRef = useRef<() => void>(() => {});
  const sceneRef = useRef<{ make: (lit?: boolean) => THREE.Object3D; bounds: { x0: number; x1: number; y0: number; y1: number; z0: number; z1: number }; dir?: [number, number, number]; room: boolean } | null>(null);
  const [capturing, setCapturing] = useState(false);
  // redraw when a finish texture image has finished loading
  const texVersion = useFinishTex((s) => s.version);
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
    // checking every shader for errors blocks the page while the driver answers (slow on Windows)
    renderer.debug.checkShaderErrors = false;
    // a computer drawing 3D in software (no usable graphics driver) gets the light mode automatically
    const soft = softwareGraphics(renderer);
    renderer.setPixelRatio(soft ? 1 : Math.min(window.devicePixelRatio, q.pixelRatio));
    el.appendChild(renderer.domElement);
    Object.assign(renderer.domElement.style, { touchAction: 'none', display: 'block', width: '100%', height: '100%' });
    const stage = createStage(renderer, soft ? 0 : q.shadows);
    const controls = new OrbitControls(stage.camera, renderer.domElement);
    controls.enableDamping = true;
    // settle quickly: a long glide keeps the GPU busy and makes the rest of the app stutter
    controls.dampingFactor = 0.15;
    controls.maxPolarAngle = Math.PI / 2 - 0.02;
    // zoom (wheel or pinch) towards the point under the pointer, not the middle of the view
    controls.zoomToCursor = true;
    controls.screenSpacePanning = true;
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
    // double-click / double-tap a spot: it becomes the point the view turns and zooms around
    let glide: { from: THREE.Vector3; to: THREE.Vector3; t: number } | null = null;
    const onDbl = (e: MouseEvent) => {
      const r = renderer.domElement.getBoundingClientRect();
      ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), stage.camera);
      const hit = ray.intersectObjects(stage.scene.children, true).find((h) => h.object.type === 'Mesh' && h.object.visible);
      if (hit) glide = { from: controls.target.clone(), to: hit.point.clone(), t: 0 };
    };
    renderer.domElement.addEventListener('dblclick', onDbl);

    const lastPos = new THREE.Vector3();
    const lastTarget = new THREE.Vector3();
    const lastQuat = new THREE.Quaternion();
    const loop = () => {
      if (glide) {
        glide.t = Math.min(1, glide.t + 0.08);
        const k = glide.t * glide.t * (3 - 2 * glide.t);
        const next = glide.from.clone().lerp(glide.to, k);
        // move the camera with the target so the view slides rather than swings
        stage.camera.position.add(next.clone().sub(controls.target));
        controls.target.copy(next);
        if (glide.t >= 1) glide = null;
        dirty = true;
      }
      let moving = controls.update();
      if (moving && !dirty) {
        // the last bit of the glide is invisible: stop drawing once the camera barely moves
        const cam = stage.camera;
        const moved = cam.position.distanceTo(lastPos) + controls.target.distanceTo(lastTarget);
        if (moved < 0.5 && cam.quaternion.angleTo(lastQuat) < 0.0005) moving = false;
      }
      if ((dirty || moving) && visible) {
        renderer.render(stage.scene, stage.camera);
        lastPos.copy(stage.camera.position);
        lastTarget.copy(controls.target);
        lastQuat.copy(stage.camera.quaternion);
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
      renderer.domElement.removeEventListener('dblclick', onDbl);
      controls.dispose();
      renderer.dispose();
      el.removeChild(renderer.domElement);
      ctx.current = null;
    };
  }, []);

  useEffect(() => {
    // rebuild the model just after the edit has been handled, and only once for a burst of edits,
    // so typing and the rest of the page never wait for the 3D
    const timer = window.setTimeout(() => {
      const c = ctx.current;
      if (!c) return;
      const opt = { showFronts: fronts, openDoors: open, lightsOn: lights, highlight: highlight ?? null };
      // clean = for the render studio: no selection outlines or highlights
      let make: (clean: boolean, lit?: boolean) => THREE.Object3D;
      let bounds;
      let dir: [number, number, number] | undefined;
      if (room && roomItems) {
        make = (clean, lit = lights) => buildRoomObject(room, roomItems, catalog, { ...opt, ceiling: clean, lightsOn: lit, highlight: clean ? null : opt.highlight, selectedItemId: clean ? null : (selectedItemId ?? null) });
        bounds = roomBounds(room);
        dir = ROOM_VIEW_DIR;
      } else if (run && runBuild) {
        make = (clean, lit = lights) => buildRunObject(run, runBuild, catalog, { ...opt, lightsOn: lit, highlight: clean ? null : opt.highlight, selectedUnitId: clean ? null : (selectedUnitId ?? null), room: view !== 'back' && view !== 'top' });
        bounds = runBounds(runBuild);
        dir = runViewDir(run);
      } else if (assembly && assemblyBuild) {
        make = (clean, lit = lights) => buildAssemblyObject(assembly, assemblyBuild, catalog, { ...opt, lightsOn: lit, highlight: clean ? null : opt.highlight, selectedUnitId: clean ? null : (selectedUnitId ?? null) });
        bounds = assemblyBounds3(assemblyBuild);
        dir = view === '3d' ? [0.7, 0.75, 1] : undefined;
      } else if (unit && build) {
        make = (clean, lit = lights) => {
          const o = buildUnitObject(unit, build, catalog, { ...opt, lightsOn: lit, highlight: clean ? null : opt.highlight });
          // the kitchen worktop around this cabinet, with the sink cut-out
          for (const xb of extraBoxes ?? []) o.add(worktopForUnit(xb.box, xb.color, build, catalog));
          if (unit.installType === 'builtIn' && view !== 'back' && view !== 'top') addUnitRoom(o as THREE.Group, unitExtents(unit, catalog));
          return o;
        };
        bounds = unitBounds(unit, catalog);
      } else return;
      const obj = make(false);
      sceneRef.current = { make: (lit?: boolean) => make(true, lit), bounds, dir, room: !!room };
      if (autoStudio && !autoStudioDone.current) {
        autoStudioDone.current = true;
        window.setTimeout(() => openStudioRef.current(), 400);
      }
      c.stage.setNight(lights);
      c.stage.setContent(obj, bounds);
      const key = `${view}|${room ? 'room' : assembly ? 'group' : run?.shape ?? ''}|${Math.round(bounds.x1 - bounds.x0)}|${Math.round(bounds.y1)}|${Math.round(bounds.z1 - bounds.z0)}`;
      if (key !== c.key) {
        const el = host.current!;
        const target = c.stage.frame((el.clientWidth || 1) / (el.clientHeight || 1), view, dir);
        c.controls.target.copy(target);
        c.key = key;
      }
      c.controls.update();
      c.invalidate();
    }, 80);
    return () => window.clearTimeout(timer);
  }, [unit, build, run, runBuild, assembly, assemblyBuild, catalog, fronts, open, lights, highlight, selectedUnitId, view, extraBoxes, room, roomItems, selectedItemId, texVersion]);

  /** The camera as it is now, so the capture can be re-rendered from the same angle. */
  const cameraNow = () => {
    const c = ctx.current!;
    const off = c.stage.scene.children.find((o) => o.userData.content)?.position ?? new THREE.Vector3();
    // stored in model coordinates (the stage centres the model)
    const p = c.stage.camera.position.clone().sub(off);
    const t = c.controls.target.clone().sub(off);
    return { position: p.toArray() as [number, number, number], target: t.toArray() as [number, number, number], fov: c.stage.camera.fov };
  };
  const name = title ?? unit?.name ?? run?.name ?? assembly?.name ?? (room ? 'Room layout' : '3D view');
  /** Save the view as a high-resolution picture to the renders library. */
  const capture = async () => {
    const c = ctx.current;
    if (!c) return;
    setCapturing(true);
    try {
      const el = host.current!;
      const aspect = (el.clientWidth || 4) / (el.clientHeight || 3);
      const long = /Android|iPhone|iPad/i.test(navigator.userAgent) ? 1920 : 2560;
      const w = aspect >= 1 ? long : Math.round(long * aspect);
      const h = aspect >= 1 ? Math.round(long / aspect) : long;
      const pr = c.renderer.getPixelRatio();
      c.renderer.setPixelRatio(1);
      c.renderer.setSize(w, h, false);
      c.renderer.render(c.stage.scene, c.stage.camera);
      const blob = await blobFromCanvas(c.renderer.domElement, 'image/jpeg', 0.94);
      c.renderer.setPixelRatio(pr);
      c.renderer.setSize(el.clientWidth || 300, el.clientHeight || 300, false);
      c.invalidate();
      await addRender({ kind: 'capture', title: name, quoteId: currentQuoteId(), width: w, height: h, mime: 'image/jpeg', blob, camera: cameraNow() });
      useSaves.setState({ message: 'View captured – find it in the quotation’s Renders' });
    } catch (e) {
      useSaves.setState({ message: `Could not capture: ${(e as Error).message}` });
    } finally {
      setCapturing(false);
    }
  };
  const openStudio = () => {
    const sc = sceneRef.current;
    if (!sc) return;
    if (!sc || !ctx.current) return;
    useStudio.setState({ scene: { title: name, quoteId: currentQuoteId(), make: sc.make, bounds: sc.bounds, dir: sc.dir, camera: cameraNow(), night: lights, room: sc.room } });
  };

  openStudioRef.current = openStudio;
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
        <div className="absolute bottom-1.5 left-1.5 flex gap-1">
          <button className={chip(capturing)} disabled={capturing} onClick={() => void capture()} title="Capture this view (saved to Renders)" aria-label="Capture view">
            <Camera size={14} />
          </button>
          <button className={chip(false)} onClick={openStudio} title="Render studio: photo-quality images and videos" aria-label="Render studio">
            <Sparkles size={14} />
          </button>
        </div>
      )}
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
