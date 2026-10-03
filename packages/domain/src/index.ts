export const SIMULATION_VERSION = '0.2.0';
export const EDUCATION_LEVELS = ['basic', 'secondary', 'vocational', 'tertiary'] as const;
export type EducationLevel = (typeof EDUCATION_LEVELS)[number];
export const OCCUPATIONS = [
  'labor',
  'service',
  'clerical',
  'technical',
  'professional',
  'management',
] as const;
export type Occupation = (typeof OCCUPATIONS)[number];
export const CLASS_BANDS = ['vulnerable', 'working', 'middle', 'affluent'] as const;
export type SocialClass = (typeof CLASS_BANDS)[number];
export type Skills = Record<'general' | 'technical' | 'service' | 'managerial', number>;
export interface HumanCapital {
  education: EducationLevel;
  skills: Skills;
  track: 'childhood' | 'secondary' | 'vocational' | 'tertiary' | 'workforce';
  performance: number;
  availableFromDay: number;
  provenance: 'initial' | 'birth' | 'immigration' | 'legacy-inferred';
  secondaryDay?: number;
  vocationalDay?: number;
  tertiaryDay?: number;
  legacyOccupation?: Occupation;
  educationEventId?: string;
  educationQualifications?: Partial<Record<Occupation, string>>;
  qualificationEventId?: string;
  lossEventId?: string;
  salaryEventId?: string;
  experience: Record<Occupation, number>;
  unemployedMonths: number;
  lastOccupation?: Occupation;
  lastEducationAge: number;
  missedStudyMonths: number;
  publicSupport: number;
  vocationalSupport: number;
  subsidySupport: number;
  lifetimeEarned: number;
  origin: {
    householdId: string;
    class: SocialClass;
    income: number;
    parentEducation: number;
    day: number;
    childhoodObserved: boolean;
  };
  adultComparison?: {
    day: number;
    origin: SocialClass;
    current: SocialClass;
    direction: 'up' | 'down' | 'stable';
  };
}
export interface HouseholdMobility {
  class: SocialClass;
  annualClass: SocialClass;
  annualDay: number;
  reviewedYears: number;
  monthlyIncome: number;
  incomeSum: number;
  incomeDays: number;
}
export type Id = string;
export type Employment = 'employed' | 'unemployed' | 'child' | 'student' | 'retired';
export interface Citizen {
  id: Id;
  name: string;
  birthDay: number;
  sex: 'F' | 'M';
  traits: { ambition: number; sociability: number };
  householdId: Id;
  residenceId?: Id;
  education: number;
  skills: number;
  humanCapital: HumanCapital;
  employmentStatus: Employment;
  employerId?: Id;
  occupation?: string;
  salary: number;
  cash: number;
  debt: number;
  happiness: number;
  stress: number;
  health: number;
  lifecycleStatus: 'alive' | 'dead' | 'emigrated';
  deathDay?: number;
  spouseId?: Id;
  parents: Id[];
  children: Id[];
}
export interface Household {
  id: Id;
  memberIds: Id[];
  residenceId?: Id;
  cash: number;
  debt: number;
  income: number;
  expenses: number;
  housingCost: number;
  socioeconomicStatus: 'secure' | 'strained' | 'vulnerable';
  mobility: HouseholdMobility;
}
export interface Company {
  id: Id;
  name: string;
  industry: 'Food' | 'Services' | 'Manufacturing' | 'Technology';
  districtId: Id;
  foundedDay: number;
  employeeIds: Id[];
  cash: number;
  revenue: number;
  expenses: number;
  payroll: number;
  profit: number;
  tax: number;
  productivity: number;
  demand: number;
  openPositions: number;
  status: 'active' | 'bankrupt';
  lossDays: number;
  targetWorkers: number;
  occupationDemand: Record<Occupation, number>;
  skillProductivity: number;
}
export interface District {
  id: Id;
  name: string;
  color: string;
  rentFactor: number;
}
export interface Building {
  id: Id;
  districtId: Id;
  type: 'residential' | 'commercial';
  capacity: number;
  unitIds: Id[];
  quality: number;
  ownerId: Id;
  value: number;
  x: number;
  y: number;
}
export interface HousingUnit {
  id: Id;
  buildingId: Id;
  districtId: Id;
  capacity: number;
  rent: number;
  estimatedValue: number;
  quality: number;
  occupantHouseholdId?: Id;
}
export interface Relationship {
  id: Id;
  citizenA: Id;
  citizenB: Id;
  relationshipType: 'spouse' | 'family' | 'friend' | 'coworker';
  familiarity: number;
  affection: number;
  trust: number;
  conflict: number;
  sinceDay: number;
}
export type EventType =
  | 'CITY_FOUNDED'
  | 'CITIZEN_BORN'
  | 'CITIZEN_DIED'
  | 'CITIZEN_MIGRATED_IN'
  | 'CITIZEN_MIGRATED_OUT'
  | 'CITIZEN_HIRED'
  | 'CITIZEN_FIRED'
  | 'CITIZEN_QUIT'
  | 'WORKFORCE_ENTERED'
  | 'CITIZEN_RETIRED'
  | 'COMPANY_CREATED'
  | 'COMPANY_BANKRUPT'
  | 'COMPANY_LAYOFF'
  | 'HOUSEHOLD_MOVED'
  | 'RENT_CHANGED'
  | 'RENT_DEFAULT'
  | 'HOUSEHOLD_INCOME_DROP'
  | 'POLICY_CHANGED'
  | 'HOUSING_BUILT'
  | 'EDUCATION_COMPLETED'
  | 'EDUCATION_DROPPED'
  | 'EDUCATION_ENROLLED'
  | 'VOCATIONAL_COMPLETED'
  | 'TERTIARY_COMPLETED'
  | 'QUALIFICATION_GAINED'
  | 'SKILL_MILESTONE'
  | 'PROMOTED'
  | 'OCCUPATION_CHANGED'
  | 'SALARY_CHANGED'
  | 'CLASS_MOVED_UP'
  | 'CLASS_MOVED_DOWN'
  | 'INTERGENERATIONAL_REVIEW'
  | 'HOUSEHOLD_FORMED';
