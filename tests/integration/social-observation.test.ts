import { expect, it } from 'vitest';
import { createCity, advance } from '../../packages/simulation/src/index';
import { canonical } from '../../packages/shared/src/canonical';
import { socialNetwork, familyTree } from '../../packages/application/src/social-observation';
import { createHistory, captureHistory } from '../../packages/application/src/history';
import { chronicleFrames } from '../../packages/application/src/chronicle';
import { narrative } from '../../packages/narrative/src/index';

it('social observations expose only recorded links, filter without inventing relationships, and leave truth unchanged', () => {
  const city = createCity({ seed: 'SOCIAL-OBSERVATION', population: 250 });
  const before = canonical(city);
  for (const citizen of city.citizens.slice(0, 30)) {
    const result = socialNetwork(city, citizen.id, 'friend', 2);
    expect(result.nodes.length).toBeLessThanOrEqual(2);
    expect(new Set(result.nodes.map((c) => c.id)).size).toBe(result.nodes.length);
    for (const r of result.relations) {
      expect(city.relationships).toContain(r);
      expect(r.relationshipType).toBe('friend');
      expect([r.citizenA, r.citizenB]).toContain(citizen.id);
    }
    const tree = familyTree(city, citizen.id);
    for (const edge of tree.edges) {
      const source = city.citizens.find((c) => c.id === edge.to)!;
      if (edge.type === 'parent') expect(source.parents).toContain(edge.from);
      else expect(city.citizens.find((c) => c.id === edge.from)?.spouseId).toBe(edge.to);
    }
  }
  expect(canonical(city)).toBe(before);
});
it('family exploration terminates on cycles, respects caps and does not infer missing ancestors', () => {
  const city = createCity({ seed: 'FAMILY-BOUND', population: 250 });
  const [a, b, c] = city.citizens;
  a.parents = [b.id];
  b.parents = [c.id];
  c.parents = [a.id];
  expect(familyTree(city, a.id, 3, 2).nodes.length).toBe(2);
  expect(familyTree(city, a.id, 3, 2).truncated).toBe(true);
  a.parents = ['unknown'];
  a.children = [];
  a.spouseId = undefined;
  expect(familyTree(city, a.id).nodes.map((n) => n.citizen.id)).toEqual([a.id]);
  expect(familyTree(city, 'missing').nodes).toEqual([]);
});
it('chronicle uses actual observation endpoints, preserves migration boundaries and leaves state/history unchanged', () => {
  const city = createCity({ seed: 'CHRONICLE', population: 250 });
  const history = createHistory(city);
  for (let day = 0; day < 400; day++) {
    advance(city);
    captureHistory(history, city);
  }
  const before = canonical({ city, history });
  const frames = chronicleFrames(history);
  expect(frames.map((f) => f.day)).toEqual([0, 365, 400]);
  expect(frames[1].values).toEqual(history.yearly[0].closing);
  expect(frames[2].values).toEqual(history.daily.at(-1)?.values);
  expect(canonical({ city, history })).toBe(before);
  const migrated = createHistory(city);
  expect(chronicleFrames(migrated).map((f) => f.day)).toEqual([400]);
});
it('news is tied to actual event identifiers, dates and categories without modifying evidence', () => {
  const city = createCity({ seed: 'GROUNDED-NEWS', population: 250 });
  const before = canonical(city);
  for (const event of city.events) {
    const article = narrative.generateNews(event);
    expect(article.eventId).toBe(event.id);
    expect(article.tick).toBe(event.tick);
    expect(article.category).toBe(event.category);
  }
  expect(canonical(city)).toBe(before);
});
