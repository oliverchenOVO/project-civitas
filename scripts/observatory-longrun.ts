import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { createCity, advance } from '../packages/simulation/src/index';
import { assertInvariants } from '../packages/simulation/src/invariants';
import { createHistory, captureHistory } from '../packages/application/src/history';
import { saveObservatory, loadObservatory } from '../packages/application/src/save';
import { stateHash } from '../packages/shared/src/canonical';
const state = createCity({ population: 1000, seed: 'OBSERVATORY-CENTURY' }),
  history = createHistory(state);
const start = performance.now(),
  growth = [];
for (let year = 1; year <= 100; year++) {
  for (let day = 0; day < 365; day++) {
    advance(state);
    captureHistory(history, state);
  }
  if (year % 10 === 0) {
    assertInvariants(state);
    const row = {
      year,
      population: state.metrics.population,
      events: state.events.length,
      historyBytes: JSON.stringify(history).length,
    };
    growth.push(row);
    console.log(JSON.stringify(row));
  }
}
const advanceMs = performance.now() - start;
let clock = performance.now();
const save = await saveObservatory({ state, history, scenarios: null });
const saveMs = performance.now() - clock;
assert.equal(JSON.parse(save).manifest.encoding, 'gzip-base64');
clock = performance.now();
const loaded = await loadObservatory(save);
const loadMs = performance.now() - clock;
const truthHash = await stateHash(state);
assert.equal(await stateHash(loaded.state), truthHash);
assert.equal(await stateHash(loaded.history), await stateHash(history));
advance(state);
captureHistory(history, state);
advance(loaded.state);
captureHistory(loaded.history, loaded.state);
assert.equal(await stateHash(loaded.state), await stateHash(state));
assert.equal(await stateHash(loaded.history), await stateHash(history));
const corrupted = JSON.parse(save);
corrupted.manifest.containerIntegrityHash = '0'.repeat(64);
await assert.rejects(() => loadObservatory(JSON.stringify(corrupted)), /integrity/);
const result = {
  passed: true,
  initialPopulation: 1000,
  years: 100,
  growth,
  advanceMs,
  saveMs,
  loadMs,
  saveBytes: Buffer.byteLength(save),
  encoding: 'gzip-base64',
  truthHash,
  continuationVerified: true,
  historyIntegrityVerified: true,
  compressedTamperRejected: true,
  dailySamples: history.daily.length,
  monthlyPeriods: history.monthly.length,
  yearlyPeriods: history.yearly.length,
};
writeFileSync('artifacts/observatory-century.json', JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
