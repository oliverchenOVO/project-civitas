import {
  age,
  CLASS_BANDS,
  EDUCATION_LEVELS,
  OCCUPATIONS,
  type Citizen,
  type CityState,
  type Household,
  type HumanCapital,
  type Occupation,
  type Skills,
} from '../../domain/src/index';
import {
  educationRank,
  occupationDemand,
  occupationProfiles,
  qualification,
  salaryFor,
  salaryEvidence,
} from '../../domain/src/occupations';
import { randomInt, seedHash } from './random';
import { emit } from './events';
import { citizenById, householdById, companyById } from './lookups';

export const emptyExperience = () =>
  Object.fromEntries(OCCUPATIONS.map((k) => [k, 0])) as Record<Occupation, number>;
export const emptyMobility = (day = 0): Household['mobility'] => ({
  class: 'working',
  annualClass: 'working',
  annualDay: day,
  reviewedYears: 0,
  monthlyIncome: 0,
  incomeSum: 0,
  incomeDays: 0,
});
const clamp = (n: number) => Math.max(0, Math.min(100, Math.floor(n)));
const draw = (s: CityState, scope: string, min: number, max: number) =>
  randomInt(s.rng, scope, s.config.seed, min, max);
export function initializeHumanCapital(
  s: CityState,
  c: Citizen,
  provenance: HumanCapital['provenance'],
) {
  const a = age(s, c),
    inferred = a >= 18;
  // Existing adults start at a declared boundary; no retrospective completion events.
  const level =
    a < 18
      ? 'basic'
      : EDUCATION_LEVELS[Math.max(0, Math.min(a < 20 ? 1 : a < 22 ? 2 : 3, c.education - 1))];
  const base = a < 6 ? 5 : a < 18 ? Math.min(30, a * 2) : Math.max(20, Math.floor(c.skills * 0.7));
  const h = householdById(s, c.householdId);
  c.humanCapital = {
    education: level,
    skills: {
      general: base,
      technical: base,
      service: base,
      managerial: inferred ? Math.max(10, base - 15) : 5,
    },
    track: a < 12 ? 'childhood' : a < 18 ? 'secondary' : 'workforce',
    performance: clamp(Math.floor(c.traits.ambition / 2) + draw(s, 'education', 20, 45)),
    availableFromDay: s.day,
    provenance,
    experience: emptyExperience(),
    unemployedMonths: 0,
    lastEducationAge: a,
    missedStudyMonths: 0,
    publicSupport: 0,
    vocationalSupport: 0,
    subsidySupport: 0,
    lifetimeEarned: 0,
    origin: {
      householdId: h.id,
      class: h.mobility?.class ?? 'working',
      income: h.mobility?.monthlyIncome ?? 0,
      parentEducation: 0,
      day: s.day,
      childhoodObserved: a < 18,
    },
  };
  if (level === 'vocational') c.humanCapital.skills.technical = Math.max(55, base);
  if (level === 'tertiary') {
    c.humanCapital.skills.general = Math.max(65, base);
    c.humanCapital.skills.technical = Math.max(65, base);
  }
  syncLegacy(c);
}
function syncLegacy(c: Citizen) {
  c.education = educationRank(c.humanCapital.education) + 1;
  c.skills = Math.floor(Object.values(c.humanCapital.skills).reduce((n, x) => n + x, 0) / 4);
}
export function deriveClass(h: Household) {
  const people = Math.max(1, h.memberIds.length),
    income = Math.floor(h.mobility.monthlyIncome / people),
    wealth = Math.floor((h.cash - h.debt) / people);
  const burden = h.mobility.monthlyIncome
    ? Math.floor((h.housingCost * 10000) / h.mobility.monthlyIncome)
    : 10000;
  if (wealth < 0 || (income < 80000 && wealth < 100000)) return 'vulnerable' as const;
  if (wealth >= 2000000 || (income >= 320000 && wealth >= 500000 && burden < 3500))
    return 'affluent' as const;
  if (income < 180000 || wealth < 300000 || burden > 5000) return 'working' as const;
  return 'middle' as const;
}
export function initializeBackground(s: CityState) {
  for (const h of s.households) {
    h.mobility.monthlyIncome = h.memberIds.reduce((n, id) => n + citizenById(s, id).salary, 0);
    h.mobility.class = deriveClass(h);
    h.mobility.annualClass = h.mobility.class;
  }
  for (const c of s.citizens) {
    const h = householdById(s, c.householdId);
    c.humanCapital.origin = {
      householdId: h.id,
      class: h.mobility.class,
      income: h.mobility.monthlyIncome,
      parentEducation: c.parents.reduce(
        (n, id) => Math.max(n, educationRank(citizenById(s, id).humanCapital.education)),
        0,
      ),
      day: s.day,
      childhoodObserved: age(s, c) < 18,
    };
  }
}
export function hire(
  s: CityState,
  c: Citizen,
  firm: CityState['companies'][number],
  occupation: Occupation,
  initial = false,
) {
  const evidence = qualification(c, occupation);
  if (!evidence.eligible || c.lifecycleStatus !== 'alive' || age(s, c) < 18 || age(s, c) >= 65)
    throw new Error('Ineligible hire');
  const previous = c.humanCapital.lastOccupation;
  const unemployedMonths = c.humanCapital.unemployedMonths;
  const q = emit(
    s,
    'QUALIFICATION_GAINED',
    [
      { kind: 'citizen', id: c.id },
      { kind: 'company', id: firm.id },
    ],
    {
      occupation,
      score: evidence.score,
      education: c.humanCapital.education,
      checks: evidence.checks.map((x) => `${x.name}:${x.actual}>=${x.required}`),
      initial: initial ? 1 : 0,
    },
    c.humanCapital.educationQualifications?.[occupation]
      ? [c.humanCapital.educationQualifications[occupation]!]
      : [],
  );
  c.humanCapital.qualificationEventId = q.id;
  c.employmentStatus = 'employed';
  c.employerId = firm.id;
  c.occupation = occupation;
  c.salary = salaryFor(c, firm, occupation, s.government.policies.minimumWage);
  c.humanCapital.unemployedMonths = 0;
  c.humanCapital.lastOccupation = occupation;
  firm.employeeIds.push(c.id);
  if (previous && previous !== occupation)
    emit(
      s,
      'OCCUPATION_CHANGED',
      [
        { kind: 'citizen', id: c.id },
        { kind: 'company', id: firm.id },
      ],
      { from: previous, to: occupation, unemployedMonths, reason: 'qualified vacancy matching' },
      [q.id],
    );
  const e = emit(
    s,
    'CITIZEN_HIRED',
    [
      { kind: 'citizen', id: c.id },
      { kind: 'company', id: firm.id },
    ],
    {
      name: c.name,
      company: firm.name,
      salary: c.salary,
      ...salaryEvidence(c, firm, occupation, s.government.policies.minimumWage),
      occupation,
      initial: initial ? 1 : 0,
    },
    [q.id],
  );
  c.humanCapital.salaryEventId = e.id;
}
// Weekly occupation buckets avoid a citizen × company search every day.
export function matchJobs(s: CityState, initial = false) {
  const buckets = Object.fromEntries(OCCUPATIONS.map((k) => [k, [] as Citizen[]])) as Record<
    Occupation,
    Citizen[]
  >;
  for (const c of s.citizens)
    if (
      c.lifecycleStatus === 'alive' &&
      c.employmentStatus === 'unemployed' &&
      age(s, c) >= 18 &&
      age(s, c) < 65 &&
      c.humanCapital.track === 'workforce'
    )
      for (const occupation of OCCUPATIONS)
        if (qualification(c, occupation).eligible) buckets[occupation].push(c);
  for (const occupation of OCCUPATIONS)
    buckets[occupation].sort(
      (a, b) =>
        qualification(b, occupation).score - qualification(a, occupation).score ||
        (a.id < b.id ? -1 : 1),
    );
  const cursors = Object.fromEntries(OCCUPATIONS.map((k) => [k, 0])) as Record<Occupation, number>;
  const firms = s.companies
    .filter((f) => f.status === 'active' && f.cash > 100000 && (initial || f.openPositions > 0))
    .sort((a, b) => b.productivity - a.productivity || (a.id < b.id ? -1 : 1));
  const fills = new Map(
    firms.map((f) => {
      f.occupationDemand = occupationDemand(f.industry, f.targetWorkers);
      const filled = Object.fromEntries(OCCUPATIONS.map((k) => [k, 0])) as Record<
        Occupation,
        number
      >;
      for (const id of f.employeeIds) filled[citizenById(s, id).occupation as Occupation]++;
      return [f.id, filled] as const;
    }),
  );
  for (const occupation of [...OCCUPATIONS].reverse()) {
    // Offer bands are monotone for a given applicant; floors/caps can create deterministic ties.
    const ability = (f: CityState['companies'][number]) =>
      f.cash < 500000 ? 90 : f.cash > 5000000 ? 110 : 100;
    const wageBand = (f: CityState['companies'][number]) =>
      Math.max(
        s.government.policies.minimumWage,
        Math.floor((occupationProfiles[occupation].baseWage * ability(f)) / 100),
      );
    const offers = [...firms].sort(
      (a, b) =>
        wageBand(b) - wageBand(a) || b.productivity - a.productivity || (a.id < b.id ? -1 : 1),
    );
    for (const f of offers) {
      let vacancies = Math.min(
        f.occupationDemand[occupation] - fills.get(f.id)![occupation],
        initial ? f.targetWorkers - f.employeeIds.length : f.openPositions,
      );
      const candidates = buckets[occupation];
      while (vacancies > 0 && cursors[occupation] < candidates.length) {
        const c = candidates[cursors[occupation]++];
        if (c.employmentStatus !== 'unemployed') continue;
        hire(s, c, f, occupation, initial);
        vacancies--;
        fills.get(f.id)![occupation]++;
        f.openPositions = Math.max(0, f.openPositions - 1);
      }
    }
  }
}

