import { describe, it, expect } from 'vitest';
import { createCity, advance, applyCommand, PIPELINE } from '../../packages/simulation/src/index';
import { randomInt } from '../../packages/simulation/src/random';
import { checkInvariants, assertInvariants } from '../../packages/simulation/src/invariants';
import { stateHash, canonical } from '../../packages/shared/src/canonical';
import { loadCity, saveCity, replayCity } from '../../packages/simulation/src/persistence';
import {
  taxOn,
  dailyWage,
  companySystem,
  housingSystem,
  incomeSystem,
} from '../../packages/simulation/src/systems';
import { narrative } from '../../packages/narrative/src/index';
import { totalMoney } from '../../packages/simulation/src/world';
const city = (seed = 'TEST') => createCity({ seed, population: 100 });
describe('deterministic primitives', () => {
  it('reproduces scoped RNG and isolates streams', () => {
    const a = {},
      b = {};
    expect(randomInt(a, 'company', 'seed', 1, 1000)).toBe(randomInt(b, 'company', 'seed', 1, 1000));
    randomInt(a, 'relationship', 'seed', 1, 1000);
    expect(randomInt(a, 'company', 'seed', 1, 1000)).toBe(randomInt(b, 'company', 'seed', 1, 1000));
  });
  it('persists RNG continuation', () => {
    const a = {};
    randomInt(a, 'test', 'S', 0, 999);
    const b = structuredClone(a);
    expect(randomInt(a, 'test', 'S', 0, 999)).toBe(randomInt(b, 'test', 'S', 0, 999));
  });
  it('calculates integer taxes', () => {
    expect(taxOn(10001, 1500)).toBe(1500);
    expect(taxOn(10001, 0)).toBe(0);
  });
  it('distributes exact monthly wage over 30 days', () => {
    expect(
      Array.from({ length: 30 }, (_, i) => dailyWage(10001, i + 1)).reduce((a, b) => a + b, 0),
    ).toBe(10001);
  });
  it('canonicalizes object ordering', async () => {
    expect(canonical({ b: 2, a: 1 })).toBe(canonical({ a: 1, b: 2 }));
    expect(await stateHash({ a: 1, b: 2 })).toBe(await stateHash({ b: 2, a: 1 }));
  });
  it('has fixed documented pipeline order', () => {
    expect(PIPELINE.map((s) => s.name)).toEqual([
      'calendarSystem',
      'demographySystem',
      'householdSystem',
      'educationSystem',
      'careerSystem',
      'employmentSystem',
      'incomeSystem',
      'governmentSystem',
      'expenseSystem',
      'companySystem',
      'housingSystem',
      'relationshipSystem',
      'migrationSystem',
      'familyFormationSystem',
      'mobilitySystem',
      'metricsSystem',
      'eventAggregationSystem',
    ]);
  });
});
describe('world and economy', () => {
  it.each([100, 250, 500, 1000])('generates valid %i-citizen city', (p) => {
    const s = createCity({ seed: 'INIT', population: p });
    expect(s.metrics.population).toBe(p);
    expect(s.districts).toHaveLength(4);
    expect(checkInvariants(s)).toEqual([]);
  });
  it('rejects invalid configuration', () => {
    expect(() => createCity({ population: NaN, seed: 'S' })).toThrow();
    expect(() => createCity({ population: 250, seed: '' })).toThrow();
  });
  it('hires actual citizens and pays wages from employer cash', () => {
    const s = city();
    const before = s.metrics.employed;
    const h = s.households[0];
    const balance = h.cash;
    advance(s);
    expect(s.metrics.employed).toBeGreaterThanOrEqual(before);
    expect(s.companies.some((f) => f.payroll > 0)).toBe(true);
    expect(h.income).toBeGreaterThan(0);
    expect(h.cash).not.toBe(balance);
    assertInvariants(s);
  });
  it('records balanced consumption, exports, payroll and taxes', () => {
    const s = city();
    advance(s, 120);
    expect(totalMoney(s)).toBe(
      s.economy.openingMoney + s.economy.exports + s.economy.financing - s.economy.imports,
    );
    expect(s.economy.exports).toBeGreaterThan(0);
    expect(s.government.taxRevenue).toBeGreaterThan(0);
    assertInvariants(s);
  });
  it('lays off on persistent losses, links effects to the cause', () => {
    const s = city();
    const f = s.companies.find((f) => f.employeeIds.length > 2)!;
    s.economy.financing -= f.cash - 100000;
    f.cash = 100000;
    f.lossDays = 40;
    f.demand = 3000;
    s.day = 30;
    const n = f.employeeIds.length;
    incomeSystem(s);
    companySystem(s);
    expect(f.employeeIds.length).toBeLessThan(n);
    const event = s.events.find((e) => e.type === 'COMPANY_LAYOFF');
    expect(event).toBeDefined();
    expect(
      s.events.some((e) => e.type === 'CITIZEN_FIRED' && e.causeEventIds.includes(event!.id)),
    ).toBe(true);
  });
  it('bankruptcy releases actual workers and preserves firm history', () => {
    const s = city();
    const f = s.companies.find((f) => f.employeeIds.length > 0)!;
    const ids = [...f.employeeIds];
    s.economy.financing -= f.cash;
    f.cash = 0;
    f.productivity = 0;
    s.day = 2;
    companySystem(s);
    expect(f.status).toBe('bankrupt');
    expect(f.employeeIds).toEqual([]);
    expect(ids.every((id) => !s.citizens.find((c) => c.id === id)!.employerId)).toBe(true);
    expect(s.events.some((e) => e.type === 'COMPANY_BANKRUPT')).toBe(true);
  });
  it('relocates unaffordable households into real vacant units', () => {
    const s = city();
    const h = s.households.find((h) => s.units.find((u) => u.id === h.residenceId)!.rent > 55000)!;
    h.income = 0;
    s.day = 30;
    const old = h.residenceId;
    housingSystem(s);
    expect(h.residenceId).not.toBe(old);
    expect(s.units.find((u) => u.id === h.residenceId)?.occupantHouseholdId).toBe(h.id);
  });
  it('housing policy spends real treasury and creates finite supply', () => {
    const s = city();
    const count = s.units.length,
      cash = s.government.cash;
    applyCommand(s, { type: 'BUILD_HOUSING', districtId: 'district-1', units: 5 });
    expect(s.units).toHaveLength(count + 5);
    expect(s.government.cash).toBe(cash - 4000000);
    assertInvariants(s);
  });
  it('rejects invalid commands atomically', () => {
    const s = city();
    const before = canonical(s);
    expect(() => applyCommand(s, { type: 'SET_POLICY', key: 'incomeTax', value: 7000 })).toThrow();
    expect(() =>
      applyCommand(s, { type: 'BUILD_HOUSING', districtId: 'district-1', units: 50 }),
    ).toThrow();
    expect(canonical(s)).toBe(before);
  });
  it('tax and minimum wage policy affect subsequent simulation', () => {
    const a = city(),
      b = city();
    applyCommand(b, { type: 'SET_POLICY', key: 'incomeTax', value: 4500 });
    applyCommand(b, { type: 'SET_POLICY', key: 'minimumWage', value: 400000 });
    advance(a, 2);
    advance(b, 2);
    expect(
      b.citizens.filter((c) => c.employmentStatus === 'employed').every((c) => c.salary >= 400000),
    ).toBe(true);
    expect(b.government.taxRevenue).toBeGreaterThan(a.government.taxRevenue);
  });
  it('narration references real event IDs and leaves truth unchanged', () => {
    const s = city();
    const before = canonical(s);
    for (const e of s.events) expect(narrative.generateNews(e).eventId).toBe(e.id);
    expect(canonical(s)).toBe(before);
  });
  it('detects broken references, non-integer money and corrupt cash flow', () => {
    const s = city();
    s.citizens[0].householdId = 'missing';
    s.households[0].cash += 0.2;
    expect(checkInvariants(s).length).toBeGreaterThan(2);
  });
});
describe('save, replay and long-term stability', () => {
  it('same seed and commands yield identical SHA-256 state', async () => {
    const a = city(),
      b = city();
    for (const s of [a, b]) {
      advance(s, 45);
      applyCommand(s, { type: 'SET_POLICY', key: 'welfare', value: 75000 });
      advance(s, 365);
    }
    expect(await stateHash(a)).toBe(await stateHash(b));
  });
  it('multiple same-day commands including day zero replay exactly', async () => {
    const s = city();
    applyCommand(s, { type: 'SET_POLICY', key: 'incomeTax', value: 2000 });
    applyCommand(s, { type: 'BUILD_HOUSING', districtId: 'district-3', units: 3 });
    advance(s, 60);
    applyCommand(s, { type: 'SET_POLICY', key: 'minimumWage', value: 220000 });
    advance(s, 305);
    const replay = replayCity(s);
    assertInvariants(replay);
    expect(await stateHash(replay)).toBe(await stateHash(s));
  });
  it('save/load continuation equals uninterrupted run', async () => {
    const s = city();
    advance(s, 125);
    const loaded = await loadCity(await saveCity(s));
    advance(s, 240);
    advance(loaded, 240);
    expect(await stateHash(loaded)).toBe(await stateHash(s));
  });
  it('rejects corrupt, incomplete, unsupported and hash-altered saves', async () => {
    const s = city();
    const save = await saveCity(s);
    const corrupt = JSON.parse(save);
    corrupt.state.citizens[0].salary = 0;
    await expect(loadCity(JSON.stringify(corrupt))).rejects.toThrow();
    const invalid = JSON.parse(save);
    invalid.manifest.saveVersion = 2;
    await expect(loadCity(JSON.stringify(invalid))).rejects.toThrow();
    await expect(loadCity('{}')).rejects.toThrow();
    await expect(loadCity('bad')).rejects.toThrow();
  });
  it('rejects a save with hash-valid broken references', async () => {
    const s = city();
    s.citizens[0].householdId = 'missing';
    const text = JSON.stringify({
      manifest: {
        saveVersion: 1,
        simulationVersion: s.simulationVersion,
        hash: await stateHash(s),
        metadata: { cityName: 'CIVITAS' },
      },
      state: s,
    });
    await expect(loadCity(text)).rejects.toThrow('household');
  });
  it('250 residents advance 10 years, remain saveable and replayable', async () => {
    const s = createCity();
    for (let i = 0; i < 10; i++) {
      advance(s, 365);
      assertInvariants(s);
    }
    expect(s.day).toBe(3650);
    const loaded = await loadCity(await saveCity(s));
    expect(await stateHash(loaded)).toBe(await stateHash(replayCity(s)));
  }, 120000);
});
