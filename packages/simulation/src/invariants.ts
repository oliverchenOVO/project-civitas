import { age, type CityState } from '../../domain/src/index';
import { totalMoney } from './world';
export function checkInvariants(s: CityState): string[] {
  const errors: string[] = [];
  const fail = (condition: unknown, message: string) => {
    if (!condition) errors.push(message);
  };
  const citizens = new Map(s.citizens.map((c) => [c.id, c]));
  const households = new Map(s.households.map((h) => [h.id, h]));
  const companies = new Map(s.companies.map((f) => [f.id, f]));
  const units = new Map(s.units.map((u) => [u.id, u]));
  const buildings = new Map(s.buildings.map((b) => [b.id, b]));
  const districts = new Set(s.districts.map((d) => d.id));
  const collections = [
    s.citizens,
    s.households,
    s.companies,
    s.units,
    s.buildings,
    s.districts,
    s.relationships,
    s.events,
    s.commands,
  ];
  const allIds = collections.flatMap((rows) => rows.map((x) => x.id));
  fail(new Set(allIds).size === allIds.length, 'Duplicate entity/event/command IDs');
  fail(
    allIds
      .filter((x) => !x.startsWith('district-'))
      .every((x) => Number(x.split('-').at(-1)) < s.nextId),
    'ID counter behind existing entities',
  );
  let commandDay = 0;
  for (const c of s.commands) {
    fail(c.day >= commandDay && c.day <= s.day, 'Invalid command chronology');
    commandDay = c.day;
  }
  for (const c of s.citizens) {
    const h = households.get(c.householdId);
    fail(h, `Missing household for ${c.id}`);
    if (c.lifecycleStatus === 'alive') {
      fail(h?.memberIds.includes(c.id), `Household membership mismatch ${c.id}`);
      fail(c.residenceId === h?.residenceId, `Residence mismatch ${c.id}`);
    }
    if (c.employmentStatus === 'employed') {
      const f = companies.get(c.employerId ?? '');
      fail(f?.status === 'active' && f.employeeIds.includes(c.id), `Employer mismatch ${c.id}`);
      fail(
        c.lifecycleStatus === 'alive' && age(s, c) >= 18 && age(s, c) < 65,
        `Impossible employment ${c.id}`,
      );
    } else fail(!c.employerId, `Nonworker employer ${c.id}`);
    for (const pid of c.parents) {
      fail(citizens.get(pid)?.children.includes(c.id), `Parent link ${c.id}`);
      const parent = citizens.get(pid);
      fail(parent && c.birthDay - parent.birthDay >= 18 * 365, `Invalid parent age ${c.id}`);
    }
    for (const cid of c.children)
      fail(citizens.get(cid)?.parents.includes(c.id), `Child link ${c.id}`);
    if (c.spouseId) fail(citizens.get(c.spouseId)?.spouseId === c.id, `Spouse link ${c.id}`);
  }
  for (const h of s.households) {
    fail(new Set(h.memberIds).size === h.memberIds.length, `Duplicate household member ${h.id}`);
    for (const cid of h.memberIds)
      fail(
        citizens.get(cid)?.householdId === h.id && citizens.get(cid)?.lifecycleStatus === 'alive',
        `Member mismatch ${h.id}`,
      );
    if (h.residenceId)
      fail(units.get(h.residenceId)?.occupantHouseholdId === h.id, `Housing mismatch ${h.id}`);
  }
  for (const f of s.companies) {
    fail(districts.has(f.districtId), `Firm district ${f.id}`);
    fail(new Set(f.employeeIds).size === f.employeeIds.length, `Duplicate employee ${f.id}`);
    for (const cid of f.employeeIds)
      fail(
        citizens.get(cid)?.employerId === f.id &&
          citizens.get(cid)?.employmentStatus === 'employed',
        `Employee mismatch ${f.id}`,
      );
    if (f.status === 'bankrupt')
      fail(
        f.employeeIds.length === 0 && f.openPositions === 0,
        `Bankrupt firm employs workers ${f.id}`,
      );
  }
  for (const u of s.units) {
    fail(
      buildings.get(u.buildingId)?.unitIds.includes(u.id) && districts.has(u.districtId),
      `Building mismatch ${u.id}`,
    );
    if (u.occupantHouseholdId) {
      const h = households.get(u.occupantHouseholdId);
      fail(h?.residenceId === u.id, `Occupancy mismatch ${u.id}`);
      fail(h && h.memberIds.length <= u.capacity, `Overcrowding ${u.id}`);
    }
  }
  for (const b of s.buildings) {
    fail(districts.has(b.districtId), `Building district ${b.id}`);
    fail(b.ownerId === 'government' || companies.has(b.ownerId), `Building owner ${b.id}`);
  }
  for (const edge of s.relationships)
    fail(
      citizens.has(edge.citizenA) && citizens.has(edge.citizenB) && edge.citizenA !== edge.citizenB,
      `Relationship mismatch ${edge.id}`,
    );
  const eventIds = new Set<string>();
  const maps = {
    citizen: citizens,
    household: households,
    company: companies,
    unit: units,
    district: districts,
  };
  let previousTick = 0;
  for (const e of s.events) {
    fail(e.tick >= previousTick && e.tick <= s.day, `Event tick ${e.id}`);
    previousTick = e.tick;
    for (const ref of e.entityRefs) fail(maps[ref.kind].has(ref.id), `Event reference ${e.id}`);
    for (const cause of e.causeEventIds) fail(eventIds.has(cause), `Future/missing cause ${e.id}`);
    eventIds.add(e.id);
  }
  // All canonical numerical fields (including payload and RNG) must be safe integers.
  function numbers(value: unknown, path: string) {
    if (typeof value === 'number')
      fail(Number.isSafeInteger(value), `Unsafe/non-integer number ${path}`);
    else if (Array.isArray(value)) value.forEach((v, i) => numbers(v, `${path}[${i}]`));
    else if (value && typeof value === 'object')
      for (const [k, v] of Object.entries(value)) numbers(v, `${path}.${k}`);
  }
  numbers(s, 'state');
  for (const c of [...s.citizens, ...s.households, ...s.companies])
    fail(c.cash >= 0, `Negative cash ${c.id}`);
  fail(s.government.cash >= 0, 'Negative treasury');
  fail(
    totalMoney(s) ===
      s.economy.openingMoney + s.economy.exports + s.economy.financing - s.economy.imports,
    'Cash flow conservation violated',
  );
  return errors;
}
export function assertInvariants(s: CityState) {
  const errors = checkInvariants(s);
  if (errors.length) throw new Error(errors.slice(0, 20).join('\n'));
}
