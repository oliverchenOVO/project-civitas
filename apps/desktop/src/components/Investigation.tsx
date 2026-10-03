import { useMemo, useState } from 'react';
import type {
  CityState,
  DomainEvent,
  EntityRef,
  Policies,
} from '../../../../packages/domain/src/index';
import { controller } from '../../../../packages/application/src/controller';
import {
  cityHistory,
  explainMetric,
  searchEntities,
  yearReview,
} from '../../../../packages/application/src/queries';
import { sampleCity, type MetricKey } from '../../../../packages/application/src/history';
import { verifyScenarios } from '../../../../packages/application/src/scenarios';
import { usePresentation } from '../store';
import { date, money, policyLabels } from '../format';
import { EventRow, EventFeed } from './EventFeed';

export const metricLabels: Record<MetricKey, string> = {
  population: '現居人口',
  households: '家庭數',
  employed: '在職人口',
  unemployed: '求職人口',
  unemploymentRate: '勞動人口失業率',
  companies: '活躍企業',
  bankruptcies: '累計倒閉企業',
  averageIncome: '平均月薪（全人口）',
  medianIncome: '月薪中位數（全人口）',
  householdWealth: '家庭平均淨財富',
  averageRent: '平均月租',
  occupied: '已入住住宅',
  units: '住宅總數',
  vacancy: '空置住宅',
  taxRevenue: '本日稅收',
  welfareSpending: '本日福利支出',
  happiness: '居民平均幸福',
  treasury: '國庫現金',
  occupancyRate: '住宅入住率',
};
const moneyKeys = new Set([
  'averageIncome',
  'medianIncome',
  'householdWealth',
  'averageRent',
  'taxRevenue',
  'welfareSpending',
  'treasury',
]);
export const metricFormat = (key: MetricKey, value: number) =>
  moneyKeys.has(key)
    ? money(value)
    : key === 'unemploymentRate' || key === 'occupancyRate'
      ? `${(value / 100).toFixed(2)}%`
      : value.toLocaleString();
const metricDeltaFormat = (key: MetricKey, value: number) =>
  key === 'unemploymentRate' || key === 'occupancyRate'
    ? `${(value / 100).toFixed(2)} 百分點`
    : metricFormat(key, value);
