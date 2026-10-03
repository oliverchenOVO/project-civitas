import { citizenById, householdById, companyById, unitById } from './lookups';
import { age, type Citizen, type CityState, type Company } from '../../domain/src/index';
import { emit, id, latestCause } from './events';
import { createCitizen, createCompany, roll } from './world';
export const taxOn = (amount: number, basisPoints: number) =>
  Math.floor((amount * basisPoints) / 10000);
export const dailyWage = (monthly: number, day: number) =>
  Math.floor(monthly / 30) + (day % 30 < monthly % 30 ? 1 : 0);
export function releaseJob(
  s: CityState,
  c: Citizen,
  type: 'CITIZEN_FIRED' | 'CITIZEN_QUIT',
  causes: string[] = [],
) {
  const firm = companyById(s, c.employerId);
  if (!firm) return;
  firm.employeeIds = firm.employeeIds.filter((cid) => cid !== c.id);
  const salary = c.salary;
  c.employerId = undefined;
  c.occupation = undefined;
  c.salary = 0;
  c.employmentStatus = age(s, c) >= 65 ? 'retired' : 'unemployed';
  const event = emit(
    s,
    type,
    [
      { kind: 'citizen', id: c.id },
      { kind: 'company', id: firm.id },
      { kind: 'household', id: c.householdId },
    ],
    { name: c.name, company: firm.name, salary },
    causes,
  );
  emit(
    s,
    'HOUSEHOLD_INCOME_DROP',
    [
      { kind: 'household', id: c.householdId },
      { kind: 'citizen', id: c.id },
    ],
    { monthlyLoss: salary },
    [event.id],
  );
}
export function calendarSystem(s: CityState) {
  s.day++;
}
export function demographySystem(s: CityState) {
  for (const c of [...s.citizens]) {
    if (c.lifecycleStatus !== 'alive') continue;
    const a = age(s, c);
    if (c.employmentStatus === 'child' && a >= 18) {
      c.employmentStatus = 'unemployed';
      emit(s, 'WORKFORCE_ENTERED', [{ kind: 'citizen', id: c.id }], { name: c.name });
    }
    if (c.employmentStatus === 'employed' && a >= 65) {
      releaseJob(s, c, 'CITIZEN_QUIT');
      c.employmentStatus = 'retired';
      emit(s, 'CITIZEN_RETIRED', [{ kind: 'citizen', id: c.id }], { name: c.name });
    }
    if (s.day % 30 === 0 && roll(s, 'population', 1, 100000) < (a > 70 ? (a - 69) * 45 : 5)) {
      const death = emit(
        s,
        'CITIZEN_DIED',
        [
          { kind: 'citizen', id: c.id },
          { kind: 'household', id: c.householdId },
        ],
        { name: c.name, age: a },
      );
      releaseJob(s, c, 'CITIZEN_QUIT', [death.id]);
      c.lifecycleStatus = 'dead';
      c.deathDay = s.day;
      const h = householdById(s, c.householdId);
      h.cash += c.cash;
      c.cash = 0;
      h.memberIds = h.memberIds.filter((cid) => cid !== c.id);
    }
  }
  if (s.day % 90 === 0 && s.citizens.filter((c) => c.lifecycleStatus === 'alive').length < 1500) {
    const mothers = s.citizens.filter(
      (c) =>
        c.lifecycleStatus === 'alive' &&
        c.sex === 'F' &&
        c.spouseId &&
        age(s, c) >= 22 &&
        age(s, c) <= 39 &&
        c.children.length < 3,
    );
    for (const m of mothers) {
      const h = householdById(s, m.householdId);
      const u = unitById(s, h.residenceId);
      if (
        !u ||
        citizenById(s, m.spouseId!).lifecycleStatus !== 'alive' ||
        h.memberIds.length >= u.capacity ||
        h.cash < 100000 ||
        roll(s, 'population', 1, 1000) > 12
      )
        continue;
      const c = createCitizen(s, h.id, s.day);
      c.cash = 0;
      c.parents = [m.id, m.spouseId!];
      c.residenceId = h.residenceId;
      h.memberIds.push(c.id);
      for (const pid of c.parents) {
        const p = citizenById(s, pid);
        p.children.push(c.id);
        s.relationships.push({
          id: id(s, 'relationship'),
          citizenA: pid,
          citizenB: c.id,
          relationshipType: 'family',
          familiarity: 100,
          affection: 90,
          trust: 90,
          conflict: 0,
          sinceDay: s.day,
        });
      }
      emit(
        s,
        'CITIZEN_BORN',
        [
          { kind: 'citizen', id: c.id },
          ...c.parents.map((pid) => ({ kind: 'citizen' as const, id: pid })),
          { kind: 'household', id: h.id },
        ],
        { name: c.name },
      );
    }
  }
}
export function householdSystem(s: CityState) {
  for (const h of s.households) {
    h.income = 0;
    h.expenses = 0;
    if (h.memberIds.length === 0 && h.residenceId) {
      const u = unitById(s, h.residenceId)!;
      u.occupantHouseholdId = undefined;
      h.residenceId = undefined;
      h.housingCost = 0;
    }
  }
  for (const f of s.companies) {
    f.revenue = 0;
    f.payroll = 0;
    f.expenses = 0;
    f.tax = 0;
  }
  s.government.taxRevenue = 0;
  s.government.welfareSpending = 0;
}
export function employmentSystem(s: CityState) {
  if (s.day % 7 !== 1) return;
  for (const c of s.citizens) {
    if (c.lifecycleStatus !== 'alive' || c.employmentStatus !== 'unemployed') continue;
    const jobs = s.companies
      .filter((f) => f.status === 'active' && f.openPositions > 0 && f.cash > 100000)
      .sort((a, b) => b.productivity - a.productivity || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    const firm = jobs[0];
    if (!firm) break;
    c.employmentStatus = 'employed';
    c.employerId = firm.id;
    c.salary = Math.max(s.government.policies.minimumWage, 180000 + c.skills * 1200);
    c.occupation =
      firm.industry === 'Technology'
        ? 'Developer'
        : firm.industry === 'Manufacturing'
          ? 'Technician'
          : firm.industry === 'Food'
            ? 'Food worker'
            : 'Service specialist';
    firm.employeeIds.push(c.id);
    firm.openPositions--;
    emit(
      s,
      'CITIZEN_HIRED',
      [
        { kind: 'citizen', id: c.id },
        { kind: 'company', id: firm.id },
      ],
      { name: c.name, company: firm.name, salary: c.salary },
    );
  }
  if (s.day % 30 === 1)
    for (const c of s.citizens.filter((c) => c.employmentStatus === 'employed')) {
      const firm = companyById(s, c.employerId)!;
      if (
        firm.lossDays > 45 &&
        c.traits.ambition > 80 &&
        s.companies.some(
          (f) =>
            f.status === 'active' && f.openPositions > 0 && f.productivity > firm.productivity + 15,
        )
      )
        releaseJob(s, c, 'CITIZEN_QUIT');
    }
}
export function incomeSystem(s: CityState) {
  for (const firm of s.companies.filter((f) => f.status === 'active')) {
    for (const cid of firm.employeeIds) {
      const c = citizenById(s, cid);
      c.salary = Math.max(c.salary, s.government.policies.minimumWage);
      const wage = Math.min(firm.cash, dailyWage(c.salary, s.day));
      firm.cash -= wage;
      firm.payroll += wage;
      const h = householdById(s, c.householdId);
      h.cash += wage;
      h.income += wage;
      const tax = taxOn(wage, s.government.policies.incomeTax);
      h.cash -= tax;
      h.income -= tax;
      s.government.cash += tax;
      s.government.taxRevenue += tax;
    }
  }
}
export function governmentSystem(s: CityState) {
  for (const c of s.citizens.filter(
    (c) => c.lifecycleStatus === 'alive' && ['unemployed', 'retired'].includes(c.employmentStatus),
  )) {
    const payment = Math.min(
      Math.max(0, s.government.cash),
      dailyWage(s.government.policies.welfare, s.day),
    );
    const h = householdById(s, c.householdId);
    h.cash += payment;
    h.income += payment;
    s.government.cash -= payment;
    s.government.welfareSpending += payment;
  }
}
export function expenseSystem(s: CityState) {
  let domestic = 0;
  for (const h of s.households.filter((h) => h.memberIds.length > 0)) {
    const baseline = h.memberIds.reduce((n, cid) => {
      const c = citizenById(s, cid);
      return n + (age(s, c) < 18 ? 1600 : 2400);
    }, 0);
    const spending = Math.min(h.cash, baseline);
    h.cash -= spending;
    h.expenses += spending;
    domestic += spending;
    const rent = dailyWage(h.housingCost, s.day);
    const paid = Math.min(h.cash, rent);
    h.cash -= paid;
    h.expenses += paid;
    s.government.cash += paid;
    if (paid < rent) {
      const unpaid = rent - paid;
      h.debt += unpaid;
      if (s.day % 30 === 0)
        emit(
          s,
          'RENT_DEFAULT',
          [
            { kind: 'household', id: h.id },
            ...h.memberIds.map((cid) => ({ kind: 'citizen' as const, id: cid })),
          ],
          { unpaid, debt: h.debt },
          latestCause(s, h.id, ['HOUSEHOLD_INCOME_DROP']),
        );
    }
    h.socioeconomicStatus = h.cash < 30000 ? 'vulnerable' : h.cash < 150000 ? 'strained' : 'secure';
    for (const cid of h.memberIds) {
      const c = citizenById(s, cid);
      c.stress = Math.min(
        100,
        Math.max(
          0,
          Math.floor(h.debt / 15000) +
            (h.cash < 50000 ? 35 : 0) +
            (c.employmentStatus === 'unemployed' ? 25 : 0),
        ),
      );
      c.happiness = Math.max(0, Math.min(100, 85 - c.stress + (h.residenceId ? 0 : -30)));
    }
  }
  const firms = s.companies.filter((f) => f.status === 'active');
  const weights = firms.map((f) => f.employeeIds.length * f.productivity);
  const total = weights.reduce((a, b) => a + b, 0);
  let assigned = 0;
  firms.forEach((f, i) => {
    const sales = total ? Math.floor((domestic * weights[i]) / total) : 0;
    f.cash += sales;
    f.revenue += sales;
    assigned += sales;
  });
  s.economy.imports += domestic - assigned;
}
export function companySystem(s: CityState) {
  for (const f of s.companies.filter((f) => f.status === 'active')) {
    if (s.day % 30 === 1)
      f.demand = Math.max(3000, Math.min(15000, f.demand + roll(s, 'company', -2500, 2200)));
    const capacity = f.employeeIds.reduce((n, cid) => {
      const c = citizenById(s, cid);
      return n + dailyWage(260000 + c.skills * 700, s.day);
    }, 0);
    const exportSales = Math.floor((capacity * f.productivity * f.demand * 85) / 100000000);
    f.cash += exportSales;
    f.revenue += exportSales;
    s.economy.exports += exportSales;
    const overhead = 800 + f.employeeIds.length * 450;
    const paid = Math.min(f.cash, overhead);
    f.cash -= paid;
    s.economy.imports += paid;
    f.expenses = f.payroll + paid;
    f.profit = f.revenue - f.expenses;
    f.tax = taxOn(Math.max(0, f.profit), s.government.policies.corporateTax);
    f.cash -= f.tax;
    s.government.cash += f.tax;
    s.government.taxRevenue += f.tax;
    f.lossDays = f.profit < 0 ? f.lossDays + 1 : Math.max(0, f.lossDays - 2);
    if (f.cash === 0 || (f.employeeIds.length === 0 && f.lossDays > 60)) {
      bankrupt(s, f);
      continue;
    }
    if (
      s.day % 30 === 0 &&
      f.lossDays >= 30 &&
      f.cash < f.payroll * 60 &&
      f.employeeIds.length > 0
    ) {
      const count = Math.max(1, Math.ceil(f.employeeIds.length * 0.2));
      const workers = f.employeeIds.slice(-count);
      const layoff = emit(
        s,
        'COMPANY_LAYOFF',
        [
          { kind: 'company', id: f.id },
          ...workers.map((cid) => ({ kind: 'citizen' as const, id: cid })),
        ],
        {
          name: f.name,
          workers: count,
          cash: f.cash,
          lossDays: f.lossDays,
          reason: 'persistent losses and insufficient payroll reserves',
        },
      );
      for (const cid of workers) releaseJob(s, citizenById(s, cid), 'CITIZEN_FIRED', [layoff.id]);
      f.targetWorkers = f.employeeIds.length;
    }
    if (s.day % 30 === 0) {
      if (f.profit > 0 && f.cash > f.payroll * 120)
        f.targetWorkers = Math.min(30, f.targetWorkers + 1);
      f.openPositions = f.lossDays > 15 ? 0 : Math.max(0, f.targetWorkers - f.employeeIds.length);
    }
  }
  if (
    s.day % 90 === 0 &&
    s.companies.filter((f) => f.status === 'active').length < Math.ceil(s.metrics.population / 10)
  ) {
    const founder = s.citizens.find(
      (c) =>
        c.lifecycleStatus === 'alive' &&
        c.employmentStatus === 'unemployed' &&
        c.traits.ambition >= 70,
    );
    if (founder) createCompany(s, founder);
  }
}
export function bankrupt(s: CityState, f: Company) {
  const workers = [...f.employeeIds];
  const e = emit(
    s,
    'COMPANY_BANKRUPT',
    [
      { kind: 'company', id: f.id },
      ...workers.map((cid) => ({ kind: 'citizen' as const, id: cid })),
    ],
    { name: f.name, workers: workers.length, reason: 'insolvency', cash: f.cash },
    latestCause(s, f.id, ['COMPANY_LAYOFF']),
  );
  for (const cid of workers) releaseJob(s, citizenById(s, cid), 'CITIZEN_FIRED', [e.id]);
  f.status = 'bankrupt';
  f.openPositions = 0;
}
export function housingSystem(s: CityState) {
  if (s.day % 30 !== 0) return;
  const aliveHouseholds = s.households.filter((h) => h.memberIds.length > 0);
  for (const d of s.districts) {
    const units = s.units.filter((u) => u.districtId === d.id);
    const occupancy = (units.filter((u) => u.occupantHouseholdId).length * 100) / units.length;
    for (const u of units) {
      const old = u.rent;
      const multiplier = occupancy > 92 ? 10100 : occupancy < 70 ? 9900 : 10000;
      u.rent = Math.max(15000, Math.min(200000, Math.floor((u.rent * multiplier) / 10000)));
      u.estimatedValue = u.rent * 240;
      if (old !== u.rent)
        emit(
          s,
          'RENT_CHANGED',
          [
            { kind: 'unit', id: u.id },
            { kind: 'district', id: d.id },
            ...(u.occupantHouseholdId
              ? [{ kind: 'household' as const, id: u.occupantHouseholdId }]
              : []),
          ],
          { oldRent: old, rent: u.rent, district: d.name },
        );
    }
  }
  for (const h of aliveHouseholds) {
    const current = unitById(s, h.residenceId);
    if (current) h.housingCost = current.rent;
    const affordable = s.units
      .filter(
        (u) =>
          !u.occupantHouseholdId &&
          u.capacity >= h.memberIds.length &&
          (!current || u.rent < current.rent * 0.8),
      )
      .sort((a, b) => a.rent - b.rent || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))[0];
    if (affordable && (!current || h.income * 30 < current.rent * 2 || h.debt > current.rent * 2)) {
      if (current) current.occupantHouseholdId = undefined;
      affordable.occupantHouseholdId = h.id;
      h.residenceId = affordable.id;
      h.housingCost = affordable.rent;
      for (const cid of h.memberIds) citizenById(s, cid).residenceId = affordable.id;
      emit(
        s,
        'HOUSEHOLD_MOVED',
        [
          { kind: 'household', id: h.id },
          { kind: 'unit', id: affordable.id },
          ...h.memberIds.map((cid) => ({ kind: 'citizen' as const, id: cid })),
        ],
        { rent: affordable.rent, previousRent: current?.rent ?? 0 },
        latestCause(s, h.id, ['RENT_DEFAULT', 'HOUSEHOLD_INCOME_DROP']),
      );
    }
  }
}
export function relationshipSystem(s: CityState) {
  if (s.day % 30 !== 0) return;
  s.relationships = s.relationships.filter((e) => e.relationshipType !== 'coworker');
  for (const f of s.companies.filter((f) => f.status === 'active'))
    for (let i = 1; i < f.employeeIds.length; i++)
      s.relationships.push({
        id: id(s, 'relationship'),
        citizenA: f.employeeIds[i - 1],
        citizenB: f.employeeIds[i],
        relationshipType: 'coworker',
        familiarity: 40,
        affection: 30,
        trust: 50,
        conflict: 0,
        sinceDay: s.day,
      });
}
export function migrationSystem(s: CityState) {
  if (s.day % 90 !== 0) return;
  const vacant = s.units.find((u) => !u.occupantHouseholdId);
  const jobs = s.companies.some((f) => f.status === 'active' && f.openPositions > 0);
  if (vacant && jobs && roll(s, 'population', 1, 100) < 35 && s.metrics.population < 1500) {
    const h = {
      id: id(s, 'household'),
      memberIds: [] as string[],
      residenceId: vacant.id,
      cash: 300000,
      debt: 0,
      income: 0,
      expenses: 0,
      housingCost: vacant.rent,
      socioeconomicStatus: 'secure' as const,
    };
    s.households.push(h);
    vacant.occupantHouseholdId = h.id;
    const c = createCitizen(s, h.id, s.day - roll(s, 'population', 20 * 365, 40 * 365));
    c.residenceId = vacant.id;
    h.memberIds.push(c.id);
    s.economy.financing += h.cash + c.cash;
    emit(
      s,
      'CITIZEN_MIGRATED_IN',
      [
        { kind: 'citizen', id: c.id },
        { kind: 'household', id: h.id },
      ],
      { name: c.name },
    );
  }
  const leaving = s.households.find(
    (h) => h.memberIds.length > 0 && h.debt > 3000000 && h.income === 0,
  );
  if (leaving) {
    for (const cid of [...leaving.memberIds]) {
      const c = citizenById(s, cid);
      releaseJob(s, c, 'CITIZEN_QUIT');
      c.lifecycleStatus = 'emigrated';
      c.residenceId = undefined;
      emit(
        s,
        'CITIZEN_MIGRATED_OUT',
        [
          { kind: 'citizen', id: c.id },
          { kind: 'household', id: leaving.id },
        ],
        { name: c.name, reason: 'long-term financial hardship' },
        latestCause(s, leaving.id, ['RENT_DEFAULT']),
      );
    }
    leaving.memberIds = [];
    if (leaving.residenceId) unitById(s, leaving.residenceId)!.occupantHouseholdId = undefined;
    leaving.residenceId = undefined;
    leaving.housingCost = 0;
  }
}
export function metricsSystem(s: CityState) {
  const people = s.citizens.filter((c) => c.lifecycleStatus === 'alive');
  const employed = people.filter((c) => c.employmentStatus === 'employed');
  const unemployed = people.filter((c) => c.employmentStatus === 'unemployed');
  const households = s.households.filter((h) => h.memberIds.length > 0);
  const incomes = people.map((c) => c.salary).sort((a, b) => a - b);
  const average = (sum: number, count: number) => (count ? Math.floor(sum / count) : 0);
  const occupied = s.units.filter((u) => u.occupantHouseholdId).length;
  s.metrics = {
    population: people.length,
    households: households.length,
    employed: employed.length,
    unemployed: unemployed.length,
    unemploymentRate:
      employed.length + unemployed.length
        ? Math.floor((unemployed.length * 10000) / (employed.length + unemployed.length))
        : 0,
    companies: s.companies.filter((f) => f.status === 'active').length,
    bankruptcies: s.companies.filter((f) => f.status === 'bankrupt').length,
    averageIncome: average(
      incomes.reduce((a, b) => a + b, 0),
      incomes.length,
    ),
    medianIncome: incomes.length ? incomes[Math.floor(incomes.length / 2)] : 0,
    householdWealth: average(
      households.reduce((n, h) => n + h.cash - h.debt, 0),
      households.length,
    ),
    averageRent: average(
      s.units.reduce((n, u) => n + u.rent, 0),
      s.units.length,
    ),
    occupied,
    units: s.units.length,
    vacancy: s.units.length - occupied,
    taxRevenue: s.government.taxRevenue,
    welfareSpending: s.government.welfareSpending,
    happiness: average(
      people.reduce((n, c) => n + c.happiness, 0),
      people.length,
    ),
  };
}
export function eventAggregationSystem(s: CityState) {
  if (s.day % 30 === 0)
    s.history.push({
      day: s.day,
      population: s.metrics.population,
      employed: s.metrics.employed,
      unemployed: s.metrics.unemployed,
      averageRent: s.metrics.averageRent,
      householdWealth: s.metrics.householdWealth,
    });
}
// Order is a versioned simulation contract. Wages and welfare precede consumption;
// realized sales precede business solvency decisions. No frame-time inputs.
export const PIPELINE = [
  calendarSystem,
  demographySystem,
  householdSystem,
  employmentSystem,
  incomeSystem,
  governmentSystem,
  expenseSystem,
  companySystem,
  housingSystem,
  relationshipSystem,
  migrationSystem,
  metricsSystem,
  eventAggregationSystem,
] as const;
