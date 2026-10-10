import { expect, it } from 'vitest';
import { cameraOffset, buildingHeight, roofHeight } from '../../apps/desktop/src/scene/spatial';
import { createCityLayout } from '../../apps/desktop/src/scene/layout';
import { createCity } from '../../packages/simulation/src/index';
import { canonical } from '../../packages/shared/src/canonical';

it('camera reaches horizontal and vertical endpoints with finite positions across a full orbit', () => {
  for (const elevation of [0, 15, 45, 75, 90])
    for (const azimuth of [-180, -90, 0, 90, 180]) {
      const p = cameraOffset(elevation, azimuth, 500);
      expect(Math.hypot(p.x, p.y, p.z)).toBeCloseTo(500);
      expect((Math.atan2(p.y, Math.hypot(p.x, p.z)) * 180) / Math.PI).toBeCloseTo(elevation);
    }
  expect(cameraOffset(-10, 0, 500).y).toBe(0);
  expect(cameraOffset(100, 0, 500).y).toBe(500);
});
it('3D massing remains deterministic and never advances simulation truth or RNG', () => {
  const city = createCity({ seed: '3D-ISOLATION', population: 1000 });
  const before = canonical(city),
    layout = createCityLayout(city);
  const heights = layout.parcels.map((p) => buildingHeight(city.config.seed, p) + roofHeight(p));
  expect(heights.every((h) => Number.isFinite(h) && h > 0)).toBe(true);
  expect(
    createCityLayout(city).parcels.map((p) => buildingHeight(city.config.seed, p) + roofHeight(p)),
  ).toEqual(heights);
  expect(canonical(city)).toBe(before);
});
