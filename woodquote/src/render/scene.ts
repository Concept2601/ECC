import * as THREE from 'three';
import type { Box3 as PartBox, Catalog, Unit, UnitBuild } from '../lib/types';

/* ---------------------------------------------------- procedural textures */

const texCache = new Map<string, THREE.CanvasTexture>();

function shade(hex: string, amt: number): string {
  const c = new THREE.Color(hex);
  c.offsetHSL(0, 0, amt);
  return `#${c.getHexString()}`;
}

function woodTexture(color: string, vertical: boolean): THREE.CanvasTexture {
  const key = `${color}|${vertical}`;
  const hit = texCache.get(key);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 512;
  const g = c.getContext('2d')!;
  g.fillStyle = color;
  g.fillRect(0, 0, 256, 512);
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 70; i++) {
    const x = rnd() * 256;
    g.strokeStyle = shade(color, (rnd() - 0.5) * 0.12);
    g.globalAlpha = 0.35 + rnd() * 0.4;
    g.lineWidth = 0.6 + rnd() * 2.2;
    g.beginPath();
    g.moveTo(x, 0);
    for (let y = 0; y <= 512; y += 16) g.lineTo(x + Math.sin(y / (40 + rnd() * 30) + i) * (2 + rnd() * 3), y);
    g.stroke();
  }
  g.globalAlpha = 1;
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (!vertical) {
    t.rotation = Math.PI / 2;
    t.center.set(0.5, 0.5);
  }
  texCache.set(key, t);
  return t;
}

/* ----------------------------------------------------------- scene graph */

export interface SceneOptions {
  showFronts: boolean;
}

const metal = new THREE.MeshStandardMaterial({ color: '#c8ccd0', metalness: 0.85, roughness: 0.3 });

function boxMesh(b: PartBox, mat: THREE.Material, edges = true): THREE.Object3D {
  const geo = new THREE.BoxGeometry(Math.max(b.w, 0.5), Math.max(b.h, 0.5), Math.max(b.d, 0.5));
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(b.x + b.w / 2, b.y + b.h / 2, b.z + b.d / 2);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  if (!edges) return mesh;
  const group = new THREE.Group();
  group.add(mesh);
  const line = new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: '#000000', transparent: true, opacity: 0.18 }));
  line.position.copy(mesh.position);
  group.add(line);
  return group;
}

export function buildUnitObject(unit: Unit, build: UnitBuild, cat: Catalog, opt: SceneOptions): THREE.Group {
  const root = new THREE.Group();
  const matCache = new Map<string, THREE.Material>();

  const boardMat = (id: string | null, b: PartBox): THREE.Material => {
    const board = cat.boards.find((x) => x.id === id);
    const color = board?.color ?? '#cccccc';
    const vertical = b.h >= b.w;
    const key = `${id}|${vertical}`;
    let m = matCache.get(key);
    if (!m) {
      m = new THREE.MeshStandardMaterial({
        color: board?.texture === 'wood' ? '#ffffff' : color,
        map: board?.texture === 'wood' ? woodTexture(color, vertical) : null,
        roughness: /gloss/i.test(board?.name ?? '') ? 0.25 : 0.7,
        metalness: 0.02,
      });
      matCache.set(key, m);
    }
    return m;
  };

  for (const p of build.parts) {
    const isFront = p.role === 'door' || p.role === 'drawerFront';
    if (!opt.showFronts && (isFront || p.kind === 'glass')) continue;
    for (const b of p.boxes) {
      let mat: THREE.Material;
      if (p.kind === 'glass') {
        const g = cat.glass.find((x) => x.id === p.materialId);
        const mirror = /mirror/i.test(g?.name ?? '');
        mat = new THREE.MeshPhysicalMaterial({
          color: g?.color ?? '#cfe8ef',
          transparent: true,
          opacity: g?.opacity ?? 0.3,
          roughness: mirror ? 0.05 : /frost/i.test(g?.name ?? '') ? 0.6 : 0.1,
          metalness: mirror ? 0.9 : 0,
        });
      } else if (p.kind === 'counter') {
        const c = cat.countertops.find((x) => x.id === p.materialId);
        mat = new THREE.MeshStandardMaterial({ color: c?.color ?? '#999', roughness: 0.3, metalness: 0.05 });
      } else mat = boardMat(p.materialId, b);
      root.add(boxMesh(b, mat, p.kind !== 'glass'));
    }
  }

  if (opt.showFronts) {
    for (const a of build.aluminium) {
      const prof = cat.aluminium.find((x) => x.id === a.profileId);
      const m = new THREE.MeshStandardMaterial({ color: prof?.color ?? '#c0c4c8', metalness: 0.8, roughness: 0.35 });
      for (const b of a.boxes) root.add(boxMesh(b, m, false));
    }
    // handles
    const handle = cat.accessories.find((a) => a.id === unit.handleId);
    if (handle && handle.unit !== 'm' && !/push/i.test(handle.name)) {
      const len = Math.min(320, Number.parseInt(handle.size) || 128);
      const isKnob = /knob/i.test(handle.name);
      const hm = /black/i.test(handle.name) ? new THREE.MeshStandardMaterial({ color: '#222', metalness: 0.6, roughness: 0.4 }) : metal;
      for (const p of build.parts) {
        if (p.role !== 'door' && p.role !== 'drawerFront') continue;
        for (const b of p.boxes) {
          const z = b.z + b.d;
          let hb: PartBox;
          if (isKnob) hb = { x: b.x + b.w / 2 - 15, y: b.y + b.h / 2 - 15, z, w: 30, h: 30, d: 25 };
          else if (p.role === 'drawerFront' || p.name === 'Flap door') hb = { x: b.x + b.w / 2 - len / 2, y: b.y + b.h - Math.min(60, b.h / 3), z, w: len, h: 12, d: 25 };
          else {
            const right = b.x + b.w / 2 < unit.width / 2;
            const hx = right ? b.x + b.w - 50 : b.x + 38;
            const l = Math.min(len, b.h * 0.6);
            // tall doors: handle at ~1000mm from the floor; high doors: near the bottom edge
            const hy = b.y < 1000 && b.y + b.h > 1300 ? 1000 - l / 2 : b.y > 1400 ? b.y + 50 : b.y + b.h / 2 - l / 2;
            hb = { x: hx, y: hy, z, w: 12, h: l, d: 25 };
          }
          root.add(boxMesh(hb, hm, false));
        }
      }
    }
  }
  for (const r of build.rails) root.add(boxMesh(r.box, metal, false));

  // legs
  if (unit.base === 'legs' && unit.baseHeight > 0) {
    const leg = cat.accessories.find((a) => a.id === unit.legId);
    const lm = /chrome/i.test(leg?.name ?? '') ? metal : new THREE.MeshStandardMaterial({ color: '#2a2a2a', metalness: 0.5, roughness: 0.5 });
    const xs = [40, unit.width - 40];
    const extra = Math.floor(Math.max(0, unit.width - 1) / 1000);
    for (let i = 1; i <= extra; i++) xs.push((unit.width * i) / (extra + 1));
    const dc = unit.depth - 60;
    for (const x of xs)
      for (const z of [60, dc]) {
        const geo = new THREE.CylinderGeometry(14, 10, unit.baseHeight, 16);
        const m = new THREE.Mesh(geo, lm);
        m.position.set(x, unit.baseHeight / 2, z);
        m.castShadow = true;
        root.add(m);
      }
  }

  return root;
}

