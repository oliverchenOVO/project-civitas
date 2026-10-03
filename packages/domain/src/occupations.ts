import {
  EDUCATION_LEVELS,
  type Citizen,
  type Company,
  type EducationLevel,
  type Occupation,
  type Skills,
} from './index';

export interface OccupationProfile {
  education: EducationLevel;
  thresholds: Partial<Skills>;
  relevant: keyof Skills;
  experience: number;
  baseWage: number;
  maxWage: number;
  productivity: number;
}
export const occupationProfiles: Record<Occupation, OccupationProfile> = {
  labor: {
    education: 'basic',
    thresholds: { general: 8 },
    relevant: 'general',
    experience: 0,
    baseWage: 155000,
    maxWage: 270000,
    productivity: 90,
  },
  service: {
    education: 'basic',
    thresholds: { service: 18 },
    relevant: 'service',
    experience: 0,
    baseWage: 175000,
    maxWage: 310000,
    productivity: 95,
  },
  clerical: {
    education: 'secondary',
    thresholds: { general: 35 },
    relevant: 'general',
    experience: 0,
    baseWage: 195000,
    maxWage: 350000,
    productivity: 100,
  },
  technical: {
    education: 'vocational',
    thresholds: { technical: 45 },
    relevant: 'technical',
    experience: 0,
    baseWage: 230000,
    maxWage: 420000,
    productivity: 110,
  },
  professional: {
    education: 'tertiary',
    thresholds: { general: 60, technical: 55 },
    relevant: 'technical',
    experience: 0,
    baseWage: 270000,
    maxWage: 490000,
    productivity: 120,
  },
  management: {
    education: 'secondary',
    thresholds: { general: 55, managerial: 55 },
    relevant: 'managerial',
    experience: 24,
    baseWage: 300000,
    maxWage: 550000,
    productivity: 115,
  },
};
export const workforceWeights: Record<Company['industry'], Record<Occupation, number>> = {
  Food: { labor: 55, service: 30, clerical: 5, technical: 0, professional: 0, management: 10 },
  Services: { labor: 5, service: 60, clerical: 25, technical: 0, professional: 0, management: 10 },
  Manufacturing: {
    labor: 55,
    service: 0,
    clerical: 5,
    technical: 30,
    professional: 0,
    management: 10,
  },
  Technology: {
    labor: 0,
    service: 0,
    clerical: 20,
    technical: 40,
    professional: 30,
    management: 10,
  },
};
export const educationRank = (level: EducationLevel) => EDUCATION_LEVELS.indexOf(level);
export function qualification(c: Citizen, occupation: Occupation) {
  const h = c.humanCapital,
    p = occupationProfiles[occupation];
  const checks = [
    { name: 'education', actual: educationRank(h.education), required: educationRank(p.education) },
    ...Object.entries(p.thresholds).map(([name, required]) => ({
      name,
      actual: h.skills[name as keyof Skills],
      required: required!,
    })),
    {
      name: 'experienceMonths',
      actual: Object.values(h.experience).reduce((n, x) => n + x, 0),
      required: p.experience,
    },
  ];
  return {
    eligible:
      checks.every((x) => x.actual >= x.required) ||
      (h.provenance === 'legacy-inferred' &&
        h.legacyOccupation === occupation &&
        c.employmentStatus === 'employed' &&
        c.occupation === occupation),
    checks,
    score: h.skills[p.relevant] * 10 + Math.min(240, h.experience[occupation]),
  };
}
export function occupationDemand(industry: Company['industry'], workers: number) {
  const weights = workforceWeights[industry],
    keys = Object.keys(weights) as Occupation[];
  const demand = Object.fromEntries(
    keys.map((k) => [k, Math.floor((workers * weights[k]) / 100)]),
  ) as Record<Occupation, number>;
  const remainder = workers - Object.values(demand).reduce((n, x) => n + x, 0);
  const ranked = [...keys].sort(
    (a, b) =>
      ((workers * weights[b]) % 100) - ((workers * weights[a]) % 100) ||
      keys.indexOf(a) - keys.indexOf(b),
  );
  for (let i = 0; i < remainder; i++) demand[ranked[i]]++;
  return demand;
}
export function salaryEvidence(
  c: Citizen,
  f: Company,
  occupation: Occupation,
  minimumWage: number,
) {
  const p = occupationProfiles[occupation],
    h = c.humanCapital;
  const ability = f.cash < 500000 ? 90 : f.cash > 5000000 ? 110 : 100;
  const earned =
    p.baseWage + h.skills[p.relevant] * 500 + Math.min(240, h.experience[occupation]) * 200;
  return {
    baseWage: p.baseWage,
    relevantSkill: h.skills[p.relevant],
    experienceMonths: h.experience[occupation],
    abilityPercent: ability,
    minimumWage,
    maxWage: p.maxWage,
    monthly: Math.max(minimumWage, Math.min(p.maxWage, Math.floor((earned * ability) / 100))),
  };
}
export const salaryFor = (c: Citizen, f: Company, occupation: Occupation, minimumWage: number) =>
  salaryEvidence(c, f, occupation, minimumWage).monthly;
