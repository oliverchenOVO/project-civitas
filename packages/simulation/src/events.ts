import type { CityState, DomainEvent, EventType, EntityRef } from '../../domain/src/index';
export const id = (s: CityState, prefix: string) => `${prefix}-${s.nextId++}`;
export function emit(
  s: CityState,
  type: EventType,
  refs: EntityRef[],
  payload: DomainEvent['payload'] = {},
  causes: string[] = [],
): DomainEvent {
  const category = type.startsWith('COMPANY')
    ? 'business'
    : type.startsWith('POLICY')
      ? 'government'
      : /RENT|HOUSING|MOVED/.test(type)
        ? 'housing'
        : type === 'CITY_FOUNDED'
          ? 'city'
          : 'people';
  const event: DomainEvent = {
    id: id(s, 'event'),
    tick: s.day,
    type,
    actorIds: refs.slice(0, 1).map((r) => r.id),
    targetIds: refs.slice(1).map((r) => r.id),
    entityRefs: refs,
    payload,
    causeEventIds: causes,
    category,
    severity: /BANKRUPT|LAYOFF|POLICY|DIED|DEFAULT/.test(type) ? 'major' : 'info',
  };
  s.events.push(event);
  return event;
}
export function latestCause(s: CityState, entityId: string, types: EventType[]): string[] {
  for (let i = s.events.length - 1; i >= 0; i--) {
    const e = s.events[i];
    if (types.includes(e.type) && e.entityRefs.some((r) => r.id === entityId)) return [e.id];
  }
  return [];
}
