import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { createCity, advance, applyCommand } from '../../packages/simulation/src/index';
import { checkInvariants } from '../../packages/simulation/src/invariants';
import { qualification, occupationProfiles } from '../../packages/domain/src/occupations';
import { age, OCCUPATIONS } from '../../packages/domain/src/index';
import { stateHash, canonical } from '../../packages/shared/src/canonical';
import { replayCity } from '../../packages/simulation/src/persistence';
import { loadObservatory, saveObservatory } from '../../packages/application/src/save';
import {
  captureHistory,
  createHistory,
  replayHistory,
} from '../../packages/application/src/history';
import { cohortAnalysis, humanDevelopment } from '../../packages/application/src/human-development';
import {
  forkScenarios,
  branchCommand,
  advanceBranch,
  verifyScenarios,
} from '../../packages/application/src/scenarios';

describe('versioned human development', () => {
  it('has bounded, age-valid human capital and evidence-qualified real jobs', () => {
    const s = createCity({ seed: 'HUMAN-QUALIFICATION', population: 1000 });
    expect(s.simulationVersion).toBe('0.2.0');
    expect(checkInvariants(s)).toEqual([]);
    for (const c of s.citizens)
      if (c.employmentStatus === 'employed') {
        expect(qualification(c, c.occupation as (typeof OCCUPATIONS)[number]).eligible).toBe(true);
        const hire = s.events.find((e) => e.id === c.humanCapital.salaryEventId)!;
        const evidence = s.events.find((e) => e.id === hire.causeEventIds[0])!;
        expect(evidence.type).toBe('QUALIFICATION_GAINED');
        expect(evidence.payload.checks).toBeDefined();
      }
    const child = s.citizens.find((c) => age(s, c) < 18)!;
    expect(qualification(child, 'professional').eligible).toBe(false);
    expect(occupationProfiles.professional.baseWage).toBeGreaterThan(
      occupationProfiles.labor.baseWage,
    );
  });
  it('records real education, career, funded spending and cohort mobility over 30 years', async () => {
    const s = createCity({ seed: 'HUMAN-DECADES', population: 250 });
    const children = s.citizens.filter((c) => age(s, c) < 18).map((c) => c.id);
    applyCommand(s, { type: 'SET_POLICY', key: 'higherEducationSubsidy', value: 50000 });
    for (let year = 0; year < 30; year++) {
      advance(s, 365);
      expect(checkInvariants(s), `year=${year}`).toEqual([]);
    }
    expect(
      s.events.some((e) => e.type === 'EDUCATION_COMPLETED' && children.includes(e.actorIds[0])),
    ).toBe(true);
    expect(
      s.events.some((e) => e.type === 'VOCATIONAL_COMPLETED' || e.type === 'TERTIARY_COMPLETED'),
    ).toBe(true);
    expect(s.events.some((e) => e.type === 'SALARY_CHANGED')).toBe(true);
    expect(s.events.some((e) => e.type === 'INTERGENERATIONAL_REVIEW')).toBe(true);
    expect(s.government.educationSpending).toBeGreaterThan(0);
    expect(humanDevelopment(s).adults).toBeGreaterThan(0);
    expect(cohortAnalysis(s, { adultOnly: true }).size).toBeGreaterThan(0);
    expect(await stateHash(replayCity(s))).toBe(await stateHash(s));
  }, 120000);
  it.each([1, 2])(
    'migrates genuine Phase 1 v%i bytes deterministically, preserving the unavailable boundary',
    async (version) => {
      const text = readFileSync(`tests/fixtures/phase1-save-v${version}.json`, 'utf8');
      const a = await loadObservatory(text),
        b = await loadObservatory(text);
      expect(canonical(a)).toBe(canonical(b));
      expect(a.state.simulationVersion).toBe('0.2.0');
      expect(
        a.state.citizens.every(
          (c) =>
            c.humanCapital.provenance === 'legacy-inferred' &&
            c.humanCapital.availableFromDay === 30,
        ),
      ).toBe(true);
      expect(a.history.humanDevelopment.availableFromDay).toBe(30);
      expect(a.state.events.some((e) => e.type === 'EDUCATION_COMPLETED')).toBe(false);
      for (let i = 0; i < 90; i++) {
        advance(a.state);
        captureHistory(a.history, a.state);
        advance(b.state);
        captureHistory(b.history, b.state);
      }
      expect(await stateHash(a.state)).toBe(await stateHash(b.state));
      expect(await stateHash(replayCity(a.state))).toBe(await stateHash(a.state));
      expect(replayHistory(a.state, a.history.historyAvailableFromDay, a.history)).toEqual(
        a.history,
      );
      const saved = await saveObservatory(a);
      expect(JSON.parse(saved).manifest.saveVersion).toBe(3);
      const restored = await loadObservatory(saved);
      expect(canonical(restored)).toBe(canonical(a));
      if (a.scenarios) {
        for (const branch of a.scenarios.branches) advanceBranch(branch, 60);
        expect((await verifyScenarios(a.scenarios)).ok).toBe(true);
      }
    },
  );
  it('rejects corrupt old bytes and incompatible replay semantics', async () => {
    const old = JSON.parse(readFileSync('tests/fixtures/phase1-save-v2.json', 'utf8'));
    old.body.state.citizens[0].skills++;
    await expect(loadObservatory(JSON.stringify(old))).rejects.toThrow('integrity');
    const s = createCity({ seed: 'VERSION-REJECT', population: 100 });
    s.simulationVersion = '0.1.0';
    expect(() => replayCity(s)).toThrow('version mismatch');
  });
  it('education A/B branches preserve original city and replay truthful budgeted outcomes', async () => {
    const s = createCity({ seed: 'EDUCATION-BRANCH', population: 100 }),
      h = createHistory(s),
      before = canonical(s),
      w = forkScenarios(s, h);
    branchCommand(w.branches[1], { type: 'SET_POLICY', key: 'vocationalFunding', value: 50000 });
    for (const b of w.branches) advanceBranch(b, 3650);
    expect(canonical(s)).toBe(before);
    expect((await verifyScenarios(w)).ok).toBe(true);
    expect(w.branches[1].state.government.vocationalSpending).not.toBe(
      w.branches[0].state.government.vocationalSpending,
    );
  }, 120000);
});
