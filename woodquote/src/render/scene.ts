import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { unitExtents } from '../lib/generate';
import { cellRects, sameRef } from '../lib/sections';
import type { ItemPrice } from '../lib/pricing';
import { inwardNormal, itemBounds, orientation, roomExtents, vertices, wallPieces } from '../lib/room';
import { activeLegs, legLength, legStart, legTransform, type RunBuild } from '../lib/runs';
import type { Appliance, Box3 as PartBox, BoardMaterial, Catalog, HandleStyle, Room, Run, SectionRef, SurfaceFinish, Unit, UnitBuild } from '../lib/types';

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
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
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

/* ------------------------------------------------------------ materials */

const FINISH: Record<SurfaceFinish, { roughness: number; clearcoat: number; env: number }> = {
  matte: { roughness: 0.92, clearcoat: 0, env: 0.25 },
  textured: { roughness: 0.75, clearcoat: 0, env: 0.35 },
  satin: { roughness: 0.42, clearcoat: 0.25, env: 0.7 },
  gloss: { roughness: 0.06, clearcoat: 1, env: 1.25 },
};

function surfaceMaterial(color: string, finish: SurfaceFinish, map: THREE.Texture | null = null): THREE.MeshPhysicalMaterial {
  const f = FINISH[finish] ?? FINISH.matte;
  return new THREE.MeshPhysicalMaterial({ color: map ? '#ffffff' : color, map, roughness: f.roughness, metalness: 0.02, clearcoat: f.clearcoat, clearcoatRoughness: 0.04, envMapIntensity: f.env });
}

const metal = new THREE.MeshStandardMaterial({ color: '#c8ccd0', metalness: 0.9, roughness: 0.25 });
const darkMetal = new THREE.MeshStandardMaterial({ color: '#222326', metalness: 0.6, roughness: 0.35 });
const brass = new THREE.MeshStandardMaterial({ color: '#b08d57', metalness: 0.85, roughness: 0.3 });
const blackGlass = new THREE.MeshPhysicalMaterial({ color: '#0b0b0d', roughness: 0.05, clearcoat: 1, metalness: 0.1 });
const notchMat = new THREE.MeshStandardMaterial({ color: '#1a1a1a', roughness: 0.9 });

function boxGeo(b: PartBox) {
  return new THREE.BoxGeometry(Math.max(b.w, 0.5), Math.max(b.h, 0.5), Math.max(b.d, 0.5));
}

function boxMesh(b: PartBox, mat: THREE.Material, edges = true): THREE.Object3D {
  // shaped panels (diagonal corner cupboards): extrude the outline upwards
  if (b.meta?.shape && b.meta.shape.length >= 3) {
    const shape = new THREE.Shape(b.meta.shape.map(([x, z]) => new THREE.Vector2(x, -z)));
    const geo = new THREE.ExtrudeGeometry(shape, { depth: Math.max(b.h, 0.5), bevelEnabled: false });
    geo.rotateX(-Math.PI / 2);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.y = b.y;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    if (!edges) return mesh;
    const group = new THREE.Group();
    group.add(mesh);
    const line = new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: '#000000', transparent: true, opacity: 0.16 }));
    line.position.copy(mesh.position);
    group.add(line);
    return group;
  }
  const geo = boxGeo(b);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(b.x + b.w / 2, b.y + b.h / 2, b.z + b.d / 2);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  if (b.meta?.ref) mesh.userData.ref = b.meta.ref;
  if (!edges) return mesh;
  const group = new THREE.Group();
  group.add(mesh);
  const line = new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: '#000000', transparent: true, opacity: 0.16 }));
  line.position.copy(mesh.position);
  group.add(line);
  if (b.meta?.ref) group.userData.ref = b.meta.ref;
  return group;
}

/* --------------------------------------------------------------- handles */

function handleObject(style: HandleStyle, size: string, door: PartBox, placement: 'left' | 'right' | 'top' | 'bottom' | 'topCenter', unitIsTall: boolean): THREE.Object3D | null {
  const g = new THREE.Group();
  const z = door.z + door.d;
  const len = Math.min(450, Number.parseInt(size) || 128);
  const vertical = placement === 'left' || placement === 'right';
  const cx = placement === 'left' ? door.x + 40 : placement === 'right' ? door.x + door.w - 40 : door.x + door.w / 2;
  let cy = placement === 'top' || placement === 'topCenter' ? door.y + door.h - 45 : placement === 'bottom' ? door.y + 45 : door.y + door.h / 2;
  if (vertical && unitIsTall && door.h > 1200 && door.y < 1000 && door.y + door.h > 1300) cy = 1000;
  else if (vertical && door.y > 1400) cy = door.y + Math.min(door.h / 2, 90);
  const mat = style === 'roman' ? brass : /black/.test(size) ? darkMetal : metal;
  const bar = (l: number, thick: number, standoff: number) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(vertical ? thick : l, vertical ? l : thick, thick), mat);
    b.position.set(cx, cy, z + standoff + thick / 2);
    g.add(b);
    for (const k of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(thick * 0.35, thick * 0.35, standoff, 10), mat);
      post.rotation.x = Math.PI / 2;
      post.position.set(cx + (vertical ? 0 : (k * l) / 2.6), cy + (vertical ? (k * l) / 2.6 : 0), z + standoff / 2);
      g.add(post);
    }
  };
  switch (style) {
    case 'push':
      return null;
    case 'knob': {
      const k = new THREE.Mesh(new THREE.CylinderGeometry(15, 13, 26, 20), mat);
      k.rotation.x = Math.PI / 2;
      k.position.set(cx, cy, z + 13);
      g.add(k);
      break;
    }
    case 'bar':
      bar(Math.min(len, (vertical ? door.h : door.w) * 0.6), 12, 28);
      break;
    case 'tbar':
      bar(Math.min(len, (vertical ? door.h : door.w) * 0.6), 10, 22);
      break;
    case 'roman':
      bar(Math.min(len, (vertical ? door.h : door.w) * 0.5), 9, 22);
      break;
    case 'appliance':
      bar(Math.min(450, (vertical ? door.h : door.w) * 0.75), 22, 45);
      break;
    case 'finger':
    case 'profile': {
      const strip = new THREE.Mesh(new THREE.BoxGeometry(door.w, style === 'profile' ? 22 : 14, 8), style === 'profile' ? darkMetal : notchMat);
      strip.position.set(door.x + door.w / 2, door.y + door.h - (style === 'profile' ? 11 : 7), z + 2);
      g.add(strip);
      break;
    }
    case 'notchRound':
    case 'notchOval':
    case 'notchTrapezium': {
      const shape = new THREE.Shape();
      if (style === 'notchTrapezium') {
        shape.moveTo(-45, 0);
        shape.lineTo(45, 0);
        shape.lineTo(28, -30);
        shape.lineTo(-28, -30);
        shape.closePath();
      } else {
        shape.absellipse(0, 0, style === 'notchOval' ? 55 : 32, style === 'notchOval' ? 22 : 32, Math.PI, 2 * Math.PI, false, 0);
        shape.closePath();
      }
      const m = new THREE.Mesh(new THREE.ShapeGeometry(shape), notchMat);
      // cut into the edge furthest from the hinge (top edge for drawers & flaps)
      if (vertical) {
        m.rotation.z = placement === 'right' ? Math.PI / 2 : -Math.PI / 2;
        m.position.set(placement === 'right' ? door.x + door.w : door.x, cy, z + 0.6);
      } else if (placement === 'bottom') {
        m.rotation.z = Math.PI;
        m.position.set(cx, door.y, z + 0.6);
      } else m.position.set(cx, door.y + door.h, z + 0.6);
      g.add(m);
      break;
    }
  }
  return g;
}

