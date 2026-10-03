import { it, expect } from 'vitest';
import { createCity } from '../../packages/simulation/src/index';
import { createHistory } from '../../packages/application/src/history';
import {
  forkScenarios,
  branchCommand,
  advanceBranch,
  verifyScenarios,
} from '../../packages/application/src/scenarios';
import { saveObservatory, loadObservatory } from '../../packages/application/src/save';
import { checkInvariants } from '../../packages/simulation/src/invariants';
import { stateHash } from '../../packages/shared/src/canonical';
import type { Command, Policies } from '../../packages/domain/src/index';

it.each(Array.from({ length: 8 }, (_, i) => i))(
  'generated education fork %i preserves save and replay',
  async (i) => {
    const seed = `HUMAN-FORK-PROPERTY-${i}`,
      commands: Command[] = [];
    let rng = i + 17;
    const pick = (n: number) => {
      rng ^= rng << 13;
      rng ^= rng >>> 17;
      rng ^= rng << 5;
      return (rng >>> 0) % n;
    };
    const keys: (keyof Policies)[] = [
      'publicEducationFunding',
      'vocationalFunding',
      'higherEducationSubsidy',
    ];
    const original = createCity({ seed, population: 100 }),
      originalHash = await stateHash(original);
    let workspace = forkScenarios(original, createHistory(original));
    try {
      for (let step = 0; step < 6; step++) {
        const command: Command = {
          type: 'SET_POLICY',
          key: keys[pick(keys.length)],
          value: pick(100001),
        };
        commands.push(command);
        branchCommand(workspace.branches[1], command);
        for (const b of workspace.branches) {
          advanceBranch(b, 60);
          expect(checkInvariants(b.state)).toEqual([]);
        }
        if (step % 2 === 0)
          workspace = (
            await loadObservatory(
              await saveObservatory({
                state: original,
                history: createHistory(original),
                scenarios: workspace,
              }),
            )
          ).scenarios!;
      }
      expect((await verifyScenarios(workspace)).ok).toBe(true);
      expect(await stateHash(original)).toBe(originalHash);
    } catch (e) {
      throw new Error(`seed=${seed}, commands=${JSON.stringify(commands)}, error=${String(e)}`);
    }
  },
  120000,
);
