export const SIMULATION_VERSION = '0.1.0';
export type Id = string;
export type Employment = 'employed' | 'unemployed' | 'child' | 'retired';
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
  | 'HOUSING_BUILT';
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
  };
  economy: { imports: number; exports: number; financing: number; openingMoney: number };
  metrics: Metrics;
  history: MetricSnapshot[];
  events: DomainEvent[];
  commands: RecordedCommand[];
}
export const age = (s: Pick<CityState, 'day'>, c: Citizen) =>
  Math.floor((s.day - c.birthDay) / 365);
