import { performance } from 'node:perf_hooks';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createCity, advance } from '../packages/simulation/src/index';
import { checkInvariants } from '../packages/simulation/src/invariants';
import { stateHash } from '../packages/shared/src/canonical';
const results = [];
for (const population of [100, 250, 500, 1000]) {
  const s = createCity({ population, seed: 'CIVITAS-BENCHMARK-1' });
  const start = performance.now();
  const violations: string[] = [];
  for (let y = 0; y < 10; y++) {
    advance(s, 365);
    violations.push(...checkInvariants(s));
  }
  const ms = performance.now() - start;
  const row = {
    initialPopulation: population,
    years: 10,
    day: s.day,
    runtimeMs: Math.round(ms),
    daysPerSecond: Math.round(3650000 / ms),
    eventCount: s.events.length,
    finalPopulation: s.metrics.population,
    activeCompanies: s.metrics.companies,
    finalHash: await stateHash(s),
    invariantViolations: violations.length,
    memoryMiB: Math.round(process.memoryUsage().heapUsed / 1048576),
  };
  results.push(row);
  console.log(JSON.stringify(row));
  if (violations.length) throw new Error(violations.slice(0, 10).join('\n'));
}
mkdirSync('artifacts', { recursive: true });
writeFileSync('artifacts/benchmark.json', JSON.stringify(results, null, 2));
writeFileSync(
  'artifacts/benchmark.md',
  '| Citizens | Years | Runtime ms | Days/sec | Events | Violations |\n|---|---|---|---|---|---|\n' +
    results
      .map(
        (r) =>
          `| ${r.initialPopulation} | 10 | ${r.runtimeMs} | ${r.daysPerSecond} | ${r.eventCount} | ${r.invariantViolations} |`,
      )
      .join('\n'),
);
