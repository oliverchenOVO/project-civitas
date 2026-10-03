import type { CityState, DomainEvent } from '../../../../packages/domain/src/index';
import { narrative } from '../../../../packages/narrative/src/index';
import { usePresentation } from '../store';
import { date } from '../format';
import { controller } from '../../../../packages/application/src/controller';
export function EventRow({ event, state }: { event: DomainEvent; state: CityState }) {
  const select = usePresentation((s) => s.select);
  const news = narrative.generateNews(event);
  return (
    <article className="event-row">
      <time>{date(event.tick)}</time>
      <div>
        <span className={`category ${event.category}`}>{event.category.toUpperCase()}</span>
        <p>
          <button className="event-title" onClick={() => select('event', event.id)}>
            {news.title}
          </button>
        </p>
        <small>
          {event.type} · {event.severity} · {event.id}
        </small>
        <div className="entity-links">
          {event.entityRefs
            .filter((r) => ['citizen', 'company', 'household', 'district'].includes(r.kind))
            .slice(0, 6)
            .map((ref) => (
              <button
                key={`${ref.kind}-${ref.id}`}
                onClick={() =>
                  select(ref.kind as 'citizen' | 'company' | 'household' | 'district', ref.id)
                }
              >
                {ref.kind === 'citizen'
                  ? state.citizens.find((c) => c.id === ref.id)?.name
                  : ref.kind === 'company'
                    ? state.companies.find((c) => c.id === ref.id)?.name
                    : ref.kind === 'district'
                      ? state.districts.find((d) => d.id === ref.id)?.name
                      : `家庭 ${ref.id.split('-')[1]}`}
              </button>
            ))}
          {event.causeEventIds.map((cid) => (
            <details key={cid}>
              <summary>追溯原因</summary>
              <p>
                {controller.events.byId.has(cid)
                  ? narrative.generateNews(controller.events.byId.get(cid)!).title
                  : 'Missing referenced event'}
              </p>
              <button onClick={() => select('event', cid)}>Trace Causes / Effects</button>
              <code>{cid}</code>
            </details>
          ))}
          <button onClick={() => select('event', event.id)}>Trace Causes / Effects</button>
        </div>
      </div>
    </article>
  );
}
export function EventFeed({
  state,
  events,
  limit = 80,
}: {
  state: CityState;
  events?: DomainEvent[];
  limit?: number;
}) {
  const rows = (events ?? state.events).slice(-limit).reverse();
  return (
    <div className="event-list">
      {rows.length ? (
        rows.map((e) => <EventRow key={e.id} state={state} event={e} />)
      ) : (
        <div className="empty">尚無符合條件的事件。模擬發生的每個事件都會保留在城市歷史中。</div>
      )}
    </div>
  );
}
