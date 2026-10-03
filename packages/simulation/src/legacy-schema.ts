// Immutable 0.1.0 entity schema for integrity-checked migration only.
import { z } from 'zod';
const integer = z.number().int().safe();
const natural = integer.nonnegative();
const entityId = z.string().min(1);
const ids = z.array(entityId);
const policies = z
  .object({
    incomeTax: integer.min(0).max(6000),
    corporateTax: integer.min(0).max(6000),
    welfare: integer.min(0).max(300000),
    minimumWage: integer.min(0).max(600000),
  })
  .strict();
export const legacyCommandSchema = z.discriminatedUnion('type', [
  z
    .object({
      type: z.literal('SET_POLICY'),
      key: z.enum(['incomeTax', 'corporateTax', 'welfare', 'minimumWage']),
      value: natural,
    })
    .strict(),
  z
    .object({
      type: z.literal('BUILD_HOUSING'),
      districtId: entityId,
      units: integer.min(1).max(50),
    })
    .strict(),
]);
const configSchema = z
  .object({ seed: z.string().min(1).max(128), population: integer.min(10).max(1000) })
  .strict();
const citizen = z
  .object({
    id: entityId,
    name: z.string(),
    birthDay: integer,
    sex: z.enum(['F', 'M']),
    traits: z.object({ ambition: natural, sociability: natural }),
    householdId: entityId,
    residenceId: entityId.optional(),
    education: natural,
    skills: natural,
    employmentStatus: z.enum(['employed', 'unemployed', 'child', 'retired']),
    employerId: entityId.optional(),
    occupation: z.string().optional(),
    salary: natural,
    cash: natural,
    debt: natural,
    happiness: natural.max(100),
    stress: natural.max(100),
    health: natural.max(100),
    lifecycleStatus: z.enum(['alive', 'dead', 'emigrated']),
    deathDay: natural.optional(),
    spouseId: entityId.optional(),
    parents: ids,
    children: ids,
  })
  .strict();
const household = z
  .object({
    id: entityId,
    memberIds: ids,
    residenceId: entityId.optional(),
    cash: natural,
    debt: natural,
    income: natural,
    expenses: natural,
    housingCost: natural,
    socioeconomicStatus: z.enum(['secure', 'strained', 'vulnerable']),
  })
  .strict();
const company = z
  .object({
    id: entityId,
    name: z.string(),
    industry: z.enum(['Food', 'Services', 'Manufacturing', 'Technology']),
    districtId: entityId,
    foundedDay: natural,
    employeeIds: ids,
    cash: natural,
    revenue: natural,
    expenses: natural,
    payroll: natural,
    profit: integer,
    tax: natural,
    productivity: natural,
    demand: natural,
    openPositions: natural,
    status: z.enum(['active', 'bankrupt']),
    lossDays: natural,
    targetWorkers: natural,
  })
  .strict();
const event = z
  .object({
    id: entityId,
    tick: natural,
    type: z.enum([
      'CITY_FOUNDED',
      'CITIZEN_BORN',
      'CITIZEN_DIED',
      'CITIZEN_MIGRATED_IN',
      'CITIZEN_MIGRATED_OUT',
      'CITIZEN_HIRED',
      'CITIZEN_FIRED',
      'CITIZEN_QUIT',
      'WORKFORCE_ENTERED',
      'CITIZEN_RETIRED',
      'COMPANY_CREATED',
      'COMPANY_BANKRUPT',
      'COMPANY_LAYOFF',
      'HOUSEHOLD_MOVED',
      'RENT_CHANGED',
      'RENT_DEFAULT',
      'HOUSEHOLD_INCOME_DROP',
      'POLICY_CHANGED',
      'HOUSING_BUILT',
    ]),
    actorIds: ids,
    targetIds: ids,
    entityRefs: z.array(
      z
        .object({
          kind: z.enum(['citizen', 'household', 'company', 'unit', 'district']),
          id: entityId,
        })
        .strict(),
    ),
    severity: z.enum(['info', 'major']),
    category: z.enum(['people', 'business', 'housing', 'government', 'city']),
    payload: z.record(z.string(), z.union([z.string(), integer, ids])),
    causeEventIds: ids,
  })
  .strict();
export const legacyCitySchema = z
  .object({
    simulationVersion: z.literal('0.1.0'),
    config: configSchema,
    day: natural,
    rng: z.record(z.string(), integer.min(0).max(4294967295)),
    nextId: natural,
    citizens: z.array(citizen),
    households: z.array(household),
    companies: z.array(company),
    districts: z
      .array(
        z
          .object({ id: entityId, name: z.string(), color: z.string(), rentFactor: natural })
          .strict(),
      )
      .length(4),
    buildings: z.array(
      z
        .object({
          id: entityId,
          districtId: entityId,
          type: z.enum(['residential', 'commercial']),
          capacity: natural,
          unitIds: ids,
          quality: natural,
          ownerId: entityId,
          value: natural,
          x: natural,
          y: natural,
        })
        .strict(),
    ),
    units: z.array(
      z
        .object({
          id: entityId,
          buildingId: entityId,
          districtId: entityId,
          capacity: natural,
          rent: natural,
          estimatedValue: natural,
          quality: natural,
          occupantHouseholdId: entityId.optional(),
        })
        .strict(),
    ),
    relationships: z.array(
      z
        .object({
          id: entityId,
          citizenA: entityId,
          citizenB: entityId,
          relationshipType: z.enum(['spouse', 'family', 'friend', 'coworker']),
          familiarity: natural,
          affection: natural,
          trust: natural,
          conflict: natural,
          sinceDay: natural,
        })
        .strict(),
    ),
    government: z
      .object({
        policies,
        cash: natural,
        taxRevenue: natural,
        welfareSpending: natural,
        constructionSpending: natural,
      })
      .strict(),
    economy: z
      .object({ imports: natural, exports: natural, financing: natural, openingMoney: natural })
      .strict(),
    metrics: z
      .object({
        population: natural,
        households: natural,
        employed: natural,
        unemployed: natural,
        unemploymentRate: natural,
        companies: natural,
        bankruptcies: natural,
        averageIncome: natural,
        medianIncome: natural,
        householdWealth: integer,
        averageRent: natural,
        occupied: natural,
        units: natural,
        vacancy: natural,
        taxRevenue: natural,
        welfareSpending: natural,
        happiness: natural,
      })
      .strict(),
    history: z.array(
      z
        .object({
          day: natural,
          population: natural,
          employed: natural,
          unemployed: natural,
          averageRent: natural,
          householdWealth: integer,
        })
        .strict(),
    ),
    events: z.array(event),
    commands: z.array(
      z.object({ id: entityId, day: natural, command: legacyCommandSchema }).strict(),
    ),
  })
  .strict();
