import type { CityState, Citizen, Relationship } from '../../domain/src/index';

const compareId = (a: { id: string }, b: { id: string }) =>
  a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
export function socialNetwork(state: CityState, citizenId: string, type = '', limit = 12) {
  const people = new Map(state.citizens.map((c) => [c.id, c]));
  const relations = state.relationships
    .filter(
      (r) =>
        (r.citizenA === citizenId || r.citizenB === citizenId) &&
        (!type || r.relationshipType === type),
    )
    .sort(compareId);
  const neighbors = new Map<string, Citizen>();
  for (const r of relations) {
    const other = r.citizenA === citizenId ? r.citizenB : r.citizenA;
    const citizen = people.get(other);
    if (citizen && citizen.id !== citizenId) neighbors.set(other, citizen);
  }
  const all = [...neighbors.values()].sort(compareId);
  const nodes = all.slice(0, Math.max(0, Math.min(48, Math.floor(limit))));
  const ids = new Set(nodes.map((c) => c.id));
  return {
    nodes,
    total: all.length,
    relations: relations.filter((r) => ids.has(r.citizenA === citizenId ? r.citizenB : r.citizenA)),
  };
}
export interface FamilyNode {
  citizen: Citizen;
  generation: number;
}
export interface FamilyEdge {
  from: string;
  to: string;
  type: 'parent' | 'spouse';
}
// Recorded links only. Unknown ancestors are not inferred from household membership.
export function familyTree(state: CityState, citizenId: string, depth = 2, limit = 48) {
  const people = new Map(state.citizens.map((c) => [c.id, c]));
  const root = people.get(citizenId);
  if (!root) return { nodes: [] as FamilyNode[], edges: [] as FamilyEdge[], truncated: false };
  const maxDepth = Math.max(0, Math.min(3, Math.floor(depth)));
  const maxNodes = Math.max(1, Math.min(60, Math.floor(limit)));
  const nodes: FamilyNode[] = [{ citizen: root, generation: 0 }];
  const visited = new Set([root.id]);
  let truncated = false;
  for (let i = 0; i < nodes.length; i++) {
    const { citizen, generation } = nodes[i];
    const candidates = [
      ...citizen.parents.map((id) => ({ id, generation: generation - 1 })),
      ...citizen.children.map((id) => ({ id, generation: generation + 1 })),
      ...(citizen.spouseId ? [{ id: citizen.spouseId, generation }] : []),
    ];
    for (const next of candidates) {
      if (Math.abs(next.generation) > maxDepth || visited.has(next.id)) continue;
      const relative = people.get(next.id);
      if (!relative) continue;
      if (nodes.length >= maxNodes) {
        truncated = true;
        continue;
      }
      visited.add(next.id);
      nodes.push({ citizen: relative, generation: next.generation });
    }
  }
  const edges: FamilyEdge[] = [],
    keys = new Set<string>();
  for (const { citizen } of nodes) {
    for (const parent of citizen.parents.filter((id) => visited.has(id)))
      edges.push({ from: parent, to: citizen.id, type: 'parent' });
    if (citizen.spouseId && visited.has(citizen.spouseId)) {
      const key = [citizen.id, citizen.spouseId].sort().join(':');
      if (!keys.has(key)) {
        keys.add(key);
        edges.push({ from: citizen.id, to: citizen.spouseId, type: 'spouse' });
      }
    }
  }
  return { nodes, edges, truncated };
}
export const relationshipLabels: Record<Relationship['relationshipType'], string> = {
  spouse: '配偶',
  family: '家人',
  friend: '朋友',
  coworker: '同事',
};
