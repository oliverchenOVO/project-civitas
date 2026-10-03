import { mkdirSync, writeFileSync } from 'node:fs';
import { createCity, advance } from '../packages/simulation/src/index';
import { createHistory, captureHistory } from '../packages/application/src/history';
import { EventIndex, explainMetric, searchEntities } from '../packages/application/src/queries';
import { stateHash } from '../packages/shared/src/canonical';
import { createCityLayout } from '../apps/desktop/src/scene/layout';
import { projectSceneData, affectedParcels } from '../apps/desktop/src/scene/data';
const state = createCity({ seed: 'OBSERVATORY-QUERY-BENCHMARK', population: 1000 }),
  history = createHistory(state);
const start = performance.now();
for (let i = 0; i < 3650; i++) {
  advance(state);
  captureHistory(history, state);
}
const collectionMs = performance.now() - start,
  index = new EventIndex();
const time = performance.now();
index.sync(state.events);
const indexMs = performance.now() - time;
function measure(name: string, fn: () => unknown, repeats = 100) {
  const times = [];
  for (let i = 0; i < repeats; i++) {
    const start = performance.now();
    fn();
    times.push(performance.now() - start);
  }
  times.sort((a, b) => a - b);
  return {
    name,
    repeats,
    meanMs: times.reduce((n, v) => n + v, 0) / repeats,
    p95Ms: times[Math.floor(repeats * 0.95)],
    maxMs: times.at(-1),
  };
}
const causal = state.events.find((e) => e.type === 'COMPANY_LAYOFF') ?? state.events.at(-1)!;
const citizen =
  state.citizens.find((c) => index.entity('citizen', c.id).length > 5) ?? state.citizens[0];
const layout = createCityLayout(state),
  data = projectSceneData(state, layout);
const refs = state.citizens.slice(0, 300).map((c) => ({ kind: 'citizen' as const, id: c.id }));
const timings = [
  measure('bounded causal graph', () => index.trace(causal.id, 'effects')),
  measure('10-year citizen indexed history', () => index.entity('citizen', citizen.id)),
  measure('90-day metric explanation', () =>
    explainMetric(state, history, index, 'unemploymentRate'),
  ),
  measure('global entity search', () => searchEntities(state, 'Anna')),
  measure('base scene data projection', () => projectSceneData(state, layout)),
  measure('affected parcel projection, 300 refs', () => affectedParcels(data, refs)),
];
const result = {
  population: 1000,
  days: 3650,
  events: state.events.length,
  collectionMs,
  indexMs,
  timings,
  historyBytes: JSON.stringify(history).length,
  dailySamples: history.daily.length,
  monthlyPeriods: history.monthly.length,
  truthHash: await stateHash(state),
  measurement:
    'Node CPU query/projection only; packaged Pixi base/overlay rendering measured separately by scene QA',
};
mkdirSync('artifacts', { recursive: true });
writeFileSync('artifacts/observatory-benchmark.json', JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