/* ------------------------------------------------------------ appliances */

export function applianceObject(a: Appliance, b: PartBox): THREE.Object3D {
  const g = new THREE.Group();
  const add = (box: PartBox, mat: THREE.Material) => g.add(boxMesh(box, mat, false));
  const body = surfaceMaterial(a.color, 'gloss');
  body.metalness = /c[0-9a-f]{5}|b5b9be|d9dde1|c8ccd0/i.test(a.color) ? 0.65 : 0.1;
  const cyl = (x: number, y: number, z: number, r: number, h: number, mat: THREE.Material) => {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 24), mat);
    c.position.set(x, y, z);
    g.add(c);
  };
  const front = b.z + b.d;
  switch (a.category) {
    case 'hob': {
      const gas = /gas/i.test(a.variant) && !/electric/i.test(a.variant);
      add({ x: b.x, y: b.y, z: b.z, w: b.w, h: 6, d: b.d }, gas ? darkMetal : blackGlass);
      // burner / plate layout by count: 2 → 1×2, 4 → 2×2, 5 → 2+1+2, 6 → 3×2
      const plates = a.plates ?? (b.w > 700 ? 6 : 4);
      const spots: [number, number, number][] = [];
      if (plates <= 2) spots.push([0.5, 0.28, 1], [0.5, 0.72, 1]);
      else if (plates === 5) spots.push([0.18, 0.28, 0.9], [0.18, 0.72, 0.9], [0.5, 0.5, 1.25], [0.82, 0.28, 0.9], [0.82, 0.72, 0.9]);
      else {
        const cols = Math.ceil(plates / 2);
        for (let i = 0; i < cols; i++) for (let j = 0; j < 2; j++) spots.push([(i + 0.5) / cols, j === 0 ? 0.3 : 0.7, (i + j) % 2 ? 1.15 : 0.9]);
      }
      const r0 = Math.min(b.w / Math.max(2, Math.ceil(plates / 2)) / 2.6, b.d / 5.2);
      const ring = new THREE.MeshStandardMaterial({ color: /induction/i.test(a.variant) ? '#3a3a40' : '#4a1a14', roughness: 0.45 });
      spots.forEach(([u, v, sz], k) => {
        const x = b.x + b.w * u;
        const z = b.z + b.d * v;
        const r = r0 * sz;
        const isGas = gas || (/combo|gas \//i.test(a.variant + a.name) && k < 2);
        if (isGas) {
          cyl(x, b.y + 12, z, r * 0.45, 12, darkMetal);
          cyl(x, b.y + 20, z, r * 0.75, 4, metal);
          for (let q = 0; q < 4; q++) {
            const bar = new THREE.Mesh(new THREE.BoxGeometry(r * 1.9, 8, 8), darkMetal);
            bar.position.set(x, b.y + 26, z);
            bar.rotation.y = (q * Math.PI) / 4;
            g.add(bar);
          }
        } else cyl(x, b.y + 6.5, z, r, 1, ring);
      });
      // control knobs / touch strip at the front
      if (gas) for (let k = 0; k < plates; k++) cyl(b.x + (b.w * (k + 0.5)) / plates, b.y + 14, b.z + b.d - 25, 12, 16, metal);
      break;
    }
    case 'downdraft': {
      add({ x: b.x, y: b.y, z: b.z, w: b.w, h: b.h, d: b.d }, blackGlass);
      add({ x: b.x + 15, y: b.y + b.h - 70, z: b.z + b.d, w: b.w - 30, h: 50, d: 1 }, new THREE.MeshStandardMaterial({ color: '#3a3d42', roughness: 0.6 }));
      break;
    }
    case 'sink': {
      add({ x: b.x, y: b.y, z: b.z, w: b.w, h: 3, d: b.d }, metal);
      const bowls = /double/i.test(a.variant) ? 2 : 1;
      const bw = /drainer/i.test(a.name) ? b.w * 0.5 : b.w * 0.9;
      for (let i = 0; i < bowls; i++) add({ x: b.x + 25 + (i * bw) / bowls, y: b.y + 3, z: b.z + 30, w: bw / bowls - 20, h: 1, d: b.d - 60 }, darkMetal);
      cyl(b.x + b.w * 0.5, b.y + 130, b.z + 25, 14, 260, metal);
      const spout = new THREE.Mesh(new THREE.CylinderGeometry(9, 9, 180, 12), metal);
      spout.rotation.x = Math.PI / 2;
      spout.position.set(b.x + b.w * 0.5, b.y + 255, b.z + 110);
      g.add(spout);
      break;
    }
    case 'oven':
    case 'microwave':
    case 'wineCooler': {
      add(b, blackGlass);
      const win = a.category === 'microwave' ? { x: b.x + 20, y: b.y + 30, w: b.w * 0.62, h: b.h - 60 } : { x: b.x + 40, y: b.y + 40, w: b.w - 80, h: b.h * 0.6 };
      add({ ...win, z: front, d: 2 }, new THREE.MeshStandardMaterial({ color: a.category === 'wineCooler' ? '#3a2a2a' : '#2c2f33', roughness: 0.1, metalness: 0.3 }));
      if (a.category !== 'microwave') add({ x: b.x + b.w * 0.15, y: b.y + b.h - 50, z: front + 10, w: b.w * 0.7, h: 14, d: 14 }, metal);
      break;
    }
    case 'dishwasher':
    case 'washer':
    case 'cooker': {
      add(b, body);
      add({ x: b.x, y: b.y + b.h - 70, z: front, w: b.w, h: 70, d: 2 }, blackGlass);
      if (a.category === 'washer') {
        const door = new THREE.Mesh(new THREE.CylinderGeometry(b.w * 0.3, b.w * 0.3, 20, 32), new THREE.MeshPhysicalMaterial({ color: '#30353b', roughness: 0.05, metalness: 0.4 }));
        door.rotation.x = Math.PI / 2;
        door.position.set(b.x + b.w / 2, b.y + b.h * 0.45, front + 10);
        g.add(door);
      }
      if (a.category === 'cooker') {
        add({ x: b.x, y: b.y + b.h, z: b.z, w: b.w, h: 6, d: b.d }, darkMetal);
        for (let i = 0; i < 4; i++) cyl(b.x + b.w * (0.3 + 0.4 * (i % 2)), b.y + b.h + 12, b.z + b.d * (0.3 + 0.4 * Math.floor(i / 2)), 40, 10, darkMetal);
        add({ x: b.x + 50, y: b.y + 120, z: front, w: b.w - 100, h: b.h * 0.45, d: 2 }, blackGlass);
      }
      break;
    }
    case 'fridge': {
      add(b, body);
      const line = (box: PartBox) => add(box, darkMetal);
      const split = /side by side|french/i.test(a.variant);
      if (split) line({ x: b.x + b.w / 2 - 2, y: /french/i.test(a.variant) ? b.y + b.h * 0.32 : b.y, z: front, w: 4, h: b.h * (/french/i.test(a.variant) ? 0.68 : 1), d: 2 });
      if (/double|top/i.test(a.variant + a.name)) line({ x: b.x, y: b.y + b.h * 0.7, z: front, w: b.w, h: 4, d: 2 });
      if (/french/i.test(a.variant)) line({ x: b.x, y: b.y + b.h * 0.32, z: front, w: b.w, h: 4, d: 2 });
      const hx = split ? [b.x + b.w / 2 - 30, b.x + b.w / 2 + 22] : [b.x + 40];
      for (const x of hx) add({ x, y: b.y + b.h * 0.4, z: front + 10, w: 10, h: b.h * 0.35, d: 18 }, metal);
      break;
    }
    case 'hood': {
      if (/chimney/i.test(a.variant)) {
        add({ x: b.x, y: b.y, z: b.z, w: b.w, h: 90, d: b.d }, metal);
        add({ x: b.x + b.w * 0.3, y: b.y + 90, z: b.z, w: b.w * 0.4, h: b.h - 90, d: b.d * 0.5 }, metal);
      } else add({ x: b.x, y: b.y, z: b.z, w: b.w, h: 40, d: b.d }, metal);
      break;
    }
    default:
      add(b, body);
  }
  return g;
}

