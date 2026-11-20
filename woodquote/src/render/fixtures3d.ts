// 3D library of fittings that should look like the real thing: hollow sinks with
// bowls that drop into the worktop, swan-neck taps, wire pull-out baskets, bins,
// carousels, bottle racks and chrome hanging rails. All sizes come from the
// item's box, so custom sizes keep the look.
import * as THREE from 'three';
import { sinkSpec, sinkZones, tapX } from '../lib/sinks';
import type { Appliance, Box3, SinkSpec } from '../lib/types';

const chrome = new THREE.MeshPhysicalMaterial({ color: '#d7dbe0', metalness: 1, roughness: 0.18, envMapIntensity: 1.4 });
const steel = new THREE.MeshPhysicalMaterial({ color: '#c9cdd2', metalness: 0.9, roughness: 0.32, envMapIntensity: 1.2 });
const steelDark = new THREE.MeshPhysicalMaterial({ color: '#9aa0a6', metalness: 0.85, roughness: 0.4 });
const plastic = new THREE.MeshStandardMaterial({ color: '#5b6066', roughness: 0.55 });
const drainMat = new THREE.MeshStandardMaterial({ color: '#1f2226', roughness: 0.4, metalness: 0.5 });
const glassGreen = new THREE.MeshPhysicalMaterial({ color: '#2f5a3a', roughness: 0.05, transmission: 0.3, transparent: true, opacity: 0.85 });
const glassAmber = new THREE.MeshPhysicalMaterial({ color: '#6b3a1a', roughness: 0.05, transmission: 0.3, transparent: true, opacity: 0.85 });

for (const m of [chrome, steel, steelDark, plastic, drainMat, glassGreen, glassAmber]) m.userData.shared = true;

const box = (g: THREE.Group, x: number, y: number, z: number, w: number, h: number, d: number, mat: THREE.Material) => {
  if (w <= 0 || h <= 0 || d <= 0) return;
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x + w / 2, y + h / 2, z + d / 2);
  m.castShadow = true;
  m.receiveShadow = true;
  g.add(m);
};
/** a thin round bar between two points */
const rod = (g: THREE.Group, a: THREE.Vector3, b: THREE.Vector3, r: number, mat: THREE.Material) => {
  const len = a.distanceTo(b);
  if (len < 0.5) return;
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 10), mat);
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  m.castShadow = true;
  g.add(m);
};
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/** A rounded rectangle path in the plan (x, z). */
function roundRect(path: THREE.Path | THREE.Shape, x: number, z: number, w: number, d: number, r: number) {
  const rr = Math.max(0.5, Math.min(r, w / 2 - 0.1, d / 2 - 0.1));
  path.moveTo(x + rr, z);
  path.lineTo(x + w - rr, z);
  path.quadraticCurveTo(x + w, z, x + w, z + rr);
  path.lineTo(x + w, z + d - rr);
  path.quadraticCurveTo(x + w, z + d, x + w - rr, z + d);
  path.lineTo(x + rr, z + d);
  path.quadraticCurveTo(x, z + d, x, z + d - rr);
  path.lineTo(x, z + rr);
  path.quadraticCurveTo(x, z, x + rr, z);
}

/**
 * A flat slab in the plan (x, z) from y0 to y0 + h, with rounded-rectangle holes cut through.
 * Used for sink decks and for worktops with the sink cut-out.
 */
