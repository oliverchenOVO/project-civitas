import {
  age,
  CLASS_BANDS,
  EDUCATION_LEVELS,
  OCCUPATIONS,
  type CityState,
  type EducationLevel,
  type Occupation,
  type SocialClass,
} from '../../domain/src/index';
export interface HumanDevelopmentSample {
  day: number;
  population: number;
  adults: number;
  education: Record<EducationLevel, number>;
  unemployedByEducation: Record<EducationLevel, number>;
  laborForceByEducation: Record<EducationLevel, number>;
  incomeByEducation: Record<EducationLevel, number>;
  occupations: Record<Occupation, number>;
  classes: Record<SocialClass, number>;
  upward: number;
  downward: number;
  mobilityHouseholdYears: number;
  educationSpending: number;
  vocationalSpending: number;
  subsidySpending: number;
  productivity: number;
}
export function humanDevelopment(s: CityState): HumanDevelopmentSample {
  const education = Object.fromEntries(EDUCATION_LEVELS.map((k) => [k, 0])) as Record<
    EducationLevel,
    number
  >;
  const unemployedByEducation = { ...education },
    laborForceByEducation = { ...education },
    incomeByEducation = { ...education };
  const occupations = Object.fromEntries(OCCUPATIONS.map((k) => [k, 0])) as Record<
    Occupation,
    number
  >;
  const classes = Object.fromEntries(CLASS_BANDS.map((k) => [k, 0])) as Record<SocialClass, number>;
  let population = 0,
    adults = 0;
  for (const c of s.citizens) {
    if (c.lifecycleStatus !== 'alive') continue;
    population++;
    if (age(s, c) < 18) continue;
    adults++;
    const level = c.humanCapital.education;
    education[level]++;
    incomeByEducation[level] += c.salary;
    if (c.employmentStatus === 'employed' || c.employmentStatus === 'unemployed')
      laborForceByEducation[level]++;
    if (c.employmentStatus === 'unemployed') unemployedByEducation[level]++;
    if (c.employmentStatus === 'employed') occupations[c.occupation as Occupation]++;
  }
  for (const level of EDUCATION_LEVELS)
    incomeByEducation[level] = education[level]
      ? Math.floor(incomeByEducation[level] / education[level])
      : 0;
  for (const h of s.households) if (h.memberIds.length) classes[h.mobility.class]++;
  const active = s.companies.filter((f) => f.status === 'active');
  return {
    day: s.day,
    population,
    adults,
    education,
    unemployedByEducation,
    laborForceByEducation,
    incomeByEducation,
    occupations,
    classes,
    upward: s.events.filter((e) => e.type === 'CLASS_MOVED_UP').length,
    downward: s.events.filter((e) => e.type === 'CLASS_MOVED_DOWN').length,
    mobilityHouseholdYears: s.households.reduce((n, h) => n + h.mobility.reviewedYears, 0),
    educationSpending: s.government.educationSpending,
    vocationalSpending: s.government.vocationalSpending,
    subsidySpending: s.government.subsidySpending,
    productivity: active.length
      ? Math.floor(active.reduce((n, f) => n + f.skillProductivity, 0) / active.length)
      : 10000,
  };
}
export interface CohortFilter {
  bornFromYear?: number;
  bornToYear?: number;
  lowIncomeOrigin?: boolean;
  tertiary?: boolean;
  adultOnly?: boolean;
}
export function cohortAnalysis(s: CityState, filter: CohortFilter = {}) {
  const people = s.citizens.filter(
    (c) =>
      c.lifecycleStatus === 'alive' &&
      (!filter.adultOnly || age(s, c) >= 18) &&
      (filter.bornFromYear === undefined || c.birthDay >= filter.bornFromYear * 365) &&
      (filter.bornToYear === undefined || c.birthDay < (filter.bornToYear + 1) * 365) &&
      (!filter.lowIncomeOrigin ||
        (c.humanCapital.origin.childhoodObserved &&
          c.humanCapital.origin.class === 'vulnerable')) &&
      (!filter.tertiary || c.humanCapital.education === 'tertiary'),
  );
  const households = new Map(s.households.map((h) => [h.id, h]));
  const classes = Object.fromEntries(CLASS_BANDS.map((k) => [k, 0])) as Record<SocialClass, number>;
  let employed = 0,
    reviewed = 0,
    up = 0,
    down = 0,
    stable = 0;
  for (const c of people) {
    classes[households.get(c.householdId)!.mobility.class]++;
    if (c.employmentStatus === 'employed') employed++;
    if (c.humanCapital.adultComparison) {
      reviewed++;
      if (c.humanCapital.adultComparison.direction === 'up') up++;
      else if (c.humanCapital.adultComparison.direction === 'down') down++;
      else stable++;
    }
  }
  return {
    size: people.length,
    employed,
    employmentRate: people.length ? Math.floor((employed * 10000) / people.length) : null,
    classes,
    reviewed,
    up,
    down,
    stable,
    ids: people.map((c) => c.id),
  };
}
