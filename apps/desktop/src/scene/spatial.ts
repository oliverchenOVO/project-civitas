import { visualHash, type Parcel } from './layout';

// Height is visual modelling only; it never allocates simulated floors or residents.
export function buildingHeight(seed: string, p: Parcel): number {
  const n = visualHash(`${seed}:${p.id}:height`);
  return p.type === 'commercial' ? 14 + (n % 32) : 9 + (n % 18);
}
export function cameraOffset(elevation: number, azimuth: number, distance: number) {
  const angle = (Math.max(0, Math.min(90, elevation)) * Math.PI) / 180;
  const heading = (azimuth * Math.PI) / 180;
  return {
    x: Math.sin(heading) * Math.cos(angle) * distance,
    y: Math.sin(angle) * distance,
    z: Math.cos(heading) * Math.cos(angle) * distance,
  };
}
