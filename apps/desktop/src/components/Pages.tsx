import { useMemo, useState } from 'react';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts';
import { Search, ArrowUpRight, Building2 } from 'lucide-react';
import { type CityState, type Policies, age } from '../../../../packages/domain/src/index';
import { controller } from '../../../../packages/application/src/controller';
import { usePresentation } from '../store';
import { money, employmentLabels, policyLabels } from '../format';
import { CityMap } from './CityMap';
import { EventFeed } from './EventFeed';
import { DevelopmentCards } from './HumanDevelopment';
export function CityPage({ state, revision }: { state: CityState; revision: number }) {
  return (
    <section className="city-page">
      <div className="section-heading">
        <div>
          <h1>城市觀察</h1>
          <p>四個行政區，一座持續留下歷史的城市。</p>
        </div>
        <span className="status-dot">{controller.speed ? '模擬進行中' : '已暫停'}</span>
      </div>
      <div className="map-frame">
        <div className="map-toolbar">
          <h2>City Map</h2>
          <small>
            {state.metrics.households} 家庭 · {state.metrics.companies} 企業 · {state.metrics.units}{' '}
            住宅
          </small>
        </div>
        <CityMap state={state} revision={revision} />
      </div>
      <DevelopmentCards state={state} />
      <div className="city-bottom">
        <section>
          <h2>
            就業變化 <small>每 30 天記錄</small>
          </h2>
          {state.history.length > 1 ? (
            <ResponsiveContainer width="100%" height={140}>
              <AreaChart data={state.history.slice(-60)}>
                <XAxis dataKey="day" stroke="#8294a2" tick={{ fontSize: 10 }} minTickGap={40} />
                <Tooltip
                  contentStyle={{
                    background: '#182632',
                    border: '1px solid #344753',
                    color: '#eef3ef',
                  }}
                />
                <Area
                  type="linear"
                  dataKey="employed"
                  name="在職人口"
                  stroke="#91d8bd"
                  fill="#91d8bd"
                  fillOpacity={0.15}
                />
                <Area
                  type="linear"
                  dataKey="unemployed"
                  name="求職人口"
                  stroke="#d4b778"
                  fill="#d4b778"
                  fillOpacity={0.05}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="empty compact">模擬滿 60 天後，顯示實際就業趨勢。</div>
          )}
        </section>
        <section>
          <h2>最近發生</h2>
          <EventFeed state={state} events={controller.events.category('major')} limit={3} />
        </section>
      </div>
    </section>
  );
}
export function CitizensPage({ state }: { state: CityState }) {
  const [query, setQuery] = useState(''),
    [district, setDistrict] = useState('all'),
    [page, setPage] = useState(0);
  const select = usePresentation((s) => s.select);
  const filter = usePresentation((s) => s.citizenFilter);
  const setFilter = (citizenFilter: string) => usePresentation.setState({ citizenFilter });
  const rows = useMemo(
    () =>
      state.citizens.filter(
        (c) =>
          c.name.toLowerCase().includes(query.toLowerCase()) &&
          (filter === 'all' ||
            (filter === 'alive' && c.lifecycleStatus === 'alive') ||
            (c.employmentStatus === filter && c.lifecycleStatus === 'alive')) &&
          (district === 'all' ||
            state.units.find((u) => u.id === c.residenceId)?.districtId === district),
      ),
    [state, query, filter, district, state.day],
  );
  return (
    <section>
      <div className="section-heading">
        <div>
          <h1>居民</h1>
          <p>每一位居民，都有可以追溯的生活。</p>
        </div>
        <span>{rows.length} 位居民</span>
      </div>
      <div className="filter-bar">
        <label className="search">
          <Search size={16} />
          <input
            aria-label="搜尋居民"
            placeholder="搜尋姓名…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(0);
            }}
          />
        </label>
        <select
          aria-label="就業篩選"
          value={filter}
          onChange={(e) => {
            setFilter(e.target.value);
            setPage(0);
          }}
        >
          <option value="alive">現居人口</option>
          <option value="employed">在職</option>
          <option value="unemployed">求職中</option>
          <option value="retired">退休</option>
          <option value="child">未成年</option>
          <option value="student">進修中</option>
          <option value="all">所有歷史人口</option>
        </select>
        <select
          aria-label="行政區篩選"
          value={district}
          onChange={(e) => {
            setDistrict(e.target.value);
            setPage(0);
          }}
        >
          <option value="all">所有行政區</option>
          {state.districts.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>居民</th>
              <th>年齡</th>
              <th>就業</th>
              <th>月薪</th>
              <th>家庭存款</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.slice(page * 40, (page + 1) * 40).map((c) => (
              <tr key={c.id}>
                <td>
                  <button className="name-button" onClick={() => select('citizen', c.id)}>
                    <span className="mini-avatar">{c.name[0]}</span>
                    {c.name}
                  </button>
                </td>
                <td>{age(state, c)}</td>
                <td>
                  <span className={c.employmentStatus === 'employed' ? 'positive' : ''}>
                    {c.lifecycleStatus === 'alive'
                      ? employmentLabels[c.employmentStatus]
                      : c.lifecycleStatus}
                  </span>
                </td>
                <td>{money(c.salary)}</td>
                <td>{money(state.households.find((h) => h.id === c.householdId)?.cash ?? 0)}</td>
                <td>
                  <button
                    aria-label={`檢視 ${c.name}`}
                    className="icon-button"
                    onClick={() => select('citizen', c.id)}
                  >
                    <ArrowUpRight size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && <div className="empty">沒有符合搜尋條件的居民。</div>}
      </div>
      <div className="pagination">
        <button disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
          上一頁
        </button>
        <span>
          {page + 1} / {Math.max(1, Math.ceil(rows.length / 40))}
        </span>
        <button disabled={(page + 1) * 40 >= rows.length} onClick={() => setPage((p) => p + 1)}>
          下一頁
        </button>
      </div>
    </section>
  );
}
export function CompaniesPage({ state }: { state: CityState }) {
  const select = usePresentation((s) => s.select);
  const [filter, setFilter] = useState('all');
  const rows = state.companies.filter((f) => filter === 'all' || f.status === filter);
  return (
    <section>
      <div className="section-heading">
        <div>
          <h1>企業</h1>
          <p>從工作與生產，到真實的盈虧與興衰。</p>
        </div>
        <select
          aria-label="企業狀態篩選"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="all">所有企業</option>
          <option value="active">營運中</option>
          <option value="bankrupt">已倒閉</option>
        </select>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>企業 / 產業</th>
              <th>員工</th>
              <th>本日營收</th>
              <th>本日薪資</th>
              <th>稅前盈虧</th>
              <th>現金</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((f) => (
              <tr key={f.id}>
                <td>
                  <button className="name-button" onClick={() => select('company', f.id)}>
                    <Building2 size={19} />
                    <span>
                      {f.name}
                      <small>
                        {f.industry} · {f.status === 'active' ? '營運中' : '已倒閉'}
                      </small>
                    </span>
                  </button>
                </td>
                <td>{f.employeeIds.length}</td>
                <td>{money(f.revenue)}</td>
                <td>{money(f.payroll)}</td>
                <td className={f.profit < 0 ? 'negative' : 'positive'}>{money(f.profit)}</td>
                <td>{money(f.cash)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && <div className="empty">沒有符合條件的企業。</div>}
      </div>
    </section>
  );
}
export function EventsPage({ state }: { state: CityState }) {
  const [category, setCategory] = useState('major'),
    [limit, setLimit] = useState(60);
  const events = controller.events.category(category);
  return (
    <section>
      <div className="section-heading">
        <div>
          <h1>城市日報</h1>
          <p>故事源自發生過的事件。每一則新聞都有證據。</p>
        </div>
        <span>{events.length.toLocaleString()} 筆事實</span>
      </div>
      <div className="tabs">
        {[
          ['major', '重要事件'],
          ['all', '全部'],
          ['people', '居民'],
          ['business', '企業'],
          ['housing', '住宅'],
          ['government', '政策'],
        ].map(([key, label]) => (
          <button
            className={category === key ? 'active' : ''}
            key={key}
            onClick={() => {
              setCategory(key);
              setLimit(60);
            }}
          >
            {label}
          </button>
        ))}
      </div>
      <EventFeed state={state} events={events} limit={limit} />
      {events.length > limit && (
        <button className="load-more" onClick={() => setLimit((n) => n + 60)}>
          讀取更早的 60 筆事件
        </button>
      )}
    </section>
  );
}
function PolicyControl({ policy, state }: { policy: keyof Policies; state: CityState }) {
  const current = state.government.policies[policy];
  const [draft, setDraft] = useState(current);
  const notify = usePresentation((s) => s.notify);
  const percent = policy.endsWith('Tax');
  const educational = [
    'publicEducationFunding',
    'vocationalFunding',
    'higherEducationSubsidy',
  ].includes(policy);
  const max = percent ? 6000 : educational ? 100000 : policy === 'welfare' ? 300000 : 600000;
  return (
    <section className="policy">
      <div>
        <h3>{policyLabels[policy]}</h3>
        <p>
          {educational
            ? policy === 'publicEducationFunding'
              ? '每生每月購買公共教育服務，以實際可用國庫為限，影響完成機會。'
              : policy === 'vocationalFunding'
                ? '支付職業教育服務；求職者每三個月可接受一次有資金支持的短期職訓。'
                : '給在學高等教育居民的每月家庭補助，降低進修機會成本；國庫不足會縮減給付。'
            : policy === 'incomeTax'
              ? '薪資所得的扣繳比例，直接影響家庭可支配收入。'
              : policy === 'corporateTax'
                ? '僅針對企業正利潤課稅，影響企業累積資金。'
                : policy === 'welfare'
                  ? '提供求職者與退休居民給付，以可用國庫資金為限。'
                  : '企業支付的每月薪資下限，可能改變招聘與盈虧。'}
        </p>
      </div>
      <div className="policy-input">
        <strong>{percent ? `${(draft / 100).toFixed(1)}%` : money(draft)}</strong>
        <input
          aria-label={policyLabels[policy]}
          type="range"
          min="0"
          max={max}
          step={percent ? 100 : educational ? 1000 : 5000}
          value={draft}
          onChange={(e) => setDraft(Number(e.target.value))}
        />
        <div>
          <small>目前 {percent ? `${current / 100}%` : money(current)}</small>
          <button
            disabled={draft === current}
            onClick={() => {
              try {
                controller.command({ type: 'SET_POLICY', key: policy, value: draft });
                notify(`${policyLabels[policy]}已生效，變更已記入歷史。`);
              } catch (e) {
                notify(String(e));
              }
            }}
          >
            套用政策
          </button>
        </div>
      </div>
    </section>
  );
}
export function GovernmentPage({ state }: { state: CityState }) {
  const [district, setDistrict] = useState(state.districts[0].id),
    [units, setUnits] = useState(5);
  const notify = usePresentation((s) => s.notify);
  return (
    <section>
      <div className="section-heading">
        <div>
          <h1>制度與政策</h1>
          <p>你制定制度，居民與企業自行適應。</p>
        </div>
        <div className="treasury">
          <small>可用國庫</small>
          <strong>{money(state.government.cash)}</strong>
        </div>
      </div>
      <div className="policy-summary">
        <span>
          本日稅收 <strong>{money(state.government.taxRevenue)}</strong>
        </span>
        <span>
          本日福利 <strong>{money(state.government.welfareSpending)}</strong>
        </span>
        <span>
          累計建設 <strong>{money(state.government.constructionSpending)}</strong>
        </span>
      </div>
      <p>
        累計公共教育 {money(state.government.educationSpending)} · 職訓{' '}
        {money(state.government.vocationalSpending)} · 高等補助{' '}
        {money(state.government.subsidySpending)}
      </p>
      {(Object.keys(policyLabels) as (keyof Policies)[]).map((key) => (
        <PolicyControl
          key={`${state.config.seed}-${key}-${state.government.policies[key]}`}
          policy={key}
          state={state}
        />
      ))}
      <section className="housing-policy">
        <h2>住宅供給</h2>
        <p>新增市有住宅。每戶成本 $8,000，可容納最多 5 人；供給與入住率將影響後續租金。</p>
        <div className="filter-bar">
          <select
            aria-label="建設行政區"
            value={district}
            onChange={(e) => setDistrict(e.target.value)}
          >
            {state.districts.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
          <label>
            戶數{' '}
            <input
              aria-label="建設戶數"
              type="number"
              min="1"
              max="50"
              value={units}
              onChange={(e) => setUnits(Number(e.target.value))}
            />
          </label>
          <button
            className="primary"
            disabled={
              !Number.isInteger(units) ||
              units < 1 ||
              units > 50 ||
              state.government.cash < units * 800000
            }
            onClick={() => {
              try {
                controller.command({ type: 'BUILD_HOUSING', districtId: district, units });
                notify(`已新增 ${units} 戶住宅。`);
              } catch (e) {
                notify(String(e));
              }
            }}
          >
            興建住宅 · {money(units * 800000)}
          </button>
        </div>
      </section>
    </section>
  );
}
