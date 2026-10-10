import * as T from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { CityState } from '../../../../packages/domain/src/index';
import {
  createCityLayout,
  layoutKey,
  riverY,
  riverHalfWidth,
  visualHash,
  insidePolygon,
  containsParcel,
  type Point,
  type CityLayout,
} from './layout';
import {
  projectSceneData,
  selectedParcels,
  affectedParcels,
  type MapSelection,
  type SceneData,
} from './data';
import { buildingHeight, roofHeight, cameraOffset } from './spatial';
import type { MapLayers } from './renderer';

export interface CameraView {
  elevation: number;
  azimuth: number;
  distance: number;
}
export interface LabelPosition {
  id: string;
  x: number;
  y: number;
  visible: boolean;
}
type Overlay = { refs: MapSelection[]; mode: string } | undefined;
const point = (p: Point, y = 0) => new T.Vector3(p.x - 500, y, p.y - 325);
const matrix = new T.Object3D();
function transform(x: number, y: number, z: number, w: number, h: number, d: number, angle = 0) {
  matrix.position.set(x, y, z);
  matrix.scale.set(w, h, d);
  matrix.rotation.set(0, -angle, 0);
  matrix.updateMatrix();
  return matrix.matrix;
}
function clear(group: T.Group) {
  group.traverse((o) => {
    if (o instanceof T.Mesh || o instanceof T.Line) {
      o.geometry.dispose();
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
        if (m instanceof T.MeshStandardMaterial) m.map?.dispose();
        m.dispose();
      }
    }
  });
  group.clear();
}
export class CityScene3D {
  readonly renderer: T.WebGLRenderer;
  readonly scene = new T.Scene();
  readonly camera = new T.PerspectiveCamera(43, 1, 0.5, 5000);
  readonly controls: OrbitControls;
  readonly terrain = new T.Group();
  readonly buildings = new T.Group();
  readonly highlights = new T.Group();
  layout!: CityLayout;
  data!: SceneData;
  renderMs = 0;
  overlayMs = 0;
  private bodies?: T.InstancedMesh;
  private roofs?: T.InstancedMesh;
  private residents?: T.InstancedMesh;
  private housingDecor = new T.Group();
  private companyDecor = new T.Group();
  private seed = '';
  private layers: MapLayers = { housing: true, companies: true, residents: true };
  private selected?: MapSelection;
  private overlay?: Overlay;
  private frame = 0;
  private renderedFrames = 0;
  private disposed = false;
  private gesture?: { id: number; x: number; y: number; dragged: boolean };
  private ray = new T.Raycaster();
  private observer: ResizeObserver;
  private onView: (view: CameraView, labels: LabelPosition[]) => void;
  constructor(
    private host: HTMLElement,
    private select: (kind: MapSelection['kind'], id: string) => void,
    private hover: (text: string) => void,
    onView: CityScene3D['onView'],
  ) {
    this.onView = onView;
    this.renderer = new T.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = T.PCFShadowMap;
    this.renderer.toneMapping = T.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.domElement.setAttribute(
      'aria-label',
      '3D 城市：拖曳旋轉、右鍵平移、滾輪縮放，點選真實實體',
    );
    this.renderer.domElement.tabIndex = 0;
    host.prepend(this.renderer.domElement);
    this.scene.background = new T.Color('#8faeb7');
    this.scene.fog = new T.Fog('#8faeb7', 1300, 2900);
    this.scene.add(new T.HemisphereLight('#cbdfe6', '#24352d', 1.6));
    const sun = new T.DirectionalLight('#ffe5b1', 2.8);
    sun.position.set(-350, 700, 250);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, {
      left: -650,
      right: 650,
      top: 650,
      bottom: -650,
      near: 1,
      far: 1800,
    });
    sun.shadow.bias = -0.0002;
    sun.shadow.normalBias = 0.6;
    this.scene.add(sun);
    this.scene.add(this.terrain, this.buildings, this.highlights);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.set(0, 14, 0);
    this.controls.enableDamping = false;
    this.controls.minPolarAngle = 0;
    this.controls.maxPolarAngle = Math.PI / 2;
    this.controls.minDistance = 30;
    this.controls.maxDistance = 5000;
    this.controls.screenSpacePanning = false;
    this.controls.maxTargetRadius = 800;
    this.controls.addEventListener('change', this.changed);
    this.setElevation(55, true);
    const canvas = this.renderer.domElement;
    canvas.addEventListener('pointerdown', this.down);
    canvas.addEventListener('pointerup', this.up);
    canvas.addEventListener('pointercancel', this.cancelGesture);
    canvas.addEventListener('pointermove', this.move);
    canvas.addEventListener('pointerleave', this.leave);
    canvas.addEventListener('keydown', this.key);
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(host);
    this.resize();
  }
  private changed = () => {
    this.requestRender();
  };
  private requestRender() {
    if (this.frame || this.disposed) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      if (!this.disposed) this.render();
    });
  }
  resize() {
    const w = this.host.clientWidth,
      h = this.host.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.requestRender();
  }
  getView(): CameraView {
    return {
      elevation: 90 - (this.controls.getPolarAngle() * 180) / Math.PI,
      azimuth: (this.controls.getAzimuthalAngle() * 180) / Math.PI,
      distance: this.controls.getDistance(),
    };
  }
  setElevation(elevation: number, reset = false) {
    const view = this.getView();
    if (reset) this.controls.target.set(0, 14, 0);
    const offset = cameraOffset(
      elevation,
      reset ? -12 : view.azimuth,
      reset ? Math.max(940, 1400 / this.camera.aspect) : view.distance || 940,
    );
    this.camera.position
      .copy(this.controls.target)
      .add(new T.Vector3(offset.x, offset.y, offset.z));
    this.controls.update();
    this.requestRender();
  }
  restore(view: CameraView & { target: [number, number, number] }) {
    this.controls.target.fromArray(view.target);
    const p = cameraOffset(view.elevation, view.azimuth, view.distance);
    this.camera.position.copy(this.controls.target).add(new T.Vector3(p.x, p.y, p.z));
    this.controls.update();
  }
  rotate(degrees: number) {
    const v = this.getView(),
      p = cameraOffset(v.elevation, v.azimuth + degrees, v.distance);
    this.camera.position.copy(this.controls.target).add(new T.Vector3(p.x, p.y, p.z));
    this.controls.update();
  }
  zoom(factor: number) {
    const v = this.camera.position.clone().sub(this.controls.target);
    v.setLength(Math.max(30, Math.min(5000, v.length() * factor)));
    this.camera.position.copy(this.controls.target).add(v);
    this.controls.update();
  }
  pan(right: number, forward: number) {
    const heading = (this.getView().azimuth * Math.PI) / 180;
    const step = Math.max(4, this.getView().distance * 0.04);
    const offset = new T.Vector3(
      (Math.cos(heading) * right - Math.sin(heading) * forward) * step,
      0,
      (-Math.sin(heading) * right - Math.cos(heading) * forward) * step,
    );
    this.controls.target.add(offset);
    this.camera.position.add(offset);
    this.controls.update();
  }
  private key = (e: KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key.toLowerCase() === 'w') this.pan(0, 1);
    else if (e.key.toLowerCase() === 's') this.pan(0, -1);
    else if (e.key.toLowerCase() === 'a') this.pan(-1, 0);
    else if (e.key.toLowerCase() === 'd') this.pan(1, 0);
    else if (e.key === 'ArrowLeft') this.rotate(-10);
    else if (e.key === 'ArrowRight') this.rotate(10);
    else if (e.key === 'ArrowUp') this.setElevation(this.getView().elevation + 5);
    else if (e.key === 'ArrowDown') this.setElevation(this.getView().elevation - 5);
    else if (e.key === '+' || e.key === '=') this.zoom(0.85);
    else if (e.key === '-') this.zoom(1.15);
    else if (e.key.toLowerCase() === 'r') this.setElevation(55, true);
    else return;
    e.preventDefault();
  };
  update(s: CityState, layers: MapLayers, selected?: MapSelection, overlay?: Overlay) {
    const started = performance.now();
    this.layers = layers;
    this.selected = selected;
    this.overlay = overlay;
    if (!this.layout || this.layout.key !== layoutKey(s)) {
      this.seed = s.config.seed;
      this.layout = createCityLayout(s);
      this.buildTerrain();
      this.data = projectSceneData(s, this.layout);
      this.buildCity();
    } else this.data = projectSceneData(s, this.layout);
    const color = new T.Color();
    this.data.buildings.forEach((b, i) => {
      const residential = b.parcel.type === 'residential';
      const enabled = residential ? layers.housing : layers.companies;
      const h = buildingHeight(this.seed, b.parcel);
      this.bodies!.setMatrixAt(
        i,
        transform(
          b.parcel.x - 500,
          h / 2 + 1,
          b.parcel.y - 325,
          enabled ? b.parcel.width : 0,
          h,
          b.parcel.height,
          b.parcel.rotation,
        ),
      );
      this.roofs!.setMatrixAt(
        i,
        transform(
          b.parcel.x - 500,
          h + 1,
          b.parcel.y - 325,
          enabled ? b.parcel.width * 1.08 : 0,
          roofHeight(b.parcel),
          b.parcel.height * 1.08,
          b.parcel.rotation,
        ),
      );
      const palette =
        b.parcel.districtId === this.layout.districts[0].id
          ? ['#789990', '#8ca394', '#a1b8a0']
          : b.parcel.districtId === this.layout.districts[1].id
            ? ['#bfa779', '#af996e', '#c8b789']
            : b.parcel.districtId === this.layout.districts[2].id
              ? ['#75828d', '#8e9091', '#888292']
              : ['#8eaabc', '#8cabb2', '#a1b5be'];
      color.set(palette[b.parcel.variant % 3]);
      this.bodies!.setColorAt(
        i,
        color
          .clone()
          .lerp(new T.Color('#c49a6b'), b.stressed ? 0.35 : 0)
          .multiplyScalar(b.occupied || b.active ? 1 : 0.57),
      );
      this.roofs!.setColorAt(i, color.clone().multiplyScalar(0.65));
    });
    for (const mesh of [this.bodies!, this.roofs!]) {
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.computeBoundingSphere();
    }
    // Detail batches follow their own building layer.
    this.housingDecor.visible = layers.housing;
    this.companyDecor.visible = layers.companies;
    if (this.residents) {
      this.residents.geometry.dispose();
      (this.residents.material as T.Material).dispose();
      this.buildings.remove(this.residents);
    }
    this.residents = new T.InstancedMesh(
      new T.SphereGeometry(1, 6, 4),
      new T.MeshBasicMaterial(),
      this.data.residents.length,
    );
    const heights = new Map(
      this.data.buildings.map((b) => [
        b.parcel.id,
        buildingHeight(this.seed, b.parcel) + roofHeight(b.parcel) + 4,
      ]),
    );
    this.data.residents.forEach((r, i) => {
      this.residents!.setMatrixAt(
        i,
        transform(r.x - 500, heights.get(r.buildingId) ?? 4, r.y - 325, 1.6, 1.6, 1.6),
      );
      this.residents!.setColorAt(i, color.set(r.employed ? '#9fffe0' : '#f4d18a'));
    });
    this.residents.visible = layers.residents;
    this.buildings.add(this.residents);
    this.renderMs = performance.now() - started;
    const overlayStart = performance.now();
    this.buildHighlights();
    this.overlayMs = performance.now() - overlayStart;
    this.requestRender();
  }
  private material(color: string) {
    return new T.MeshStandardMaterial({ color, roughness: 0.88, metalness: 0.04 });
  }
  private batch(group: T.Group, geos: T.BufferGeometry[], color: string, shadow = false) {
    if (!geos.length) return;
    const geometry = mergeGeometries(geos);
    geos.forEach((g) => g.dispose());
    if (!geometry) return;
    const mesh = new T.Mesh(geometry, this.material(color));
    mesh.receiveShadow = true;
    mesh.castShadow = shadow;
    group.add(mesh);
  }
  private box(p: Point, y: number, w: number, h: number, d: number, angle = 0) {
    return new T.BoxGeometry(1, 1, 1).applyMatrix4(
      transform(p.x - 500, y, p.y - 325, w, h, d, angle),
    );
  }
  private buildTerrain() {
    clear(this.terrain);
    const land = new T.Mesh(new T.BoxGeometry(7000, 12, 7000), this.material('#b7c6aa'));
    const textureCanvas = document.createElement('canvas');
    textureCanvas.width = 128;
    textureCanvas.height = 128;
    const ctx = textureCanvas.getContext('2d')!;
    ctx.fillStyle = '#7b8e71';
    ctx.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 4500; i++) {
      const n = visualHash(`${this.seed}:soil:${i}`);
      ctx.fillStyle = n % 2 ? '#889d7e' : '#607662';
      ctx.globalAlpha = 0.22;
      ctx.fillRect(n % 128, (n >>> 8) % 128, 1 + (n % 4), 1 + (n % 3));
    }
    const groundTexture = new T.CanvasTexture(textureCanvas);
    groundTexture.wrapS = groundTexture.wrapT = T.RepeatWrapping;
    groundTexture.repeat.set(80, 80);
    groundTexture.colorSpace = T.SRGBColorSpace;
    (land.material as T.MeshStandardMaterial).map = groundTexture;
    land.position.y = -6.5;
    land.receiveShadow = true;
    this.terrain.add(land);
    const shape = new T.Shape();
    for (let x = -400; x <= 1400; x += 20) {
      const y = riverY(x) - riverHalfWidth(x);
      if (x === -400) shape.moveTo(x - 500, y - 325);
      else shape.lineTo(x - 500, y - 325);
    }
    for (let x = 1400; x >= -400; x -= 20)
      shape.lineTo(x - 500, riverY(x) + riverHalfWidth(x) - 325);
    const waterGeometry = new T.ShapeGeometry(shape);
    waterGeometry.rotateX(Math.PI / 2);
    // Shape's positive y must become positive world z.

    const water = new T.Mesh(
      waterGeometry,
      new T.MeshStandardMaterial({
        color: '#24536a',
        roughness: 0.32,
        metalness: 0.5,
        side: T.DoubleSide,
      }),
    );
    water.position.y = 0.15;
    this.terrain.add(water);
    const roads: T.BufferGeometry[] = [],
      edges: T.BufferGeometry[] = [],
      rails: T.BufferGeometry[] = [],
      marks: T.BufferGeometry[] = [];
    for (const road of [...this.layout.roads, ...this.layout.districts.flatMap((d) => d.roads)]) {
      const width = { primary: 9, secondary: 5, local: 2.8, path: 1.2 }[road.hierarchy];
      for (let i = 1; i < road.points.length; i++) {
        const a = road.points[i - 1],
          b = road.points[i],
          len = Math.hypot(b.x - a.x, b.y - a.y),
          angle = Math.atan2(b.y - a.y, b.x - a.x),
          p = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        edges.push(this.box(p, 0.55, len + 1, 0.7, width + 2.3, angle));
        roads.push(this.box(p, 1.0, len + 1, 0.35, width, angle));
        if (road.hierarchy === 'primary')
          for (let t = 5; t < len; t += 15)
            marks.push(
              this.box(
                { x: a.x + ((b.x - a.x) * t) / len, y: a.y + ((b.y - a.y) * t) / len },
                1.2,
                5,
                0.06,
                0.35,
                angle,
              ),
            );
      }
    }
    // Raised bridge decks, piers and parapets cross the actual river.
    for (const x of [78, 450, 535, 922]) {
      const y = riverY(x),
        length = riverHalfWidth(x) * 2 + 26;
      roads.push(this.box({ x: x + 6, y }, 3.0, 11, 2, length, -0.12));
      for (const side of [-1, 1])
        rails.push(this.box({ x: x + 6 + side * 6, y }, 5, 0.8, 2, length, -0.12));
      for (const dy of [-length / 3, length / 3])
        edges.push(this.box({ x: x + 6, y: y + dy }, 1.1, 9, 6, 3));
    }
    this.batch(this.terrain, edges, '#75877f');
    this.batch(this.terrain, roads, '#46545b');
    this.batch(this.terrain, rails, '#c1c5ae');
    this.batch(this.terrain, marks, '#b6b69b');
    marks.length = 0;
    rails.length = 0;
    const foliage: T.BufferGeometry[] = [],
      trunks: T.BufferGeometry[] = [],
      gardens: T.BufferGeometry[] = [];
    for (let i = 0; i < 1800; i++) {
      const hash = visualHash(`${this.seed}:tree:${i}`),
        x = 35 + (hash % 930),
        y = 20 + ((hash >>> 10) % 615);
      if (
        Math.abs(y - riverY(x)) < riverHalfWidth(x) + 17 ||
        this.layout.parcels.some((p) => containsParcel(p, { x, y }, 5))
      )
        continue;
      if (
        [...this.layout.roads, ...this.layout.districts.flatMap((d) => d.roads)].some((r) =>
          r.points.some((a, j) => {
            const b = r.points[j + 1];
            if (!b) return false;
            const dx = b.x - a.x,
              dy = b.y - a.y,
              t = Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / (dx * dx + dy * dy)));
            return Math.hypot(x - a.x - t * dx, y - a.y - t * dy) < 8;
          }),
        )
      )
        continue;
      const h = 7 + ((hash >>> 20) % 7);
      foliage.push(
        new T.IcosahedronGeometry(1, 1).applyMatrix4(
          transform(x - 500, h, y - 325, 3.8, h * 0.55, 3.8),
        ),
      );
      trunks.push(this.box({ x, y }, h / 2, 0.7, h, 0.7));
    }
    for (const d of this.layout.districts)
      for (const a of d.anchors) {
        const p = a.position;
        gardens.push(this.box(p, 0.7, 32, 0.6, 24));
        if (['plaza', 'market', 'utilities'].includes(a.kind)) {
          const g = new T.CylinderGeometry(3, 6, 12, 12);
          g.translate(p.x - 500, 7, p.y - 325);
          rails.push(g);
        }
        if (a.kind === 'field') {
          for (const dy of [-9, 9])
            marks.push(this.box({ x: p.x, y: p.y + dy }, 1.1, 27, 0.1, 0.4));
          for (const dx of [-13.5, 0, 13.5])
            marks.push(this.box({ x: p.x + dx, y: p.y }, 1.1, 0.4, 0.1, 18));
        }
        if (a.kind === 'utilities')
          for (const dx of [-9, 9]) {
            const tank = new T.CylinderGeometry(4, 4, 7, 16);
            tank.translate(p.x + dx - 500, 4.5, p.y - 325);
            rails.push(tank);
          }
        if (a.kind === 'market')
          for (let i = 0; i < 4; i++)
            rails.push(this.box({ x: p.x - 12 + i * 8, y: p.y + 7 }, 4, 5, 6, 7));
        if (a.kind === 'steps')
          for (let i = 0; i < 5; i++)
            rails.push(this.box({ x: p.x, y: p.y - 8 + i * 4 }, 1 + i * 0.5, 27, 1 + i, 4));
      }
    this.batch(this.terrain, foliage, '#4d6e4c', true);
    this.batch(this.terrain, trunks, '#605541');
    this.batch(this.terrain, gardens, '#627b60');
    this.batch(this.terrain, rails.splice(0), '#c1c5ae');
    this.batch(this.terrain, marks.splice(0), '#c7d4c1');
    const ripples: T.BufferGeometry[] = [];
    for (let i = 0; i < 480; i++) {
      const n = visualHash(`wave${i}`),
        x = n % 1000,
        y = riverY(x) + (((n % 47) - 23) * riverHalfWidth(x)) / 28;
      ripples.push(this.box({ x, y }, 0.21, 3 + (n % 13), 0.025, 0.16));
    }
    this.batch(this.terrain, ripples, '#3b6c80');
  }
  private buildCity() {
    clear(this.buildings);
    const count = this.data.buildings.length;
    this.bodies = new T.InstancedMesh(new T.BoxGeometry(1, 1, 1), this.material('#ffffff'), count);
    this.bodies.castShadow = true;
    this.bodies.receiveShadow = true;
    this.buildings.add(this.bodies);
    // Four-sided roof with a ridge gives real sloping surfaces at all camera angles.
    const roof = new T.BufferGeometry();
    roof.setAttribute(
      'position',
      new T.Float32BufferAttribute(
        [
          -0.5, 0, -0.5, 0.5, 0, -0.5, 0, 1, -0.5, -0.5, 0, 0.5, 0, 1, 0.5, 0.5, 0, 0.5, -0.5, 0,
          -0.5, 0, 1, -0.5, 0, 1, 0.5, -0.5, 0, -0.5, 0, 1, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0,
          0.5, 0, 1, 0.5, 0.5, 0, -0.5, 0, 1, 0.5, 0, 1, -0.5,
        ],
        3,
      ),
    );
    roof.computeVertexNormals();
    this.roofs = new T.InstancedMesh(
      roof,
      new T.MeshStandardMaterial({ color: '#ffffff', roughness: 0.9, side: T.DoubleSide }),
      count,
    );
    this.roofs.castShadow = true;
    this.buildings.add(this.roofs);
    const windowsByType = {
      residential: [] as T.BufferGeometry[],
      commercial: [] as T.BufferGeometry[],
    };
    const detailsByType = {
      residential: [] as T.BufferGeometry[],
      commercial: [] as T.BufferGeometry[],
    };
    for (const b of this.data.buildings) {
      const p = b.parcel,
        h = buildingHeight(this.seed, p),
        floors = Math.max(1, Math.floor(h / 5));
      const windows = windowsByType[p.type],
        details = detailsByType[p.type];
      // Facade-local details remain attached to the real parcel and its layer.
      const local = (x: number, z: number) => ({
        x: p.x + x * Math.cos(p.rotation) - z * Math.sin(p.rotation),
        y: p.y + x * Math.sin(p.rotation) + z * Math.cos(p.rotation),
      });
      windows.push(this.box(local(0, p.height / 2 + 0.12), 3, p.width * 0.2, 4, 0.2, p.rotation));
      details.push(this.box(local(0, p.height / 2 + 1), 5.5, p.width * 0.35, 0.6, 2.4, p.rotation));
      details.push(this.box(p, h + 0.8, p.width * 1.09, 0.7, p.height * 1.09, p.rotation));
      if (p.type === 'commercial') {
        for (const side of [-1, 1]) {
          details.push(
            this.box(local((side * p.width) / 2, 0), h + 2, 0.6, 2, p.height, p.rotation),
          );
          details.push(
            this.box(local(0, (side * p.height) / 2), h + 2, p.width, 2, 0.6, p.rotation),
          );
        }
        details.push(
          this.box(local(-p.width * 0.2, 0), h + 3, p.width * 0.3, 3, p.height * 0.3, p.rotation),
        );
        windows.push(
          this.box(
            local(-p.width * 0.2, 0),
            h + 4.6,
            p.width * 0.28,
            0.2,
            p.height * 0.28,
            p.rotation,
          ),
        );
      } else {
        const chimney = local(p.width * 0.24, -p.height * 0.2);
        details.push(
          this.box(chimney, h + roofHeight(p) * 0.65, 1.5, roofHeight(p) + 2, 1.5, p.rotation),
        );
        if (p.variant % 2 === 0)
          for (let f = 1; f < floors; f++) {
            details.push(
              this.box(
                local(0, p.height / 2 + 1.1),
                2.7 + f * 5,
                p.width * 0.65,
                0.5,
                2.4,
                p.rotation,
              ),
            );
            details.push(
              this.box(
                local(0, p.height / 2 + 2.2),
                3.5 + f * 5,
                p.width * 0.65,
                1.3,
                0.25,
                p.rotation,
              ),
            );
          }
      }
      for (let f = 0; f < floors; f++)
        for (const side of [-1, 1])
          for (let col = 0; col < 3; col++) {
            const ox = (col - 1) * p.width * 0.25,
              oz = side * (p.height / 2 + 0.06),
              c = Math.cos(p.rotation),
              s = Math.sin(p.rotation);
            windows.push(
              this.box(
                { x: p.x + ox * c - oz * s, y: p.y + ox * s + oz * c },
                4 + f * 5,
                p.width * 0.13,
                1.9,
                0.1,
                p.rotation,
              ),
            );
          }
      details.push(this.box(p, 1.7, p.width * 1.03, 2, p.height * 1.03, p.rotation));
      for (let f = 0; f < floors; f++)
        for (const side of [-1, 1])
          for (let col = 0; col < 2; col++) {
            const ox = side * (p.width / 2 + 0.06),
              oz = (col - 0.5) * p.height * 0.45,
              c = Math.cos(p.rotation),
              s = Math.sin(p.rotation);
            windows.push(
              this.box(
                { x: p.x + ox * c - oz * s, y: p.y + ox * s + oz * c },
                4 + f * 5,
                0.1,
                1.9,
                p.height * 0.18,
                p.rotation,
              ),
            );
          }
    }
    for (const [kind, group] of [
      ['residential', this.housingDecor],
      ['commercial', this.companyDecor],
    ] as const) {
      group.clear();
      this.batch(group, windowsByType[kind], '#304b58');
      this.batch(group, detailsByType[kind], '#737d75');
      this.buildings.add(group);
    }
  }
  private buildHighlights() {
    clear(this.highlights);
    const draw = (refs: MapSelection[], color: string) => {
      const geos: T.BufferGeometry[] = [];
      for (const p of affectedParcels(this.data, refs)) {
        const h = buildingHeight(this.seed, p) + roofHeight(p) + 5;
        const geometry = new T.BoxGeometry(p.width + 3, h, p.height + 3);
        geometry.rotateY(-p.rotation);
        geometry.translate(p.x - 500, h / 2, p.y - 325);
        const outline = new T.LineSegments(
          new T.EdgesGeometry(geometry),
          new T.LineBasicMaterial({ color }),
        );
        geometry.dispose();
        this.highlights.add(outline);
        geos.push(this.box(p, 1.4, p.width + 5, 0.3, p.height + 5, p.rotation));
      }
      this.batch(this.highlights, geos, color);
      for (const ref of refs.filter((r) => r.kind === 'district')) {
        const d = this.layout.districts.find((d) => d.id === ref.id);
        if (!d) continue;
        const points = [...d.polygon, d.polygon[0]].map((p) => point(p, 2));
        const g = new T.BufferGeometry().setFromPoints(points);
        this.highlights.add(new T.Line(g, new T.LineBasicMaterial({ color })));
      }
    };
    if (this.overlay)
      draw(
        this.overlay.refs.filter(
          (r) => this.overlay!.mode === 'all' || this.overlay!.mode === r.kind,
        ),
        '#e3bb64',
      );
    if (this.selected) draw([this.selected], '#acffe2');
  }
  focus() {
    const parcel = selectedParcels(this.data, this.selected)[0];
    const district =
      this.selected?.kind === 'district'
        ? this.layout.districts.find((d) => d.id === this.selected!.id)
        : undefined;
    if (district) {
      this.focusDistrict(district.id);
      return;
    }
    const p = parcel;
    if (!p) return;
    const offset = this.camera.position
      .clone()
      .sub(this.controls.target)
      .setLength(parcel ? 180 : 400);
    this.controls.target.copy(point(p, parcel ? buildingHeight(this.seed, parcel) / 2 : 14));
    this.camera.position.copy(this.controls.target).add(offset);
    this.controls.update();
  }
  focusDistrict(id: string) {
    const district = this.layout.districts.find((d) => d.id === id);
    if (!district) return;
    const center = district.polygon.reduce(
      (sum, p) => ({
        x: sum.x + p.x / district.polygon.length,
        y: sum.y + p.y / district.polygon.length,
      }),
      { x: 0, y: 0 },
    );
    const offset = this.camera.position
      .clone()
      .sub(this.controls.target)
      .setLength(Math.max(460, 600 / this.camera.aspect));
    this.controls.target.copy(point(center, 14));
    this.camera.position.copy(this.controls.target).add(offset);
    this.controls.update();
  }
  private pick(e: PointerEvent) {
    const r = this.renderer.domElement.getBoundingClientRect();
    this.ray.setFromCamera(
      new T.Vector2(
        ((e.clientX - r.left) / r.width) * 2 - 1,
        (-(e.clientY - r.top) / r.height) * 2 + 1,
      ),
      this.camera,
    );
    const hits = this.ray.intersectObjects(
      [this.residents!, this.bodies!, this.roofs!].filter((o) => o?.visible),
      false,
    );
    const hit = hits[0];
    if (hit?.instanceId !== undefined) {
      if (hit.object === this.residents) {
        const resident = this.data.residents[hit.instanceId];
        return { selection: { kind: 'citizen' as const, id: resident.id }, label: resident.label };
      }
      const b = this.data.buildings[hit.instanceId];
      return {
        selection: b.companyId
          ? { kind: 'company' as const, id: b.companyId }
          : b.householdIds[0]
            ? { kind: 'household' as const, id: b.householdIds[0] }
            : { kind: 'district' as const, id: b.parcel.districtId },
        label: b.label,
      };
    }
    const ground = this.ray.ray.intersectPlane(
      new T.Plane(new T.Vector3(0, 1, 0), 0),
      new T.Vector3(),
    );
    if (ground) {
      const d = this.layout.districts.find((d) =>
        insidePolygon({ x: ground.x + 500, y: ground.z + 325 }, d.polygon),
      );
      if (d) return { selection: { kind: 'district' as const, id: d.id }, label: d.name };
    }
  }
  private down = (e: PointerEvent) => {
    if (this.gesture) {
      this.gesture.dragged = true;
      return;
    }
    this.gesture = { id: e.pointerId, x: e.clientX, y: e.clientY, dragged: false };
  };
  private cancelGesture = () => {
    this.gesture = undefined;
  };
  private up = (e: PointerEvent) => {
    const gesture = this.gesture;
    if (gesture?.id !== e.pointerId) return;
    this.gesture = undefined;
    if (
      e.button !== 0 ||
      gesture.dragged ||
      Math.hypot(e.clientX - gesture.x, e.clientY - gesture.y) > 5
    )
      return;
    const hit = this.pick(e);
    if (hit) this.select(hit.selection.kind, hit.selection.id);
  };
  private move = (e: PointerEvent) => {
    if (this.gesture && Math.hypot(e.clientX - this.gesture.x, e.clientY - this.gesture.y) > 5)
      this.gesture.dragged = true;
    if (!this.data || e.buttons) return;
    const hit = this.pick(e);
    this.hover(hit?.label ?? '');
    this.renderer.domElement.style.cursor = hit ? 'pointer' : 'grab';
  };
  private leave = () => {
    this.hover('');
    if (this.gesture) this.gesture.dragged = true;
  };
  render() {
    this.renderer.render(this.scene, this.camera);
    this.host.dataset.frame = String(++this.renderedFrames);
    const view = this.getView();
    const labels =
      this.layout?.districts.map((d) => {
        const p = point(d.label, 40).project(this.camera);
        return {
          id: d.id,
          x: ((p.x + 1) * this.host.clientWidth) / 2,
          y: ((1 - p.y) * this.host.clientHeight) / 2,
          visible:
            p.z < 1 &&
            p.z > -1 &&
            Math.abs(p.x) < 0.93 &&
            Math.abs(p.y) < 0.8 &&
            view.elevation > 12,
        };
      }) ?? [];
    this.onView(view, labels);
    this.host.dataset.drawCalls = String(this.renderer.info.render.calls);
    const targets = this.data
      ? [
          ...this.data.residents.slice(0, 30).map((r) => ({
            kind: 'citizen',
            id: r.id,
            position: point(
              r,
              buildingHeight(
                this.seed,
                this.layout.parcels.find((p) => p.id === r.buildingId)!,
              ) +
                roofHeight(this.layout.parcels.find((p) => p.id === r.buildingId)!) +
                4,
            ),
          })),
          ...this.data.buildings
            .filter((b) => b.companyId)
            .slice(0, 20)
            .map((b) => ({
              kind: 'company',
              id: b.companyId,
              position: point(b.parcel, buildingHeight(this.seed, b.parcel) + 2),
            })),
        ].map((t) => {
          const p = t.position.project(this.camera);
          return {
            kind: t.kind,
            id: t.id,
            x: ((p.x + 1) * this.host.clientWidth) / 2,
            y: ((1 - p.y) * this.host.clientHeight) / 2,
          };
        })
      : [];
    this.host.dataset.pickTargets = JSON.stringify(targets);
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    cancelAnimationFrame(this.frame);
    this.observer.disconnect();
    this.controls.dispose();
    const c = this.renderer.domElement;
    c.removeEventListener('pointerdown', this.down);
    c.removeEventListener('pointerup', this.up);
    c.removeEventListener('pointercancel', this.cancelGesture);
    c.removeEventListener('pointermove', this.move);
    c.removeEventListener('pointerleave', this.leave);
    c.removeEventListener('keydown', this.key);
    clear(this.terrain);
    clear(this.buildings);
    clear(this.highlights);
    this.scene.traverse((o) => {
      if (o instanceof T.DirectionalLight) o.shadow.dispose();
    });
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    c.remove();
  }
}