function learn(s: CityState, c: Citizen, key: keyof Skills, amount: number, reason: string) {
  const old = c.humanCapital.skills[key],
    value = clamp(old + amount);
  c.humanCapital.skills[key] = value;
  if (Math.floor(old / 25) !== Math.floor(value / 25))
    emit(
      s,
      'SKILL_MILESTONE',
      [{ kind: 'citizen', id: c.id }],
      { skill: key, from: old, to: value, reason },
      reason === 'prolonged unemployment' && c.humanCapital.lossEventId
        ? [c.humanCapital.lossEventId]
        : c.humanCapital.educationEventId && reason === 'education'
          ? [c.humanCapital.educationEventId]
          : [],
    );
  syncLegacy(c);
}
function complete(s: CityState, c: Citizen, level: HumanCapital['education']) {
  const h = c.humanCapital;
  const before = Object.fromEntries(
    OCCUPATIONS.map((k) => [k, qualification(c, k).eligible]),
  ) as Record<Occupation, boolean>;
  h.education = level;
  if (level === 'secondary') h.secondaryDay = s.day;
  if (level === 'vocational') h.vocationalDay = s.day;
  if (level === 'tertiary') h.tertiaryDay = s.day;
  const event = emit(
    s,
    level === 'vocational'
      ? 'VOCATIONAL_COMPLETED'
      : level === 'tertiary'
        ? 'TERTIARY_COMPLETED'
        : 'EDUCATION_COMPLETED',
    [
      { kind: 'citizen', id: c.id },
      { kind: 'household', id: c.householdId },
    ],
    {
      level,
      performance: h.performance,
      publicSupport: h.publicSupport,
      vocationalSupport: h.vocationalSupport,
      subsidySupport: h.subsidySupport,
    },
    h.educationEventId ? [h.educationEventId] : [],
  );
  h.educationEventId = event.id;
  learn(s, c, 'general', level === 'tertiary' ? 20 : 12, 'education');
  if (level === 'vocational' || level === 'tertiary')
    learn(
      s,
      c,
      'technical',
      Math.max(
        level === 'vocational' ? 30 : 25,
        (level === 'vocational' ? 55 : 65) - h.skills.technical,
      ),
      'education',
    );
  if (level === 'tertiary') learn(s, c, 'general', Math.max(0, 65 - h.skills.general), 'education');
  if (level === 'secondary') learn(s, c, 'service', 12, 'education');
  syncLegacy(c);
  for (const k of OCCUPATIONS)
    if (!before[k] && qualification(c, k).eligible)
      (h.educationQualifications ??= {})[k] = event.id;
}
function fundEducation(s: CityState) {
  const active = s.citizens.filter((c) => c.lifecycleStatus === 'alive'),
    p = s.government.policies;
  for (const [track, rate, account, support] of [
    ['school', p.publicEducationFunding, 'educationSpending', 'publicSupport'],
    ['vocational', p.vocationalFunding, 'vocationalSpending', 'vocationalSupport'],
    ['tertiary', p.higherEducationSubsidy, 'subsidySpending', 'subsidySupport'],
  ] as const) {
    const students = active.filter((c) =>
      track === 'school' ? age(s, c) >= 6 && age(s, c) < 18 : c.humanCapital.track === track,
    );
    const payment = students.length
      ? Math.min(rate, Math.floor(s.government.cash / students.length))
      : 0;
    const total = payment * students.length;
    s.government.cash -= total;
    s.government[account] += total;
    if (track === 'tertiary')
      for (const c of students) householdById(s, c.householdId).cash += payment;
    else s.economy.imports += total;
    for (const c of students) c.humanCapital[support] = payment;
  }
}
export function educationSystem(s: CityState) {
  if (s.day % 30 !== 0) return;
  fundEducation(s);
  for (const c of s.citizens) {
    if (c.lifecycleStatus !== 'alive') continue;
    const a = age(s, c),
      hc = c.humanCapital,
      h = householdById(s, c.householdId);
    if (a >= 6 && a < 18) {
      hc.track = a < 12 ? 'childhood' : 'secondary';
      if (s.day % 180 === 0) {
        learn(s, c, 'general', 1, 'school attendance');
        learn(s, c, 'service', 1, 'school attendance');
      }
      if (s.day % 360 === 0)
        hc.performance = clamp(
          hc.performance +
            Math.floor(hc.publicSupport / 5000) +
            (h.cash > 150000 ? 1 : 0) +
            (hc.origin.parentEducation >= 2 ? 1 : 0) -
            (c.stress > 60 ? 2 : 0),
        );
    }
    if (a >= 18 && hc.lastEducationAge < 18) {
      const chance = Math.max(
        35,
        Math.min(
          95,
          50 +
            Math.floor(hc.performance / 2) +
            Math.min(15, Math.floor(hc.publicSupport / 3000)) -
            Math.floor(c.stress / 10),
        ),
      );
      const passed = draw(s, 'education', 1, 100) <= chance;
      if (passed) complete(s, c, 'secondary');
      else
        emit(
          s,
          'EDUCATION_DROPPED',
          [
            { kind: 'citizen', id: c.id },
            { kind: 'household', id: h.id },
          ],
          { track: 'secondary', performance: hc.performance, stress: c.stress, chance },
        );
      hc.track = 'workforce';
      if (passed) {
        const tertiary = hc.performance >= 60 && draw(s, 'education', 1, 100) <= 40;
        const route = tertiary ? 'tertiary' : 'vocational';
        const offer = Math.min(
          tertiary
            ? s.government.policies.higherEducationSubsidy
            : s.government.policies.vocationalFunding,
          s.government.cash,
        );
        const reserve = 3 * Math.max(0, (tertiary ? 40000 : 20000) - offer);
        const affordable = h.cash >= reserve;
        if (affordable) {
          hc.track = route;
          c.employmentStatus = 'student';
          emit(
            s,
            'EDUCATION_ENROLLED',
            [
              { kind: 'citizen', id: c.id },
              { kind: 'household', id: h.id },
            ],
            {
              track: route,
              performance: hc.performance,
              householdCash: h.cash,
              monthlyOpportunityCost: tertiary ? 40000 : 20000,
            },
            hc.educationEventId ? [hc.educationEventId] : [],
          );
        } else
          emit(
            s,
            'EDUCATION_DROPPED',
            [
              { kind: 'citizen', id: c.id },
              { kind: 'household', id: h.id },
            ],
            {
              track: route,
              reason: 'access resources below opportunity-cost threshold',
              householdCash: h.cash,
            },
          );
      }
    }
    if (hc.track === 'vocational' || hc.track === 'tertiary') {
      const cost = hc.track === 'tertiary' ? 40000 : Math.max(0, 20000 - hc.vocationalSupport),
        paid = Math.min(h.cash, cost);
      h.cash -= paid;
      s.economy.imports += paid;
      hc.missedStudyMonths = paid < cost ? hc.missedStudyMonths + 1 : 0;
      if (hc.missedStudyMonths >= 3) {
        emit(
          s,
          'EDUCATION_DROPPED',
          [
            { kind: 'citizen', id: c.id },
            { kind: 'household', id: h.id },
          ],
          {
            track: hc.track,
            reason: 'three consecutive underfunded study months',
            monthlyCost: cost,
          },
        );
        hc.track = 'workforce';
      } else if (a >= (hc.track === 'vocational' ? 20 : 22)) {
        complete(s, c, hc.track);
        hc.track = 'workforce';
      }
    }
    hc.lastEducationAge = a;
    if (a >= 18 && ['child', 'student'].includes(c.employmentStatus) && hc.track === 'workforce') {
      c.employmentStatus = 'unemployed';
      emit(
        s,
        'WORKFORCE_ENTERED',
        [{ kind: 'citizen', id: c.id }],
        { name: c.name, education: hc.education },
        hc.educationEventId ? [hc.educationEventId] : [],
      );
    }
  }
}
export function careerSystem(s: CityState) {
  if (s.day % 30 !== 0) return;
  for (const c of s.citizens) {
    if (c.lifecycleStatus !== 'alive') continue;
    const hc = c.humanCapital;
    if (c.employmentStatus === 'employed') {
      const occupation = c.occupation as Occupation,
        f = companyById(s, c.employerId)!;
      hc.experience[occupation]++;
      hc.unemployedMonths = 0;
      if (hc.experience[occupation] % 3 === 0) {
        learn(s, c, occupationProfiles[occupation].relevant, 1, 'work experience');
        learn(s, c, 'managerial', 1, 'role experience');
      }
      let promoted: string | undefined;
      if (
        hc.experience[occupation] >= 24 &&
        hc.experience[occupation] % 12 === 0 &&
        f.lossDays === 0
      ) {
        f.occupationDemand = occupationDemand(f.industry, f.targetWorkers);
        const target = OCCUPATIONS.find(
          (k) =>
            occupationProfiles[k].baseWage > occupationProfiles[occupation].baseWage &&
            f.occupationDemand[k] >
              f.employeeIds.filter((id) => citizenById(s, id).occupation === k).length &&
            qualification(c, k).eligible,
        );
        if (target) {
          const evidence = qualification(c, target);
          const proof = emit(
            s,
            'QUALIFICATION_GAINED',
            [
              { kind: 'citizen', id: c.id },
              { kind: 'company', id: f.id },
            ],
            {
              occupation: target,
              score: evidence.score,
              checks: evidence.checks.map((x) => `${x.name}:${x.actual}>=${x.required}`),
            },
            hc.educationQualifications?.[target] ? [hc.educationQualifications[target]!] : [],
          );
          hc.qualificationEventId = proof.id;
          promoted = emit(
            s,
            'PROMOTED',
            [
              { kind: 'citizen', id: c.id },
              { kind: 'company', id: f.id },
            ],
            {
              from: occupation,
              to: target,
              experienceMonths: hc.experience[occupation],
              score: qualification(c, target).score,
            },
            [proof.id],
          ).id;
          c.occupation = target;
          hc.lastOccupation = target;
          emit(
            s,
            'OCCUPATION_CHANGED',
            [
              { kind: 'citizen', id: c.id },
              { kind: 'company', id: f.id },
            ],
            { from: occupation, to: target, reason: 'qualified internal vacancy' },
            [promoted],
          );
        }
      }
      if (promoted || hc.experience[occupation] % 12 === 0) {
        const salary = salaryFor(
          c,
          f,
          c.occupation as Occupation,
          s.government.policies.minimumWage,
        );
        if (salary !== c.salary) {
          hc.salaryEventId = emit(
            s,
            'SALARY_CHANGED',
            [
              { kind: 'citizen', id: c.id },
              { kind: 'company', id: f.id },
            ],
            {
              from: c.salary,
              to: salary,
              ...salaryEvidence(
                c,
                f,
                c.occupation as Occupation,
                s.government.policies.minimumWage,
              ),
              occupation: c.occupation!,
              reason: promoted ? 'promotion' : 'annual skill, experience and cash-band review',
            },
            promoted ? [promoted] : [],
          ).id;
          c.salary = salary;
        }
      }
    } else if (c.employmentStatus === 'unemployed' && hc.track === 'workforce') {
      hc.unemployedMonths++;
      if (hc.unemployedMonths >= 6 && hc.unemployedMonths % 3 === 0)
        learn(s, c, 'technical', -1, 'prolonged unemployment');
      // Budgeted short-course training redirects an unemployed adult toward technical work.
      if (s.government.policies.vocationalFunding > 0 && hc.unemployedMonths % 3 === 0) {
        const cost = Math.min(s.government.policies.vocationalFunding, s.government.cash);
        s.government.cash -= cost;
        s.government.vocationalSpending += cost;
        s.economy.imports += cost;
        if (cost >= 10000) {
          learn(
            s,
            c,
            'technical',
            Math.min(3, Math.floor(cost / 10000)),
            'funded vocational training',
          );
          if (age(s, c) >= 20 && hc.education === 'secondary' && hc.skills.technical >= 45)
            complete(s, c, 'vocational');
        }
      }
    }
  }
  for (const f of s.companies) {
    const workers = f.employeeIds.map((id) => citizenById(s, id));
    const sum = workers.reduce(
      (n, c) =>
        n +
        occupationProfiles[c.occupation as Occupation].productivity * 100 +
        c.humanCapital.skills[occupationProfiles[c.occupation as Occupation].relevant] * 20,
      0,
    );
    f.skillProductivity = workers.length
      ? Math.max(9000, Math.min(12000, Math.floor(sum / workers.length)))
      : 10000;
  }
}
export function mobilitySystem(s: CityState) {
  for (const h of s.households) {
    const m = h.mobility;
    if (!h.memberIds.length) continue;
    m.incomeSum += h.income;
    m.incomeDays++;
    if (s.day % 30 === 0) {
      m.monthlyIncome = Math.floor((m.incomeSum * 30) / m.incomeDays);
      m.incomeSum = 0;
      m.incomeDays = 0;
      m.class = deriveClass(h);
    }
    if (s.day - m.annualDay >= 365) {
      const from = m.annualClass,
        to = m.class;
      if (from !== to)
        emit(
          s,
          CLASS_BANDS.indexOf(to) > CLASS_BANDS.indexOf(from)
            ? 'CLASS_MOVED_UP'
            : 'CLASS_MOVED_DOWN',
          [
            { kind: 'household', id: h.id },
            ...h.memberIds.map((id) => ({ kind: 'citizen' as const, id })),
          ],
          {
            from,
            to,
            monthlyIncome: m.monthlyIncome,
            wealth: h.cash - h.debt,
            housingCost: h.housingCost,
            windowStart: m.annualDay,
            windowEnd: s.day,
          },
        );
      m.annualClass = to;
      m.annualDay = s.day;
      m.reviewedYears++;
    }
  }
  if (s.day % 30 === 0)
    for (const c of s.citizens) {
      const hc = c.humanCapital;
      if (
        c.lifecycleStatus !== 'alive' ||
        !hc.origin.childhoodObserved ||
        hc.adultComparison ||
        age(s, c) < 25
      )
        continue;
      const current = householdById(s, c.householdId).mobility.class,
        from = hc.origin.class;
      const direction =
        CLASS_BANDS.indexOf(current) > CLASS_BANDS.indexOf(from)
          ? 'up'
          : current === from
            ? 'stable'
            : 'down';
      hc.adultComparison = { day: s.day, origin: from, current, direction };
      emit(
        s,
        'INTERGENERATIONAL_REVIEW',
        [
          { kind: 'citizen', id: c.id },
          { kind: 'household', id: c.householdId },
        ],
        {
          originClass: from,
          currentClass: current,
          direction,
          originDay: hc.origin.day,
          originHousehold: hc.origin.householdId,
          age: age(s, c),
        },
      );
    }
}
// Migration uses a per-ID stable stream, never the existing population/company RNG.
export function migrationSeed(c: Citizen, seed: string) {
  return seedHash(`${seed}:human-capital-migration:${c.id}`);
}
