import { useEffect, useRef, useState } from 'react';
import { age, type CityState } from '../../../../packages/domain/src/index';
import {
  familyTree,
  socialNetwork,
  relationshipLabels,
} from '../../../../packages/application/src/social-observation';
import { usePresentation } from '../store';
import { date } from '../format';

export function SocialFabricPage({ state }: { state: CityState }) {
  const selected = usePresentation((s) => s.selected);
  const select = usePresentation((s) => s.select);
  const mode = usePresentation((s) => s.socialView);
  const [filter, setFilter] = useState('');
  const [limit, setLimit] = useState(12);
  const graphScroll = useRef<HTMLDivElement>(null);
  const root =
    state.citizens.find((c) => selected?.kind === 'citizen' && c.id === selected.id) ??
    state.citizens[0];
  const network = socialNetwork(state, root.id, filter, limit);
  const tree = familyTree(state, root.id);
  const height =
    mode === 'family'
      ? Math.max(
          540,
          ...[-2, -1, 0, 1, 2].map(
            (g) => tree.nodes.filter((n) => n.generation === g).length * 78 + 100,
          ),
        )
      : network.nodes.length > 12
        ? 240 + Math.ceil(network.nodes.length / 5) * 84
        : 560;
  const positions = new Map<string, { x: number; y: number }>();
  if (mode === 'network') {
    positions.set(root.id, { x: 450, y: network.nodes.length > 12 ? 90 : 280 });
    network.nodes.forEach((c, i) => {
      const a = (i * Math.PI * 2) / network.nodes.length - Math.PI / 2;
      positions.set(
        c.id,
        network.nodes.length > 12
          ? { x: 90 + (i % 5) * 180, y: 220 + Math.floor(i / 5) * 84 }
          : { x: 450 + Math.cos(a) * 330, y: 280 + Math.sin(a) * 210 },
      );
    });
  } else {
    for (const g of [-2, -1, 0, 1, 2])
      tree.nodes
        .filter((n) => n.generation === g)
        .forEach((n, i, group) =>
          positions.set(n.citizen.id, {
            x: 90 + (g + 2) * 180,
            y: height / 2 + (i - (group.length - 1) / 2) * 78,
          }),
        );
  }
  const citizens = mode === 'network' ? [root, ...network.nodes] : tree.nodes.map((n) => n.citizen);
  const edges =
    mode === 'network'
      ? network.relations.map((r) => ({
          from: r.citizenA,
          to: r.citizenB,
          type: r.relationshipType,
        }))
      : tree.edges;
  const rootPosition = positions.get(root.id)!;
  useEffect(() => {
    const host = graphScroll.current;
    if (!host) return;
    const center = () => {
      host.scrollLeft = Math.max(0, rootPosition.x - host.clientWidth / 2);
      host.scrollTop = Math.max(0, rootPosition.y - host.clientHeight / 2);
    };
    const observer = new ResizeObserver(center);
    observer.observe(host);
    center();
    return () => observer.disconnect();
  }, [rootPosition.x, rootPosition.y, root.id, mode]);
  return (
    <section className="social-fabric">
      <p className="eyebrow">SOCIAL FABRIC · RECORDED RELATIONSHIPS</p>
      <h1>人與人的城市</h1>
      <p>從 {root.name} 出發，探索已記錄的人際關係與家族。點選節點可換一位居民繼續調查。</p>
      <div className="filter-bar">
        <label>
          觀察居民{' '}
          <select
            aria-label="社會網路居民"
            value={root.id}
            onChange={(e) => select('citizen', e.target.value)}
          >
            {state.citizens.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} · {c.id}
              </option>
            ))}
          </select>
        </label>
        <button
          aria-pressed={mode === 'network'}
          onClick={() => usePresentation.setState({ socialView: 'network' })}
        >
          社交網路
        </button>
        <button
          aria-pressed={mode === 'family'}
          onClick={() => usePresentation.setState({ socialView: 'family' })}
        >
          家族樹
        </button>
        {mode === 'network' && (
          <select
            aria-label="關係類型"
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value);
              setLimit(12);
            }}
          >
            <option value="">所有關係</option>
            {Object.entries(relationshipLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        )}
      </div>
      <p className="muted">
        {mode === 'family'
          ? '顯示前後兩代及其已記錄配偶；缺少祖先資料時不推測。實線為親子，虛線為配偶；配偶連結不推定婚期。'
          : `顯示 ${network.nodes.length} / ${network.total} 位直接關係人；數值為目前記錄，不推定最後互動時間。`}
      </p>
      <div
        className="social-graph-scroll"
        ref={graphScroll}
        tabIndex={0}
        role="region"
        aria-label={mode === 'family' ? '家族樹圖，可水平捲動' : '社交關係圖，可水平捲動'}
      >
        <div
          className="social-graph"
          style={{ height }}
          data-root-id={root.id}
          data-node-count={citizens.length}
        >
          {mode === 'family' && (
            <div className="family-generations">
              {['祖輩', '父母輩', '同代／配偶', '子女輩', '孫輩'].map((label) => (
                <span key={label}>{label}</span>
              ))}
            </div>
          )}
          <svg width="900" height={height} aria-hidden="true">
            {edges.map((edge, i) => {
              const from = positions.get(edge.from),
                to = positions.get(edge.to);
              return from && to ? (
                <line
                  key={i}
                  x1={from.x}
                  y1={from.y}
                  x2={to.x}
                  y2={to.y}
                  className={`social-edge ${edge.type}`}
                />
              ) : null;
            })}
          </svg>
          {citizens.map((c) => {
            const p = positions.get(c.id)!;
            return (
              <button
                key={c.id}
                className={`social-node ${c.id === root.id ? 'root' : ''}`}
                style={{ left: p.x, top: p.y }}
                aria-label={`觀察居民 ${c.name} ${c.id}`}
                onClick={() => select('citizen', c.id)}
              >
                <strong>{c.name}</strong>
                <small>
                  {c.lifecycleStatus === 'dead' && c.deathDay !== undefined
                    ? Math.floor((c.deathDay - c.birthDay) / 365)
                    : age(state, c)}{' '}
                  歲{c.lifecycleStatus === 'dead' ? '（離世時）' : ''} ·{' '}
                  {c.lifecycleStatus === 'alive'
                    ? '現居'
                    : c.lifecycleStatus === 'dead'
                      ? '已離世'
                      : '已遷出'}
                </small>
                <small>{c.id}</small>
              </button>
            );
          })}
        </div>
      </div>
      {mode === 'network' && network.nodes.length < network.total && limit < 48 && (
        <button onClick={() => setLimit((n) => Math.min(48, n + 12))}>顯示更多關係人</button>
      )}
      {mode === 'network' && !network.nodes.length && (
        <p className="empty">沒有此類型的已記錄關係。</p>
      )}
      {mode === 'family' && tree.truncated && (
        <p role="status">此圖最多顯示 48 位家人；點選節點可繼續探索。</p>
      )}
      {mode === 'network' && (
        <div className="table-wrap">
          <table>
            <caption>關係證據 · 現在的城市狀態</caption>
            <thead>
              <tr>
                <th>關係人</th>
                <th>類型／記錄起日</th>
                <th>熟悉／信任／情感／衝突</th>
              </tr>
            </thead>
            <tbody>
              {network.relations.map((r) => {
                const other = r.citizenA === root.id ? r.citizenB : r.citizenA;
                return (
                  <tr key={r.id}>
                    <td>
                      <button className="text-button" onClick={() => select('citizen', other)}>
                        {state.citizens.find((c) => c.id === other)?.name}
                      </button>
                    </td>
                    <td>
                      {relationshipLabels[r.relationshipType]} · {date(r.sinceDay)}
                    </td>
                    <td>
                      {r.familiarity} / {r.trust} / {r.affection} / {r.conflict}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
