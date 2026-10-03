import { z } from 'zod';
import { SIMULATION_VERSION, type CityState } from '../../domain/src/index';
import { citySchema, loadCity } from '../../simulation/src/persistence';
import { assertInvariants } from '../../simulation/src/invariants';
import { stateHash } from '../../shared/src/canonical';
import { createHistory, type ObservationHistory } from './history';
import type { ScenarioWorkspace } from './scenarios';
import { legacyCitySchema } from '../../simulation/src/legacy-schema';
import { migrateLegacyState } from '../../simulation/src/migration';
import { humanDevelopment } from './human-development';

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
    humanDevelopment: z
      .object({
        availableFromDay: natural,
        samples: z
          .array(
            z
              .object({
                day: natural,
                population: natural,
                adults: natural,
                education: z.record(
                  z.enum(['basic', 'secondary', 'vocational', 'tertiary']),
                  natural,
                ),
                unemployedByEducation: z.record(
                  z.enum(['basic', 'secondary', 'vocational', 'tertiary']),
                  natural,
                ),
                laborForceByEducation: z.record(
                  z.enum(['basic', 'secondary', 'vocational', 'tertiary']),
                  natural,
                ),
                incomeByEducation: z.record(
                  z.enum(['basic', 'secondary', 'vocational', 'tertiary']),
                  natural,
                ),
                occupations: z.record(
                  z.enum([
                    'labor',
                    'service',
                    'clerical',
                    'technical',
                    'professional',
                    'management',
                  ]),
                  natural,
                ),
                classes: z.record(z.enum(['vulnerable', 'working', 'middle', 'affluent']), natural),
                upward: natural,
                downward: natural,
                mobilityHouseholdYears: natural,
                educationSpending: natural,
                vocationalSpending: natural,
                subsidySpending: natural,
                productivity: natural,
              })
              .strict(),
          )
          .min(1)
          .max(20000),
      })
      .strict(),
    replayCheckpoint: z.string().max(250000000).optional(),
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
    migratedLegacy: z.boolean().optional(),
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
        saveVersion: z.literal(3),
        simulationVersion: z.literal(SIMULATION_VERSION),
        simulationTruthHash: hash,
        containerIntegrityHash: hash,
        encoding: z.enum(['json', 'gzip-base64']).optional(),
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
  const human = h.humanDevelopment;
  if (human.availableFromDay > state.day || human.samples[0]?.day !== human.availableFromDay)
    throw new Error('Invalid human-development availability');
  for (let i = 0; i < human.samples.length; i++) {
    const row = human.samples[i];
    if (
      row.day > state.day ||
      (i > 0 && row.day <= human.samples[i - 1].day) ||
      Object.values(row.education).reduce((n, x) => n + x, 0) !== row.adults
    )
      throw new Error('Invalid human-development chronology/cohort');
  }
  if (h.replayCheckpoint) {
    const baseline = historySchema.parse(JSON.parse(h.replayCheckpoint));
    if (baseline.replayCheckpoint || baseline.daily.at(-1)!.day > state.day)
      throw new Error('Invalid history replay checkpoint');
  }
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
  if (body.state.migrationCheckpoint) {
    const checkpoint = citySchema.parse(JSON.parse(body.state.migrationCheckpoint)) as CityState;
    assertInvariants(checkpoint);
    if (
      checkpoint.migrationCheckpoint ||
      checkpoint.day > body.state.day ||
      checkpoint.config.seed !== body.state.config.seed ||
      JSON.stringify(checkpoint.commands) !==
        JSON.stringify(body.state.commands.slice(0, checkpoint.commands.length))
    )
      throw new Error('Invalid migration replay checkpoint');
  }
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
  const manifest = {
    saveVersion: 3,
    simulationVersion: SIMULATION_VERSION,
    simulationTruthHash: await stateHash(body.state),
    containerIntegrityHash: await stateHash(body),
    encoding: 'json' as 'json' | 'gzip-base64',
  };
  const text = JSON.stringify(body);
  if (text.length > 500_000_000) throw new Error('Expanded save exceeds 500 MB limit');
  if (text.length <= 1_000_000) return JSON.stringify({ manifest, body });
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'));
  const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 32768)
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 32768));
  manifest.encoding = 'gzip-base64';
  return JSON.stringify({ manifest, compressedPayload: btoa(binary) });
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
  if (input?.manifest?.encoding === 'gzip-base64') {
    const encoded = z
      .object({
        manifest: z
          .object({
            saveVersion: natural,
            simulationVersion: z.string(),
            simulationTruthHash: hash,
            containerIntegrityHash: hash,
            encoding: z.literal('gzip-base64'),
          })
          .strict(),
        compressedPayload: z.string(),
      })
      .strict()
      .parse(input);
    const bytes = Uint8Array.from(atob(encoded.compressedPayload), (c) => c.charCodeAt(0));
    const reader = new Blob([bytes])
      .stream()
      .pipeThrough(new DecompressionStream('gzip'))
      .getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        const item = await reader.read();
        if (item.done) break;
        size += item.value.length;
        if (size > 500_000_000) throw new Error('Expanded save exceeds 500 MB limit');
        chunks.push(item.value);
      }
    } finally {
      await reader.cancel();
      reader.releaseLock();
    }
    const expanded = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      expanded.set(chunk, offset);
      offset += chunk.length;
    }
    input.body = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(expanded));
    delete input.compressedPayload;
  }
  if (input?.manifest?.saveVersion === 2) {
    const oldHistory = historySchema.omit({ humanDevelopment: true, replayCheckpoint: true });
    const oldBranch = z
      .object({ name: z.string().max(80), state: legacyCitySchema, history: oldHistory })
      .strict();
    const oldWorkspace = z
      .object({
        checkpoint: legacyCitySchema,
        checkpointHistory: oldHistory,
        branches: z.tuple([oldBranch, oldBranch]),
      })
      .strict();
    const old = z
      .object({
        manifest: z
          .object({
            saveVersion: z.literal(2),
            simulationVersion: z.literal('0.1.0'),
            simulationTruthHash: hash,
            containerIntegrityHash: hash,
            encoding: z.enum(['json', 'gzip-base64']).optional(),
          })
          .strict(),
        body: z
          .object({
            state: legacyCitySchema,
            history: oldHistory,
            scenarios: oldWorkspace.nullable(),
          })
          .strict(),
      })
      .strict()
      .parse(input);
    if (
      (await stateHash(old.body)) !== old.manifest.containerIntegrityHash ||
      (await stateHash(old.body.state)) !== old.manifest.simulationTruthHash
    )
      throw new Error('Legacy save integrity mismatch');
    const migratePair = (pair: { state: unknown; history: unknown }) => {
      const state = migrateLegacyState(pair.state);
      const history = structuredClone(pair.history) as ObservationHistory;
      history.humanDevelopment = {
        availableFromDay: state.day,
        samples: [humanDevelopment(state)],
      };
      history.replayCheckpoint = JSON.stringify(history);
      return { state, history };
    };
    const migrated = migratePair(old.body);
    const scenarios = old.body.scenarios
      ? {
          migratedLegacy: true,
          checkpoint: migratePair({
            state: old.body.scenarios.checkpoint,
            history: old.body.scenarios.checkpointHistory,
          }).state,
          checkpointHistory: migratePair({
            state: old.body.scenarios.checkpoint,
            history: old.body.scenarios.checkpointHistory,
          }).history,
          branches: old.body.scenarios.branches.map((b) => ({
            name: b.name,
            ...migratePair(b),
          })) as ScenarioWorkspace['branches'],
        }
      : null;
    // Legacy diverged branches resume from their individual migration points; a new fork is required for cross-version checkpoint replay.
    const body = { ...migrated, scenarios };
    validateBody(body);
    return body;
  }
  const save = saveSchema.parse(input),
    body = save.body as ObservatorySave;
  if ((await stateHash(body)) !== save.manifest.containerIntegrityHash)
    throw new Error('Save container integrity mismatch');
  if ((await stateHash(body.state)) !== save.manifest.simulationTruthHash)
    throw new Error('Simulation truth hash mismatch');
  validateBody(body);
  return body;
}