/* ----------------------------------------------------------- scene graph */

export interface SceneOptions {
  showFronts: boolean;
  openDoors?: boolean;
  lightsOn?: boolean;
  highlight?: SectionRef | null;
  room?: boolean;
}

export function buildUnitObject(unit: Unit, build: UnitBuild, cat: Catalog, opt: SceneOptions): THREE.Group {
  const root = new THREE.Group();
  root.userData.unitId = unit.id;
  const matCache = new Map<string, THREE.Material>();
  const boardMat = (board: BoardMaterial | undefined, b: PartBox): THREE.Material => {
    const vertical = b.h >= b.w;
    const key = `${board?.id}|${vertical}`;
    let m = matCache.get(key);
    if (!m) {
      m = surfaceMaterial(board?.color ?? '#cccccc', board?.finish ?? 'matte', board?.texture === 'wood' ? woodTexture(board.color, vertical) : null);
      matCache.set(key, m);
    }
    return m;
  };
  const isTall = unit.height > 1300;
  const handle = cat.accessories.find((a) => a.id === unit.handleId);
  const doorGroups = new Map<string, { group: THREE.Group; boxes: PartBox[]; drawer: boolean; parent: THREE.Object3D }>();
  // parts drawn in their own frame (corner cupboard side arm, diagonal door)
  const frames = new Map<string, THREE.Group>();
  const frameOf = (b: PartBox): THREE.Object3D => {
    const f = b.meta?.frame;
    if (!f) return root;
    const key = `${f.x}|${f.z}|${f.rot}`;
    let g = frames.get(key);
    if (!g) {
      g = new THREE.Group();
      g.position.set(f.x, 0, f.z);
      g.rotation.y = (f.rot * Math.PI) / 180;
      root.add(g);
      frames.set(key, g);
    }
    return g;
  };
  const target = (b: PartBox): THREE.Object3D => {
    const id = b.meta?.door;
    const parent = frameOf(b);
    if (!id) return parent;
    let dg = doorGroups.get(id);
    if (!dg) {
      dg = { group: new THREE.Group(), boxes: [], drawer: !!b.meta?.drawer, parent };
      doorGroups.set(id, dg);
      parent.add(dg.group);
    }
    dg.boxes.push(b);
    return dg.group;
  };

  for (const p of build.parts) {
    const isFront = p.role === 'door' || p.role === 'drawerFront' || (p.kind === 'glass' && !!p.boxes[0]?.meta?.door);
    if (!opt.showFronts && isFront) continue;
    for (const b of p.boxes) {
      let mat: THREE.Material;
      if (p.kind === 'glass') {
        const g = cat.glass.find((x) => x.id === p.materialId);
        const mirror = /mirror/i.test(g?.name ?? '');
        mat = new THREE.MeshPhysicalMaterial({ color: g?.color ?? '#cfe8ef', transparent: true, opacity: g?.opacity ?? 0.3, roughness: mirror ? 0.02 : /frost/i.test(g?.name ?? '') ? 0.6 : 0.05, metalness: mirror ? 0.95 : 0, envMapIntensity: 1.4 });
      } else if (p.kind === 'counter') {
        const c = cat.countertops.find((x) => x.id === p.materialId);
        mat = surfaceMaterial(c?.color ?? '#999', c?.finish ?? 'satin');
      } else mat = boardMat(cat.boards.find((x) => x.id === p.materialId), b);
      const obj = boxMesh(b, mat, p.kind !== 'glass');
      target(b).add(obj);
      if (b.meta?.style && b.meta.style !== 'flat' && p.role === 'finish') root.add(panelDecoration(b, mat, unit));
    }
  }

  if (opt.showFronts) {
    for (const a of build.aluminium) {
      const prof = cat.aluminium.find((x) => x.id === a.profileId);
      const m = new THREE.MeshStandardMaterial({ color: prof?.color ?? '#c0c4c8', metalness: 0.8, roughness: 0.35 });
      for (const b of a.boxes) target(b).add(boxMesh(b, m, false));
    }
  }

  // handles + opening motion per door
  for (const [, dg] of doorGroups) {
    const bb = dg.boxes.reduce(
      (acc, b) => ({ x0: Math.min(acc.x0, b.x), y0: Math.min(acc.y0, b.y), z0: Math.min(acc.z0, b.z), x1: Math.max(acc.x1, b.x + b.w), y1: Math.max(acc.y1, b.y + b.h), z1: Math.max(acc.z1, b.z + b.d) }),
      { x0: Infinity, y0: Infinity, z0: Infinity, x1: -Infinity, y1: -Infinity, z1: -Infinity },
    );
    const front = dg.boxes.find((b) => b.meta?.handle) ?? null;
    const meta = dg.boxes.find((b) => b.meta?.hinge || b.meta?.slide || b.meta?.drawer)?.meta ?? {};
    if (opt.showFronts && front && handle) {
      const placement = meta.drawer ? 'topCenter' : meta.hinge === 'left' ? 'right' : meta.hinge === 'right' ? 'left' : meta.hinge === 'top' ? 'bottom' : meta.hinge === 'bottom' ? 'top' : meta.slide === 'left' ? 'left' : 'right';
      const fb = { x: bb.x0, y: bb.y0, z: front.z, w: bb.x1 - bb.x0, h: bb.y1 - bb.y0, d: front.d };
      const h = handleObject(handle.style ?? 'bar', `${handle.size} ${handle.name.toLowerCase()}`, fb, placement, isTall);
      if (h) dg.group.add(h);
    }
    if (!opt.openDoors) continue;
    const pivot = new THREE.Group();
    const inner = dg.group;
    dg.parent.remove(inner);
    pivot.add(inner);
    dg.parent.add(pivot);
    if (meta.drawer) pivot.position.z = (bb.z1 - bb.z0) * 0.55;
    else if (meta.slide) pivot.position.x = (meta.slide === 'left' ? -1 : 1) * (bb.x1 - bb.x0) * 0.6;
    else if (meta.hinge === 'left' || meta.hinge === 'right') {
      const px = meta.hinge === 'left' ? bb.x0 : bb.x1;
      inner.position.set(-px, 0, -bb.z0);
      pivot.position.set(px, 0, bb.z0);
      pivot.rotation.y = (meta.hinge === 'left' ? -1 : 1) * 1.3;
    } else if (meta.hinge === 'top' || meta.hinge === 'bottom') {
      const py = meta.hinge === 'top' ? bb.y1 : bb.y0;
      inner.position.set(0, -py, -bb.z0);
      pivot.position.set(0, py, bb.z0);
      pivot.rotation.x = (meta.hinge === 'top' ? -1 : 1) * 1.25;
    }
  }

  for (const r of build.rails) root.add(boxMesh(r.box, metal, false));
  for (const ins of build.inserts) {
    const geo = boxGeo(ins.box);
    const lines = new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: '#8d949b' }));
    lines.position.set(ins.box.x + ins.box.w / 2, ins.box.y + ins.box.h / 2, ins.box.z + ins.box.d / 2);
    root.add(lines);
    const tiers = Math.max(1, Math.floor(ins.box.h / 300));
    for (let k = 0; k < tiers; k++) root.add(boxMesh({ x: ins.box.x, y: ins.box.y + (ins.box.h * k) / tiers + 5, z: ins.box.z, w: ins.box.w, h: 4, d: ins.box.d, meta: ins.box.meta }, metal, false));
  }
  for (const ap of build.appliances) {
    const a = cat.appliances.find((x) => x.id === ap.applianceId);
    if (!a) continue;
    const o = applianceObject(a, ap.box);
    if (ap.ref) o.traverse((c) => (c.userData.ref = ap.ref));
    root.add(o);
  }

  // LED lights: glowing strips, plus real light sources when lights are on
  let lightBudget = 10;
  for (const l of build.lights) {
    const strip = new THREE.Mesh(boxGeo(l.box), new THREE.MeshBasicMaterial({ color: opt.lightsOn ? l.color : shade(l.color, -0.25) }));
    strip.position.set(l.box.x + l.box.w / 2, l.box.y + l.box.h / 2, l.box.z + l.box.d / 2);
    root.add(strip);
    if (opt.lightsOn && lightBudget > 0) {
      const vertical = l.box.h > l.box.w;
      const len = vertical ? l.box.h : l.box.w;
      const n = Math.min(lightBudget, Math.max(1, Math.round(len / 700)));
      for (let k = 0; k < n; k++) {
        const pl = new THREE.PointLight(l.color, 1.6, 900, 0);
        const off = l.dir === 'down' ? -120 : l.dir === 'up' ? 160 : 0;
        const along = (len * (k + 0.5)) / n;
        pl.position.set(vertical ? l.box.x : l.box.x + along, (vertical ? l.box.y + along : l.box.y) + off, l.box.z + (l.dir === 'front' ? 120 : 0));
        root.add(pl);
        lightBudget--;
      }
      // soft glow halo
      const halo = new THREE.Mesh(new THREE.PlaneGeometry(vertical ? 160 : l.box.w, vertical ? l.box.h : 160), new THREE.MeshBasicMaterial({ color: l.color, transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide }));
      if (vertical) halo.position.set(l.box.x + 6, l.box.y + l.box.h / 2, l.box.z + 14);
      else if (l.dir === 'front') halo.position.set(l.box.x + l.box.w / 2, l.box.y - 60, l.box.z + 2);
      else {
        halo.rotation.x = Math.PI / 2;
        halo.position.set(l.box.x + l.box.w / 2, l.box.y + (l.dir === 'up' ? 20 : -2), l.box.z);
      }
      root.add(halo);
    }
  }

  // legs
  if (unit.mount === 'floor' && unit.base === 'legs' && unit.baseHeight > 0) {
    const leg = cat.accessories.find((a) => a.id === unit.legId);
    const lm = /chrome/i.test(leg?.name ?? '') ? metal : darkMetal;
    const xs = [40, unit.width - 40];
    const extra = Math.floor(Math.max(0, unit.width - 1) / 1000);
    for (let i = 1; i <= extra; i++) xs.push((unit.width * i) / (extra + 1));
    for (const x of xs)
      for (const z of [60, unit.depth - 60]) {
        const m = new THREE.Mesh(new THREE.CylinderGeometry(14, 10, unit.baseHeight, 16), lm);
        m.position.set(x, unit.baseHeight / 2, z);
        m.castShadow = true;
        root.add(m);
      }
  }

  if (opt.highlight && !unit.corner) {
    const c = cellRects(unit, cat).find((x) => sameRef(x.ref, opt.highlight));
    if (c) {
      const yo = unit.mount === 'wall' ? unit.mountHeight : 0;
      const hb: PartBox = { x: c.x, y: c.y + yo, z: 0, w: c.w, h: c.h, d: unit.depth + 4 };
      const hm = new THREE.Mesh(boxGeo(hb), new THREE.MeshBasicMaterial({ color: '#f97316', transparent: true, opacity: 0.16, depthWrite: false }));
      hm.position.set(hb.x + hb.w / 2, hb.y + hb.h / 2, hb.z + hb.d / 2);
      root.add(hm);
      const ln = new THREE.LineSegments(new THREE.EdgesGeometry(boxGeo(hb)), new THREE.LineBasicMaterial({ color: '#ea580c' }));
      ln.position.copy(hm.position);
      root.add(ln);
    }
  }
  return root;
}

