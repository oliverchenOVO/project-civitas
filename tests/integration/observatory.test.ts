import { describe, it, expect } from 'vitest';
import { createCity, advance, applyCommand } from '../../packages/simulation/src/index';
import { loadCity, saveCity, replayCity } from '../../packages/simulation/src/persistence';
import { canonical, stateHash } from '../../packages/shared/src/canonical';
import {
  captureHistory,
  createHistory,
  replayHistory,
} from '../../packages/application/src/history';
import {
  EventIndex,
  explainMetric,
  importance,
  yearReview,
} from '../../packages/application/src/queries';
import { loadObservatory, saveObservatory } from '../../packages/application/src/save';
import {
  advanceBranch,
  branchCommand,
  forkScenarios,
  verifyScenarios,
} from '../../packages/application/src/scenarios';
import type { DomainEvent } from '../../packages/domain/src/index';
const city = () => createCity({ seed: 'OBSERVATORY-TEST', population: 100 });
function run(s: ReturnType<typeof city>, h: ReturnType<typeof createHistory>, days: number) {
  for (let i = 0; i < days; i++) {
    advance(s);
    captureHistory(h, s);
  }
}
function event(id: string, causes: string[] = [], tick = 1): DomainEvent {
  return {
    id,
    tick,
    type: 'CITIZEN_FIRED',
    entityRefs: [{ kind: 'citizen', id: 'citizen-1' }],
    actorIds: [],
    targetIds: [],
    payload: {},
    severity: 'info',
    category: 'people',
    causeEventIds: causes,
  };
}
describe('recorded causal queries', () => {
  it('direct / multiple causes, reverse consequences and duplicate elimination', () => {
    const index = new EventIndex();
    index.sync([event('a'), event('b'), event('c', ['a', 'b', 'a']), event('d', ['c'])]);
    expect(index.trace('c', 'causes', 1).nodes.map((e) => e.id)).toEqual(['a', 'b', 'c']);
    expect(index.trace('a', 'effects').nodes.map((e) => e.id)).toEqual(['a', 'c', 'd']);
    expect(index.trace('c', 'causes').edges).toHaveLength(2);
  });
  it('empty causes and missing references never invent edges', () => {
    const index = new EventIndex();
    index.sync([event('a'), event('b', ['missing'])]);
    expect(index.trace('a', 'causes').edges).toEqual([]);
    expect(index.trace('b', 'causes').missing).toEqual(['missing']);
    expect(index.trace('unknown', 'effects').missing).toEqual(['unknown']);
  });
  it('deep chains are bounded, cycles terminate and ordering is deterministic', () => {
    const rows = Array.from({ length: 30 }, (_, i) =>
      event(
        `e${i.toString().padStart(2, '0')}`,
        i ? [`e${(i - 1).toString().padStart(2, '0')}`] : [],
        i,
      ),
    );
    rows[0].causeEventIds = ['e29'];
    const index = new EventIndex();
    index.sync(rows);
    expect(index.trace('e29', 'causes', 64, 100).nodes).toHaveLength(30);
    expect(index.trace('e29', 'causes', 3, 5).truncated).toBe(true);
    expect(index.trace('e29', 'causes', 64, 4).nodes).toHaveLength(4);
    expect(index.trace('e29', 'causes')).toEqual(index.trace('e29', 'causes'));
  });
  it('append indexing, ledger replacement, entity dedup and chronology ranges', () => {
    const index = new EventIndex(),
      rows = [event('a', [], 0)];
    index.sync(rows);
    rows.push(event('b', ['a'], 30));
    index.sync(rows);
    expect(index.entity('citizen', 'citizen-1')).toHaveLength(2);
    expect(index.range(0, 30, ['CITIZEN_FIRED'])).toHaveLength(1);
    index.sync([event('new')]);
    expect(index.byId.has('a')).toBe(false);
  });
});
describe('compact observed history', () => {
  it('daily sampling preserves truth/RNG and same-day commands do not double count flow', () => {
    const s = city(),
      h = createHistory(s);
    advance(s);
    const before = canonical(s);
    captureHistory(h, s);
    expect(canonical(s)).toBe(before);
    expect(h.daily.at(-1)!.values).toMatchObject(s.metrics);
    const revenue = h.monthly[0].flows.taxRevenue;
    applyCommand(s, { type: 'SET_POLICY', key: 'incomeTax', value: 3000 });
    captureHistory(h, s);
    expect(h.monthly[0].flows.taxRevenue).toBe(revenue);
    expect(h.monthly[0].count).toBe(1);
  });
  it('month/year boundaries distinguish closing stocks, summed flows and cumulative bankruptcies', () => {
    const s = city(),
      h = createHistory(s);
    run(s, h, 366);
    expect(h.monthly[0].count).toBe(30);
    expect(h.monthly[11].count).toBe(35);
    expect(h.yearly[0].count).toBe(365);
    expect(h.yearly[1].count).toBe(1);
    expect(h.yearly[0].closing.population).toBe(
      h.daily.find((r) => r.day === 365)!.values.population,
    );
    expect(h.yearly[0].flows.taxRevenue).toBe(
      h.daily.filter((r) => r.day > 0 && r.day <= 365).reduce((n, r) => n + r.values.taxRevenue, 0),
    );
    expect(h.yearly[0].flows.bankruptcies).toBe(
      h.yearly[0].closing.bankruptcies - h.yearly[0].opening.bankruptcies,
    );
    const index = new EventIndex();
    index.sync(s.events);
    expect(yearReview(h, index, 0)).toBeDefined();
    expect(yearReview(h, index, 1)).toBeUndefined();
  });
  it('zero-event periods collect measured stocks without invented explanations', () => {
    const s = city();
    s.events = [];
    const h = createHistory(s);
    s.day = 1;
    s.government.taxRevenue = 0;
    s.metrics.taxRevenue = 0;
    captureHistory(h, s);
    const index = new EventIndex();
    index.sync(s.events);
    expect(explainMetric(s, h, index, 'unemploymentRate').events).toEqual([]);
    expect(h.monthly[0].flows.taxRevenue).toBe(0);
  });
  it('save/load continuation and replay history agree separately from simulation hash', async () => {
    const s = city(),
      h = createHistory(s);
    run(s, h, 50);
    applyCommand(s, { type: 'SET_POLICY', key: 'welfare', value: 55000 });
    captureHistory(h, s);
    const loaded = await loadObservatory(
      await saveObservatory({ state: s, history: h, scenarios: null }),
    );
    run(s, h, 40);
    run(loaded.state, loaded.history, 40);
    expect(await stateHash(loaded.state)).toBe(await stateHash(s));
    expect(loaded.history).toEqual(h);
    expect(replayHistory(s, 0)).toEqual(h);
    expect(await stateHash(replayCity(s))).toBe(await stateHash(s));
  });
  it('v1 migration starts at load day and rejects container corruption', async () => {
    const s = city();
    advance(s, 90);
    const legacy = await saveCity(s),
      loaded = await loadObservatory(legacy);
    expect(loaded.history.historyAvailableFromDay).toBe(90);
    expect(loaded.history.daily).toHaveLength(1);
    expect(loaded.history.monthly).toHaveLength(0);
    run(loaded.state, loaded.history, 30);
    expect(replayHistory(loaded.state, 90)).toEqual(loaded.history);
    const input = JSON.parse(await saveObservatory(loaded));
    input.body.history.daily[0].values.population++;
    await expect(loadObservatory(JSON.stringify(input))).rejects.toThrow('integrity');
    expect(canonical(await loadCity(legacy))).toBe(canonical(s));
  });
  it('old migration partial year cannot claim a complete year review', () => {
    const s = city();
    advance(s, 90);
    const h = createHistory(s);
    run(s, h, 275);
    const index = new EventIndex();
    index.sync(s.events);
    expect(yearReview(h, index, 0)).toBeUndefined();
    expect(h.yearly[0].count).toBe(275);
  });
  it('bounded daily retention and linear monthly/entity growth for a century', () => {
    const s = city(),
      h = createHistory(s);
    // Fixed-state observations isolate storage growth from demographic/event-ledger growth.
    for (let day = 1; day <= 36500; day++) {
      s.day = day;
      captureHistory(h, s);
    }
    expect(h.daily).toHaveLength(400);
    expect(h.yearly).toHaveLength(100);
    expect(h.monthly).toHaveLength(1200);
    expect(h.companies[s.companies[0].id]).toHaveLength(1201);
    expect(JSON.stringify(h).length).toBeLessThan(20_000_000);
  });
});
describe('scenario checkpoint and evidence semantics', () => {
  it('fork isolates original/A/B RNG, counters, commands and histories; both replay after save/load', async () => {
    const s = city(),
      h = createHistory(s);
    run(s, h, 365);
    const before = canonical(s),
      workspace = forkScenarios(s, h);
    expect(await stateHash(workspace.branches[0].state)).toBe(
      await stateHash(workspace.branches[1].state),
    );
    branchCommand(workspace.branches[1], { type: 'SET_POLICY', key: 'minimumWage', value: 400000 });
    for (const b of workspace.branches) advanceBranch(b, 365);
    expect(canonical(s)).toBe(before);
    expect(workspace.branches[0].state.commands).toHaveLength(0);
    expect(workspace.branches[1].state.commands).toHaveLength(1);
    expect((await verifyScenarios(workspace)).ok).toBe(true);
    const saved = await loadObservatory(
      await saveObservatory({ state: s, history: h, scenarios: workspace }),
    );
    expect((await verifyScenarios(saved.scenarios!)).ok).toBe(true);
  });
  it('event importance is deterministic and explanations distinguish counted transitions from causality', () => {
    const s = city(),
      h = createHistory(s);
    run(s, h, 90);
    const index = new EventIndex();
    index.sync(s.events);
    const result = explainMetric(s, h, index, 'unemploymentRate');
    expect(result.classification).toBe('association');
    expect(result.contribution.classification).toBe('contribution');
    for (const e of result.events) expect(importance(e)).toBe(importance(e));
    expect(result.groups.reduce((n, g) => n + g.count, 0)).toBe(
      result.events.filter(
        (e) => e.type === 'CITIZEN_FIRED' && e.entityRefs.some((r) => r.kind === 'company'),
      ).length,
    );
  });
});
