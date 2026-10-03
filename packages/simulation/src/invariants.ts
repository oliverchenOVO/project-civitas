import {
  age,
  CLASS_BANDS,
  EDUCATION_LEVELS,
  OCCUPATIONS,
  type Occupation,
  type CityState,
} from '../../domain/src/index';
import { qualification, educationRank } from '../../domain/src/occupations';
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
    const hc = c.humanCapital;
    fail(EDUCATION_LEVELS.includes(hc.education), `Education enum ${c.id}`);
    fail(
      Object.values(hc.skills).every((x) => Number.isInteger(x) && x >= 0 && x <= 100),
      `Skill bounds ${c.id}`,
    );
    fail(
      hc.availableFromDay <= s.day &&
        hc.origin.day <= s.day &&
        households.has(hc.origin.householdId),
      `Human-capital boundary/origin ${c.id}`,
    );
    fail(hc.education !== 'tertiary' || age(s, c) >= 22, `Child/young tertiary completion ${c.id}`);
    fail(hc.education !== 'vocational' || age(s, c) >= 20, `Young vocational completion ${c.id}`);
    fail(hc.education !== 'secondary' || age(s, c) >= 18, `Young secondary completion ${c.id}`);
    fail(
      !hc.secondaryDay || (hc.secondaryDay >= hc.availableFromDay && hc.secondaryDay <= s.day),
      `Secondary chronology ${c.id}`,
    );
    for (const day of [hc.vocationalDay, hc.tertiaryDay])
      if (day !== undefined) {
        fail(day <= s.day && day >= hc.availableFromDay, `Education chronology ${c.id}`);
        fail(
          hc.provenance !== 'birth' || (hc.secondaryDay !== undefined && hc.secondaryDay <= day),
          `Missing earlier secondary completion ${c.id}`,
        );
      }
    if (hc.adultComparison) {
      fail(
        age(s, c) >= 25 && hc.origin.childhoodObserved && hc.adultComparison.day <= s.day,
        `Mobility cohort boundary ${c.id}`,
      );
      const delta =
        CLASS_BANDS.indexOf(hc.adultComparison.current) -
        CLASS_BANDS.indexOf(hc.adultComparison.origin);
      fail(
        hc.adultComparison.direction === (delta > 0 ? 'up' : delta < 0 ? 'down' : 'stable'),
        `Mobility direction ${c.id}`,
      );
    }
    const h = households.get(c.householdId);
    fail(h, `Missing household for ${c.id}`);
    if (c.lifecycleStatus === 'alive') {
      fail(h?.memberIds.includes(c.id), `Household membership mismatch ${c.id}`);
      fail(c.residenceId === h?.residenceId, `Residence mismatch ${c.id}`);
    }
    if (c.employmentStatus === 'employed') {
      fail(
        OCCUPATIONS.includes(c.occupation as Occupation) &&
          qualification(c, c.occupation as Occupation).eligible,
        `Employment qualification ${c.id}`,
      );
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
    fail(
      CLASS_BANDS.includes(h.mobility.class) && CLASS_BANDS.includes(h.mobility.annualClass),
      `Class band ${h.id}`,
    );
    fail(h.mobility.annualDay <= s.day, `Mobility time ${h.id}`);
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
    fail(
      OCCUPATIONS.every(
        (k) => Number.isInteger(f.occupationDemand[k]) && f.occupationDemand[k] >= 0,
      ),
      `Occupation demand ${f.id}`,
    );
    fail(f.skillProductivity >= 9000 && f.skillProductivity <= 12000, `Productivity bound ${f.id}`);
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
    if (e.type === 'CLASS_MOVED_UP' || e.type === 'CLASS_MOVED_DOWN') {
      const from = CLASS_BANDS.indexOf(e.payload.from as (typeof CLASS_BANDS)[number]),
        to = CLASS_BANDS.indexOf(e.payload.to as (typeof CLASS_BANDS)[number]);
      fail(
        from >= 0 &&
          to >= 0 &&
          (e.type === 'CLASS_MOVED_UP' ? to > from : to < from) &&
          e.entityRefs.some((r) => r.kind === 'household'),
        `Class event consistency ${e.id}`,
      );
    }
    if (['EDUCATION_COMPLETED', 'VOCATIONAL_COMPLETED', 'TERTIARY_COMPLETED'].includes(e.type)) {
      const c = citizens.get(e.entityRefs.find((r) => r.kind === 'citizen')?.id ?? '');
      const rank = EDUCATION_LEVELS.indexOf(e.payload.level as (typeof EDUCATION_LEVELS)[number]);
      fail(
        c && rank >= 0 && educationRank(c.humanCapital.education) >= rank,
        `Education event consistency ${e.id}`,
      );
    }
    fail(e.tick >= previousTick && e.tick <= s.day, `Event tick ${e.id}`);
    previousTick = e.tick;
    for (const ref of e.entityRefs) fail(maps[ref.kind].has(ref.id), `Event reference ${e.id}`);
    for (const cause of e.causeEventIds) fail(eventIds.has(cause), `Future/missing cause ${e.id}`);
    eventIds.add(e.id);
  }
  for (const c of s.citizens)
    for (const eventId of [
      ...Object.values(c.humanCapital.educationQualifications ?? {}),
      c.humanCapital.educationEventId,
      c.humanCapital.qualificationEventId,
      c.humanCapital.lossEventId,
      c.humanCapital.salaryEventId,
    ])
      if (eventId) fail(eventIds.has(eventId), `Missing human-capital evidence ${c.id}`);
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