/** Shaker frames, flutes and slats on exposed finish panels. */
function panelDecoration(b: PartBox, mat: THREE.Material, unit: Unit): THREE.Object3D {
  const g = new THREE.Group();
  const side = b.x < 0 ? 'left' : b.x >= unit.width ? 'right' : 'back';
  const style = b.meta?.style;
  // work in panel space: u along the face, v up
  const faceLen = side === 'back' ? b.w : b.d;
  const place = (u0: number, v0: number, ul: number, vl: number, proud: number, m: THREE.Material) => {
    let box: PartBox;
    if (side === 'back') box = { x: b.x + u0, y: b.y + v0, z: b.z - proud, w: ul, h: vl, d: proud };
    else if (side === 'left') box = { x: b.x - proud, y: b.y + v0, z: b.z + faceLen - u0 - ul, w: proud, h: vl, d: ul };
    else box = { x: b.x + b.w, y: b.y + v0, z: b.z + u0, w: proud, h: vl, d: ul };
    g.add(boxMesh(box, m, false));
  };
  const dark = new THREE.MeshStandardMaterial({ color: '#000000', transparent: true, opacity: 0.35 });
  if (style === 'shaker') {
    const f = 70;
    place(0, 0, f, b.h, 6, mat);
    place(faceLen - f, 0, f, b.h, 6, mat);
    place(f, 0, faceLen - 2 * f, f, 6, mat);
    place(f, b.h - f, faceLen - 2 * f, f, 6, mat);
  } else if (style === 'fluted') {
    for (let u = 25; u < faceLen - 10; u += 30) place(u, 20, 4, b.h - 40, 0.8, dark);
  } else if (style === 'slatted') {
    const sw = b.meta?.slatWidth ?? 40;
    const sg = b.meta?.slatGap ?? 15;
    const n = Math.max(1, Math.floor((faceLen + sg) / (sw + sg)));
    const start = (faceLen - (n * sw + (n - 1) * sg)) / 2;
    place(0, 0, faceLen, b.h, 1, dark);
    for (let k = 0; k < n; k++) place(start + k * (sw + sg), 0, sw, b.h, 16, mat);
  }
  return g;
}