export function slabWithHoles(x: number, z: number, w: number, d: number, y0: number, h: number, holes: { x: number; z: number; w: number; d: number; r: number }[], mat: THREE.Material, corner = 0): THREE.Mesh {
  const shape = new THREE.Shape();
  if (corner > 0) roundRect(shape, x, z, w, d, corner);
  else {
    shape.moveTo(x, z);
    shape.lineTo(x + w, z);
    shape.lineTo(x + w, z + d);
    shape.lineTo(x, z + d);
    shape.closePath();
  }
  for (const hl of holes) {
    const p = new THREE.Path();
    roundRect(p, hl.x, hl.z, hl.w, hl.d, hl.r);
    shape.holes.push(p);
  }
  const geo = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: false, curveSegments: 6 });
  // shape (x, z) extruded along +Z → plan (x, z) with height along y
  geo.rotateX(Math.PI / 2);
  geo.translate(0, y0 + h, 0);
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/** The bowl openings of a sink, in the sink's own box coordinates (plan x, z). */
export function sinkHoles(a: Appliance, b: Box3): { x: number; z: number; w: number; d: number; r: number }[] {
  const spec = sinkSpec(a);
  const back = spec.mount === 'undermount' ? 10 : 35;
  const hh = b.d - back - (spec.mount === 'undermount' ? 10 : 30);
  return sinkZones(spec, b.w)
    .filter((z) => z.kind !== 'drainer')
    .map((z) => ({ x: b.x + z.x, z: b.z + back, w: z.w, d: hh, r: spec.material === 'ceramic' ? 45 : 30 }));
}

function sinkMaterial(spec: SinkSpec): THREE.Material {
  if (spec.material === 'stainless') return steel;
  if (spec.material === 'ceramic') return new THREE.MeshPhysicalMaterial({ color: spec.color, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.05 });
  return new THREE.MeshStandardMaterial({ color: spec.color, roughness: 0.62 });
}

/**
 * Hollow sink: deck with real openings (inset) or just bowls (undermount), bowls that
 * drop below the worktop with a drain and overflow, a ribbed drainer and a swan-neck tap.
 * b.y is the top of the worktop.
 */
export function sinkObject(a: Appliance, b: Box3): THREE.Group {
  const g = new THREE.Group();
  const spec = sinkSpec(a);
  const mat = sinkMaterial(spec);
  const t = spec.material === 'stainless' ? 1.2 : 10;
  const holes = sinkHoles(a, b);
  const inset = spec.mount === 'inset';
  if (inset) g.add(slabWithHoles(b.x, b.z, b.w, b.d, b.y, Math.max(1.5, t), holes, mat, 18));
  // bowls: walls, floor, drain and overflow
  const zones = sinkZones(spec, b.w).filter((z) => z.kind !== 'drainer');
  holes.forEach((hl, i) => {
    const depth = zones[i]?.kind === 'half' ? 150 : 190;
    const top = b.y + (inset ? 0 : 0);
    const y0 = top - depth;
    box(g, hl.x, y0, hl.z, t, depth, hl.d, mat);
    box(g, hl.x + hl.w - t, y0, hl.z, t, depth, hl.d, mat);
    box(g, hl.x, y0, hl.z, hl.w, depth, t, mat);
    box(g, hl.x, y0, hl.z + hl.d - t, hl.w, depth, t, mat);
    box(g, hl.x, y0 - t, hl.z, hl.w, t, hl.d, mat);
    const drain = new THREE.Mesh(new THREE.CylinderGeometry(42, 42, 2, 24), steelDark);
    drain.position.set(hl.x + hl.w / 2, y0 + 1, hl.z + hl.d * 0.6);
    g.add(drain);
    const hole = new THREE.Mesh(new THREE.CylinderGeometry(18, 18, 2.2, 16), drainMat);
    hole.position.set(hl.x + hl.w / 2, y0 + 1.2, hl.z + hl.d * 0.6);
    g.add(hole);
    // overflow slot on the back wall
    box(g, hl.x + hl.w / 2 - 25, top - 45, hl.z + t + 0.5, 50, 10, 1, drainMat);
  });
  // drainer: ribs across the deck, falling towards the bowl
  if (inset)
    for (const z of sinkZones(spec, b.w).filter((q) => q.kind === 'drainer')) {
      const n = Math.max(3, Math.floor((b.d - 70) / 32));
      for (let k = 0; k < n; k++) box(g, b.x + z.x + 15, b.y + t, b.z + 40 + k * 32, z.w - 30, 2, 9, spec.material === 'stainless' ? steelDark : mat);
    }
  // swan-neck mixer tap behind the bowl
  const tx = tapX(spec, b.w);
  if (tx != null) {
    const x = b.x + tx;
    const z = b.z + (inset ? 18 : -20);
    const baseY = b.y + (inset ? t : 0);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(26, 28, 20, 24), chrome);
    base.position.set(x, baseY + 10, z);
    g.add(base);
    rod(g, V(x, baseY + 20, z), V(x, baseY + 280, z), 14, chrome);
    const neck = new THREE.Mesh(new THREE.TorusGeometry(85, 13, 12, 24, Math.PI), chrome);
    neck.position.set(x, baseY + 280, z + 85);
    neck.rotation.y = Math.PI / 2;
    g.add(neck);
    rod(g, V(x, baseY + 280, z + 170), V(x, baseY + 225, z + 170), 13, chrome);
    rod(g, V(x, baseY + 150, z), V(x + 70, baseY + 175, z), 6, chrome); // lever
  }
  return g;
}

