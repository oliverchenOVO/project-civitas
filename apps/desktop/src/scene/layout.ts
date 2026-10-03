import type { Building, CityState } from '../../../../packages/domain/src/index';

export const WORLD = { width: 1000, height: 650 };
export type Point = { x: number; y: number };
export type Character = 'residential' | 'historic' | 'industrial' | 'waterfront';
export interface Road {
  points: Point[];
  hierarchy: 'primary' | 'secondary' | 'local' | 'path';
}
export interface Parcel extends Point {
  id: string;
  districtId: string;
  type: Building['type'];
  width: number;
  height: number;
  rotation: number;
  variant: number;
}
export interface Block extends Point {
  width: number;
  height: number;
  rotation: number;
  garden: boolean;
}
export interface DistrictLayout {
  id: string;
  name: string;
  color: string;
  character: Character;
  tags: string;
  polygon: Point[];
  label: Point;
  blocks: Block[];
  roads: Road[];
  anchors: {
    kind: 'field' | 'garden' | 'plaza' | 'market' | 'yard' | 'utilities' | 'steps' | 'park';
    position: Point;
  }[];
}
export interface CityLayout {
  districts: DistrictLayout[];
  parcels: Parcel[];
  roads: Road[];
  key: string;
}

// Independent visual hashing; never reads or advances simulation RNG streams.
export function visualHash(text: string): number {
  let n = 2166136261;
  for (const char of text) n = Math.imul(n ^ char.charCodeAt(0), 16777619);
  return n >>> 0;
}
export function riverY(x: number): number {
  return 296 + x * 0.063 + Math.sin(x / 145) * 23;
}
export function riverHalfWidth(x: number): number {
  return 29 + Math.sin(x / 170) * 5;
}
export function transform(p: Point, origin: Point, angle: number): Point {
  return {
    x: origin.x + p.x * Math.cos(angle) - p.y * Math.sin(angle),
    y: origin.y + p.x * Math.sin(angle) + p.y * Math.cos(angle),
  };
}
export function corners(p: Point & { width: number; height: number; rotation: number }): Point[] {
  return [
    { x: -p.width / 2, y: -p.height / 2 },
    { x: p.width / 2, y: -p.height / 2 },
    { x: p.width / 2, y: p.height / 2 },
    { x: -p.width / 2, y: p.height / 2 },
  ].map((q) => transform(q, p, p.rotation));
}
export function insidePolygon(p: Point, polygon: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i],
      b = polygon[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x)
      inside = !inside;
  }
  return inside;
}
export function containsParcel(parcel: Parcel, p: Point, margin = 0): boolean {
  const dx = p.x - parcel.x,
    dy = p.y - parcel.y;
  const x = dx * Math.cos(parcel.rotation) + dy * Math.sin(parcel.rotation);
  const y = -dx * Math.sin(parcel.rotation) + dy * Math.cos(parcel.rotation);
  return Math.abs(x) <= parcel.width / 2 + margin && Math.abs(y) <= parcel.height / 2 + margin;
}
export function layoutKey(s: CityState): string {
  return JSON.stringify([
    s.config,
    s.districts.map((d) => [d.id, d.name, d.color]),
    s.buildings.map((b) => [b.id, b.districtId, b.type]),
  ]);
}
const styles = {
  Northbank: {
    character: 'residential',
    origin: { x: 75, y: 60 },
    width: 362,
    height: 183,
    angle: 0.06,
    tags: 'RESIDENTIAL · EDUCATION',
    label: { x: 253, y: 246 },
  },
  'Old Quarter': {
    character: 'historic',
    origin: { x: 559, y: 64 },
    width: 350,
    height: 216,
    angle: -0.07,
    tags: 'HISTORIC · CIVIC · RETAIL',
    label: { x: 773, y: 286 },
  },
  Foundry: {
    character: 'industrial',
    origin: { x: 63, y: 393 },
    width: 375,
    height: 191,
    angle: -0.08,
    tags: 'INDUSTRY · INNOVATION',
    label: { x: 264, y: 509 },
  },
  Riverside: {
    character: 'waterfront',
    origin: { x: 571, y: 420 },
    width: 335,
    height: 169,
    angle: 0.08,
    tags: 'BUSINESS · CULTURE',
    label: { x: 757, y: 508 },
  },
} as const;