/* ------------------------------------------------------------ kitchens */

export function buildRunObject(run: Run, rb: RunBuild, cat: Catalog, opt: SceneOptions & { selectedUnitId?: string | null }): THREE.Group {
  const root = new THREE.Group();
  for (const p of rb.pieces) {
    const o = buildUnitObject(p.unit, p.build, cat, { ...opt, highlight: opt.selectedUnitId === p.unit.id ? opt.highlight : null });
    o.userData.unitId = p.unit.id;
    o.traverse((c) => (c.userData.unitId = p.unit.id));
    const tr = legTransform(run, p.place);
    o.position.set(tr.x, 0, tr.z);
    o.rotation.y = tr.rotY;
    root.add(o);
    if (opt.selectedUnitId === p.unit.id && !opt.highlight) {
      const yo = p.unit.mount === 'wall' ? p.unit.mountHeight : 0;
      const hb: PartBox = { x: 0, y: yo, z: 0, w: p.unit.width, h: p.unit.height, d: p.unit.depth + 4 };
      const ln = new THREE.LineSegments(new THREE.EdgesGeometry(boxGeo(hb)), new THREE.LineBasicMaterial({ color: '#ea580c' }));
      ln.position.set(hb.x + hb.w / 2, hb.y + hb.h / 2, hb.z + hb.d / 2);
      o.add(ln);
    }
  }
  const counter = cat.countertops.find((c) => c.id === run.countertopId);
  for (const ep of rb.extraPlacements) {
    const g = new THREE.Group();
    if (ep.kind === 'counter') g.add(boxMesh(ep.box, surfaceMaterial(counter?.color ?? '#999', counter?.finish ?? 'satin')));
    else if (ep.kind === 'panel') {
      const b = cat.boards.find((x) => x.id === ep.materialId);
      g.add(boxMesh(ep.box, surfaceMaterial(b?.color ?? '#ddd', b?.finish ?? 'matte')));
    } else {
      const a = cat.appliances.find((x) => x.id === ep.applianceId);
      if (a) g.add(applianceObject(a, ep.box));
    }
    const tr = legTransform(run, ep.place);
    g.position.set(tr.x, 0, tr.z);
    g.rotation.y = tr.rotY;
    root.add(g);
  }
  if (opt.room !== false) addRoom(root, run);
  return root;
}

