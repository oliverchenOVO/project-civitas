import { writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { createCity } from '../packages/simulation/src/index';
import { createHistory } from '../packages/application/src/history';
import {
  forkScenarios,
  branchCommand,
  advanceBranch,
  verifyScenarios,
} from '../packages/application/src/scenarios';
import { humanDevelopment } from '../packages/application/src/human-development';
import { stateHash } from '../packages/shared/src/canonical';

const state = createCity({ seed: 'CIVITAS-HUMAN-30', population: 250 });
const originalHash = await stateHash(state);
const workspace = forkScenarios(state, createHistory(state));
for (const [i, b] of workspace.branches.entries()) {
  branchCommand(b, {
    type: 'SET_POLICY',
    key: 'publicEducationFunding',
    value: i === 0 ? 0 : 50000,
  });
  advanceBranch(b, 3650);
}
const results = workspace.branches.map((b) => ({
  policy: b.state.government.policies.publicEducationFunding,
  development: humanDevelopment(b.state),
  secondaryCompletions: b.state.events.filter((e) => e.type === 'EDUCATION_COMPLETED').length,
  vocationalCompletions: b.state.events.filter((e) => e.type === 'VOCATIONAL_COMPLETED').length,
  tertiaryCompletions: b.state.events.filter((e) => e.type === 'TERTIARY_COMPLETED').length,
  truth: b.state.citizens
    .filter((c) => c.lifecycleStatus === 'alive')
    .map((c) => ({
      id: c.id,
      education: c.humanCapital.education,
      salary: c.salary,
      skills: c.humanCapital.skills,
    })),
}));
const replay = await verifyScenarios(workspace);
assert.equal(replay.ok, true);
assert.equal(await stateHash(state), originalHash);
assert.notDeepEqual(results[0].truth, results[1].truth);
assert.notDeepEqual(results[0].development.education, results[1].development.education);
writeFileSync(
  'artifacts/phase2a-policy-evidence.json',
  JSON.stringify(
    { seed: state.config.seed, years: 10, originalPreserved: true, replay, results },
    null,
    2,
  ),
);
console.log(
  JSON.stringify(
    results.map(({ truth, ...r }) => ({ ...r, citizens: truth.length })),
    null,
    2,
  ),
);
