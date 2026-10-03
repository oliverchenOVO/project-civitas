import {
  SIMULATION_VERSION,
  age,
  type Citizen,
  type CityState,
  type Config,
  type Company,
} from '../../domain/src/index';
import { randomInt } from './random';
import { emit, id } from './events';
import { metricsSystem } from './systems';
export const roll = (s: CityState, scope: string, min: number, max: number) =>
  randomInt(s.rng, scope, s.config.seed, min, max);
const names = [
  'Anna',
  'Elena',
  'Michael',
  'Noah',
  'Maya',
  'Oliver',
  'Sarah',
  'Leo',
  'Amelia',
  'Lucas',
  'Sofia',
  'Ethan',
  'Iris',
  'Kai',
  'Luna',
  'Arthur',
  'Nora',
  'Theo',
  'Emma',
  'Daniel',
];
const surnames = [
  'Lin',
  'Park',
  'Chen',
  'Rivera',
  'Wong',
  'Kim',
  'Reed',
  'Patel',
  'Silva',
  'Huang',
  'Gray',
  'Khan',
];
export function createCitizen(s: CityState, householdId: string, birthDay?: number): Citizen {
  const c: Citizen = {
    id: id(s, 'citizen'),
    name: `${names[roll(s, 'population', 0, names.length - 1)]} ${surnames[roll(s, 'population', 0, surnames.length - 1)]}`,
    birthDay: birthDay ?? -roll(s, 'population', 18 * 365, 72 * 365),
    sex: roll(s, 'population', 0, 1) ? 'F' : 'M',
    traits: { ambition: roll(s, 'population', 20, 95), sociability: roll(s, 'population', 20, 95) },
    householdId,
    education: roll(s, 'population', 1, 4),
    skills: roll(s, 'population', 40, 100),
    employmentStatus: 'unemployed',
    salary: 0,
    cash: roll(s, 'population', 10000, 80000),
    debt: 0,
    happiness: 60,
    stress: 20,
    health: 100,
    lifecycleStatus: 'alive',
    parents: [],
    children: [],
  };
  const a = age(s, c);
  if (a < 18) c.employmentStatus = 'child';
  else if (a >= 65) c.employmentStatus = 'retired';
  s.citizens.push(c);
  return c;
}
export function createCompany(s: CityState, founder?: Citizen): Company {
  const industries: Company['industry'][] = ['Food', 'Services', 'Manufacturing', 'Technology'];
  const stems = ['Atlas', 'Mercury', 'River', 'North', 'Cedar', 'Nova', 'Harbor', 'Lumen'];
  const c: Company = {
    id: id(s, 'company'),
    name: `${stems[roll(s, 'company', 0, 7)]} ${industries[s.companies.length % 4]} ${s.companies.length + 1}`,
    industry: industries[s.companies.length % 4],
    districtId: s.districts[s.companies.length % 4].id,
    foundedDay: s.day,
    employeeIds: [],
    cash: roll(s, 'company', 2000000, 6000000),
    revenue: 0,
    expenses: 0,
    payroll: 0,
    profit: 0,
    tax: 0,
    productivity: roll(s, 'company', 85, 130),
    demand: 10000,
    openPositions: roll(s, 'company', 5, 10),
    status: 'active',
    lossDays: 0,
    targetWorkers: roll(s, 'company', 5, 10),
  };
  if (founder) s.economy.financing += c.cash;
  s.companies.push(c);
  s.buildings.push({
    id: id(s, 'building'),
    districtId: c.districtId,
    type: 'commercial',
    capacity: c.targetWorkers,
    unitIds: [],
    quality: 70,
    ownerId: c.id,
    value: 10000000,
    x: roll(s, 'company', 8, 90),
    y: roll(s, 'company', 8, 90),
  });
  emit(
    s,
    'COMPANY_CREATED',
    [
      { kind: 'company', id: c.id },
      ...(founder ? [{ kind: 'citizen' as const, id: founder.id }] : []),
    ],
    { name: c.name, industry: c.industry },
  );
  return c;
}
export function addHousing(s: CityState, districtId: string, count: number): string[] {
  const district = s.districts.find((d) => d.id === districtId)!;
  const ids: string[] = [];
  for (let i = 0; i < count; i++) {
    const buildingId = id(s, 'building');
    const unitId = id(s, 'unit');
    const rent = Math.floor((roll(s, 'housing', 38000, 68000) * district.rentFactor) / 100);
    s.units.push({
      id: unitId,
      buildingId,
      districtId,
      capacity: 5,
      rent,
      estimatedValue: rent * 240,
      quality: roll(s, 'housing', 45, 95),
    });
    s.buildings.push({
      id: buildingId,
      districtId,
      type: 'residential',
      capacity: 5,
      unitIds: [unitId],
      quality: s.units.at(-1)!.quality,
      ownerId: 'government',
      value: rent * 240,
      x: roll(s, 'housing', 8, 92),
      y: roll(s, 'housing', 8, 92),
    });
    ids.push(unitId);
  }
  return ids;
}
export function createCity(
  config: Config = { seed: 'CIVITAS-938291', population: 250 },
): CityState {
  if (
    !Number.isInteger(config.population) ||
    config.population < 10 ||
    config.population > 1000 ||
    !config.seed.trim() ||
    config.seed.length > 128
  )
    throw new Error('City requires 10–1000 citizens and a seed of 1–128 characters.');
  const s: CityState = {
    simulationVersion: SIMULATION_VERSION,
    config: { ...config },
    day: 0,
    rng: {},
    nextId: 1,
    citizens: [],
    households: [],
    companies: [],
    districts: [
      { id: 'district-1', name: 'Northbank', color: '#92ceb9', rentFactor: 120 },
      { id: 'district-2', name: 'Old Quarter', color: '#d8bc7a', rentFactor: 85 },
      { id: 'district-3', name: 'Riverside', color: '#81aeca', rentFactor: 110 },
      { id: 'district-4', name: 'Foundry', color: '#b69cc7', rentFactor: 75 },
    ],
    buildings: [],
    units: [],
    relationships: [],
    government: {
      policies: { incomeTax: 1500, corporateTax: 1800, welfare: 45000, minimumWage: 160000 },
      cash: 20000000,
      taxRevenue: 0,
      welfareSpending: 0,
      constructionSpending: 0,
    },
    economy: { imports: 0, exports: 0, financing: 0, openingMoney: 0 },
    metrics: {} as CityState['metrics'],
    history: [],
    events: [],
    commands: [],
  };
  emit(s, 'CITY_FOUNDED', [], { seed: config.seed, population: config.population });
  const householdCount = Math.ceil(config.population / 2.5);
  for (let i = 0; i < householdCount; i++)
    s.households.push({
      id: id(s, 'household'),
      memberIds: [],
      cash: roll(s, 'household', 200000, 900000),
      debt: 0,
      income: 0,
      expenses: 0,
      housingCost: 0,
      socioeconomicStatus: 'secure',
    });
  for (let i = 0; i < config.population; i++) {
    const h = s.households[i % householdCount];
    const parentAges = h.memberIds.map((cid) =>
      age(
        s,
        s.citizens.find((c) => c.id === cid)!,
      ),
    );
    const oldestChildDays = Math.max(0, Math.min(17, Math.min(...parentAges) - 18)) * 365;
    const c = createCitizen(
      s,
      h.id,
      i >= householdCount * 2 ? -roll(s, 'population', 0, oldestChildDays) : undefined,
    );
    h.memberIds.push(c.id);
    emit(
      s,
      'CITIZEN_MIGRATED_IN',
      [
        { kind: 'citizen', id: c.id },
        { kind: 'household', id: h.id },
      ],
      { name: c.name, initial: 1 },
    );
  }
  for (const h of s.households) {
    const adults = h.memberIds
      .map((cid) => s.citizens.find((c) => c.id === cid)!)
      .filter((c) => age(s, c) >= 18);
    if (adults.length >= 2) {
      adults[0].spouseId = adults[1].id;
      adults[1].spouseId = adults[0].id;
      s.relationships.push({
        id: id(s, 'relationship'),
        citizenA: adults[0].id,
        citizenB: adults[1].id,
        relationshipType: 'spouse',
        familiarity: 90,
        affection: 75,
        trust: 80,
        conflict: 10,
        sinceDay: 0,
      });
    }
    for (const cid of h.memberIds) {
      const c = s.citizens.find((c) => c.id === cid)!;
      if (age(s, c) < 18) {
        c.parents = adults.slice(0, 2).map((a) => a.id);
        for (const p of adults.slice(0, 2)) {
          p.children.push(c.id);
          s.relationships.push({
            id: id(s, 'relationship'),
            citizenA: p.id,
            citizenB: c.id,
            relationshipType: 'family',
            familiarity: 100,
            affection: 90,
            trust: 90,
            conflict: 0,
            sinceDay: 0,
          });
        }
      }
    }
  }
  for (let i = 0; i < 4; i++)
    addHousing(s, s.districts[i].id, Math.ceil((householdCount * 1.15) / 4));
  s.households.forEach((h, i) => {
    const u = s.units[i];
    h.residenceId = u.id;
    h.housingCost = u.rent;
    u.occupantHouseholdId = h.id;
    for (const c of s.citizens.filter((c) => c.householdId === h.id)) c.residenceId = u.id;
    emit(
      s,
      'HOUSEHOLD_MOVED',
      [
        { kind: 'household', id: h.id },
        { kind: 'unit', id: u.id },
        ...h.memberIds.map((cid) => ({ kind: 'citizen' as const, id: cid })),
      ],
      { rent: u.rent, initial: 1 },
    );
  });
  for (let i = 0; i < Math.max(8, Math.round(config.population / 12.5)); i++) createCompany(s);
  // Initial jobs are actual assignments and logged facts, not invented histories.
  let cursor = 0;
  const workers = s.citizens.filter((c) => c.employmentStatus === 'unemployed');
  for (const firm of s.companies)
    for (let j = 0; j < firm.targetWorkers && cursor < Math.floor(workers.length * 0.88); j++) {
      const c = workers[cursor++];
      c.employmentStatus = 'employed';
      c.employerId = firm.id;
      c.salary = Math.max(s.government.policies.minimumWage, 180000 + c.skills * 1200);
      c.occupation =
        firm.industry === 'Food'
          ? 'Food worker'
          : firm.industry === 'Technology'
            ? 'Developer'
            : firm.industry === 'Manufacturing'
              ? 'Technician'
              : 'Service specialist';
      firm.employeeIds.push(c.id);
      emit(
        s,
        'CITIZEN_HIRED',
        [
          { kind: 'citizen', id: c.id },
          { kind: 'company', id: firm.id },
        ],
        { name: c.name, company: firm.name, salary: c.salary, initial: 1 },
      );
    }
  for (const firm of s.companies)
    firm.openPositions = Math.max(0, firm.targetWorkers - firm.employeeIds.length);
  for (let i = 0; i + 1 < s.citizens.length; i += 7)
    s.relationships.push({
      id: id(s, 'relationship'),
      citizenA: s.citizens[i].id,
      citizenB: s.citizens[i + 1].id,
      relationshipType: 'friend',
      familiarity: 50,
      affection: 50,
      trust: 60,
      conflict: 5,
      sinceDay: 0,
    });
  s.economy.openingMoney = totalMoney(s);
  metricsSystem(s);
  return s;
}
export function totalMoney(s: CityState): number {
  return (
    s.government.cash +
    s.citizens.reduce((a, c) => a + c.cash, 0) +
    s.households.reduce((a, h) => a + h.cash, 0) +
    s.companies.reduce((a, c) => a + c.cash, 0)
  );
}
