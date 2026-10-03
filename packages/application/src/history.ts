import type { CityState, Metrics } from '../../domain/src/index';
import { advance, applyCommand, createCity } from '../../simulation/src/index';

export type MetricKey = keyof Metrics | 'treasury' | 'occupancyRate';
export type Values = Record<MetricKey, number>;
export interface Sample {
  day: number;
  values: Values;
}
export interface Period {
  id: number;
  startDay: number;
  endDay: number;
  count: number;
  opening: Values;
  closing: Values;
  sums: Values;
  flows: { taxRevenue: number; welfareSpending: number; bankruptcies: number };
}
export interface EntitySample {
  day: number;
  values: Record<string, number>;
}
export interface ObservationHistory {
  historyAvailableFromDay: number;
  initial: Sample;
  daily: Sample[];
  monthly: Period[];
  yearly: Period[];
  companies: Record<string, EntitySample[]>;
  households: Record<string, EntitySample[]>;
}
export const metricSemantics = {
  taxRevenue: 'flow',
  welfareSpending: 'flow',
  bankruptcies: 'cumulative',
} as const;
export function sampleCity(s: CityState): Sample {
  return {
    day: s.day,
    values: {
      ...s.metrics,
      treasury: s.government.cash,
      occupancyRate: s.metrics.units
        ? Math.floor((s.metrics.occupied * 10000) / s.metrics.units)
        : 0,
    },
  };
}
export function createHistory(s: CityState): ObservationHistory {
  const initial = sampleCity(s);
  const h: ObservationHistory = {
    historyAvailableFromDay: s.day,
    initial,
    daily: [initial],
    monthly: [],
    yearly: [],
    companies: {},
    households: {},
  };
  captureEntities(h, s);
  return h;
}
function captureEntities(h: ObservationHistory, s: CityState) {
  for (const f of s.companies) {
    const series = (h.companies[f.id] ??= []);
    const row = {
      day: s.day,
      values: {
        employees: f.employeeIds.length,
        revenue: f.revenue,
        payroll: f.payroll,
        profit: f.profit,
        cash: f.cash,
      },
    };
    if (series.at(-1)?.day === s.day) series[series.length - 1] = row;
    else series.push(row);
  }
  for (const f of s.households) {
    const series = (h.households[f.id] ??= []);
    const row = {
      day: s.day,
      values: {
        cash: f.cash,
        debt: f.debt,
        income: f.income,
        expenses: f.expenses,
        housingCost: f.housingCost,
        members: f.memberIds.length,
      },
    };
    if (series.at(-1)?.day === s.day) series[series.length - 1] = row;
    else series.push(row);
  }
}
// Twelve presentation months: eleven 30-day periods and a 35-day final month.
// Each observation year contains days year*365+1 through (year+1)*365.
export function periodIds(day: number) {
  const year = Math.floor((day - 1) / 365);
  return { year, month: year * 12 + Math.min(11, Math.floor(((day - 1) % 365) / 30)) };
}
export function captureHistory(h: ObservationHistory, s: CityState) {
  const row = sampleCity(s),
    previous = h.daily.at(-1)!;
  if (row.day < previous.day || row.day > previous.day + 1)
    throw new Error('History requires sequential observation');
  if (row.day === previous.day) {
    // Commands change closing stocks at the same instant, never add another day of flows.
    for (const periods of [h.monthly, h.yearly]) {
      const p = periods.at(-1);
      if (p?.endDay === row.day) {
        for (const key of Object.keys(row.values) as MetricKey[])
          p.sums[key] += row.values[key] - previous.values[key];
        p.closing = row.values;
      }
    }
    h.daily[h.daily.length - 1] = row;
    if (h.initial.day === row.day) h.initial = row;
    if (h.companies[s.companies[0]?.id]?.at(-1)?.day === row.day) captureEntities(h, s);
    return;
  }
  const ids = periodIds(row.day);
  for (const [periods, id] of [
    [h.monthly, ids.month],
    [h.yearly, ids.year],
  ] as const) {
    let p = periods.at(-1);
    if (!p || p.id !== id) {
      p = {
        id,
        startDay: row.day,
        endDay: row.day,
        count: 0,
        opening: previous.values,
        closing: row.values,
        sums: Object.fromEntries(Object.keys(row.values).map((k) => [k, 0])) as Values,
        flows: { taxRevenue: 0, welfareSpending: 0, bankruptcies: 0 },
      };
      periods.push(p);
    }
    p.endDay = row.day;
    p.count++;
    p.closing = row.values;
    for (const key of Object.keys(row.values) as MetricKey[]) p.sums[key] += row.values[key];
    p.flows.taxRevenue += row.values.taxRevenue;
    p.flows.welfareSpending += row.values.welfareSpending;
    p.flows.bankruptcies += row.values.bankruptcies - previous.values.bankruptcies;
  }
  h.daily.push(row);
  if (h.daily.length > 400) h.daily.shift();
  const tomorrow = periodIds(row.day + 1);
  if (tomorrow.month !== ids.month) captureEntities(h, s);
}
export function historicalValue(h: ObservationHistory, day: number, key: MetricKey) {
  if (day < h.historyAvailableFromDay) return undefined;
  if (day === h.initial.day) return h.initial.values[key];
  const daily = h.daily.find((row) => row.day === day);
  if (daily) return daily.values[key];
  return h.monthly.find((row) => row.endDay === day)?.closing[key];
}
export function replayHistory(source: CityState, boundary: number) {
  const state = createCity(source.config);
  let history: ObservationHistory | undefined;
  let commandCursor = 0;
  for (let day = 0; day <= source.day; day++) {
    if (day > 0) {
      advance(state);
      if (history) captureHistory(history, state);
    }
    while (source.commands[commandCursor]?.day === day) {
      applyCommand(state, source.commands[commandCursor++].command);
      if (history) captureHistory(history, state);
    }
    if (day === boundary) history = createHistory(state);
  }
  if (!history) throw new Error('Invalid replay history boundary');
  return history;
}
