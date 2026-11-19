// Render studio engine: polished client images and videos from any view.
//
// Two ways to render:
//  * "Studio" (fast, every device): soft shadows, environment reflections,
//    ambient occlusion in corners and joints, and super-sampled edges.
//  * "Photoreal" (desktop / strong phones): a path tracer that follows the
//    light as it bounces – true reflections in gloss fronts and floors, soft
//    shadows and light spilling between cabinets. It builds up sample by
//    sample, so more samples = cleaner picture.
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { SSAARenderPass } from 'three/examples/jsm/postprocessing/SSAARenderPass.js';
import type { CameraView } from '../app/media';
import { kelvinToHex } from '../lib/util';
import type { StudioScene } from './studioState';

export type Background = 'white' | 'light' | 'warm' | 'gradient' | 'dark' | 'transparent';
export type FloorKind = 'shadow' | 'matte' | 'gloss' | 'none';

export interface Look {
  /** sun direction: around the model and height above the horizon (degrees) */
  sunAzimuth: number;
  sunElevation: number;
  sunIntensity: number;
  /** colour of the sunlight (Kelvin): 2700 warm … 6500 cool */
  sunKelvin: number;
  /** soft sky / room light */
  ambient: number;
  /** strength of reflections in gloss, metal and glass */
  reflections: number;
  exposure: number;
  /** 0 = crisp shadows, 1 = very soft */
  shadowSoftness: number;
  /** how dark shadows on the floor are */
  shadowDarkness: number;
  /** darkening in corners and joints */
  occlusion: number;
  floor: FloorKind;
  floorColor: string;
  background: Background;
  /** cabinet LED lighting switched on */
  lightsOn: boolean;
  /** thin panel outlines (drawing look) */
  outlines: boolean;
}

export const DEFAULT_LOOK: Look = {
  sunAzimuth: 35,
  sunElevation: 48,
  sunIntensity: 2.4,
  sunKelvin: 5600,
  ambient: 0.9,
  reflections: 0.8,
  exposure: 1,
  shadowSoftness: 0.45,
  shadowDarkness: 0.28,
  occlusion: 0.6,
  floor: 'shadow',
  floorColor: '#d9d3ca',
  background: 'white',
  lightsOn: false,
  outlines: false,
};

export const LOOKS: { id: string; label: string; look: Partial<Look> }[] = [
  { id: 'daylight', label: 'Daylight', look: {} },
  { id: 'studio', label: 'Studio white', look: { sunIntensity: 1.6, ambient: 1.4, shadowSoftness: 0.8, shadowDarkness: 0.18, background: 'white', floor: 'shadow', reflections: 1, sunKelvin: 6000 } },
  { id: 'showroom', label: 'Showroom', look: { sunIntensity: 2, ambient: 1, reflections: 1.3, floor: 'gloss', floorColor: '#e7e2da', background: 'light', shadowSoftness: 0.6, exposure: 1.05 } },
  { id: 'evening', label: 'Warm evening', look: { sunAzimuth: 70, sunElevation: 18, sunIntensity: 2.2, sunKelvin: 3200, ambient: 0.55, background: 'warm', exposure: 1.05, shadowSoftness: 0.35 } },
  { id: 'night', label: 'Night – lights on', look: { sunIntensity: 0.15, ambient: 0.18, reflections: 0.35, sunKelvin: 4000, background: 'dark', lightsOn: true, exposure: 1.2, floor: 'gloss', floorColor: '#3a3631' } },
  { id: 'drawing', label: 'Line drawing', look: { outlines: true, reflections: 0.4, occlusion: 0.3, shadowDarkness: 0.15, background: 'white' } },
];

const BACKGROUND: Record<Exclude<Background, 'gradient' | 'transparent'>, string> = { white: '#ffffff', light: '#eef0f3', warm: '#f4ede3', dark: '#16181d' };

