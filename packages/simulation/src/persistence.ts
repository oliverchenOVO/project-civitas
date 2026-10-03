import { z } from 'zod';
import {
  SIMULATION_VERSION,
  EDUCATION_LEVELS,
  OCCUPATIONS,
  CLASS_BANDS,
  type CityState,
} from '../../domain/src/index';
import { stateHash } from '../../shared/src/canonical';
import { createCity, advance, applyCommand } from './index';
import { assertInvariants } from './invariants';
import { legacyCitySchema } from './legacy-schema';
import { migrateLegacyState } from './migration';
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
    publicEducationFunding: natural.max(100000),
    vocationalFunding: natural.max(100000),
    higherEducationSubsidy: natural.max(100000),
  })
  .strict();
export const commandSchema = z.discriminatedUnion('type', [
  z
    .object({
      type: z.literal('SET_POLICY'),
      key: z.enum([
        'incomeTax',
        'corporateTax',
        'welfare',
        'minimumWage',
        'publicEducationFunding',
        'vocationalFunding',
        'higherEducationSubsidy',
      ]),
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
export const configSchema = z
  .object({ seed: z.string().min(1).max(128), population: integer.min(10).max(1000) })
  .strict();
const skillProfile = z
  .object({
    general: natural.max(100),
    technical: natural.max(100),
    service: natural.max(100),
    managerial: natural.max(100),
  })
  .strict();
const experience = z
  .object({
    labor: natural,
    service: natural,
    clerical: natural,
    technical: natural,
    professional: natural,
    management: natural,
  })
  .strict();
const mobility = z
  .object({
    class: z.enum(CLASS_BANDS),
    annualClass: z.enum(CLASS_BANDS),
    annualDay: natural,
    reviewedYears: natural,
    monthlyIncome: natural,
    incomeSum: natural,
    incomeDays: natural,
  })
  .strict();
const humanCapital = z
  .object({
    education: z.enum(EDUCATION_LEVELS),
    skills: skillProfile,
    track: z.enum(['childhood', 'secondary', 'vocational', 'tertiary', 'workforce']),
    performance: natural.max(100),
    availableFromDay: natural,
    provenance: z.enum(['initial', 'birth', 'immigration', 'legacy-inferred']),
    secondaryDay: natural.optional(),
    vocationalDay: natural.optional(),
    tertiaryDay: natural.optional(),
    educationEventId: entityId.optional(),
    educationQualifications: z
      .object({
        labor: entityId.optional(),
        service: entityId.optional(),
        clerical: entityId.optional(),
        technical: entityId.optional(),
        professional: entityId.optional(),
        management: entityId.optional(),
      })
      .strict()
      .optional(),
    qualificationEventId: entityId.optional(),
    lossEventId: entityId.optional(),
    salaryEventId: entityId.optional(),
    experience,
    unemployedMonths: natural,
    lastOccupation: z.enum(OCCUPATIONS).optional(),
    lastEducationAge: natural,
    missedStudyMonths: natural,
    publicSupport: natural,
    vocationalSupport: natural,
    subsidySupport: natural,
    lifetimeEarned: natural,
    origin: z
      .object({
        householdId: entityId,
        class: z.enum(CLASS_BANDS),
        income: natural,
        parentEducation: natural.max(3),
        day: natural,
        childhoodObserved: z.boolean(),
      })
      .strict(),
    adultComparison: z
      .object({
        day: natural,
        origin: z.enum(CLASS_BANDS),
        current: z.enum(CLASS_BANDS),
        direction: z.enum(['up', 'down', 'stable']),
      })
      .strict()
      .optional(),
    legacyOccupation: z.enum(OCCUPATIONS).optional(),
  })
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
    skills: natural.max(100),
    humanCapital,
    employmentStatus: z.enum(['employed', 'unemployed', 'child', 'student', 'retired']),
    employerId: entityId.optional(),
    occupation: z.enum(OCCUPATIONS).optional(),
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
    mobility,
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
    occupationDemand: experience,
    skillProductivity: natural.min(9000).max(12000),
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
      'EDUCATION_COMPLETED',
      'EDUCATION_DROPPED',
      'EDUCATION_ENROLLED',
      'VOCATIONAL_COMPLETED',
      'TERTIARY_COMPLETED',
      'QUALIFICATION_GAINED',
      'SKILL_MILESTONE',
      'PROMOTED',
      'OCCUPATION_CHANGED',
      'SALARY_CHANGED',
      'CLASS_MOVED_UP',
      'CLASS_MOVED_DOWN',
      'INTERGENERATIONAL_REVIEW',
      'HOUSEHOLD_FORMED',
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
export const citySchema = z
  .object({
    simulationVersion: z.literal(SIMULATION_VERSION),
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
        educationSpending: natural,
        vocationalSpending: natural,
        subsidySpending: natural,
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
    commands: z.array(z.object({ id: entityId, day: natural, command: commandSchema }).strict()),
    migrationCheckpoint: z.string().max(250000000).optional(),
  })
  .strict();
const saveSchema = z
  .object({
    manifest: z
      .object({
        saveVersion: z.literal(1),
        simulationVersion: z.literal(SIMULATION_VERSION),
        hash: z.string().regex(/^[0-9a-f]{64}$/),
        metadata: z.object({ cityName: z.string() }).strict(),
      })
      .strict(),
    state: citySchema,
  })
  .strict();
export async function saveCity(s: CityState): Promise<string> {
  assertInvariants(s);
  return JSON.stringify({
    manifest: {
      saveVersion: 1,
      simulationVersion: SIMULATION_VERSION,
      hash: await stateHash(s),
      metadata: { cityName: 'CIVITAS' },
    },
    state: s,
  });
}
export async function loadCity(text: string): Promise<CityState> {
  if (text.length > 100_000_000) throw new Error('Save exceeds 100 MB limit');
  const input = JSON.parse(text);
  if (input?.manifest?.saveVersion === 1 && input?.manifest?.simulationVersion === '0.1.0') {
    const legacy = z
      .object({
        manifest: z
          .object({
            saveVersion: z.literal(1),
            simulationVersion: z.literal('0.1.0'),
            hash: z.string().regex(/^[0-9a-f]{64}$/),
            metadata: z.object({ cityName: z.string() }).strict(),
          })
          .strict(),
        state: legacyCitySchema,
      })
      .strict()
      .parse(input);
    if ((await stateHash(legacy.state)) !== legacy.manifest.hash)
      throw new Error('Save integrity hash mismatch');
    return migrateLegacyState(legacy.state);
  }
  const parsed = saveSchema.parse(input);
  const state = parsed.state as CityState;
  if ((await stateHash(state)) !== parsed.manifest.hash)
    throw new Error('Save integrity hash mismatch');
  assertInvariants(state);
  return state;
}
export const MIGRATIONS: Readonly<Record<number, (input: unknown) => unknown>> = {}; // v1 is current; unknown versions are rejected, never silently upgraded.
export function replayCity(source: CityState): CityState {
  if (source.simulationVersion !== SIMULATION_VERSION) throw new Error('Replay version mismatch');
  const state = source.migrationCheckpoint
    ? (citySchema.parse(JSON.parse(source.migrationCheckpoint)) as CityState)
    : createCity(source.config);
  if (source.migrationCheckpoint) {
    assertInvariants(state);
    state.migrationCheckpoint = source.migrationCheckpoint;
  }
  let day = state.day;
  for (const recorded of source.commands.slice(state.commands.length)) {
    if (recorded.day < day || recorded.day > source.day)
      throw new Error('Invalid command chronology');
    advance(state, recorded.day - day);
    applyCommand(state, recorded.command);
    day = recorded.day;
  }
  advance(state, source.day - day);
  return state;
}
