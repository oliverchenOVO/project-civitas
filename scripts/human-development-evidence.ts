import { readFileSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { createCity, advance, applyCommand } from '../packages/simulation/src/index';
import { stateHash } from '../packages/shared/src/canonical';
import { cohortAnalysis } from '../packages/application/src/human-development';
import { replayCity } from '../packages/simulation/src/persistence';
import { saveObservatory, loadObservatory } from '../packages/application/src/save';
import { createHistory } from '../packages/application/src/history';
import { checkInvariants } from '../packages/simulation/src/invariants';

const benchmark = JSON.parse(readFileSync('artifacts/phase2a-human-benchmark.json', 'utf8'));
const results = [];
for (const population of [250, 1000]) {
  const s = createCity({ seed: 'CIVITAS-HUMAN-30', population });
  for (let year = 0; year < 30; year++) {
    if (year === 3 || year === 12)
      applyCommand(s, {
        type: 'SET_POLICY',
        key: year === 3 ? 'higherEducationSubsidy' : 'vocationalFunding',
        value: 40000,
      });
    advance(s, 365);
  }
  const truth = await stateHash(s);
  assert.equal(
    truth,
    benchmark.find((r: { initialPopulation: number }) => r.initialPopulation === population).truth,
  );
  const counts = Object.fromEntries(
    [...new Set(s.events.map((e) => e.type))].map((type) => [
      type,
      s.events.filter((e) => e.type === type).length,
    ]),
  );
  const examples = Object.fromEntries(
    [
      'EDUCATION_COMPLETED',
      'VOCATIONAL_COMPLETED',
      'TERTIARY_COMPLETED',
      'PROMOTED',
      'SALARY_CHANGED',
      'CITIZEN_FIRED',
      'CLASS_MOVED_UP',
      'CLASS_MOVED_DOWN',
      'INTERGENERATIONAL_REVIEW',
    ].map((type) => [type, s.events.find((e) => e.type === type)]),
  );
  const affluentDecline = s.events.find(
    (e) => e.type === 'CLASS_MOVED_DOWN' && e.payload.from === 'affluent',
  );
  const cohorts = {
    adults: cohortAnalysis(s, { adultOnly: true }),
    bornYears1to5: cohortAnalysis(s, { adultOnly: true, bornFromYear: 0, bornToYear: 4 }),
    observedVulnerableChildhood: cohortAnalysis(s, { adultOnly: true, lowIncomeOrigin: true }),
    tertiaryAdults: cohortAnalysis(s, { adultOnly: true, tertiary: true }),
  };
  results.push({ population, truth, counts, examples, affluentDecline, cohorts });
}
writeFileSync('artifacts/phase2a-human-evidence.json', JSON.stringify(results, null, 2));
console.log(
  JSON.stringify(
    results.map((r) => ({
      population: r.population,
      counts: r.counts,
      cohorts: Object.fromEntries(
        Object.entries(r.cohorts).map(([k, v]) => [
          k,
          { n: v.size, reviewed: v.reviewed, up: v.up, down: v.down, stable: v.stable },
        ]),
      ),
    })),
    null,
    2,
  ),
);
const century = createCity({ seed: 'CIVITAS-CENTURY-1', population: 1000 });
advance(century, 36500);
assert.deepEqual(checkInvariants(century), []);
const centuryHash = await stateHash(century);
const calibration = JSON.parse(
  readFileSync('artifacts/phase2a-demographic-calibration.json', 'utf8'),
);
assert.equal(centuryHash, calibration.finalHash);
const encoded = await saveObservatory({
  state: century,
  history: createHistory(century),
  scenarios: null,
});
const loaded = (await loadObservatory(encoded)).state;
assert.equal(await stateHash(loaded), centuryHash);
assert.equal(await stateHash(replayCity(century)), centuryHash);
advance(loaded, 30);
advance(century, 30);
assert.equal(await stateHash(loaded), await stateHash(century));
writeFileSync(
  'artifacts/phase2a-century-verification.json',
  JSON.stringify(
    {
      seed: century.config.seed,
      years: 100,
      saveFormat: 'v3 gzip observatory; history availability begins at this measured checkpoint',
      saveBytes: Buffer.byteLength(encoded),
      expandedStateBytes: Buffer.byteLength(JSON.stringify(century)),
      cohortDay: century.day,
      truth: centuryHash,
      saveReplayContinuationPassed: true,
      cohorts: {
        adults: cohortAnalysis(century, { adultOnly: true }),
        observedVulnerableChildhood: cohortAnalysis(century, {
          adultOnly: true,
          lowIncomeOrigin: true,
        }),
      },
    },
    null,
    2,
  ),
);
console.log('PASS: century truth, save/load, replay, thirty-day continuation and observed cohorts');