function addRoom(root: THREE.Group, run: Run) {
  const wallMat = new THREE.MeshStandardMaterial({ color: '#e7e3dc', roughness: 0.95 }); // one-sided: invisible from outside the room
  const H = 2700;
  const LA = legLength(run.legs[0]);
  const n = activeLegs(run);
  const depth = Math.max(n > 1 ? legStart(run, 1) + legLength(run.legs[1]) : 0, n > 2 ? legStart(run, 2) + legLength(run.legs[2]) : 0, run.baseDepth + 600) + 400;
  const back = new THREE.Mesh(new THREE.PlaneGeometry(LA + 400, H), wallMat);
  back.position.set(LA / 2, H / 2, -2);
  back.receiveShadow = true;
  root.add(back);
  if (n > 1) {
    const r = new THREE.Mesh(new THREE.PlaneGeometry(depth, H), wallMat);
    r.rotation.y = -Math.PI / 2;
    r.position.set(LA + 2, H / 2, depth / 2);
    root.add(r);
  }
  if (n > 2) {
    const l = new THREE.Mesh(new THREE.PlaneGeometry(depth, H), wallMat);
    l.rotation.y = Math.PI / 2;
    l.position.set(-2, H / 2, depth / 2);
    root.add(l);
  }
}

function addUnitRoom(root: THREE.Group, ext: ReturnType<typeof unitExtents>) {
  const wallMat = new THREE.MeshStandardMaterial({ color: '#e7e3dc', roughness: 0.95 }); // one-sided: invisible from outside the room
  const w = ext.x1 - ext.x0 + 800;
  const h = Math.max(2600, ext.y1 + 300);
  const back = new THREE.Mesh(new THREE.PlaneGeometry(w, h), wallMat);
  back.position.set((ext.x0 + ext.x1) / 2, h / 2, ext.z0 - 2);
  back.receiveShadow = true;
  root.add(back);
}

/* ------------------------------------------------------------ stage setup */

export interface Bounds {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  z0: number;
  z1: number;
}

export type ViewName = '3d' | 'front' | 'left' | 'right' | 'back' | 'top';

const VIEW_DIRS: Record<ViewName, [number, number, number]> = {
  '3d': [0.55, 0.38, 1],
  front: [0, 0.08, 1],
  left: [-1, 0.1, 0.02],
  right: [1, 0.1, 0.02],
  back: [0, 0.12, -1],
  top: [0, 1, 0.02],
};

const envCache = new WeakMap<THREE.WebGLRenderer, THREE.Texture>();

export function createStage(renderer: THREE.WebGLRenderer, shadowSize = 2048) {
  renderer.shadowMap.enabled = shadowSize > 0;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#eef0f3');
  let env = envCache.get(renderer);
  if (!env) {
    const pm = new THREE.PMREMGenerator(renderer);
    env = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    pm.dispose();
    envCache.set(renderer, env);
  }
  scene.environment = env;
  scene.environmentIntensity = 0.55;
  const hemi = new THREE.HemisphereLight('#ffffff', '#b9b3a8', 1.1);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight('#ffffff', 2.2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(shadowSize || 512, shadowSize || 512);
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
  let center = new THREE.Vector3();
  let radius = 1000;
  /** Free the GPU memory of the current model (shared wood textures stay cached). */
  const clear = () => {
    if (!content) return;
    scene.remove(content);
    content.traverse((o) => {
      if (o instanceof THREE.Mesh || o instanceof THREE.LineSegments || o instanceof THREE.Points) {
        o.geometry.dispose();
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of mats) m.dispose();
      }
    });
    content = null;
  };
  /** Release everything (lights' shadow maps included) when a view closes. */
  const dispose = () => {
    clear();
    scene.traverse((o) => {
      const sh = (o as THREE.Light & { shadow?: THREE.LightShadow }).shadow;
      if (sh?.map) sh.map.dispose();
    });
  };
  const setContent = (obj: THREE.Object3D, b: Bounds) => {
    clear();
    const cx = (b.x0 + b.x1) / 2;
    const cz = (b.z0 + b.z1) / 2;
    obj.position.set(-cx, 0, -cz);
    scene.add(obj);
    content = obj;
    center = new THREE.Vector3(0, (b.y0 + b.y1) / 2, 0);
    radius = Math.sqrt((b.x1 - b.x0) ** 2 + (b.y1 - b.y0) ** 2 + (b.z1 - b.z0) ** 2) / 2;
    const r = Math.max(b.x1 - b.x0, b.y1, b.z1 - b.z0);
    sun.position.set(r * 1.2, r * 2.2, r * 1.6);
    sun.target.position.set(0, b.y1 / 2, 0);
    fill.position.set(-r * 1.5, r, r);
    const cam = sun.shadow.camera as THREE.OrthographicCamera;
    cam.left = cam.bottom = -r * 1.5;
    cam.right = cam.top = r * 1.5;
    cam.near = 10;
    cam.far = r * 8;
    cam.updateProjectionMatrix();
  };

  const frame = (aspect: number, view: ViewName = '3d', dirOverride?: [number, number, number]) => {
    const fov = (camera.fov * Math.PI) / 180;
    const dist = (radius / Math.sin(fov / 2)) * (aspect < 1 ? 1.1 / Math.max(aspect, 0.45) : 1.02);
    const dir = new THREE.Vector3(...(view === '3d' && dirOverride ? dirOverride : VIEW_DIRS[view])).normalize();
    camera.position.copy(dir.multiplyScalar(dist)).add(center);
    camera.lookAt(center);
    camera.updateProjectionMatrix();
    return center.clone();
  };

  /** Dim daylight so LEDs glow ("night" view). */
  const setNight = (night: boolean) => {
    hemi.intensity = night ? 0.12 : 1.1;
    sun.intensity = night ? 0.05 : 2.2;
    fill.intensity = night ? 0.03 : 0.6;
    scene.environmentIntensity = night ? 0.08 : 0.55;
    scene.background = new THREE.Color(night ? '#1d2027' : '#eef0f3');
  };

  return { scene, camera, setContent, frame, setNight, clear, dispose };
}