export function createCityLayout(s: CityState): CityLayout {
  const districts: DistrictLayout[] = [],
    parcels: Parcel[] = [];
  const density = Math.max(1, Math.sqrt(s.config.population / 250));
  for (const district of s.districts) {
    const style = styles[district.name as keyof typeof styles] ?? styles.Northbank;
    const angle = style.angle + ((visualHash(s.config.seed + district.id) % 9) - 4) * 0.002;
    const bend = style.character === 'historic' ? 13 : style.character === 'waterfront' ? 10 : 5;
    const local = (x: number, y: number) =>
      transform(
        {
          x: x + Math.sin(y / 74) * bend,
          y: y + Math.sin(x / 91) * bend,
        },
        style.origin,
        angle,
      );
    const cols = Math.ceil(
      (style.character === 'industrial' ? 5 : style.character === 'historic' ? 7 : 6) * density,
    );
    const rows = Math.ceil((style.character === 'historic' ? 5 : 4) * density);
    const cw = style.width / cols,
      ch = style.height / rows;
    const blocks: Block[] = [],
      roads: Road[] = [];
    const homeSlots: (Point & { width: number; height: number; salt: string })[] = [];
    const companySlots: (Point & { width: number; height: number; salt: string })[] = [];
    const anchorCells = new Set([
      0,
      cols + (style.character === 'historic' ? Math.floor(cols / 2) : 0),
    ]);
    const commercialCells = new Set(
      Array.from({ length: rows * cols }, (_, i) => i)
        .filter((i) => !anchorCells.has(i))
        .sort(
          (a, b) =>
            visualHash(`${s.config.seed}:${district.id}:business:${a}`) -
            visualHash(`${s.config.seed}:${district.id}:business:${b}`),
        )
        .slice(0, Math.max(6, Math.ceil(density * 6))),
    );
    for (let row = 0; row < rows; row++)
      for (let col = 0; col < cols; col++) {
        const index = row * cols + col;
        const center = local((col + 0.5) * cw, (row + 0.5) * ch);
        const anchor = anchorCells.has(index);
        blocks.push({ ...center, width: cw - 7, height: ch - 7, rotation: angle, garden: anchor });
        if (anchor) continue;
        const commercial = commercialCells.has(index);
        // Each baseline business gets a larger parcel; excess new companies can
        // share it through deterministic subdivision, without inventing buildings.
        if (commercial)
          companySlots.push({ ...center, width: cw - 12, height: ch - 12, salt: `${row}:${col}` });
        else
          for (let sy = 0; sy < 2; sy++)
            for (let sx = 0; sx < 2; sx++) {
              homeSlots.push({
                ...local((col + 0.25 + sx * 0.5) * cw, (row + 0.25 + sy * 0.5) * ch),
                width: cw / 2 - 7,
                height: ch / 2 - 6,
                salt: `${row}:${col}:${sx}:${sy}`,
              });
            }
      }
    for (let col = 0; col <= cols; col++)
      roads.push({
        hierarchy: col % 3 === 0 ? 'secondary' : 'local',
        points: Array.from({ length: rows + 1 }, (_, row) => local(col * cw, row * ch)),
      });
    for (let row = 0; row <= rows; row++)
      roads.push({
        hierarchy: row === 0 || row === rows ? 'secondary' : 'local',
        points: Array.from({ length: cols + 1 }, (_, col) => local(col * cw, row * ch)),
      });
    const polygon = [
      local(-24, 6),
      local(22, -27),
      local(style.width - 12, -25),
      local(style.width + 22, 30),
      local(style.width + 23, style.height - 15),
      local(style.width - 24, style.height + 26),
      local(13, style.height + 27),
      local(-27, style.height - 33),
    ];
    const anchorPositions = [...anchorCells].map((cell) =>
      local(((cell % cols) + 0.5) * cw, (Math.floor(cell / cols) + 0.5) * ch),
    );
    const kinds = {
      residential: ['field', 'garden'],
      historic: ['plaza', 'market'],
      industrial: ['yard', 'utilities'],
      waterfront: ['steps', 'park'],
    } as const;
    districts.push({
      id: district.id,
      name: district.name,
      color: district.color,
      character: style.character,
      tags: style.tags,
      polygon,
      label: style.label,
      blocks,
      roads,
      anchors: anchorPositions.map((position, index) => ({
        kind: kinds[style.character][index],
        position,
      })),
    });
    for (const type of ['residential', 'commercial'] as const) {
      const slots = type === 'commercial' ? companySlots : homeSlots;
      slots.sort(
        (a, b) =>
          visualHash(`${s.config.seed}:${district.id}:${type}:${a.salt}`) -
          visualHash(`${s.config.seed}:${district.id}:${type}:${b.salt}`),
      );
      const entities = s.buildings
        .filter((b) => b.districtId === district.id && b.type === type)
        .sort(
          (a, b) =>
            Number(a.id.split('-').at(-1)) - Number(b.id.split('-').at(-1)) ||
            a.id.localeCompare(b.id),
        );
      // Positions of existing IDs are fixed. When parcels fill, split within the
      // same plot. Mass dimensions may shrink, but centers never jump on growth.
      const pages = Math.max(1, Math.ceil(entities.length / slots.length));
      const size = Math.ceil(Math.sqrt(pages));
      entities.forEach((building, index) => {
        const slot = slots[index % slots.length];
        const page = Math.floor(index / slots.length);
        const offset =
          page === 0
            ? { x: 0, y: 0 }
            : {
                x: Math.cos(page * 2.399963) * Math.sqrt(page / (page + 4)) * slot.width * 0.38,
                y: Math.sin(page * 2.399963) * Math.sqrt(page / (page + 4)) * slot.height * 0.38,
              };
        const jitter = visualHash(s.config.seed + building.id);
        const p = transform(offset, slot, angle);
        parcels.push({
          ...p,
          id: building.id,
          districtId: district.id,
          type,
          rotation: angle,
          width: Math.max(3, (slot.width / size) * (0.78 + (jitter % 14) / 100)),
          height: Math.max(3, (slot.height / size) * (0.74 + ((jitter >>> 5) % 18) / 100)),
          variant: jitter % 4,
        });
      });
    }
  }
  const roads: Road[] = [];
  for (const x of [78, 450, 535, 922]) {
    const y = riverY(x);
    roads.push({
      hierarchy: 'primary',
      points: [
        { x: x - 16, y: 25 },
        { x, y: y - 54 },
        { x: x + 13, y: y + 56 },
        { x: x + 5, y: 622 },
      ],
    });
  }
  const bank = (side: number) =>
    Array.from({ length: 27 }, (_, i) => ({
      x: i * 40 - 20,
      y: riverY(i * 40 - 20) + side * (riverHalfWidth(i * 40 - 20) + 10),
    }));
  roads.push(
    { hierarchy: 'secondary', points: bank(-1) },
    { hierarchy: 'secondary', points: bank(1) },
  );
  roads.push(
    {
      hierarchy: 'primary',
      points: [
        { x: 36, y: 36 },
        { x: 429, y: 25 },
        { x: 570, y: 38 },
        { x: 960, y: 36 },
      ],
    },
    {
      hierarchy: 'secondary',
      points: [
        { x: 36, y: 610 },
        { x: 430, y: 606 },
        { x: 535, y: 637 },
        { x: 940, y: 638 },
      ],
    },
  );
  return { districts, parcels, roads, key: layoutKey(s) };
}
