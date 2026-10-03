import {
  Container,
  Graphics,
  Rectangle,
  Text,
  type Application,
  type FederatedPointerEvent,
} from 'pixi.js';
import type { CityState } from '../../../../packages/domain/src/index';
import {
  corners,
  containsParcel,
  createCityLayout,
  insidePolygon,
  layoutKey,
  riverHalfWidth,
  riverY,
  transform,
  visualHash,
  WORLD,
  type CityLayout,
  type Point,
  type Road,
} from './layout';
import { projectSceneData, selectedParcels, type MapSelection, type SceneData } from './data';

export interface MapLayers {
  residents: boolean;
  housing: boolean;
  companies: boolean;
}
export interface View {
  scale: number;
  x: number;
  y: number;
  width: number;
  height: number;
}
const flat = (points: Point[]) => points.flatMap((p) => [p.x, p.y]);
function line(g: Graphics, points: Point[], color: number | string, width: number, alpha = 1) {
  g.moveTo(points[0].x, points[0].y);
  for (const p of points.slice(1)) g.lineTo(p.x, p.y);
  g.stroke({ color, width, alpha, cap: 'round', join: 'round' });
}
function road(g: Graphics, r: Road) {
  const width = { primary: 9, secondary: 5, local: 2.3, path: 1 }[r.hierarchy];
  line(g, r.points, 0x101c23, width + 3);
  line(g, r.points, r.hierarchy === 'local' ? 0x43514f : 0x68716d, width + 0.9, 0.82);
  line(g, r.points, r.hierarchy === 'local' ? 0x293941 : 0x37474f, width);
  if (r.hierarchy === 'primary') line(g, r.points, 0x87918a, 0.65, 0.45);
}

export class CityScene {
  readonly root = new Container();
  readonly terrain = new Container();
  readonly buildings = new Graphics();
  readonly residents = new Graphics();
  readonly selection = new Graphics();
  layout!: CityLayout;
  data!: SceneData;
  view: View = { scale: 1, x: 0, y: 0, width: 1000, height: 650 };
  renderMs = 0;
  private layers: MapLayers = { residents: true, housing: true, companies: true };
  private selected?: MapSelection;
  private hovered?: MapSelection;
  private readonly select: (kind: MapSelection['kind'], id: string) => void;
  private readonly hover: (text: string) => void;