export function unitBounds(u: Unit, cat: Catalog): Bounds {
  const e = unitExtents(u, cat);
  return { x0: e.x0, x1: e.x1, y0: 0, y1: Math.max(e.y1, 300), z0: e.z0, z1: e.z1 };
}

export function runBounds(rb: RunBuild): Bounds {
  return { x0: 0, x1: rb.size.w, y0: 0, y1: rb.size.h, z0: 0, z1: rb.size.d };
}

/* --------------------------------------------------------- still renders */

let stillRenderer: THREE.WebGLRenderer | null = null;

/** Look into the corner of L / U kitchens so the side walls' fronts are visible. */
export const runViewDir = (run: Run): [number, number, number] | undefined => (run.shape === 'L' ? [-0.75, 0.6, 1] : run.shape === 'U' ? [0, 0.85, 1] : undefined);

// One renderer and one stage are reused for every still picture (thumbnails,
// PDF images); the model is freed straight after each picture so phones do not
// run out of graphics memory.
let stillStage: ReturnType<typeof createStage> | null = null;
const lowMemory = () => {
  const n = navigator as Navigator & { deviceMemory?: number };
  return /Android|iPhone|iPad/i.test(navigator.userAgent) || (n.deviceMemory ?? 8) <= 4;
};

function still(obj: THREE.Object3D, bounds: Bounds, width: number, height: number, mime: string, view: ViewName, night = false, dir?: [number, number, number]): string | null {
  try {
    if (!stillRenderer) {
      stillRenderer = new THREE.WebGLRenderer({ antialias: !lowMemory(), preserveDrawingBuffer: true, powerPreference: 'low-power' });
      stillRenderer.domElement.addEventListener('webglcontextlost', (e) => {
        e.preventDefault();
        stillRenderer = null;
        stillStage = null;
      });
    }
    if (!stillStage) stillStage = createStage(stillRenderer, lowMemory() ? 1024 : 2048);
    const stage = stillStage;
    stillRenderer.setPixelRatio(1);
    stillRenderer.setSize(width, height, false);
    stage.scene.background = new THREE.Color('#ffffff');
    stage.setNight(night);
    stage.setContent(obj, bounds);
    stage.camera.aspect = width / height;
    stage.frame(width / height, view, dir);
    stillRenderer.render(stage.scene, stage.camera);
    const url = stillRenderer.domElement.toDataURL(mime, 0.88);
    stage.clear();
    return url;
  } catch {
    return null;
  }
}

/** Render a unit to an image data URL (quotation PDFs, thumbnails, attachments). */
export function renderUnitImage(unit: Unit, build: UnitBuild, cat: Catalog, width = 900, height = 700, mime: 'image/png' | 'image/jpeg' = 'image/png', view: ViewName = '3d', night = false): string | null {
  const obj = buildUnitObject(unit, build, cat, { showFronts: true, lightsOn: night });
  const bounds = unitBounds(unit, cat);
  if (unit.installType === 'builtIn' && view !== 'back') addUnitRoom(obj as THREE.Group, unitExtents(unit, cat));
  return still(obj, bounds, width, height, mime, view, night);
}

export function renderRunImage(run: Run, rb: RunBuild, cat: Catalog, width = 1200, height = 700, mime: 'image/png' | 'image/jpeg' = 'image/png', view: ViewName = '3d', night = false): string | null {
  return still(buildRunObject(run, rb, cat, { showFronts: true, lightsOn: night, room: view === '3d' || view === 'front' }), runBounds(rb), width, height, mime, view, night, runViewDir(run));
}

export { addUnitRoom };

/* ---------------------------------------------------------------- rooms */

export function roomBounds(room: Room): Bounds {
  const T = room.wallThickness;
  const e = roomExtents(room);
  return { x0: e.x0 - T, x1: e.x1 + T, y0: 0, y1: e.h, z0: e.z0 - T, z1: e.z1 + T };
}

export const ROOM_VIEW_DIR: [number, number, number] = [0.45, 1.05, 1];

