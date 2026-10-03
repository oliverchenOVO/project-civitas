import type { CityState, Command } from '../../domain/src/index';
import { advance, applyCommand } from '../../simulation/src/index';
import { replayCity } from '../../simulation/src/persistence';
import { stateHash } from '../../shared/src/canonical';
import { captureHistory, type ObservationHistory } from './history';

export interface Branch {
  name: string;
  state: CityState;
  history: ObservationHistory;
}
export interface ScenarioWorkspace {
  migratedLegacy?: boolean;
  checkpoint: CityState;
  checkpointHistory: ObservationHistory;
  branches: [Branch, Branch];
}
export function forkScenarios(state: CityState, history: ObservationHistory): ScenarioWorkspace {
  return {
    checkpoint: structuredClone(state),
    checkpointHistory: structuredClone(history),
    branches: [
      { name: 'Baseline A', state: structuredClone(state), history: structuredClone(history) },
      { name: 'Policy B', state: structuredClone(state), history: structuredClone(history) },
    ],
  };
}
export function branchCommand(branch: Branch, command: Command) {
  applyCommand(branch.state, command);
  captureHistory(branch.history, branch.state);
}
export function advanceBranch(branch: Branch, days: number) {
  if (!Number.isInteger(days) || days < 0 || days > 36500)
    throw new Error('Invalid comparison window');
  for (let i = 0; i < days; i++) {
    advance(branch.state);
    captureHistory(branch.history, branch.state);
  }
}
export async function verifyScenarios(workspace: ScenarioWorkspace) {
  const results = [];
  for (const branch of workspace.branches) {
    const state: CityState = workspace.migratedLegacy
        ? JSON.parse(branch.state.migrationCheckpoint!)
        : structuredClone(workspace.checkpoint),
      history: ObservationHistory = workspace.migratedLegacy
        ? JSON.parse(branch.history.replayCheckpoint!)
        : structuredClone(workspace.checkpointHistory);
    if (workspace.migratedLegacy) {
      state.migrationCheckpoint = branch.state.migrationCheckpoint;
      history.replayCheckpoint = branch.history.replayCheckpoint;
    }
    for (const recorded of branch.state.commands.slice(state.commands.length)) {
      while (state.day < recorded.day) {
        advance(state);
        captureHistory(history, state);
      }
      applyCommand(state, recorded.command);
      captureHistory(history, state);
    }
    while (state.day < branch.state.day) {
      advance(state);
      captureHistory(history, state);
    }
    results.push({
      name: branch.name,
      truth: await stateHash(branch.state),
      replayTruth: await stateHash(replayCity(branch.state)),
      history: await stateHash(branch.history),
      replayHistory: await stateHash(history),
      checkpointTruth: await stateHash(state),
    });
  }
  return {
    ok: results.every(
      (r) =>
        r.truth === r.replayTruth && r.truth === r.checkpointTruth && r.history === r.replayHistory,
    ),
    results,
  };
}
