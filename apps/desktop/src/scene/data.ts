import type { CityState } from '../../../../packages/domain/src/index';
import { transform, type CityLayout, type Parcel, type Point } from './layout';

export type MapSelection = { kind: 'citizen' | 'company' | 'household' | 'district'; id: string };
export interface BuildingVisual {
  parcel: Parcel;
  occupied: number;
  units: number;
  stressed: boolean;
  active: boolean;
  companyId?: string;
  householdIds: string[];
  label: string;
}
export interface ResidentVisual extends Point {
  id: string;
  householdId: string;
  buildingId: string;
  employed: boolean;
  label: string;
}
export interface SceneData {
  buildings: BuildingVisual[];
  residents: ResidentVisual[];
  unlocated: number;
  districts: Map<
    string,
    { population: number; companies: number; occupied: number; units: number }
  >;
}
export function projectSceneData(s: CityState, layout: CityLayout): SceneData {
  const buildings = new Map(s.buildings.map((b) => [b.id, b]));
  const units = new Map(s.units.map((u) => [u.id, u]));
  const households = new Map(s.households.map((h) => [h.id, h]));
  const companies = new Map(s.companies.map((c) => [c.id, c]));
  const parcels = new Map(layout.parcels.map((p) => [p.id, p]));
  const districts: SceneData['districts'] = new Map(
    s.districts.map((d) => [d.id, { population: 0, companies: 0, occupied: 0, units: 0 }]),
  );
  for (const unit of s.units) {
    const count = districts.get(unit.districtId)!;
    count.units++;
    if (unit.occupantHouseholdId) count.occupied++;
  }
  for (const firm of s.companies)
    if (firm.status === 'active') districts.get(firm.districtId)!.companies++;
  const residentGroups = new Map<string, typeof s.citizens>();
  let unlocated = 0;
  for (const citizen of s.citizens) {
    if (citizen.lifecycleStatus !== 'alive') continue;
    const unit = citizen.residenceId ? units.get(citizen.residenceId) : undefined;
    if (!unit || !parcels.has(unit.buildingId)) {
      unlocated++;
      continue;
    }
    districts.get(unit.districtId)!.population++;
    const list = residentGroups.get(unit.buildingId) ?? [];
    list.push(citizen);
    residentGroups.set(unit.buildingId, list);
  }
  const residents: ResidentVisual[] = [];
  const visualBuildings = layout.parcels.map((parcel): BuildingVisual => {
    const building = buildings.get(parcel.id)!;
    const localUnits = building.unitIds.map((id) => units.get(id)!).filter(Boolean);
    const occupied = localUnits.filter((u) => !!u.occupantHouseholdId);
    const householdIds = occupied.map((u) => u.occupantHouseholdId!);
    const firm = building.type === 'commercial' ? companies.get(building.ownerId) : undefined;
    const citizens = residentGroups.get(building.id) ?? [];
    citizens.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
    const columns = Math.max(1, Math.ceil(Math.sqrt(citizens.length * 1.6)));
    citizens.forEach((citizen, index) => {
      const rows = Math.ceil(citizens.length / columns);
      const point = transform(
        {
          x: (((index % columns) + 0.5) / columns - 0.5) * parcel.width * 0.8,
          y: ((Math.floor(index / columns) + 0.5) / rows - 0.5) * parcel.height * 0.65,
        },
        parcel,
        parcel.rotation,
      );
      residents.push({
        ...point,
        id: citizen.id,
        householdId: citizen.householdId,
        buildingId: building.id,
        employed: citizen.employmentStatus === 'employed',
        label: `${citizen.name} · ${citizen.id} · ${citizen.employmentStatus === 'employed' ? '在職' : '其他居民'}（住所）`,
      });
    });
    return {
      parcel,
      occupied: occupied.length,
      units: localUnits.length,
      householdIds,
      stressed: householdIds.some((id) => {
        const h = households.get(id);
        return h && (h.debt > 0 || h.socioeconomicStatus !== 'secure');
      }),
      active: firm?.status === 'active',
      companyId: firm?.id,
      label: firm
        ? `${firm.name} · ${firm.id} · ${firm.status === 'active' ? `${firm.employeeIds.length} 位員工` : '已破產'}`
        : `${building.id} · ${occupied.length}/${localUnits.length} 戶入住`,
    };
  });
  return { buildings: visualBuildings, residents, districts, unlocated };
}
export function selectedParcels(data: SceneData, selected?: MapSelection): Parcel[] {
  if (!selected || selected.kind === 'district') return [];
  const resident =
    selected.kind === 'citizen' ? data.residents.find((r) => r.id === selected.id) : undefined;
  return data.buildings
    .filter((b) =>
      selected.kind === 'company'
        ? b.companyId === selected.id
        : selected.kind === 'household'
          ? b.householdIds.includes(selected.id)
          : b.parcel.id === resident?.buildingId,
    )
    .map((b) => b.parcel);
}
export function affectedParcels(data: SceneData, refs: MapSelection[]): Parcel[] {
  const byRef = new Map<string, Parcel>(),
    byBuilding = new Map(data.buildings.map((b) => [b.parcel.id, b.parcel]));
  for (const b of data.buildings) {
    if (b.companyId) byRef.set(`company:${b.companyId}`, b.parcel);
    for (const id of b.householdIds) byRef.set(`household:${id}`, b.parcel);
  }
  for (const r of data.residents) {
    const p = byBuilding.get(r.buildingId);
    if (p) byRef.set(`citizen:${r.id}`, p);
  }
  const result = new Map<string, Parcel>();
  for (const ref of refs) {
    const p = byRef.get(`${ref.kind}:${ref.id}`);
    if (p) result.set(p.id, p);
  }
  return [...result.values()];
}
