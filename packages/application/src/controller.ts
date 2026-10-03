import { type CityState, type Command, type Config } from '../../domain/src/index';
import { createCity, advance, applyCommand } from '../../simulation/src/index';
import { replayCity } from '../../simulation/src/persistence';
import { stateHash } from '../../shared/src/canonical';
import { captureHistory, createHistory, replayHistory } from './history';
import { EventIndex } from './queries';
import { loadObservatory, saveObservatory } from './save';
import { forkScenarios, advanceBranch, branchCommand, type ScenarioWorkspace } from './scenarios';
export class CityController {
  state: CityState = createCity();
  history = createHistory(this.state);
  readonly events = new EventIndex();
  scenarios: ScenarioWorkspace | null = null;
  revision = 0;
  speed = 0;
  processingMs = 0;
  private listeners = new Set<() => void>();
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  getSnapshot = () => this.revision;
  private publish() {
    this.events.sync(this.state.events);
    this.revision++;
    for (const listener of this.listeners) listener();
  }
  newCity(config: Config) {
    this.speed = 0;
    this.state = createCity(config);
    this.history = createHistory(this.state);
    this.scenarios = null;
    this.publish();
  }
  step(days = 1) {
    const start = performance.now();
    if (!Number.isInteger(days) || days < 0 || days > 100000) throw new Error('Invalid day count');
    for (let i = 0; i < days; i++) {
      advance(this.state);
      captureHistory(this.history, this.state);
    }
    this.processingMs = performance.now() - start;
    this.publish();
  }
  setSpeed(speed: number) {
    this.speed = speed;
    this.publish();
  }
  command(command: Command) {
    applyCommand(this.state, command);
    captureHistory(this.history, this.state);
    this.publish();
  }
  save() {
    return saveObservatory({ state: this.state, history: this.history, scenarios: this.scenarios });
  }
  async load(text: string) {
    const body = await loadObservatory(text);
    this.speed = 0;
    this.state = body.state;
    this.history = body.history;
    this.scenarios = body.scenarios;
    this.publish();
  }
  async verifyReplay() {
    this.setSpeed(0);
    const source = structuredClone(this.state);
    const replay = replayCity(source);
    const [expected, actual] = await Promise.all([stateHash(source), stateHash(replay)]);
    const [historyExpected, historyActual] = await Promise.all([
      stateHash(this.history),
      stateHash(replayHistory(source, this.history.historyAvailableFromDay, this.history)),
    ]);
    return {
      ok: expected === actual && historyExpected === historyActual,
      expected,
      actual,
      historyExpected,
      historyActual,
    };
  }
  fork() {
    this.speed = 0;
    this.scenarios = forkScenarios(this.state, this.history);
    this.publish();
  }
  scenarioCommand(command: Command) {
    if (!this.scenarios) throw new Error('No checkpoint');
    branchCommand(this.scenarios.branches[1], command);
    this.publish();
  }
  runScenarios(days: number) {
    if (!this.scenarios) throw new Error('No checkpoint');
    for (const branch of this.scenarios.branches) advanceBranch(branch, days);
    this.publish();
  }
}
export const controller = new CityController();
controller.events.sync(controller.state.events);
