import type { CityState } from '../../domain/src/index';
// Ephemeral indexes are not simulation truth and are deliberately excluded from saves/hashes.
// Entities are retained historically; membership updates mutate the indexed object itself.
const cache = new WeakMap<
  CityState,
  {
    size: number;
    citizens: Map<string, CityState['citizens'][number]>;
    households: Map<string, CityState['households'][number]>;
    companies: Map<string, CityState['companies'][number]>;
    units: Map<string, CityState['units'][number]>;
  }
>();
function indexes(s: CityState) {
  const size = s.citizens.length + s.households.length + s.companies.length + s.units.length;
  let entry = cache.get(s);
  if (!entry || entry.size !== size) {
    entry = {
      size,
      citizens: new Map(s.citizens.map((c) => [c.id, c])),
      households: new Map(s.households.map((h) => [h.id, h])),
      companies: new Map(s.companies.map((f) => [f.id, f])),
      units: new Map(s.units.map((u) => [u.id, u])),
    };
    cache.set(s, entry);
  }
  return entry;
}
export const citizenById = (s: CityState, id: string) => indexes(s).citizens.get(id)!;
export const householdById = (s: CityState, id: string) => indexes(s).households.get(id)!;
export const companyById = (s: CityState, id: string | undefined) =>
  id ? indexes(s).companies.get(id) : undefined;
export const unitById = (s: CityState, id: string | undefined) =>
  id ? indexes(s).units.get(id) : undefined;