/* ------------------------------------------------------------ stage setup */

export function createStage(renderer: THREE.WebGLRenderer) {
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#eef0f3');
  const hemi = new THREE.HemisphereLight('#ffffff', '#b9b3a8', 1.6);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight('#ffffff', 2.2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0005;
  scene.add(sun);
  scene.add(sun.target);
  const fill = new THREE.DirectionalLight('#fff4e6', 0.6);
  scene.add(fill);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(40000, 40000), new THREE.ShadowMaterial({ opacity: 0.18 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
  const camera = new THREE.PerspectiveCamera(35, 1, 10, 100000);

  let content: THREE.Object3D | null = null;
  const setContent = (obj: THREE.Object3D, size: { w: number; h: number; d: number }) => {
    if (content) {
      scene.remove(content);
      content.traverse((o) => {
        if (o instanceof THREE.Mesh || o instanceof THREE.LineSegments) o.geometry.dispose();
      });
    }
    obj.position.set(-size.w / 2, 0, -size.d / 2);
    scene.add(obj);
    content = obj;
    const r = Math.max(size.w, size.h, size.d);
    sun.position.set(r * 1.2, r * 2.2, r * 1.6);
    sun.target.position.set(0, size.h / 2, 0);
    fill.position.set(-r * 1.5, r, r);
    const cam = sun.shadow.camera as THREE.OrthographicCamera;
    cam.left = cam.bottom = -r * 1.5;
    cam.right = cam.top = r * 1.5;
    cam.near = 10;
    cam.far = r * 8;
    cam.updateProjectionMatrix();
  };

  const frame = (size: { w: number; h: number; d: number }, aspect: number) => {
    const r = Math.sqrt(size.w ** 2 + size.h ** 2 + size.d ** 2) / 2;
    const fov = (camera.fov * Math.PI) / 180;
    const dist = (r / Math.sin(fov / 2)) * (aspect < 1 ? 1.15 / Math.max(aspect, 0.5) : 1.05);
    const dir = new THREE.Vector3(0.55, 0.35, 1).normalize();
    camera.position.copy(dir.multiplyScalar(dist)).add(new THREE.Vector3(0, size.h / 2, 0));
    camera.lookAt(0, size.h / 2, 0);
    camera.updateProjectionMatrix();
  };

  return { scene, camera, setContent, frame };
}

export const unitSize = (u: Unit) => ({ w: u.width, h: u.height, d: u.depth + (u.countertopId ? u.countertopOverhang : 0) });

/* --------------------------------------------------------- still renders */

let stillRenderer: THREE.WebGLRenderer | null = null;

/** Render a unit to a PNG data URL (used for quotation PDFs and thumbnails). */
export function renderUnitImage(unit: Unit, build: UnitBuild, cat: Catalog, width = 900, height = 700, mime: 'image/png' | 'image/jpeg' = 'image/png'): string | null {
  try {
    if (!stillRenderer) stillRenderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    stillRenderer.setPixelRatio(1);
    stillRenderer.setSize(width, height, false);
    const stage = createStage(stillRenderer);
    stage.scene.background = new THREE.Color('#ffffff');
    const size = unitSize(unit);
    stage.setContent(buildUnitObject(unit, build, cat, { showFronts: true }), size);
    stage.camera.aspect = width / height;
    stage.frame(size, width / height);
    stillRenderer.render(stage.scene, stage.camera);
    return stillRenderer.domElement.toDataURL(mime, 0.88);
  } catch {
    return null;
  }
}