  constructor(
    private app: Application,
    select: CityScene['select'],
    hover: CityScene['hover'],
  ) {
    this.select = select;
    this.hover = hover;
    this.root.addChild(this.terrain, this.buildings, this.residents, this.selection);
    this.root.eventMode = 'static';
    this.root.hitArea = new Rectangle(0, 0, WORLD.width, WORLD.height);
    this.root.on('pointermove', (event: FederatedPointerEvent) => this.point(event, false));
    this.root.on('pointertap', (event: FederatedPointerEvent) => this.point(event, true));
    this.root.on('pointerleave', () => {
      this.hovered = undefined;
      this.hover('');
      this.drawSelection();
      this.app.render();
    });
    app.stage.addChild(this.root);
  }
  resize(): View {
    const width = this.app.screen.width,
      height = this.app.screen.height;
    const scale = Math.min(width / WORLD.width, height / WORLD.height);
    this.view = {
      scale,
      x: (width - WORLD.width * scale) / 2,
      y: (height - WORLD.height * scale) / 2,
      width,
      height,
    };
    this.root.scale.set(scale);
    this.root.position.set(this.view.x, this.view.y);
    return this.view;
  }
  update(state: CityState, layers: MapLayers, selected?: MapSelection) {
    const start = performance.now();
    this.layers = layers;
    this.selected = selected;
    if (this.layout?.key !== layoutKey(state)) {
      this.layout = createCityLayout(state);
      this.drawTerrain(state.config.seed);
    }
    this.data = projectSceneData(state, this.layout);
    this.drawBuildings();
    this.drawResidents();
    this.drawSelection();
    this.renderMs = performance.now() - start;
  }
  private drawTerrain(seed: string) {
    for (const child of this.terrain.removeChildren()) child.destroy({ children: true });
    const ground = new Graphics();
    this.terrain.addChild(ground);
    ground.rect(-1000, -1000, 3000, 3000).fill(0x172b2d);
    const colors = {
      residential: 0x1c3331,
      historic: 0x32362e,
      industrial: 0x282e35,
      waterfront: 0x20323b,
    };
    for (const d of this.layout.districts) {
      // Irregular cadastral ground, never dashboard containers.
      ground.poly(flat(d.polygon)).fill({ color: colors[d.character], alpha: 0.3 });
      for (const block of d.blocks) {
        ground.poly(flat(corners(block))).fill({
          color: block.garden ? 0x2d493b : colors[d.character],
          alpha: block.garden ? 0.65 : 0.18,
        });
      }
    }
    // Landscape texture has no entity IDs and never stands in for inhabitants.
    for (let i = 0; i < 690; i++) {
      const n = visualHash(`${seed}:landscape:${i}`);
      const x = 15 + (n % 970),
        y = 15 + ((n >>> 10) % 620);
      if (Math.abs(y - riverY(x)) < riverHalfWidth(x) + 15) continue;
      ground.circle(x + 1.2, y + 2.2, 2.2 + (n % 3)).fill({ color: 0x08171c, alpha: 0.7 });
      ground.circle(x, y, 2 + (n % 3)).fill({ color: i % 3 ? 0x29423a : 0x33483c, alpha: 0.85 });
      ground.circle(x - 0.8, y - 0.8, 0.9).fill({ color: 0x60745a, alpha: 0.25 });
    }
    const top: Point[] = [],
      bottom: Point[] = [];
    for (let x = -30; x <= 1050; x += 20) {
      top.push({ x, y: riverY(x) - riverHalfWidth(x) });
      bottom.push({ x, y: riverY(x) + riverHalfWidth(x) });
    }
    ground.poly(flat([...top, ...[...bottom].reverse()])).fill(0x193849);
    line(ground, top, 0x547379, 1.3, 0.6);
    line(ground, bottom, 0x547379, 1.3, 0.6);
    for (let offset = -20; offset <= 20; offset += 8) {
      for (let x = 0; x < 1000; x += 74)
        line(
          ground,
          [
            { x, y: riverY(x) + offset },
            { x: x + 43, y: riverY(x + 43) + offset },
          ],
          0x4c7785,
          0.6,
          0.24,
        );
    }
    const streets = new Graphics();
    this.terrain.addChild(streets);
    for (const d of this.layout.districts) for (const r of d.roads) road(streets, r);
    for (const r of this.layout.roads) road(streets, r);
    for (const x of [78, 450, 535, 922]) {
      const y = riverY(x),
        half = riverHalfWidth(x);
      line(
        streets,
        [
          { x: x + 2, y: y - half - 7 },
          { x: x + 11, y: y + half + 7 },
        ],
        0xa1a79a,
        13,
      );
      line(
        streets,
        [
          { x: x + 2, y: y - half - 7 },
          { x: x + 11, y: y + half + 7 },
        ],
        0x43545e,
        9,
      );
      line(
        streets,
        [
          { x: x + 2, y: y - half - 7 },
          { x: x + 11, y: y + half + 7 },
        ],
        0xd4b778,
        0.75,
        0.5,
      );
      for (let dy = -half; dy <= half; dy += 8)
        line(
          streets,
          [
            { x: x + 2, y: y + dy },
            { x: x + 11, y: y + dy },
          ],
          0x9cb1ac,
          0.65,
          0.35,
        );
    }
    const anchors = new Graphics();
    this.terrain.addChild(anchors);
    for (const d of this.layout.districts)
      for (const anchor of d.anchors) {
        const { x, y } = anchor.position;
        if (anchor.kind === 'field') {
          anchors
            .roundRect(x - 21, y - 13, 42, 26, 12)
            .fill(0x36533f)
            .stroke({ color: 0x8faaa1, width: 1 });
          anchors.roundRect(x - 18, y - 10, 36, 20, 9).stroke({ color: 0x89a89b, width: 0.7 });
          anchors
            .roundRect(x - 12, y - 7, 24, 14, 1)
            .fill(0x264836)
            .stroke({ color: 0x769589, width: 0.6 });
          line(
            anchors,
            [
              { x, y: y - 7 },
              { x, y: y + 7 },
            ],
            0x78998a,
            0.6,
          );
        } else if (anchor.kind === 'plaza') {
          anchors.circle(x, y, 21).fill(0x1b292e).stroke({ color: 0x7d8170, width: 5 });
          anchors.circle(x, y, 12).fill(0x596052).stroke({ color: 0xb5a77e, width: 0.8 });
          anchors.circle(x, y, 5).fill(0x8e977e);
          anchors.circle(x, y, 2).fill(0xc7bea0);
          for (let k = 0; k < 4; k++) {
            const a = (k * Math.PI) / 2;
            line(
              anchors,
              [
                { x: x + Math.cos(a) * 22, y: y + Math.sin(a) * 22 },
                { x: x + Math.cos(a) * 29, y: y + Math.sin(a) * 29 },
              ],
              0x747d71,
              3,
            );
          }
        } else if (anchor.kind === 'market') {
          anchors
            .rect(x - 19, y - 13, 38, 26)
            .fill(0x414539)
            .stroke({ color: 0xa0926b, width: 0.9 });
          for (let k = -2; k <= 2; k++)
            line(
              anchors,
              [
                { x: x + k * 6, y: y - 10 },
                { x: x + k * 6, y: y + 10 },
              ],
              0x7f8069,
              0.7,
            );
          anchors.circle(x, y, 4).fill(0x35525a).stroke({ color: 0xaaa486, width: 1 });
        } else if (anchor.kind === 'yard' || anchor.kind === 'utilities') {
          anchors
            .rect(x - 22, y - 14, 44, 28)
            .fill(0x32383c)
            .stroke({ color: 0x65666b, width: 0.8 });
          if (anchor.kind === 'yard')
            for (let k = -2; k <= 2; k++) {
              line(
                anchors,
                [
                  { x: x - 18, y: y + k * 5 },
                  { x: x + 18, y: y + k * 5 },
                ],
                0x7b7780,
                1.3,
              );
              for (let j = -3; j <= 3; j++)
                line(
                  anchors,
                  [
                    { x: x + j * 5, y: y + k * 5 - 1.6 },
                    { x: x + j * 5, y: y + k * 5 + 1.6 },
                  ],
                  0x53555f,
                  0.6,
                );
            }
          else
            for (let k = -1; k <= 1; k++)
              anchors
                .circle(x + k * 13, y, 5)
                .fill(0x57616a)
                .stroke({ color: 0x9b9c9a, width: 1 });
        } else if (anchor.kind === 'steps') {
          anchors
            .poly([x - 21, y - 14, x + 24, y - 14, x + 13, y + 13, x - 21, y + 13])
            .fill(0x425761);
          for (let k = -2; k <= 2; k++)
            line(
              anchors,
              [
                { x: x - 19, y: y + k * 5 },
                { x: x + 18 - k * 2, y: y + k * 5 },
              ],
              0x81949b,
              0.8,
            );
        } else {
          anchors.ellipse(x, y, 21, 13).fill(0x294436).stroke({ color: 0x4e6954, width: 0.8 });
          anchors
            .ellipse(x + 4, y, 7, 5)
            .fill(0x244654)
            .stroke({ color: 0x6c8c8b, width: 0.6 });
          line(
            anchors,
            [
              { x: x - 20, y: y + 4 },
              { x: x - 5, y: y - 5 },
              { x: x + 19, y: y + 2 },
            ],
            0x8b9680,
            1.6,
            0.7,
          );
        }
      }
    const riverLabel = new Text({
      text: 'C I V I T A S   R I V E R',
      style: { fontFamily: 'Segoe UI', fontSize: 11, fill: 0x91b1bc, letterSpacing: 1 },
    });
    riverLabel.anchor.set(0.5);
    riverLabel.position.set(315, riverY(315));
    riverLabel.rotation = -0.025;
    this.terrain.addChild(riverLabel);
  }
  private drawBuildings() {
    const g = this.buildings;
    g.clear();
    const districtStyles = new Map(this.layout.districts.map((d) => [d.id, d]));
    for (const b of this.data.buildings) {
      const p = b.parcel;
      if (p.type === 'commercial' ? !this.layers.companies : !this.layers.housing) continue;
      const d = districtStyles.get(p.districtId)!;
      const roof = b.companyId
        ? b.active
          ? d.color
          : '#3e454b'
        : b.occupied
          ? {
              residential: '#52766c',
              historic: '#88816a',
              industrial: '#5c6570',
              waterfront: '#5c8294',
            }[d.character]
          : '#27343c';
      const offset = { ...p, x: p.x + 2.4, y: p.y + 3 };
      g.poly(flat(corners({ ...p, width: p.width + 4, height: p.height + 4 })))
        .fill({ color: d.color, alpha: 0.035 })
        .stroke({ color: d.color, alpha: 0.15, width: 0.55 });
      g.poly(flat(corners(offset))).fill({ color: 0x07171c, alpha: 0.8 });
      g.poly(flat(corners(p)))
        .fill({ color: roof, alpha: b.companyId ? 0.74 : 0.85 })
        .stroke({
          color: b.stressed ? '#d4a578' : d.color,
          width: b.stressed ? 1.1 : 0.7,
          alpha: b.stressed ? 0.8 : 0.45,
        });
      const a = (x: number, y: number) => transform({ x, y }, p, p.rotation);
      // Different roof topology is a visual style, not an additional building.
      if (d.character === 'industrial' || (b.companyId && p.variant % 2)) {
        for (let k = -1; k <= 1; k++)
          line(
            g,
            [a(-p.width * 0.43, k * p.height * 0.26), a(p.width * 0.43, k * p.height * 0.26)],
            '#b6c0bf',
            0.65,
            0.32,
          );
        g.poly(
          flat([
            a(-p.width * 0.18, -p.height * 0.25),
            a(p.width * 0.2, -p.height * 0.25),
            a(p.width * 0.2, -p.height * 0.12),
            a(-p.width * 0.18, -p.height * 0.12),
          ]),
        ).fill({ color: 0x1e363f, alpha: 0.7 });
      } else if (d.character === 'waterfront') {
        g.poly(flat(corners({ ...p, width: p.width * 0.62, height: p.height * 0.58 })))
          .fill({ color: 0xb3c4c8, alpha: 0.13 })
          .stroke({ color: 0xd5e0db, alpha: 0.2, width: 0.5 });
        line(
          g,
          [a(-p.width / 2, -p.height / 2), a(p.width / 2, p.height / 2)],
          0xb7ccd0,
          0.65,
          0.28,
        );
      } else {
        line(
          g,
          [a(-p.width / 2, 0), a(0, -p.height * 0.24), a(p.width / 2, 0)],
          '#c1c9b3',
          0.7,
          0.35,
        );
        line(
          g,
          [a(-p.width / 2, -p.height / 2), a(p.width / 2, -p.height / 2)],
          '#d6dec7',
          0.8,
          0.25,
        );
      }
      if (!b.companyId && !b.occupied) line(g, [a(-2, 0), a(2, 0)], '#8c9b9f', 0.9, 0.8);
      if (b.companyId && b.active) g.circle(p.x, p.y, 1.6).fill(0xd4b778);
    }
  }
  private drawResidents() {
    const g = this.residents;
    g.clear();
    if (!this.layers.residents) return;
    for (const resident of this.data.residents) {
      g.circle(resident.x, resident.y, 2.3).fill({ color: 0x0b1d25, alpha: 0.9 });
      g.circle(resident.x, resident.y, 1.55).fill(resident.employed ? 0xa3e0c8 : 0xd4b778);
    }
  }
  private drawSelection() {
    if (!this.data) return;
    const g = this.selection;
    g.clear();
    for (const chosen of [this.selected, this.hovered]) {
      if (!chosen) continue;
      const selected = chosen === this.selected;
      if (chosen.kind === 'district') {
        const d = this.layout.districts.find((item) => item.id === chosen.id);
        if (d)
          g.poly(flat(d.polygon))
            .fill({ color: d.color, alpha: selected ? 0.045 : 0.02 })
            .stroke({ color: d.color, width: selected ? 1.5 : 0.7, alpha: selected ? 0.7 : 0.4 });
      }
      for (const p of selectedParcels(this.data, chosen)) {
        g.poly(flat(corners({ ...p, width: p.width + 7, height: p.height + 7 }))).stroke({
          color: selected ? 0xf1f5df : 0xa3d8c6,
          width: selected ? 2 : 1,
          alpha: 1,
        });
      }
      if (chosen.kind === 'citizen') {
        const r = this.data.residents.find((item) => item.id === chosen.id);
        if (r) g.circle(r.x, r.y, 4).stroke({ color: 0xf3f5dd, width: 1.2 });
      }
    }
  }
  private point(event: FederatedPointerEvent, click: boolean) {
    if (!this.data) return;
    const point = event.getLocalPosition(this.root);
    let match: MapSelection | undefined,
      text = '';
    if (this.layers.residents) {
      const radius = Math.max(2.7, 3.5 / this.view.scale);
      let distance = radius * radius;
      for (const r of this.data.residents) {
        const ds = (r.x - point.x) ** 2 + (r.y - point.y) ** 2;
        if (ds < distance) {
          match = { kind: 'citizen', id: r.id };
          text = r.label;
          distance = ds;
        }
      }
    }
    if (!match) {
      const b = this.data.buildings.find(
        (item) =>
          (item.companyId ? this.layers.companies : this.layers.housing) &&
          containsParcel(item.parcel, point, 1),
      );
      if (b) {
        text = b.label;
        if (b.companyId) match = { kind: 'company', id: b.companyId };
        else if (b.householdIds[0]) match = { kind: 'household', id: b.householdIds[0] };
      }
    }
    if (!match) {
      const d = this.layout.districts.find((item) => insidePolygon(point, item.polygon));
      if (d) {
        match = { kind: 'district', id: d.id };
        if (!text) text = d.name;
      }
    }
    this.root.cursor = match ? 'pointer' : 'default';
    if (click && match) this.select(match.kind, match.id);
    if (this.hovered?.id !== match?.id || this.hovered?.kind !== match?.kind) {
      this.hovered = match;
      this.hover(text);
      this.drawSelection();
      this.app.render();
    }
  }
  destroy() {
    this.root.destroy({ children: true });
  }
}