export function buildRoomObject(room: Room, items: ItemPrice[], cat: Catalog, opt: SceneOptions & { selectedItemId?: string | null }): THREE.Group {
  const root = new THREE.Group();
  const T = room.wallThickness;
  const verts = vertices(room);
  const sgn = orientation(room);
  // floor follows the outline of the walls
  const shape = new THREE.Shape();
  verts.slice(0, room.walls.length).forEach(([x, z], i) => (i === 0 ? shape.moveTo(x, -z) : shape.lineTo(x, -z)));
  shape.closePath();
  const floorTex = woodTexture(room.floorColor, false).clone();
  floorTex.repeat.set(0.0008, 0.0008);
  floorTex.needsUpdate = true;
  const floor = new THREE.Mesh(new THREE.ShapeGeometry(shape), surfaceMaterial(room.floorColor, 'satin', floorTex));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0.5;
  floor.receiveShadow = true;
  root.add(floor);
  const wallMat = new THREE.MeshStandardMaterial({ color: room.wallColor, roughness: 0.95 });
  const beamMat = new THREE.MeshStandardMaterial({ color: '#a7a39c', roughness: 0.85 });
  const frameMat = new THREE.MeshStandardMaterial({ color: '#f5f5f4', roughness: 0.5 });
  const glassMat = new THREE.MeshPhysicalMaterial({ color: '#cfe8ef', transparent: true, opacity: 0.28, roughness: 0.05, envMapIntensity: 1.4 });
  const doorMat = surfaceMaterial('#8b6b4a', 'satin', woodTexture('#8b6b4a', true));

  room.walls.forEach((wall, wi) => {
    // wall frame: local x along the wall, local z into the room (−z = outside)
    const g = new THREE.Group();
    g.position.set(verts[wi][0], 0, verts[wi][1]);
    g.rotation.y = (-wall.angle * Math.PI) / 180;
    if (sgn < 0) g.scale.z = -1;
    root.add(g);
    // v = depth into the wall from the room side (0 = room face, T = outside face)
    const box = (u0: number, u1: number, y0: number, y1: number, v0 = 0, v1 = T): PartBox => ({ x: u0, y: y0, z: -v1, w: u1 - u0, h: y1 - y0, d: v1 - v0 });
    const { pieces, openings, H } = wallPieces(room, wi);
    for (const p of pieces) {
      const y1 = wall.visible ? p.y1 : Math.min(p.y1, 120);
      if (y1 > p.y0) g.add(boxMesh(box(p.u0, p.u1, p.y0, y1), p.kind === 'beam' ? beamMat : wallMat, false));
    }
    if (!wall.visible) return;
    for (const o of openings) {
      const a = o.offset;
      const b = o.offset + o.width;
      if (o.kind === 'window') {
        g.add(boxMesh(box(a, b, o.sill, o.height, T / 2 - 4, T / 2 + 4), glassMat, false));
        for (const [u0, u1, y0, y1] of [
          [a, a + 50, o.sill, o.height],
          [b - 50, b, o.sill, o.height],
          [a, b, o.sill, o.sill + 50],
          [a, b, o.height - 50, o.height],
          [(a + b) / 2 - 25, (a + b) / 2 + 25, o.sill, o.height],
        ])
          g.add(boxMesh(box(u0, u1, y0, y1, T / 2 - 30, T / 2 + 30), frameMat, false));
      } else if (o.kind === 'door') {
        for (const [u0, u1, y0, y1] of [
          [a - 40, a, 0, o.height + 40],
          [b, b + 40, 0, o.height + 40],
          [a, b, o.height, o.height + 40],
        ])
          g.add(boxMesh(box(u0, u1, y0, y1, -20, T + 20), frameMat, false));
        const leaf = new THREE.Group();
        leaf.add(boxMesh({ x: 0, y: 0, z: 0, w: o.width - 10, h: o.height - 10, d: 40 }, doorMat));
        leaf.position.set(a + 5, 0, 0);
        leaf.rotation.y = -0.6; // ajar, swinging into the room
        g.add(leaf);
      } else if (o.kind === 'opening' && o.beam) {
        g.add(boxMesh(box(a, b, H - o.beamDepth, H, -40, T + 40), beamMat));
      }
    }
  });
  // corner posts fill the joints between walls
  room.walls.forEach((w, i) => {
    const prev = room.walls[(i - 1 + room.walls.length) % room.walls.length];
    const vis = w.visible && prev.visible;
    const h = vis ? Math.min(w.height, prev.height) : 120;
    const post = new THREE.Mesh(new THREE.CylinderGeometry(T * 0.72, T * 0.72, h, 12), wallMat);
    const [nx, nz] = inwardNormal(room, i);
    post.position.set(verts[i][0] - (nx * T) / 2, h / 2, verts[i][1] - (nz * T) / 2);
    root.add(post);
  });
  // outlines read from a plan: thin coloured footprints on the floor
  for (const f of room.fixtures ?? []) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(f.w, 12, f.d), new THREE.MeshStandardMaterial({ color: '#8b5cf6', transparent: true, opacity: 0.35 }));
    const g = new THREE.Group();
    m.position.set(f.w / 2, 7, f.d / 2);
    g.add(m);
    g.position.set(f.x, 0, f.z);
    g.rotation.y = (-f.rot * Math.PI) / 180;
    root.add(g);
  }
  // the quoted items
  for (const p of room.placements) {
    const it = items.find((i) => i.id === p.itemId);
    if (!it) continue;
    let obj: THREE.Object3D | null = null;
    if (it.kind === 'run' && it.run && it.runBuild) obj = buildRunObject(it.run, it.runBuild, cat, { ...opt, room: false, highlight: null });
    else if (it.unit && it.build) obj = buildUnitObject(it.unit, it.build, cat, { ...opt, highlight: null });
    if (!obj) continue;
    const g = new THREE.Group();
    g.add(obj);
    g.position.set(p.x, 0, p.z);
    g.rotation.y = (-p.rot * Math.PI) / 180;
    g.userData.itemId = it.id;
    g.traverse((c) => (c.userData.itemId = it.id));
    if (opt.selectedItemId === it.id) {
      const bb = itemBounds(it, cat);
      const hb: PartBox = { x: bb.x0, y: 0, z: bb.z0, w: bb.x1 - bb.x0, h: bb.h, d: bb.z1 - bb.z0 };
      const ln = new THREE.LineSegments(new THREE.EdgesGeometry(boxGeo(hb)), new THREE.LineBasicMaterial({ color: '#ea580c' }));
      ln.position.set(hb.x + hb.w / 2, hb.h / 2, hb.z + hb.d / 2);
      g.add(ln);
    }
    root.add(g);
  }
  return root;
}

export function renderRoomImage(room: Room, items: ItemPrice[], cat: Catalog, width = 1400, height = 900, mime: 'image/png' | 'image/jpeg' = 'image/jpeg', view: ViewName = '3d', night = false): string | null {
  return still(buildRoomObject(room, items, cat, { showFronts: true, lightsOn: night }), roomBounds(room), width, height, mime, view, night, ROOM_VIEW_DIR);
}
