import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { Catalog, Unit, UnitBuild } from '../lib/types';
import { buildUnitObject, createStage, unitSize } from '../render/scene';

interface Props {
  unit: Unit;
  build: UnitBuild;
  catalog: Catalog;
  showFronts: boolean;
  className?: string;
}

/** Interactive orbitable 3D render of a unit. */
export default function Viewer3D({ unit, build, catalog, showFronts, className }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const ctx = useRef<{ renderer: THREE.WebGLRenderer; stage: ReturnType<typeof createStage>; controls: OrbitControls; key: string } | null>(null);

  useEffect(() => {
    const el = host.current!;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    } catch {
      el.innerHTML = '<div class="p-6 text-sm text-stone-500">3D preview is not supported on this device.</div>';
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    el.appendChild(renderer.domElement);
    Object.assign(renderer.domElement.style, { touchAction: 'none', display: 'block', width: '100%', height: '100%' });
    const stage = createStage(renderer);
    const controls = new OrbitControls(stage.camera, renderer.domElement);
    controls.enableDamping = true;
    controls.maxPolarAngle = Math.PI / 2 - 0.02;
    ctx.current = { renderer, stage, controls, key: '' };
    let raf = 0;
    const loop = () => {
      controls.update();
      renderer.render(stage.scene, stage.camera);
      raf = requestAnimationFrame(loop);
    };
    const resize = () => {
      const w = el.clientWidth || 300;
      const h = el.clientHeight || 300;
      renderer.setSize(w, h, false);
      stage.camera.aspect = w / h;
      stage.camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    resize();
    loop();
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      controls.dispose();
      renderer.dispose();
      el.removeChild(renderer.domElement);
      ctx.current = null;
    };
  }, []);

  useEffect(() => {
    const c = ctx.current;
    if (!c) return;
    const size = unitSize(unit);
    c.stage.setContent(buildUnitObject(unit, build, catalog, { showFronts }), size);
    // only re-frame the camera when overall size changes
    const key = `${size.w}|${size.h}|${size.d}`;
    if (key !== c.key) {
      const el = host.current!;
      c.stage.frame(size, (el.clientWidth || 1) / (el.clientHeight || 1));
      c.controls.target.set(0, size.h / 2, 0);
      c.key = key;
    }
  }, [unit, build, catalog, showFronts]);

  return <div ref={host} className={`min-w-0 overflow-hidden ${className ?? 'h-72 w-full'}`} />;
}
