import { afterAll, describe, it, expect } from 'vitest';
import { writeFileSync, mkdirSync } from 'node:fs';
import { createCity, advance, applyCommand } from '../../packages/simulation/src/index';
import { checkInvariants } from '../../packages/simulation/src/invariants';
import { saveCity, loadCity, replayCity } from '../../packages/simulation/src/persistence';
import { stateHash } from '../../packages/shared/src/canonical';
import type { Command, Policies } from '../../packages/domain/src/index';
const seeds = Array.from({ length: 32 }, (_, i) => `POLICY-PROPERTY-${i}`);
const failures: { seed: string; commands: Command[]; error: string }[] = [];
afterAll(() => {
  mkdirSync('artifacts', { recursive: true });
  writeFileSync(
    'artifacts/property-tests.json',
    JSON.stringify(
      {
        generator: 'bounded seeded xorshift32 valid policy/affordable construction sequences',
        seeds,
        commandsPerSeed: 24,
        daysPerSeed: 360,
        passed: failures.length === 0,
        failures,
      },
      null,
      2,
    ),
  );
});
describe('bounded policy sequence properties', () => {
  it.each(seeds)('%s reproduces invariants, save/load and replay', async (seed) => {
    let rng = seeds.indexOf(seed) + 1;
    const pick = (max: number) => {
      rng ^= rng << 13;
      rng ^= rng >>> 17;
      rng ^= rng << 5;
      return (rng >>> 0) % max;
    };
    let s = createCity({ seed, population: 100 });
    const commands: Command[] = [];
    try {
      for (let i = 0; i < 24; i++) {
        const choice = pick(8),
          keys: (keyof Policies)[] = [
            'incomeTax',
            'corporateTax',
            'welfare',
            'minimumWage',
            'publicEducationFunding',
            'vocationalFunding',
            'higherEducationSubsidy',
          ];
        const command: Command =
          choice === 7 && s.government.cash >= 800000
            ? { type: 'BUILD_HOUSING', districtId: s.districts[pick(4)].id, units: 1 }
            : {
                type: 'SET_POLICY',
                key: keys[choice % 7],
                value: pick(
                  choice % 7 < 2
                    ? 6001
                    : choice % 7 === 2
                      ? 300001
                      : choice % 7 === 3
                        ? 600001
                        : 100001,
                ),
              };
        commands.push(command);
        applyCommand(s, command);
        advance(s, 15);
        if (i % 6 === 0) s = await loadCity(await saveCity(s));
        expect(checkInvariants(s), `seed=${seed}, step=${i}`).toEqual([]);
        expect(
          s.citizens.every(
            (c) => c.lifecycleStatus === 'alive' || c.employmentStatus !== 'employed',
          ),
          seed,
        ).toBe(true);
      }
      const loaded = await loadCity(await saveCity(s));
      expect(await stateHash(loaded), seed).toBe(await stateHash(s));
      advance(s, 30);
      advance(loaded, 30);
      expect(await stateHash(loaded), seed).toBe(await stateHash(s));
      expect(await stateHash(replayCity(s)), seed).toBe(await stateHash(s));
    } catch (error) {
      failures.push({ seed, commands, error: String(error) });
      throw error;
    }
  });
});
