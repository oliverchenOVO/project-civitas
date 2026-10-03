import { describe, expect, it } from 'vitest';
import { advance, applyCommand, createCity } from '../../packages/simulation/src/index';
import { loadCity, replayCity, saveCity } from '../../packages/simulation/src/persistence';
import { canonical } from '../../packages/shared/src/canonical';
import {
  corners,
  createCityLayout,
  riverHalfWidth,
  riverY,
} from '../../apps/desktop/src/scene/layout';
import { projectSceneData, selectedParcels } from '../../apps/desktop/src/scene/data';

describe('presentation scene isolation and truth', () => {
  it('recreates identical layout through save/load/replay without touching state or RNG', async () => {
    const city = createCity({ seed: 'SCENE-REPLAY', population: 250 });
    applyCommand(city, { type: 'BUILD_HOUSING', districtId: 'district-1', units: 5 });
    advance(city, 60);
    const before = canonical(city);
    const layout = createCityLayout(city);
    projectSceneData(city, layout);
    expect(canonical(city)).toBe(before);
    const loaded = await loadCity(await saveCity(city));
    expect(createCityLayout(loaded)).toEqual(layout);
    const replay = replayCity(city);
    expect(canonical(replay)).toBe(before);
    expect(createCityLayout(replay)).toEqual(layout);
  });
  it.each([100, 250, 500, 1000])(
    'maps all %i-population buildings and housed alive residents exactly once, on land',
    (population) => {
      const city = createCity({ seed: 'SCENE-DENSITY', population });
      const layout = createCityLayout(city),
        data = projectSceneData(city, layout);
      expect(new Set(layout.parcels.map((p) => p.id))).toEqual(
        new Set(city.buildings.map((b) => b.id)),
      );
      expect(layout.parcels.length).toBe(city.buildings.length);
      expect(new Set(layout.parcels.map((p) => `${p.x}:${p.y}`)).size).toBe(layout.parcels.length);
      expect(new Set(data.residents.map((c) => c.id))).toEqual(
        new Set(
          city.citizens
            .filter((c) => c.lifecycleStatus === 'alive' && c.residenceId)
            .map((c) => c.id),
        ),
      );
      expect(data.residents.length + data.unlocated).toBe(city.metrics.population);
      expect([...data.districts.values()].reduce((sum, d) => sum + d.population, 0)).toBe(
        data.residents.length,
      );
      for (const parcel of layout.parcels)
        for (const p of corners(parcel)) {
          expect(p.x).toBeGreaterThan(0);
          expect(p.x).toBeLessThan(1000);
          expect(p.y).toBeGreaterThan(0);
          expect(p.y).toBeLessThan(650);
          expect(Math.abs(p.y - riverY(p.x))).toBeGreaterThan(riverHalfWidth(p.x));
        }
      expect(layout.districts.map((d) => d.character).sort()).toEqual([
        'historic',
        'industrial',
        'residential',
        'waterfront',
      ]);
      expect(layout.districts.every((d) => d.anchors.length >= 2)).toBe(true);
      expect(layout.roads.filter((r) => r.hierarchy === 'primary').length).toBeGreaterThanOrEqual(
        4,
      );
    },
  );
  it('retains existing parcel centers when housing is built, including crowded plots', () => {
    const city = createCity({ seed: 'SCENE-GROWTH', population: 100 });
    const original = createCityLayout(city);
    city.government.cash = 50 * 800000;
    applyCommand(city, { type: 'BUILD_HOUSING', districtId: 'district-1', units: 50 });
    const updated = createCityLayout(city);
    for (const parcel of original.parcels) {
      const next = updated.parcels.find((p) => p.id === parcel.id)!;
      expect([next.x, next.y]).toEqual([parcel.x, parcel.y]);
    }
    expect(updated.parcels.length).toBe(original.parcels.length + 50);
    expect(new Set(updated.parcels.map((p) => `${p.x}:${p.y}`)).size).toBe(updated.parcels.length);
  });
  it('encodes real vacancies, stressed households, employment and bankrupt companies', () => {
    const city = createCity({ seed: 'SCENE-STATES', population: 100 });
    const household = city.households[0];
    household.debt = 100;
    const citizen = city.citizens.find((c) => c.householdId === household.id)!;
    citizen.employmentStatus = 'unemployed';
    const firm = city.companies[0];
    firm.status = 'bankrupt';
    const layout = createCityLayout(city),
      data = projectSceneData(city, layout);
    expect(data.buildings.find((b) => b.householdIds.includes(household.id))?.stressed).toBe(true);
    expect(data.buildings.find((b) => b.companyId === firm.id)?.active).toBe(false);
    expect(data.residents.find((r) => r.id === citizen.id)?.employed).toBe(false);
    expect(data.buildings.some((b) => b.units > 0 && b.occupied === 0)).toBe(true);
    expect(selectedParcels(data, { kind: 'citizen', id: citizen.id })).toEqual(
      selectedParcels(data, { kind: 'household', id: household.id }),
    );
    expect(selectedParcels(data, { kind: 'company', id: firm.id })).toHaveLength(1);
    expect(selectedParcels(data, { kind: 'citizen', id: 'missing' })).toHaveLength(0);
    citizen.lifecycleStatus = 'dead';
    expect(projectSceneData(city, layout).residents.some((r) => r.id === citizen.id)).toBe(false);
  });
  it('never fabricates a residence for an unlocated resident', () => {
    const city = createCity({ seed: 'SCENE-UNLOCATED', population: 100 });
    const citizen = city.citizens[0];
    citizen.residenceId = undefined;
    const data = projectSceneData(city, createCityLayout(city));
    expect(data.residents.some((r) => r.id === citizen.id)).toBe(false);
    expect(data.unlocated).toBe(1);
  });
});