function gradientTexture(top: string, bottom: string) {
  const c = document.createElement('canvas');
  c.width = 4;
  c.height = 256;
  const g = c.getContext('2d')!;
  const gr = g.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, top);
  gr.addColorStop(1, bottom);
  g.fillStyle = gr;
  g.fillRect(0, 0, 4, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/**
 * Panoramic studio light for the path tracer: bright sky, warm ground bounce
 * and two soft-box panels that give gloss fronts their clean reflections.
 */
function studioPanorama(night: boolean, kelvin: number): THREE.DataTexture {
  const W = 512;
  const H = 256;
  const data = new Float32Array(W * H * 4);
  const tint = new THREE.Color(kelvinToHex(kelvin));
  const sky = night ? 0.05 : 1.0;
  const ground = night ? 0.02 : 0.32;
  for (let y = 0; y < H; y++) {
    const el = (0.5 - y / H) * Math.PI; // +90° at the top, -90° at the bottom
    for (let x = 0; x < W; x++) {
      const az = (x / W) * Math.PI * 2;
      let v = el > 0 ? ground + (sky - ground) * Math.min(1, 0.35 + Math.sin(el) * 0.9) : ground * (1 - Math.min(1, -el));
      // two soft boxes, front-left and back-right, high up
      for (const [baz, bel] of [
        [0.6, 0.55],
        [3.8, 0.7],
      ] as const) {
        const d = Math.hypot(((az - baz + Math.PI * 3) % (Math.PI * 2)) - Math.PI, (el - bel) * 1.4);
        if (d < 0.32) v += (night ? 0.3 : 7) * (1 - d / 0.32) ** 2;
      }
      const i = (y * W + x) * 4;
      data[i] = v * (el > 0 ? tint.r : 0.95);
      data[i + 1] = v * (el > 0 ? tint.g : 0.9);
      data[i + 2] = v * (el > 0 ? tint.b : 0.82);
      data[i + 3] = 1;
    }
  }
  const t = new THREE.DataTexture(data, W, H, THREE.RGBAFormat, THREE.FloatType);
  t.mapping = THREE.EquirectangularReflectionMapping;
  t.minFilter = THREE.LinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.needsUpdate = true;
  return t;
}

export class Studio {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls | null = null;
  look: Look = { ...DEFAULT_LOOK };
  private src: StudioScene;
  private content: THREE.Object3D;
  private contentLit: boolean;
  private sun = new THREE.DirectionalLight('#ffffff', 2);
  private hemi = new THREE.HemisphereLight('#ffffff', '#b9b3a8', 1);
  private fill = new THREE.DirectionalLight('#fff4e6', 0.5);
  private floor: THREE.Mesh;
  private shadowFloor: THREE.Mesh;
  private env: THREE.Texture;
  private center = new THREE.Vector3();
  private radius = 1000;
  private gradient: THREE.Texture | null = null;

  constructor(host: HTMLElement, src: StudioScene) {
    this.src = src;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.VSMShadowMap;
    host.appendChild(this.renderer.domElement);
    Object.assign(this.renderer.domElement.style, { width: '100%', height: '100%', display: 'block', touchAction: 'none' });

    const pm = new THREE.PMREMGenerator(this.renderer);
    this.env = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    pm.dispose();
    this.scene.environment = this.env;

    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(4096, 4096);
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 1.5;
    this.scene.add(this.sun, this.sun.target, this.hemi, this.fill);

    this.floor = new THREE.Mesh(new THREE.PlaneGeometry(60000, 60000), new THREE.MeshPhysicalMaterial({ color: '#d9d3ca', roughness: 0.6 }));
    this.floor.rotation.x = -Math.PI / 2;
    this.floor.position.y = -0.5;
    this.floor.receiveShadow = true;
    this.shadowFloor = new THREE.Mesh(new THREE.PlaneGeometry(60000, 60000), new THREE.ShadowMaterial({ opacity: 0.25 }));
    this.shadowFloor.rotation.x = -Math.PI / 2;
    this.shadowFloor.receiveShadow = true;
    this.scene.add(this.floor, this.shadowFloor);

    this.camera = new THREE.PerspectiveCamera(src.camera.fov, 1, 10, 200000);
    this.contentLit = src.night;
    this.content = this.place(src.make(src.night));
    this.setView(src.camera);
  }

  /** Centre the model like the 3D views do and remember its size. */
  private place(obj: THREE.Object3D) {
    const b = this.src.bounds;
    obj.position.set(-(b.x0 + b.x1) / 2, 0, -(b.z0 + b.z1) / 2);
    this.center.set(0, (b.y0 + b.y1) / 2, 0);
    this.radius = Math.max(600, Math.hypot(b.x1 - b.x0, b.y1 - b.y0, b.z1 - b.z0) / 2);
    obj.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    this.scene.add(obj);
    return obj;
  }

  /** Camera views are stored relative to the model; turn them into scene positions. */
  private offset() {
    const b = this.src.bounds;
    return new THREE.Vector3(-(b.x0 + b.x1) / 2, 0, -(b.z0 + b.z1) / 2);
  }

  setView(v: CameraView) {
    const off = this.offset();
    this.camera.position.fromArray(v.position).add(off);
    this.camera.fov = v.fov;
    const t = new THREE.Vector3().fromArray(v.target).add(off);
    this.camera.lookAt(t);
    this.camera.updateProjectionMatrix();
    if (this.controls) {
      this.controls.target.copy(t);
      this.controls.update();
    }
  }

  view(): CameraView {
    const off = this.offset();
    const t = this.controls ? this.controls.target.clone() : this.center.clone();
    return { position: this.camera.position.clone().sub(off).toArray() as [number, number, number], target: t.sub(off).toArray() as [number, number, number], fov: this.camera.fov };
  }

  enableControls(onChange: () => void) {
    const c = new OrbitControls(this.camera, this.renderer.domElement);
    c.enableDamping = true;
    c.zoomToCursor = true;
    c.screenSpacePanning = true;
    c.maxPolarAngle = Math.PI / 2 - 0.01;
    const off = this.offset();
    c.target.fromArray(this.src.camera.target).add(off);
    c.update();
    c.addEventListener('change', onChange);
    this.controls = c;
  }

  setLook(l: Look) {
    this.look = l;
    if (l.lightsOn !== this.contentLit) {
      this.scene.remove(this.content);
      this.contentLit = l.lightsOn;
      this.content = this.place(this.src.make(l.lightsOn));
    }
    const r = this.radius;
    const az = (l.sunAzimuth * Math.PI) / 180;
    const el = (Math.max(3, l.sunElevation) * Math.PI) / 180;
    this.sun.position.set(Math.sin(az) * Math.cos(el) * r * 4, Math.sin(el) * r * 4, Math.cos(az) * Math.cos(el) * r * 4).add(this.center);
    this.sun.target.position.copy(this.center);
    this.sun.color.set(kelvinToHex(l.sunKelvin));
    this.sun.intensity = l.sunIntensity;
    const cam = this.sun.shadow.camera as THREE.OrthographicCamera;
    cam.left = cam.bottom = -r * 1.6;
    cam.right = cam.top = r * 1.6;
    cam.near = 10;
    cam.far = r * 10;
    cam.updateProjectionMatrix();
    this.sun.shadow.radius = 1 + l.shadowSoftness * 18;
    this.sun.shadow.blurSamples = Math.round(8 + l.shadowSoftness * 17);
    this.fill.position.set(-r * 2, r * 1.2, r * 1.5);
    this.fill.intensity = l.ambient * 0.45;
    this.hemi.intensity = l.ambient;
    this.scene.environmentIntensity = l.reflections * 0.7;
    this.renderer.toneMappingExposure = l.exposure;
    // floor
    const fm = this.floor.material as THREE.MeshPhysicalMaterial;
    fm.color.set(l.floorColor);
    fm.roughness = l.floor === 'gloss' ? 0.08 : 0.75;
    fm.clearcoat = l.floor === 'gloss' ? 1 : 0;
    fm.envMapIntensity = l.floor === 'gloss' ? 1.2 : 0.4;
    this.floor.visible = l.floor === 'matte' || l.floor === 'gloss';
    this.shadowFloor.visible = l.floor === 'shadow';
    (this.shadowFloor.material as THREE.ShadowMaterial).opacity = l.shadowDarkness;
    // background
    this.gradient?.dispose();
    this.gradient = null;
    if (l.background === 'transparent') this.scene.background = null;
    else if (l.background === 'gradient') this.scene.background = this.gradient = gradientTexture('#ffffff', '#d7dbe1');
    else this.scene.background = new THREE.Color(BACKGROUND[l.background]);
    this.renderer.setClearAlpha(l.background === 'transparent' ? 0 : 1);
    this.content.traverse((o) => {
      if (o instanceof THREE.LineSegments && o.material instanceof THREE.LineBasicMaterial && o.material.color.getHex() === 0) o.visible = l.outlines;
    });
  }

  /** Live preview in the studio window. */
  preview() {
    this.renderer.render(this.scene, this.camera);
  }

  resize(w: number, h: number) {
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  /** Render one high-quality frame at the given size into the canvas (studio mode). */
  renderStudioFrame(w: number, h: number, samples = 3) {
    const r = this.renderer;
    r.setPixelRatio(1);
    this.resize(w, h);
    const composer = new EffectComposer(r);
    composer.setPixelRatio(1);
    composer.setSize(w, h);
    const ssaa = new SSAARenderPass(this.scene, this.camera, this.scene.background instanceof THREE.Color ? this.scene.background.getHex() : 0xffffff, this.look.background === 'transparent' ? 0 : 1);
    ssaa.sampleLevel = samples; // 2^samples jittered renders
    ssaa.unbiased = true;
    composer.addPass(ssaa);
    if (this.look.occlusion > 0) {
      const ao = new GTAOPass(this.scene, this.camera, w, h);
      ao.blendIntensity = this.look.occlusion;
      ao.updateGtaoMaterial({ radius: Math.max(40, this.radius * 0.06), distanceExponent: 1.5, thickness: 2, scale: 1 });
      ao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 16 });
      composer.addPass(ao);
    }
    composer.addPass(new OutputPass());
    composer.render();
    composer.dispose();
  }

  /** Photoreal: path traced, refined sample by sample. Resolves when done or cancelled. */
  async renderPhotoreal(w: number, h: number, samples: number, onProgress: (p: number) => void, cancelled: () => boolean) {
    const { WebGLPathTracer } = await import('three-gpu-pathtracer');
    const r = this.renderer;
    r.setPixelRatio(1);
    this.resize(w, h);
    // the path tracer has no "shadow only" floor: use a real floor
    const shadowWas = this.shadowFloor.visible;
    const floorWas = this.floor.visible;
    if (shadowWas) {
      this.shadowFloor.visible = false;
      this.floor.visible = true;
      (this.floor.material as THREE.MeshPhysicalMaterial).color.set(this.look.background === 'dark' ? '#2d2a26' : '#f2efea');
    }
    const lines: THREE.Object3D[] = [];
    this.content.traverse((o) => {
      if (o instanceof THREE.LineSegments && o.visible) {
        o.visible = false;
        lines.push(o);
      }
    });
    // the path tracer lights the scene from a panorama instead of the room-light map
    const envWas = this.scene.environment;
    const pano = studioPanorama(this.look.background === 'dark' || this.look.lightsOn, this.look.sunKelvin);
    this.scene.environment = pano;
    const pt = new WebGLPathTracer(r);
    pt.bounces = 6;
    pt.filterGlossyFactor = 0.5;
    pt.minSamples = 1;
    pt.renderDelay = 0;
    pt.fadeDuration = 0;
    pt.dynamicLowRes = false;
    pt.renderScale = 1;
    pt.tiles.set(w * h > 2_500_000 ? 3 : 2, w * h > 2_500_000 ? 3 : 2);
    try {
      // give the page a moment to show the progress bar, then prepare the scene
      // (building the ray-tracing structure takes well under a second for a kitchen)
      onProgress(0.02);
      await new Promise((res) => setTimeout(res, 60));
      pt.setScene(this.scene, this.camera);
      onProgress(0.08);
      while (pt.samples < samples && !cancelled()) {
        pt.renderSample();
        onProgress(0.08 + 0.92 * Math.min(1, pt.samples / samples));
        // let the page breathe between samples
        await new Promise((res) => setTimeout(res, 0));
      }
    } finally {
      this.scene.environment = envWas;
      pano.dispose();
      for (const l of lines) l.visible = true;
      this.shadowFloor.visible = shadowWas;
      this.floor.visible = floorWas;
      this.setLook(this.look);
      pt.dispose();
    }
  }

  canvas() {
    return this.renderer.domElement;
  }

  /**
   * The finished picture on its chosen background. Some devices (many phones)
   * path trace with a see-through background, which would turn black in a JPEG.
   */
  picture(): HTMLCanvasElement {
    const src = this.renderer.domElement;
    if (this.look.background === 'transparent') return src;
    const c = document.createElement('canvas');
    c.width = src.width;
    c.height = src.height;
    const g = c.getContext('2d')!;
    if (this.look.background === 'gradient') {
      const grad = g.createLinearGradient(0, 0, 0, c.height);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(1, '#d7dbe1');
      g.fillStyle = grad;
    } else g.fillStyle = BACKGROUND[this.look.background];
    g.fillRect(0, 0, c.width, c.height);
    g.drawImage(src, 0, 0);
    return c;
  }

  /** Position for frame t (0–1) of a 360° turn around the current target. */
  turntable(t: number, start: CameraView, turns = 1) {
    const off = this.offset();
    const target = new THREE.Vector3().fromArray(start.target).add(off);
    const p = new THREE.Vector3().fromArray(start.position).add(off).sub(target);
    const sph = new THREE.Spherical().setFromVector3(p);
    sph.theta += t * Math.PI * 2 * turns;
    this.camera.position.setFromSpherical(sph).add(target);
    this.camera.lookAt(target);
  }

  /** Glide through saved views in order (smooth in and out of each). */
  flyThrough(t: number, views: CameraView[]) {
    if (views.length === 1) return this.setView(views[0]);
    const seg = Math.min(views.length - 2, Math.floor(t * (views.length - 1)));
    const k0 = t * (views.length - 1) - seg;
    const k = k0 * k0 * (3 - 2 * k0);
    const a = views[seg];
    const b = views[seg + 1];
    const lerp = (x: number[], y: number[]) => x.map((v, i) => v + (y[i] - v) * k) as [number, number, number];
    this.setView({ position: lerp(a.position, b.position), target: lerp(a.target, b.target), fov: a.fov + (b.fov - a.fov) * k });
  }

  dispose() {
    this.controls?.dispose();
    this.gradient?.dispose();
    this.env.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
