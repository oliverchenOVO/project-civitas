import { z } from 'zod';
import { SIMULATION_VERSION, type CityState } from '../../domain/src/index';
import { citySchema, loadCity } from '../../simulation/src/persistence';
import { assertInvariants } from '../../simulation/src/invariants';
import { stateHash } from '../../shared/src/canonical';
import { createHistory, type ObservationHistory } from './history';
import type { ScenarioWorkspace } from './scenarios';

const natural = z.number().int().safe().nonnegative();
const values = citySchema.shape.metrics.extend({ treasury: natural, occupancyRate: natural });
const sample = z.object({ day: natural, values }).strict();
const period = z
  .object({
    id: natural,
    startDay: natural,
    endDay: natural,
    count: natural,
    opening: values,
    closing: values,
    sums: values,
    flows: z
      .object({ taxRevenue: natural, welfareSpending: natural, bankruptcies: natural })
      .strict(),
  })
  .strict();
const entitySeries = z.record(
  z.string(),
  z
    .array(
      z.object({ day: natural, values: z.record(z.string(), z.number().int().safe()) }).strict(),
    )
    .max(20000),
);
export const historySchema = z
  .object({
    historyAvailableFromDay: natural,
    initial: sample,
    daily: z.array(sample).min(1).max(400),
    monthly: z.array(period).max(12000),
    yearly: z.array(period).max(1000),
    companies: entitySeries,
    households: entitySeries,
  })
  .strict();
const branch = z
  .object({ name: z.string().max(80), state: citySchema, history: historySchema })
  .strict();
const workspace = z
  .object({
    checkpoint: citySchema,
    checkpointHistory: historySchema,
    branches: z.tuple([branch, branch]),
  })
  .strict();
const bodySchema = z
  .object({ state: citySchema, history: historySchema, scenarios: workspace.nullable() })
  .strict();
const hash = z.string().regex(/^[0-9a-f]{64}$/);
const saveSchema = z
  .object({
    manifest: z
      .object({
        saveVersion: z.literal(2),
        simulationVersion: z.literal(SIMULATION_VERSION),
        simulationTruthHash: hash,
        containerIntegrityHash: hash,
      })
      .strict(),
    body: bodySchema,
  })
  .strict();
export interface ObservatorySave {
  state: CityState;
  history: ObservationHistory;
  scenarios: ScenarioWorkspace | null;
}
function validateHistory(state: CityState, h: ObservationHistory) {
  if (
    h.initial.day !== h.historyAvailableFromDay ||
    h.initial.day > state.day ||
    h.daily.at(-1)?.day !== state.day
  )
    throw new Error('Invalid history availability boundary');
  for (let i = 1; i < h.daily.length; i++)
    if (h.daily[i].day !== h.daily[i - 1].day + 1) throw new Error('Invalid daily chronology');
  for (const periods of [h.monthly, h.yearly])
    for (let i = 0; i < periods.length; i++) {
      const p = periods[i];
      if (
        p.startDay > p.endDay ||
        p.endDay > state.day ||
        p.count !== p.endDay - p.startDay + 1 ||
        (i > 0 && p.id <= periods[i - 1].id)
      )
        throw new Error('Invalid aggregate chronology');
    }
  for (const [collection, entities] of [
    [h.companies, state.companies],
    [h.households, state.households],
  ] as const) {
    const ids = new Set(entities.map((e) => e.id));
    for (const [id, rows] of Object.entries(collection)) {
      if (!ids.has(id)) throw new Error('Unknown historical entity');
      for (let i = 0; i < rows.length; i++)
        if (
          rows[i].day < h.initial.day ||
          rows[i].day > state.day ||
          (i > 0 && rows[i].day <= rows[i - 1].day)
        )
          throw new Error('Invalid entity series');
    }
  }
}
function validateBody(body: ObservatorySave) {
  assertInvariants(body.state);
  validateHistory(body.state, body.history);
  if (body.scenarios) {
    const w = body.scenarios;
    assertInvariants(w.checkpoint);
    validateHistory(w.checkpoint, w.checkpointHistory);
    for (const b of w.branches) {
      assertInvariants(b.state);
      validateHistory(b.state, b.history);
      if (
        b.state.day < w.checkpoint.day ||
        b.state.config.seed !== w.checkpoint.config.seed ||
        JSON.stringify(b.state.commands.slice(0, w.checkpoint.commands.length)) !==
          JSON.stringify(w.checkpoint.commands)
      )
        throw new Error('Invalid scenario checkpoint lineage');
    }
  }
}
export async function saveObservatory(body: ObservatorySave) {
  validateBody(body);
  return JSON.stringify({
    manifest: {
      saveVersion: 2,
      simulationVersion: SIMULATION_VERSION,
      simulationTruthHash: await stateHash(body.state),
      containerIntegrityHash: await stateHash(body),
    },
    body,
  });
}
export const MIGRATIONS = {
  1: (state: CityState): ObservatorySave => ({
    state,
    history: createHistory(state),
    scenarios: null,
  }),
};
export async function loadObservatory(text: string): Promise<ObservatorySave> {
  if (text.length > 100_000_000) throw new Error('Save exceeds 100 MB limit');
  const input = JSON.parse(text);
  if (input?.manifest?.saveVersion === 1) return MIGRATIONS[1](await loadCity(text));
  const save = saveSchema.parse(input),
    body = save.body as ObservatorySave;
  if ((await stateHash(body)) !== save.manifest.containerIntegrityHash)
    throw new Error('Save container integrity mismatch');
  if ((await stateHash(body.state)) !== save.manifest.simulationTruthHash)
    throw new Error('Simulation truth hash mismatch');
  validateBody(body);
  return body;
}