/** Hanging rail: chrome tube on two end brackets. */
export function railObject(b: Box3): THREE.Group {
  const g = new THREE.Group();
  const y = b.y + b.h / 2;
  const z = b.z + b.d / 2;
  rod(g, V(b.x + 4, y, z), V(b.x + b.w - 4, y, z), 12.5, chrome);
  for (const x of [b.x + 6, b.x + b.w - 6]) {
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(22, 22, 6, 18), chrome);
    disc.rotation.z = Math.PI / 2;
    disc.position.set(x, y, z);
    g.add(disc);
  }
  return g;
}

/** An open wire basket: rim, corner posts and a slatted floor. */
function basket(g: THREE.Group, x: number, y: number, z: number, w: number, h: number, d: number, r = 3) {
  const c = [V(x, 0, z), V(x + w, 0, z), V(x + w, 0, z + d), V(x, 0, z + d)];
  for (const yy of [y + 6, y + h]) for (let i = 0; i < 4; i++) rod(g, c[i].clone().setY(yy), c[(i + 1) % 4].clone().setY(yy), r, chrome);
  for (const p of c) rod(g, p.clone().setY(y + 6), p.clone().setY(y + h), r, chrome);
  const n = Math.max(3, Math.floor(w / 25));
  for (let k = 1; k < n; k++) {
    const xx = x + (w * k) / n;
    rod(g, V(xx, y + 6, z), V(xx, y + 6, z + d), r * 0.7, chrome);
    rod(g, V(xx, y + 6, z), V(xx, y + h * 0.75, z), r * 0.6, chrome);
    rod(g, V(xx, y + 6, z + d), V(xx, y + h * 0.75, z + d), r * 0.6, chrome);
  }
}

