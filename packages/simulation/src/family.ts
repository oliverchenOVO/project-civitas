import { age, type Citizen, type CityState } from '../../domain/src/index';
import { citizenById, householdById } from './lookups';
import { randomInt } from './random';
import { emit, id } from './events';
import { emptyMobility, deriveClass } from './human-capital';

// A bounded household-formation mechanism, not a romance simulation. Birth hazard is unchanged.
export function familyFormationSystem(s: CityState) {
  if (s.day % 365 !== 0) return;
  const single = (c: Citizen) =>
    c.lifecycleStatus === 'alive' &&
    age(s, c) >= 20 &&
    age(s, c) <= 40 &&
    (!c.spouseId || citizenById(s, c.spouseId).lifecycleStatus !== 'alive');
  const women = s.citizens.filter((c) => single(c) && c.sex === 'F');
  const men = s.citizens.filter((c) => single(c) && c.sex === 'M');
  const related = (a: Citizen, b: Citizen) =>
    a.parents.includes(b.id) ||
    b.parents.includes(a.id) ||
    a.parents.some((id) => b.parents.includes(id));
  for (const a of women) {
    if (randomInt(s.rng, 'family', s.config.seed, 1, 100) > 30) continue;
    const b = men.find((c) => single(c) && Math.abs(age(s, a) - age(s, c)) <= 12 && !related(a, c));
    if (!b) continue;
    const unit = s.units
      .filter((u) => !u.occupantHouseholdId && u.capacity >= 2)
      .sort((a, b) => a.rent - b.rent || (a.id < b.id ? -1 : 1))[0];
    if (!unit) break;
    const sources = [householdById(s, a.householdId), householdById(s, b.householdId)];
    const resources = sources.reduce(
      (n, h) => n + Math.floor(h.cash / Math.max(1, h.memberIds.length)),
      0,
    );
    if (a.salary + b.salary < unit.rent * 2 && resources < 200000) continue;
    const h = {
      id: id(s, 'household'),
      memberIds: [a.id, b.id],
      residenceId: unit.id,
      cash: 0,
      debt: 0,
      income: 0,
      expenses: 0,
      housingCost: unit.rent,
      socioeconomicStatus: 'secure' as const,
      mobility: emptyMobility(s.day),
    };
    for (const c of [a, b]) {
      const old = householdById(s, c.householdId),
        divisor = old.memberIds.length;
      const cash = Math.floor(old.cash / divisor),
        debt = Math.floor(old.debt / divisor);
      old.cash -= cash;
      old.debt -= debt;
      h.cash += cash;
      h.debt += debt;
      old.memberIds = old.memberIds.filter((id) => id !== c.id);
      if (!old.memberIds.length && old.residenceId) {
        s.units.find((u) => u.id === old.residenceId)!.occupantHouseholdId = undefined;
        old.residenceId = undefined;
        old.housingCost = 0;
      }
      if (c.spouseId) citizenById(s, c.spouseId).spouseId = undefined;
      c.householdId = h.id;
      c.residenceId = unit.id;
    }
    a.spouseId = b.id;
    b.spouseId = a.id;
    unit.occupantHouseholdId = h.id;
    s.households.push(h);
    h.mobility.monthlyIncome = a.salary + b.salary;
    h.mobility.class = deriveClass(h);
    h.mobility.annualClass = h.mobility.class;
    s.relationships.push({
      id: id(s, 'relationship'),
      citizenA: a.id,
      citizenB: b.id,
      relationshipType: 'spouse',
      familiarity: 60,
      affection: 60,
      trust: 60,
      conflict: 0,
      sinceDay: s.day,
    });
    emit(
      s,
      'HOUSEHOLD_FORMED',
      [
        { kind: 'household', id: h.id },
        { kind: 'citizen', id: a.id },
        { kind: 'citizen', id: b.id },
        { kind: 'unit', id: unit.id },
      ],
      {
        reason: 'eligible unrelated adults formed a funded household',
        cash: h.cash,
        debt: h.debt,
        rent: unit.rent,
      },
    );
  }
}