export interface EntityRef {
  kind: 'citizen' | 'household' | 'company' | 'unit' | 'district';
  id: Id;
}
export interface DomainEvent {
  id: Id;
  tick: number;
  type: EventType;
  actorIds: Id[];
  targetIds: Id[];
  entityRefs: EntityRef[];
  severity: 'info' | 'major';
  category: 'people' | 'business' | 'housing' | 'government' | 'city';
  payload: Record<string, string | number | string[]>;
  causeEventIds: Id[];
}
export interface Policies {
  incomeTax: number;
  corporateTax: number;
  welfare: number;
  minimumWage: number;
  publicEducationFunding: number;
  vocationalFunding: number;
  higherEducationSubsidy: number;
}
export type Command =
  | { type: 'SET_POLICY'; key: keyof Policies; value: number }
  | { type: 'BUILD_HOUSING'; districtId: Id; units: number };
export interface RecordedCommand {
  id: Id;
  day: number;
  command: Command;
}
export interface Config {
  population: number;
  seed: string;
}
export interface Metrics {
  population: number;
  households: number;
  employed: number;
  unemployed: number;
  unemploymentRate: number;
  companies: number;
  bankruptcies: number;
  averageIncome: number;
  medianIncome: number;
  householdWealth: number;
  averageRent: number;
  occupied: number;
  units: number;
  vacancy: number;
  taxRevenue: number;
  welfareSpending: number;
  happiness: number;
}
export interface MetricSnapshot {
  day: number;
  population: number;
  employed: number;
  unemployed: number;
  averageRent: number;
  householdWealth: number;
}
export interface CityState {
  simulationVersion: string;
  config: Config;
  day: number;
  rng: Record<string, number>;
  nextId: number;
  citizens: Citizen[];
  households: Household[];
  companies: Company[];
  districts: District[];
  buildings: Building[];
  units: HousingUnit[];
  relationships: Relationship[];
  government: {
    policies: Policies;
    cash: number;
    taxRevenue: number;
    welfareSpending: number;
    constructionSpending: number;
    educationSpending: number;
    vocationalSpending: number;
    subsidySpending: number;
  };
  economy: { imports: number; exports: number; financing: number; openingMoney: number };
  metrics: Metrics;
  history: MetricSnapshot[];
  events: DomainEvent[];
  commands: RecordedCommand[];
  migrationCheckpoint?: string;
}
export const age = (s: Pick<CityState, 'day'>, c: Citizen) =>
  Math.floor((s.day - c.birthDay) / 365);