/** Pull-outs and organisers, by catalogue id (falls back to wire baskets). */
export function insertObject(id: string, name: string, b: Box3): THREE.Group {
  const g = new THREE.Group();
  const key = `${id} ${name}`.toLowerCase();
  if (/bin|trash/.test(key)) {
    // pull-out frame with two bins
    basket(g, b.x, b.y, b.z, b.w, 60, b.d, 4);
    const bw = (b.w - 30) / 2;
    const bh = Math.min(b.h - 40, 420);
    for (let i = 0; i < 2; i++) {
      const bin = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, b.d * 0.8), plastic);
      bin.position.set(b.x + 10 + bw / 2 + i * (bw + 10), b.y + 10 + bh / 2, b.z + b.d / 2);
      bin.castShadow = true;
      g.add(bin);
      box(g, b.x + 10 + i * (bw + 10), b.y + 10 + bh, b.z + b.d * 0.1, bw, 6, b.d * 0.8, steelDark);
    }
  } else if (/carousel|lazy/.test(key)) {
    // two round trays turning on a centre pole (three-quarter circle)
    const r = Math.min(b.w, b.d) / 2;
    const cx = b.x + b.w / 2;
    const cz = b.z + b.d / 2;
    rod(g, V(cx, b.y, cz), V(cx, b.y + b.h, cz), 10, chrome);
    for (const yy of [b.y + 20, b.y + b.h * 0.55]) {
      const tray = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 6, 32, 1, false, 0, Math.PI * 1.5), steel);
      tray.position.set(cx, yy, cz);
      g.add(tray);
      const lip = new THREE.Mesh(new THREE.TorusGeometry(r, 4, 6, 32, Math.PI * 1.5), chrome);
      lip.rotation.x = Math.PI / 2;
      lip.position.set(cx, yy + 25, cz);
      g.add(lip);
    }
  } else if (/magic/.test(key)) {
    const bw = b.w * 0.45;
    for (const yy of [b.y + 30, b.y + b.h * 0.5]) {
      basket(g, b.x + 10, yy, b.z + b.d * 0.5, bw, 90, b.d * 0.45);
      basket(g, b.x + bw + 30, yy, b.z + 10, bw, 90, b.d * 0.45);
    }
  } else if (/spice/.test(key)) {
    const n = Math.max(3, Math.floor(b.h / 140));
    for (let k = 0; k < n; k++) basket(g, b.x + 5, b.y + 20 + (k * (b.h - 60)) / n, b.z + 10, b.w - 10, 70, b.d - 20, 2.5);
    rod(g, V(b.x + 5, b.y, b.z + b.d - 10), V(b.x + 5, b.y + b.h, b.z + b.d - 10), 5, chrome);
    rod(g, V(b.x + b.w - 5, b.y, b.z + b.d - 10), V(b.x + b.w - 5, b.y + b.h, b.z + b.d - 10), 5, chrome);
  } else if (/cutlery/.test(key)) {
    box(g, b.x, b.y, b.z, b.w, 4, b.d, plastic);
    for (let k = 0; k <= 5; k++) box(g, b.x + (k * (b.w - 4)) / 5, b.y, b.z, 4, 50, b.d * 0.7, plastic);
    box(g, b.x, b.y, b.z + b.d * 0.7, b.w, 50, 4, plastic);
  } else if (/bottle|wine/.test(key)) {
    const n = Math.max(2, Math.floor(b.h / 260));
    for (let k = 0; k < n; k++) {
      const yy = b.y + 20 + (k * (b.h - 40)) / n;
      basket(g, b.x + 5, yy, b.z + 10, b.w - 10, 120, b.d - 20, 2.5);
      const bottles = Math.max(1, Math.floor((b.w - 20) / 80));
      for (let i = 0; i < bottles; i++) {
        const bt = new THREE.Mesh(new THREE.CylinderGeometry(34, 34, 230, 16), i % 2 ? glassAmber : glassGreen);
        bt.position.set(b.x + 45 + i * 80, yy + 125, b.z + b.d / 2);
        g.add(bt);
        const neck = new THREE.Mesh(new THREE.CylinderGeometry(12, 30, 70, 12), i % 2 ? glassAmber : glassGreen);
        neck.position.set(b.x + 45 + i * 80, yy + 275, b.z + b.d / 2);
        g.add(neck);
      }
    }
  } else {
    // pantry / vegetable racks and anything else: tiers of wire baskets on a frame
    const tiers = /pantry|larder/.test(key) ? Math.max(4, Math.floor(b.h / 330)) : Math.max(2, Math.floor(b.h / 260));
    for (let k = 0; k < tiers; k++) basket(g, b.x + 8, b.y + 15 + (k * (b.h - 30)) / tiers, b.z + 10, b.w - 16, Math.min(140, (b.h / tiers) * 0.5), b.d - 20);
    rod(g, V(b.x + 4, b.y, b.z + b.d - 6), V(b.x + 4, b.y + b.h, b.z + b.d - 6), 6, chrome);
    rod(g, V(b.x + b.w - 4, b.y, b.z + b.d - 6), V(b.x + b.w - 4, b.y + b.h, b.z + b.d - 6), 6, chrome);
  }
  return g;
}