export function Trend({
  rows,
  label,
  format = (v) => v.toLocaleString(),
}: {
  rows: { day: number; value: number }[];
  label: string;
  format?: (v: number) => string;
}) {
  if (rows.length < 2) return <p className="muted">尚不足兩個已記錄採樣點。</p>;
  const min = Math.min(...rows.map((r) => r.value)),
    max = Math.max(...rows.map((r) => r.value)),
    span = max - min || 1;
  const start = rows[0].day,
    end = rows.at(-1)!.day;
  const points = rows
    .map(
      (r) =>
        `${52 + ((r.day - start) / (end - start || 1)) * 490},${136 - ((r.value - min) / span) * 110}`,
    )
    .join(' ');
  return (
    <figure className="evidence-trend">
      <figcaption>{label}</figcaption>
      <svg viewBox="0 0 580 180" role="img" aria-label={label}>
        <path d="M52 24V136H542" fill="none" stroke="#344753" />
        <text x="0" y="30">
          {format(max)}
        </text>
        <text x="0" y="138">
          {format(min)}
        </text>
        <polyline points={points} fill="none" stroke="#91d8bd" strokeWidth="2" />
        <text x="52" y="166">
          {date(start)}
        </text>
        <text x="410" y="166">
          {date(end)}
        </text>
      </svg>
    </figure>
  );
}
export function EntityLinks({ refs, state }: { refs: EntityRef[]; state: CityState }) {
  return (
    <div className="entity-links">
      {refs.map((ref) =>
        ref.kind === 'unit' ? (
          <span key={`${ref.kind}:${ref.id}`}>{ref.id}</span>
        ) : (
          <button
            key={`${ref.kind}:${ref.id}`}
            onClick={() => {
              if (ref.kind !== 'unit') usePresentation.getState().select(ref.kind, ref.id);
            }}
          >
            {ref.kind === 'citizen'
              ? (state.citizens.find((c) => c.id === ref.id)?.name ?? ref.id)
              : ref.kind === 'company'
                ? (state.companies.find((c) => c.id === ref.id)?.name ?? ref.id)
                : ref.kind === 'district'
                  ? (state.districts.find((c) => c.id === ref.id)?.name ?? ref.id)
                  : `家庭 ${ref.id}`}{' '}
            ↗
          </button>
        ),
      )}
    </div>
  );
}
export function showAffected(events: DomainEvent[], label: string) {
  const refs = new Map<
    string,
    { kind: 'citizen' | 'company' | 'household' | 'district'; id: string }
  >();
  for (const event of events)
    for (const ref of event.entityRefs)
      if (ref.kind !== 'unit') refs.set(`${ref.kind}:${ref.id}`, { kind: ref.kind, id: ref.id });
  const store = usePresentation.getState();
  store.setOverlay({ label, refs: [...refs.values()], mode: 'all' });
  store.focusMap();
}
function MetricDetail({ state, metric }: { state: CityState; metric: MetricKey }) {
  const selected = usePresentation((s) => s.selected);
  const days = selected?.window ?? 90,
    explain = selected?.explained ?? false;
  const setDays = (window: number) => usePresentation.getState().metricOptions({ window });
  const setExplain = (explained: boolean) =>
    usePresentation.getState().metricOptions({ explained });
  const result = useMemo(
    () => explainMetric(state, controller.history, controller.events, metric, days),
    [state, metric, days, controller.revision],
  );
  const rows =
    days <= 365
      ? controller.history.daily
          .filter((s) => s.day >= state.day - days)
          .map((s) => ({ day: s.day, value: s.values[metric] }))
      : controller.history.monthly.slice(-120).map((s) => ({
          day: s.endDay,
          value:
            metric === 'taxRevenue' || metric === 'welfareSpending'
              ? s.flows[metric]
              : s.closing[metric],
        }));
  return (
    <section className="investigation">
      <div className="section-heading">
        <div>
          <p className="eyebrow">METRIC DETAIL · EVIDENCE</p>
          <h1>{metricLabels[metric]}</h1>
        </div>
        <select
          aria-label="調查指標"
          value={metric}
          onChange={(e) => usePresentation.getState().select('metric', e.target.value)}
        >
          {Object.entries(metricLabels).map(([k, v]) => (
            <option value={k} key={k}>
              {v}
            </option>
          ))}
        </select>
      </div>
      <div className="evidence-summary">
        <strong>{metricFormat(metric, result.current)}</strong>
        {result.deltas.map((d) => (
          <div key={d.days}>
            <small>{d.days} 日變化</small>
            <b>{d.value === null ? '未有詳細歷史' : metricDeltaFormat(metric, d.value)}</b>
          </div>
        ))}
      </div>
      <p className="muted">
        Detailed history available from {date(result.boundary)}.{' '}
        {metric === 'bankruptcies'
          ? '累計量；年/月倒閉事件另以期間流量計算。'
          : metric === 'taxRevenue' || metric === 'welfareSpending'
            ? '流量；當前值是本日，月份圖使用期間合計。'
            : '存量 / 比率；月份圖使用期末觀測值。'}
      </p>
      <div className="tabs">
        {[30, 90, 365, 3650].map((n) => (
          <button key={n} className={days === n ? 'active' : ''} onClick={() => setDays(n)}>
            {n === 3650 ? '10 年 / 月採樣' : `${n} 日`}
          </button>
        ))}
      </div>
      <Trend
        rows={rows}
        label={days <= 365 ? '每日已記錄觀測' : '每月期末觀測 / 流量合計（含當期）'}
        format={(v) => metricFormat(metric, v)}
      />
      <button className="primary" onClick={() => setExplain(true)}>
        Explain · 解釋這個數字
      </button>
      {explain && (
        <section className="evidence-section">
          <h2>Observed contributing events · {days} 日</h2>
          <p>
            Association：下列事件與指標相關。只有明列 causeEventIds 的邊稱為 Recorded causation。
          </p>
          <p>
            Contribution：下列為實際事件次數，不是失業率的加總分解；同一人可有多次轉換。退休、遷入、離世及勞動人口分母也可能變化。
          </p>
          <div className="evidence-counts">
            {Object.entries(result.counts).map(([type, count]) => (
              <span key={type}>
                {type}
                <b>{count}</b>
              </span>
            ))}
          </div>
          {result.groups.map((group) => (
            <button
              className="evidence-group"
              key={group.companyId}
              onClick={() => usePresentation.getState().select('company', group.companyId)}
            >
              {state.companies.find((c) => c.id === group.companyId)?.name ?? group.companyId}
              <b>{group.count} 次失去工作</b>
            </button>
          ))}
          <button
            disabled={!result.events.length}
            onClick={() =>
              showAffected(result.events, `${metricLabels[metric]} · ${days} 日相關事件`)
            }
          >
            Focus on Map · 受影響實體
          </button>
          {result.events.slice(0, 30).map((event) => (
            <EventRow key={event.id} state={state} event={event} />
          ))}
          {!result.events.length && <p>此期間没有已記錄的相關事件；不推論原因。</p>}
        </section>
      )}
    </section>
  );
}
function CausalDetail({
  state,
  id,
  direction,
}: {
  state: CityState;
  id: string;
  direction?: 'causes' | 'effects';
}) {
  const event = controller.events.byId.get(id);
  const result = controller.events.trace(id, direction ?? 'causes');
  if (!event) return <p>找不到事件 {id}。</p>;
  return (
    <section className="investigation">
      <p className="eyebrow">RECORDED CAUSATION · BOUNDED GRAPH</p>
      <h1>事件證據</h1>
      <EventRow event={event} state={state} />
      <div className="tabs">
        <button
          className={direction !== 'effects' ? 'active' : ''}
          onClick={() => usePresentation.getState().trace('causes')}
        >
          Trace Causes
        </button>
        <button
          className={direction === 'effects' ? 'active' : ''}
          onClick={() => usePresentation.getState().trace('effects')}
        >
          Trace Effects
        </button>
        <button onClick={() => showAffected(result.nodes, `事件 ${id} · recorded causal graph`)}>
          Focus on Map
        </button>
      </div>
      {direction !== 'effects' && !event.causeEventIds.length && (
        <p className="evidence-boundary">No recorded causal predecessor</p>
      )}
      {direction === 'effects' && result.nodes.length === 1 && <p>No recorded consequences</p>}
      <p className="muted">
        最多 8 層 / 100 個節點。只顯示帳本明列的邊；缺漏 {result.missing.length}，
        {result.truncated ? '結果已截斷' : '未截斷'}。
      </p>
      {result.missing.length > 0 && <p>Missing referenced events: {result.missing.join(', ')}</p>}
      <div className="causal-edges">
        {result.edges.map((edge) => (
          <div key={`${edge.from}:${edge.to}`}>
            <button onClick={() => usePresentation.getState().select('event', edge.from)}>
              {edge.from}
            </button>
            <span>→ recorded →</span>
            <button onClick={() => usePresentation.getState().select('event', edge.to)}>
              {edge.to}
            </button>
          </div>
        ))}
      </div>
      {result.nodes
        .filter((node) => node.id !== id)
        .map((node) => (
          <EventRow key={node.id} event={node} state={state} />
        ))}
      {event.category === 'government' && (
        <button onClick={() => usePresentation.getState().setPage('Government')}>
          檢視政府政策（目前值）
        </button>
      )}
    </section>
  );
}
export function InvestigationPage({ state }: { state: CityState }) {
  const selected = usePresentation((s) => s.selected);
  if (selected?.kind === 'metric' && Object.hasOwn(metricLabels, selected.id))
    return <MetricDetail state={state} metric={selected.id as MetricKey} />;
  if (selected?.kind === 'event')
    return <CausalDetail state={state} id={selected.id} direction={selected.trace} />;
  return (
    <section>
      <h1>數字與證據</h1>
      <p>從 City Pulse 點選指標，或開啟事件追溯 recorded causal graph。</p>
    </section>
  );
}
export function CityHistoryPage({ state }: { state: CityState }) {
  const savedFilters = usePresentation((s) => s.historyFilters);
  const { year, category, district, entityType, limit } = savedFilters ?? {
    year: Math.max(0, Math.floor(state.day / 365) - 1),
    category: '',
    district: '',
    entityType: '',
    limit: 30,
  };
  const setFilters = (patch: Partial<import('../store').HistoryFilters>) =>
    usePresentation.setState({
      historyFilters: { year, category, district, entityType, limit, ...patch },
    });
  const setYear = (year: number) => setFilters({ year, limit: 30 });
  const setCategory = (category: string) => setFilters({ category });
  const setDistrict = (district: string) => setFilters({ district });
  const setEntityType = (entityType: string) => setFilters({ entityType });
  const setLimit = (value: number | ((limit: number) => number)) =>
    setFilters({ limit: typeof value === 'function' ? value(limit) : value });
  const events = useMemo(
    () =>
      cityHistory(controller.events, {
        year,
        category: category || undefined,
        districtId: district || undefined,
        entityType: entityType || undefined,
      }),
    [year, category, district, entityType, controller.revision],
  );
  const review = yearReview(controller.history, controller.events, year);
  return (
    <section className="investigation">
      <p className="eyebrow">CITY HISTORY · VERIFIABLE MEMORY</p>
      <h1>城市歷史</h1>
      <div className="filter-bar">
        <label>
          Year{' '}
          <select
            aria-label="歷史年度"
            value={year}
            onChange={(e) => {
              setYear(Number(e.target.value));
            }}
          >
            {Array.from({ length: Math.floor(state.day / 365) + 1 }, (_, i) => (
              <option key={i} value={i}>
                Year {i + 1}
              </option>
            ))}
          </select>
        </label>
        <select
          aria-label="歷史類別"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="">所有類別</option>
          {['people', 'business', 'housing', 'government', 'city'].map((k) => (
            <option key={k}>{k}</option>
          ))}
        </select>
        <select
          aria-label="歷史行政區"
          value={district}
          onChange={(e) => setDistrict(e.target.value)}
        >
          <option value="">所有直接記錄行政區</option>
          {state.districts.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
        <select
          aria-label="歷史實體類型"
          value={entityType}
          onChange={(e) => setEntityType(e.target.value)}
        >
          <option value="">所有實體</option>
          {['citizen', 'household', 'company', 'district'].map((k) => (
            <option key={k}>{k}</option>
          ))}
        </select>
      </div>
      <section className="year-review">
        <h2>Year in Review · {year + 1}</h2>
        {review ? (
          <>
            <div className="review-grid">
              {(
                [
                  'population',
                  'unemploymentRate',
                  'companies',
                  'averageRent',
                  'householdWealth',
                  'treasury',
                ] as MetricKey[]
              ).map((k) => (
                <div key={k}>
                  <small>{metricLabels[k]}</small>
                  <b>
                    {metricFormat(k, review.period.opening[k])} →{' '}
                    {metricFormat(k, review.period.closing[k])}
                  </b>
                </div>
              ))}
            </div>
            <p>
              年度稅收 {money(review.period.flows.taxRevenue)} · 福利{' '}
              {money(review.period.flows.welfareSpending)} · 倒閉 {review.period.flows.bankruptcies}
            </p>
            <p>
              直接記錄事件最多行政區：
              {review.mostRecordedDistrict
                ? state.districts.find((d) => d.id === review.mostRecordedDistrict![0])?.name
                : '沒有行政區證據'}
              （事件數，並非影響程度推論）。百人門檻淨跨越 {review.populationMilestone}。
            </p>
            <button onClick={() => showAffected(review.events, `Year ${year + 1} · 重要事件`)}>
              Focus on Map · 年度事件
            </button>
            {review.events.slice(0, 5).map((e) => (
              <EventRow key={e.id} state={state} event={e} />
            ))}
          </>
        ) : (
          <p>
            尚無此年度完整的 365 日詳細觀測。Detailed history available from{' '}
            {date(controller.history.historyAvailableFromDay)}.
          </p>
        )}
      </section>
      <h2>重要性排序 · {events.length} 筆</h2>
      <p className="muted">
        以固定規則評分：severity、直接實體數、記錄裁員人數、財務金額、政策與人口事件。未記錄行政區的事件不會用現在住所回填。
      </p>
      {events.slice(0, limit).map((e) => (
        <EventRow key={e.id} state={state} event={e} />
      ))}
      {events.length > limit && (
        <button onClick={() => setLimit((n) => n + 30)}>更多历史事件</button>
      )}
    </section>
  );
}
export function EntityHistory({
  state,
  kind,
  id,
}: {
  state: CityState;
  kind: 'citizen' | 'household' | 'company';
  id: string;
}) {
  const [limit, setLimit] = useState(30);
  const events = controller.events.entity(kind, id);
  const series =
    kind === 'company'
      ? controller.history.companies[id]
      : kind === 'household'
        ? controller.history.households[id]
        : undefined;
  const keys =
    kind === 'company'
      ? ['employees', 'revenue', 'payroll', 'profit', 'cash']
      : ['cash', 'debt', 'income', 'expenses', 'housingCost'];
  return (
    <section className="entity-history">
      <h4>
        {kind === 'citizen'
          ? 'Life · 多年人生軌跡'
          : kind === 'household'
            ? '家庭財務歷史'
            : '企業歷史與趨勢'}
      </h4>
      <p className="muted">
        詳細財務採樣自 {date(controller.history.historyAvailableFromDay)}；下列事件依直接
        entityRefs。舊資料未記錄的薪資、成員及住所不從目前狀態倒推。
      </p>
      {series &&
        keys.map((key) => (
          <Trend
            key={key}
            rows={series.slice(-120).map((row) => ({ day: row.day, value: row.values[key] }))}
            label={`${key} · 月末瞬間值${['revenue', 'payroll', 'profit', 'income', 'expenses'].includes(key) ? '（本日流量，非月合計）' : ''}`}
            format={key === 'employees' ? undefined : money}
          />
        ))}
      {kind === 'citizen' ? (
        <div className="life-years">
          {[
            ...new Set(
              events
                .slice(-limit)
                .reverse()
                .map((e) => Math.floor(e.tick / 365)),
            ),
          ].map((year) => (
            <section key={year}>
              <h4>Year {year + 1}</h4>
              {events
                .slice(-limit)
                .reverse()
                .filter((e) => Math.floor(e.tick / 365) === year)
                .map((event) => (
                  <EventRow key={event.id} state={state} event={event} />
                ))}
            </section>
          ))}
        </div>
      ) : (
        <EventFeed state={state} events={events} limit={limit} />
      )}
      {events.length > limit && (
        <button onClick={() => setLimit((n) => n + 30)}>更早的 Life / History</button>
      )}
    </section>
  );
}
export function GlobalSearch({ state }: { state: CityState }) {
  const [query, setQuery] = useState('');
  const results = useMemo(() => searchEntities(state, query), [state, query, controller.revision]);
  return (
    <div className="global-search">
      <input
        aria-label="全域搜尋"
        placeholder="搜尋居民、家庭、企業、行政區"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {query && (
        <div className="search-results" role="list">
          {results.map((r) => (
            <button
              key={`${r.kind}:${r.id}`}
              onClick={() => {
                usePresentation.getState().select(r.kind, r.id);
                setQuery('');
              }}
            >
              <small>{r.kind}</small>
              {r.name} · {r.id}
            </button>
          ))}
          {!results.length && <span>沒有符合實體。</span>}
          <button onClick={() => setQuery('')}>關閉搜尋</button>
        </div>
      )}
    </div>
  );
}
export function ScenarioPage() {
  const workspace = controller.scenarios;
  const [key, setKey] = useState<keyof Policies>('minimumWage'),
    [value, setValue] = useState(2000),
    [units, setUnits] = useState(5),
    [district, setDistrict] = useState(controller.state.districts[0].id),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState('');
  const execute = (fn: () => void) => {
    try {
      fn();
      setMessage('操作完成。原城市維持不變。');
    } catch (e) {
      setMessage(String(e));
    }
  };
  const run = async (days: number) => {
    setBusy(true);
    await new Promise((r) => setTimeout(r, 30));
    try {
      for (let progressed = 0; progressed < days; progressed += 30) {
        controller.runScenarios(Math.min(30, days - progressed));
        setMessage(`兩分支已推進 ${Math.min(days, progressed + 30)} / ${days} 日。`);
        await new Promise((r) => setTimeout(r, 0));
      }
      setMessage(`兩分支各推進 ${days} 日。`);
    } catch (e) {
      setMessage(String(e));
    } finally {
      setBusy(false);
    }
  };
  const values = workspace?.branches.map((b) => sampleCity(b.state).values);
  return (
    <section className="investigation">
      <p className="eyebrow">SIMULATION COMPARISON</p>
      <h1>政策情境比較</h1>
      <p>
        Simulation comparison · 模擬比較。這是同一模型下的兩條可重播歷史，不是現實經濟或政策預測。
      </p>
      <button className="primary" disabled={busy} onClick={() => execute(() => controller.fork())}>
        {workspace ? '重新從目前城市建立 checkpoint' : '從目前城市 / 已載入存檔 Fork A / B'}
      </button>
      {workspace && (
        <>
          <p>
            Fork moment {date(workspace.checkpoint.day)} · A / B 從相同城市狀態與事件歷史開始，
            沿用相同的隨機序列，各自記錄後續政策與結果。
          </p>
          <section className="scenario-controls">
            <h2>Policy B commands</h2>
            <div className="filter-bar">
              <select
                aria-label="情境政策"
                value={key}
                onChange={(e) => {
                  const k = e.target.value as keyof Policies;
                  setKey(k);
                  setValue(workspace.branches[1].state.government.policies[k] / 100);
                }}
              >
                {Object.entries(policyLabels).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </select>
              <input
                aria-label="情境政策數值"
                type="number"
                value={value}
                min="0"
                step={key.endsWith('Tax') ? '0.1' : '10'}
                onChange={(e) => setValue(Number(e.target.value))}
              />
              <button
                disabled={busy}
                onClick={() =>
                  execute(() =>
                    controller.scenarioCommand({
                      type: 'SET_POLICY',
                      key,
                      value: Math.round(value * 100),
                    }),
                  )
                }
              >
                套用至 B
              </button>
            </div>
            <p className="muted">稅率使用百分比；福利及最低工資使用每月美元金額。</p>
            <div className="filter-bar">
              <select
                aria-label="情境建設行政區"
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
              >
                {controller.state.districts.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
              <input
                type="number"
                aria-label="情境建設戶數"
                value={units}
                min="1"
                max="50"
                onChange={(e) => setUnits(Number(e.target.value))}
              />
              <button
                disabled={busy}
                onClick={() =>
                  execute(() =>
                    controller.scenarioCommand({
                      type: 'BUILD_HOUSING',
                      districtId: district,
                      units,
                    }),
                  )
                }
              >
                B 興建住宅
              </button>
            </div>
          </section>
          <div className="tabs">
            {[30, 365, 1825].map((n) => (
              <button key={n} disabled={busy} onClick={() => void run(n)}>
                兩分支推進 {n === 30 ? '30 日' : n === 365 ? '1 年' : '5 年'}
              </button>
            ))}
            <button
              disabled={busy}
              onClick={() => {
                setBusy(true);
                void verifyScenarios(workspace)
                  .then((result) =>
                    setMessage(
                      result.ok
                        ? 'Replay A / B 通過：Simulation Truth 與 history hash 一致。'
                        : 'Replay mismatch',
                    ),
                  )
                  .catch((e) => setMessage(String(e)))
                  .finally(() => setBusy(false));
              }}
            >
              Replay A / B
            </button>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>指標</th>
                  {workspace.branches.map((b) => (
                    <th key={b.name}>
                      {b.name} · {date(b.state.day)}
                    </th>
                  ))}
                  <th>B − A</th>
                </tr>
              </thead>
              <tbody>
                {(
                  [
                    'population',
                    'unemploymentRate',
                    'companies',
                    'bankruptcies',
                    'householdWealth',
                    'averageRent',
                    'vacancy',
                    'treasury',
                  ] as MetricKey[]
                ).map((k) => (
                  <tr key={k}>
                    <td>{metricLabels[k]}</td>
                    <td>{metricFormat(k, values![0][k])}</td>
                    <td>{metricFormat(k, values![1][k])}</td>
                    <td>{metricDeltaFormat(k, values![1][k] - values![0][k])}</td>
                  </tr>
                ))}
                <tr>
                  <td>Fork 後累計稅收（flow）</td>
                  {workspace.branches.map((b) => (
                    <td key={b.name}>
                      {money(
                        b.history.yearly.reduce((n, p) => n + p.flows.taxRevenue, 0) -
                          workspace.checkpointHistory.yearly.reduce(
                            (n, p) => n + p.flows.taxRevenue,
                            0,
                          ),
                      )}
                    </td>
                  ))}
                  <td>同期間合計</td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}
      {busy && <p role="status">正在計算可重播分支…</p>}
      <p role="status">{message}</p>
    </section>
  );
}
