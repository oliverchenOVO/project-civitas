import type { CityState, DomainEvent, EntityRef, EventType } from '../../domain/src/index';
import { historicalValue, sampleCity, type MetricKey, type ObservationHistory } from './history';

const order = (a: DomainEvent, b: DomainEvent) =>
  a.tick - b.tick || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
const entityKey = (ref: EntityRef) => `${ref.kind}:${ref.id}`;
function push<K, V>(map: Map<K, V[]>, key: K, value: V) {
  const rows = map.get(key) ?? [];
  rows.push(value);
  map.set(key, rows);
}
export class EventIndex {
  readonly byId = new Map<string, DomainEvent>();
  readonly byEntity = new Map<string, DomainEvent[]>();
  readonly byType = new Map<EventType, DomainEvent[]>();
  readonly effects = new Map<string, string[]>();
  readonly byCategory = new Map<string, DomainEvent[]>();
  readonly major: DomainEvent[] = [];
  private indexed = 0;
  private source?: DomainEvent[];
  sync(events: DomainEvent[]) {
    if (this.source !== events || events.length < this.indexed) {
      this.byId.clear();
      this.byEntity.clear();
      this.byType.clear();
      this.effects.clear();
      this.byCategory.clear();
      this.major.length = 0;
      this.indexed = 0;
      this.source = events;
    }
    for (; this.indexed < events.length; this.indexed++) {
      const e = events[this.indexed];
      this.byId.set(e.id, e);
      push(this.byType, e.type, e);
      push(this.byCategory, e.category, e);
      if (e.severity === 'major') this.major.push(e);
      for (const key of new Set(e.entityRefs.map(entityKey))) push(this.byEntity, key, e);
      for (const cause of new Set(e.causeEventIds)) push(this.effects, cause, e.id);
    }
  }
  entity(kind: EntityRef['kind'], id: string) {
    return this.byEntity.get(`${kind}:${id}`) ?? [];
  }
  category(category: string) {
    return category === 'all'
      ? (this.source ?? [])
      : category === 'major'
        ? this.major
        : (this.byCategory.get(category) ?? []);
  }
  range(start: number, end: number, types?: EventType[]) {
    // Each indexed list is chronological; binary bounds skip prior years.
    const slice = (source: DomainEvent[]) => {
      let lo = 0,
        hi = source.length;
      while (lo < hi) {
        const mid = (lo + hi) >>> 1;
        if (source[mid].tick <= start) lo = mid + 1;
        else hi = mid;
      }
      let stop = lo;
      while (stop < source.length && source[stop].tick <= end) stop++;
      return source.slice(lo, stop);
    };
    return types
      ? [...new Set(types)].flatMap((type) => slice(this.byType.get(type) ?? [])).sort(order)
      : slice(this.source ?? []);
  }
  trace(id: string, direction: 'causes' | 'effects', maxDepth = 8, maxNodes = 100) {
    if (
      !Number.isInteger(maxDepth) ||
      maxDepth < 0 ||
      maxDepth > 64 ||
      !Number.isInteger(maxNodes) ||
      maxNodes < 1 ||
      maxNodes > 1000
    )
      throw new Error('Invalid traversal bounds');
    const root = this.byId.get(id);
    if (!root) return { nodes: [], edges: [], missing: [id], truncated: false };
    const seen = new Set([id]),
      missing = new Set<string>(),
      nodes: DomainEvent[] = [root];
    const edges: { from: string; to: string }[] = [];
    const edgeKeys = new Set<string>();
    const queue = [{ id, depth: 0 }];
    let truncated = false;
    for (let cursor = 0; cursor < queue.length; cursor++) {
      const item = queue[cursor];
      const refs =
        direction === 'causes'
          ? (this.byId.get(item.id)?.causeEventIds ?? [])
          : (this.effects.get(item.id) ?? []);
      if (item.depth >= maxDepth) {
        if (refs.some((ref) => !seen.has(ref))) truncated = true;
        continue;
      }
      for (const ref of [...new Set(refs)].sort((a, b) => {
        const x = this.byId.get(a),
          y = this.byId.get(b);
        return x && y ? order(x, y) : a < b ? -1 : a > b ? 1 : 0;
      })) {
        const event = this.byId.get(ref);
        if (!event) {
          missing.add(ref);
          continue;
        }
        if (!seen.has(ref) && nodes.length >= maxNodes) {
          truncated = true;
          continue;
        }
        const from = direction === 'causes' ? ref : item.id,
          to = direction === 'causes' ? item.id : ref;
        const key = `${from}:${to}`;
        if (!edgeKeys.has(key)) {
          edges.push({ from, to });
          edgeKeys.add(key);
        }
        if (!seen.has(ref)) {
          seen.add(ref);
          nodes.push(event);
          queue.push({ id: ref, depth: item.depth + 1 });
        }
      }
    }
    return { nodes: nodes.sort(order), edges, missing: [...missing].sort(), truncated };
  }
}
export function importance(e: DomainEvent) {
  const p = e.payload;
  const workers = typeof p.workers === 'number' ? p.workers : 0;
  const financial = Math.max(
    ...['cost', 'monthlyLoss', 'unpaid'].map((k) =>
      typeof p[k] === 'number' ? Math.abs(p[k] as number) : 0,
    ),
  );
  return (
    (e.severity === 'major' ? 40 : 0) +
    (e.type === 'POLICY_CHANGED' ? 40 : 0) +
    Math.min(30, new Set(e.entityRefs.map(entityKey)).size * 2) +
    Math.min(40, workers * 4) +
    Math.min(20, Math.floor(Math.log10(financial + 1)) * 3) +
    (/MIGRATED|BORN|DIED/.test(e.type) ? 10 : 0)
  );
}
const relevant: Partial<Record<MetricKey, EventType[]>> = {
  population: ['CITIZEN_BORN', 'CITIZEN_DIED', 'CITIZEN_MIGRATED_IN', 'CITIZEN_MIGRATED_OUT'],
  employed: [
    'CITIZEN_HIRED',
    'CITIZEN_FIRED',
    'CITIZEN_QUIT',
    'CITIZEN_RETIRED',
    'WORKFORCE_ENTERED',
  ],
  unemployed: [
    'CITIZEN_HIRED',
    'CITIZEN_FIRED',
    'CITIZEN_QUIT',
    'CITIZEN_RETIRED',
    'WORKFORCE_ENTERED',
  ],
  unemploymentRate: [
    'CITIZEN_HIRED',
    'CITIZEN_FIRED',
    'CITIZEN_QUIT',
    'CITIZEN_RETIRED',
    'WORKFORCE_ENTERED',
    'CITIZEN_DIED',
    'CITIZEN_MIGRATED_IN',
    'CITIZEN_MIGRATED_OUT',
  ],
  householdWealth: ['HOUSEHOLD_INCOME_DROP', 'RENT_DEFAULT', 'HOUSEHOLD_MOVED', 'CITIZEN_HIRED'],
  averageRent: ['RENT_CHANGED', 'HOUSING_BUILT', 'HOUSEHOLD_MOVED'],
  occupancyRate: ['HOUSEHOLD_MOVED', 'HOUSING_BUILT', 'CITIZEN_MIGRATED_OUT'],
  happiness: ['RENT_DEFAULT', 'HOUSEHOLD_INCOME_DROP', 'CITIZEN_HIRED', 'CITIZEN_FIRED'],
};
export function explainMetric(
  state: CityState,
  h: ObservationHistory,
  index: EventIndex,
  metric: MetricKey,
  days = 90,
) {
  const start = Math.max(0, state.day - days),
    current = sampleCity(state).values[metric];
  const events = index
    .range(start, state.day, relevant[metric])
    .sort((a, b) => importance(b) - importance(a) || order(a, b));
  const counts: Record<string, number> = {},
    groups = new Map<string, { companyId: string; events: string[]; count: number }>();
  for (const event of events) {
    counts[event.type] = (counts[event.type] ?? 0) + 1;
    if (event.type === 'CITIZEN_FIRED') {
      const company = event.entityRefs.find((r) => r.kind === 'company');
      if (!company) continue;
      const group = groups.get(company.id) ?? { companyId: company.id, events: [], count: 0 };
      group.events.push(event.id);
      group.count++;
      groups.set(company.id, group);
    }
  }
  return {
    metric,
    startDay: start,
    endDay: state.day,
    current,
    deltas: [30, 90, 365].map((window) => {
      const before = historicalValue(h, state.day - window, metric);
      return { days: window, value: before === undefined ? null : current - before };
    }),
    events,
    counts,
    groups: [...groups.values()].sort(
      (a, b) => b.count - a.count || (a.companyId < b.companyId ? -1 : 1),
    ),
    classification: 'association' as const,
    contribution: {
      classification: 'contribution' as const,
      description:
        'Counts of recorded transitions, not an additive decomposition of the unemployment rate.',
      counts,
    },
    boundary: h.historyAvailableFromDay,
  };
}
export function cityHistory(
  index: EventIndex,
  filters: { year?: number; category?: string; districtId?: string; entityType?: string },
) {
  return index
    .range(
      filters.year === undefined ? -1 : filters.year * 365 - 1,
      filters.year === undefined ? Infinity : (filters.year + 1) * 365 - 1,
    )
    .filter(
      (e) =>
        (!filters.category || e.category === filters.category) &&
        (!filters.districtId ||
          e.entityRefs.some((r) => r.kind === 'district' && r.id === filters.districtId)) &&
        (!filters.entityType || e.entityRefs.some((r) => r.kind === filters.entityType)),
    )
    .sort((a, b) => importance(b) - importance(a) || order(a, b));
}
export function yearReview(h: ObservationHistory, index: EventIndex, year: number) {
  const period = h.yearly.find((p) => p.id === year);
  if (
    !period ||
    period.startDay !== year * 365 + 1 ||
    period.endDay !== (year + 1) * 365 ||
    period.count !== 365
  )
    return undefined;
  const events = index
    .range(year * 365, (year + 1) * 365)
    .sort((a, b) => importance(b) - importance(a) || order(a, b));
  const districts = new Map<string, number>();
  for (const e of events)
    for (const r of e.entityRefs)
      if (r.kind === 'district') districts.set(r.id, (districts.get(r.id) ?? 0) + 1);
  return {
    period,
    events: events.slice(0, 10),
    mostRecordedDistrict:
      [...districts].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))[0] ?? null,
    human: (() => {
      const rows = h.humanDevelopment.samples,
        opening = rows.find((r) => r.day === year * 365),
        closing = rows.find((r) => r.day === (year + 1) * 365);
      if (!opening || !closing || h.humanDevelopment.availableFromDay > year * 365)
        return undefined;
      return {
        educationSpending: closing.educationSpending - opening.educationSpending,
        vocationalSpending: closing.vocationalSpending - opening.vocationalSpending,
        subsidySpending: closing.subsidySpending - opening.subsidySpending,
        upward: closing.upward - opening.upward,
        downward: closing.downward - opening.downward,
      };
    })(),
    populationMilestone:
      Math.floor(period.closing.population / 100) - Math.floor(period.opening.population / 100),
  };
}
export function searchEntities(s: CityState, text: string, limit = 30) {
  const needle = text.trim().toLocaleLowerCase();
  if (!needle) return [];
  return [
    ...s.citizens.map((e) => ({ kind: 'citizen' as const, id: e.id, name: e.name })),
    ...s.households.map((e) => ({ kind: 'household' as const, id: e.id, name: `家庭 ${e.id}` })),
    ...s.companies.map((e) => ({ kind: 'company' as const, id: e.id, name: e.name })),
    ...s.districts.map((e) => ({ kind: 'district' as const, id: e.id, name: e.name })),
  ]
    .filter((e) => `${e.id} ${e.name}`.toLocaleLowerCase().includes(needle))
    .slice(0, limit);
}
