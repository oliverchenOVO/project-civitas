import { SIMULATION_VERSION, type CityState, type Occupation } from '../../domain/src/index';
import { occupationDemand } from '../../domain/src/occupations';
import {
  emptyMobility,
  initializeHumanCapital,
  initializeBackground,
  migrationSeed,
} from './human-capital';
import { legacyCitySchema } from './legacy-schema';
import { assertInvariants } from './invariants';

export function migrateLegacyState(input: unknown): CityState {
  const old = legacyCitySchema.parse(input);
  const state = structuredClone(old) as unknown as CityState;
  state.simulationVersion = SIMULATION_VERSION;
  Object.assign(state.government.policies, {
    publicEducationFunding: 10000,
    vocationalFunding: 10000,
    higherEducationSubsidy: 10000,
  });
  Object.assign(state.government, {
    educationSpending: 0,
    vocationalSpending: 0,
    subsidySpending: 0,
  });
  for (const h of state.households) h.mobility = emptyMobility(state.day);
  for (const f of state.companies) {
    f.occupationDemand = occupationDemand(f.industry, f.targetWorkers);
    f.skillProductivity = 10000;
  }
  const savedStreams = { ...state.rng };
  for (const c of state.citizens) {
    const stream = migrationSeed(c, state.config.seed);
    state.rng.education = stream;
    initializeHumanCapital(state, c, 'legacy-inferred');
    c.humanCapital.performance = 40 + (stream % 51);
    if (c.employmentStatus === 'employed') {
      const firm = state.companies.find((f) => f.id === c.employerId)!;
      const occupation: Occupation =
        firm.industry === 'Technology'
          ? 'professional'
          : firm.industry === 'Manufacturing'
            ? 'technical'
            : firm.industry === 'Food'
              ? 'labor'
              : 'service';
      c.occupation = occupation;
      c.humanCapital.lastOccupation = occupation;
      c.humanCapital.legacyOccupation = occupation;
    } else c.occupation = undefined;
  }
  state.rng = savedStreams;
  initializeBackground(state);
  assertInvariants(state);
  // Replay begins at the accepted upgraded checkpoint, never reinterprets old commands as 0.2.0 rules.
  state.migrationCheckpoint = JSON.stringify(state);
  return state;
}
