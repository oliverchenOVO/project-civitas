import { mkdirSync, writeFileSync } from 'node:fs';
import { createCity, advance, applyCommand } from '../packages/simulation/src/index';
import { checkInvariants } from '../packages/simulation/src/invariants';
import { replayCity } from '../packages/simulation/src/persistence';
import { createHistory, captureHistory, replayHistory } from '../packages/application/src/history';
import { saveObservatory, loadObservatory } from '../packages/application/src/save';
import { humanDevelopment, cohortAnalysis } from '../packages/application/src/human-development';
import { qualification } from '../packages/domain/src/occupations';
import { age, OCCUPATIONS } from '../packages/domain/src/index';
import { stateHash, canonical } from '../packages/shared/src/canonical';

const runs = [];
mkdirSync('artifacts', { recursive: true });
for (const population of [250, 1000]) {
  const s = createCity({ seed: 'CIVITAS-HUMAN-30', population }),
    history = createHistory(s);
  const before = performance.now();
  const snapshots = [];
  for (let year = 0; year < 30; year++) {
    if (year === 3 || year === 12) {
      applyCommand(s, {
        type: 'SET_POLICY',
        key: year === 3 ? 'higherEducationSubsidy' : 'vocationalFunding',
        value: 40000,
      });
      captureHistory(history, s);
    }
    for (let day = 0; day < 365; day++) {
      advance(s);
      captureHistory(history, s);
    }
    const errors = checkInvariants(s);
    if (errors.length)
      throw Error(
        `seed=${s.config.seed},year=${year},commands=${JSON.stringify(s.commands)}: ${errors.join(',')}`,
      );
    snapshots.push({
      year: year + 1,
      population: s.metrics.population,
      education: humanDevelopment(s).education,
    });
  }
  const runtimeMs = performance.now() - before;
  const simulationHeapMiB = Math.round(process.memoryUsage().heapUsed / 1048576);
  const truth = await stateHash(s),
    replayed = await stateHash(replayCity(s));
  if (truth !== replayed) throw Error('30-year replay mismatch');
  if (canonical(replayHistory(s, 0)) !== canonical(history))
    throw Error('30-year history replay mismatch');
  const body = { state: s, history, scenarios: null },
    encoded = await saveObservatory(body),
    loaded = await loadObservatory(encoded);
  if ((await stateHash(loaded.state)) !== truth) throw Error('30-year save mismatch');
  const continued = structuredClone(s);
  advance(continued, 30);
  advance(loaded.state, 30);
  if ((await stateHash(loaded.state)) !== (await stateHash(continued)))
    throw Error('Continuation mismatch');
  const latency = (fn: () => unknown, n = 100) => {
    const values = [];
    for (let i = 0; i < n; i++) {
      const start = performance.now();
      fn();
      values.push(performance.now() - start);
    }
    values.sort((a, b) => a - b);
    return { meanMs: values.reduce((a, b) => a + b, 0) / n, p95Ms: values[Math.floor(n * 0.95)] };
  };
  const cohort = latency(() => cohortAnalysis(s, { lowIncomeOrigin: true, adultOnly: true }));
  const candidates = s.citizens.filter(
    (c) => c.lifecycleStatus === 'alive' && age(s, c) >= 18 && age(s, c) < 65,
  );
  const matching = latency(() => {
    let qualified = 0;
    for (const c of candidates)
      for (const k of OCCUPATIONS) if (qualification(c, k).eligible) qualified++;
    return qualified;
  });
  const row = {
    simulationVersion: s.simulationVersion,
    initialPopulation: population,
    years: 30,
    runtimeMs: Math.round(runtimeMs),
    events: body.state.events.length,
    historyBytes: JSON.stringify(history).length,
    saveBytes: Buffer.byteLength(encoded),
    simulationHeapMiB,
    verificationHeapMiB: Math.round(process.memoryUsage().heapUsed / 1048576),
    truth,
    saveReplayContinuationPassed: true,
    cohortQuery: cohort,
    qualificationIndex: {
      ...matching,
      candidates: candidates.length,
      pairs: candidates.length * OCCUPATIONS.length,
    },
    development: humanDevelopment(s),
    snapshots,
  };
  runs.push(row);
  console.log(JSON.stringify(row));
  writeFileSync('artifacts/phase2a-human-benchmark.json', JSON.stringify(runs, null, 2));
}
const s = createCity({ seed: 'CIVITAS-CENTURY-1', population: 1000 }),
  rows = [];
function sample() {
  const p = s.citizens.filter((c) => c.lifecycleStatus === 'alive'),
    born = new Set(s.events.filter((e) => e.type === 'CITIZEN_BORN').map((e) => e.actorIds[0]));
  const female = p.filter((c) => c.sex === 'F' && age(s, c) >= 22 && age(s, c) <= 39);
  return {
    year: s.day / 365,
    population: p.length,
    children: p.filter((c) => age(s, c) < 18).length,
    workingAge: p.filter((c) => age(s, c) >= 18 && age(s, c) < 65).length,
    elderly: p.filter((c) => age(s, c) >= 65).length,
    fertilityEligible: female.length,
    eligibleWithLivingSpouse: female.filter(
      (c) => c.spouseId && s.citizens.find((x) => x.id === c.spouseId)?.lifecycleStatus === 'alive',
    ).length,
    eligibleWithResources: female.filter((c) => {
      const h = s.households.find((h) => h.id === c.householdId)!,
        u = s.units.find((u) => u.id === h.residenceId);
      return (
        c.spouseId &&
        s.citizens.find((x) => x.id === c.spouseId)?.lifecycleStatus === 'alive' &&
        c.children.length < 3 &&
        u &&
        h.memberIds.length < u.capacity &&
        h.cash >= 100000
      );
    }).length,
    households: s.households.filter((h) => h.memberIds.length).length,
    formedHouseholds: s.events.filter((e) => e.type === 'HOUSEHOLD_FORMED').length,
    births: born.size,
    deaths: s.events.filter((e) => e.type === 'CITIZEN_DIED').length,
    migrationIn: s.events.filter((e) => e.type === 'CITIZEN_MIGRATED_IN' && !e.payload.initial)
      .length,
    migrationOut: s.events.filter((e) => e.type === 'CITIZEN_MIGRATED_OUT').length,
    bornReachedAdulthood: s.citizens.filter(
      (c) => born.has(c.id) && (c.deathDay ?? s.day) - c.birthDay >= 18 * 365,
    ).length,
    bornAdultAlive: s.citizens.filter(
      (c) => born.has(c.id) && age(s, c) >= 18 && c.lifecycleStatus === 'alive',
    ).length,
  };
}
rows.push(sample());
for (let y = 0; y < 100; y++) {
  advance(s, 365);
  const errors = checkInvariants(s);
  if (errors.length) throw Error(`century year=${y}: ${errors.join(',')}`);
  if ((y + 1) % 10 === 0) {
    rows.push(sample());
    console.log(JSON.stringify(rows.at(-1)));
  }
}
writeFileSync(
  'artifacts/phase2a-demographic-calibration.json',
  JSON.stringify(
    {
      simulationVersion: s.simulationVersion,
      seed: s.config.seed,
      rows,
      traceablePopulation:
        1000 +
          rows.at(-1)!.births +
          rows.at(-1)!.migrationIn -
          rows.at(-1)!.deaths -
          rows.at(-1)!.migrationOut ===
        rows.at(-1)!.population,
      finalHash: await stateHash(s),
    },
    null,
    2,
  ),
);
