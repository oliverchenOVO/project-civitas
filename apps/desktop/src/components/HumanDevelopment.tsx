import { useMemo, useState } from 'react';
import {
  age,
  EDUCATION_LEVELS,
  OCCUPATIONS,
  CLASS_BANDS,
  type Citizen,
  type CityState,
  type Occupation,
} from '../../../../packages/domain/src/index';
import { qualification, occupationProfiles } from '../../../../packages/domain/src/occupations';
import {
  humanDevelopment,
  cohortAnalysis,
} from '../../../../packages/application/src/human-development';
import { controller } from '../../../../packages/application/src/controller';
import { usePresentation } from '../store';
import { date, money } from '../format';
import { EventRow } from './EventFeed';

export const educationLabels = {
  basic: '基礎',
  secondary: '中等',
  vocational: '職業',
  tertiary: '高等',
};
export const occupationLabels = {
  labor: '勞務',
  service: '服務',
  clerical: '文書',
  technical: '技術',
  professional: '專業',
  management: '管理',
};
export const classLabels = {
  vulnerable: '經濟脆弱',
  working: '工作階層',
  middle: '中間階層',
  affluent: '富裕',
};
const skillLabels = { general: '通用', technical: '技術', service: '服務', managerial: '管理' };
const pct = (n: number, d: number) => (d ? `${((n * 100) / d).toFixed(1)}%` : '無可比較樣本');

export function CitizenDevelopment({ state, citizen }: { state: CityState; citizen: Citizen }) {
  const [tab, setTab] = useState('education'),
    [occupation, setOccupation] = useState<Occupation>('technical');
  const hc = citizen.humanCapital,
    household = state.households.find((h) => h.id === citizen.householdId)!;
  const events = controller.events.entity('citizen', citizen.id);
  const evidence = qualification(citizen, occupation);
  const hire = [...events]
    .reverse()
    .find((e) => e.type === 'CITIZEN_HIRED' && e.tick >= hc.availableFromDay);
  const qualificationEvent = hire ? controller.events.byId.get(hire.causeEventIds[0]) : undefined;
  const career = events.filter(
    (e) =>
      [
        'CITIZEN_HIRED',
        'CITIZEN_FIRED',
        'PROMOTED',
        'OCCUPATION_CHANGED',
        'SALARY_CHANGED',
      ].includes(e.type) && e.tick >= hc.availableFromDay,
  );
  return (
    <section className="human-citizen" aria-label="居民人力發展">
      <h4>Human Development · 人生機會</h4>
      <div className="tabs" role="group" aria-label="居民發展分頁">
        {[
          ['education', '教育'],
          ['career', '職涯'],
          ['mobility', '流動'],
        ].map(([k, label]) => (
          <button
            key={k}
            className={tab === k ? 'active' : ''}
            aria-pressed={tab === k}
            onClick={() => setTab(k)}
          >
            {label}
          </button>
        ))}
      </div>
      <p className="muted">
        教育／職涯紀錄自 {date(hc.availableFromDay)}。
        {hc.provenance === 'legacy-inferred'
          ? '遷移前教育與職涯細節不可用；目前起始能力為有標記的推導值。'
          : hc.provenance !== 'birth'
            ? '初始能力為模型起點，並非城市內已發生的歷史。'
            : '從出生起記錄的實際模擬歷史。'}
      </p>
      {tab === 'education' && (
        <>
          <p>
            最高完成教育 <strong>{educationLabels[hc.education]}</strong> · {age(state, citizen)} 歲
            · 目前路徑 {hc.track}
          </p>
          <div className="human-skills">
            {Object.entries(hc.skills).map(([k, v]) => (
              <div key={k}>
                <span>{skillLabels[k as keyof typeof skillLabels]}</span>
                <strong>{v} / 100</strong>
                <progress max="100" value={v} />
              </div>
            ))}
          </div>
          <p className="muted">技能反映教育、工作／職訓與長期失業；不是人格或價值評分。</p>
          {events
            .filter(
              (e) => /EDUCATION|VOCATIONAL|TERTIARY/.test(e.type) && e.tick >= hc.availableFromDay,
            )
            .slice(-8)
            .reverse()
            .map((e) => (
              <EventRow key={e.id} event={e} state={state} />
            ))}
        </>
      )}
      {tab === 'career' && (
        <>
          <p>
            目前職業{' '}
            <strong>
              {citizen.occupation
                ? occupationLabels[citizen.occupation as Occupation]
                : '尚無在職職位'}
            </strong>{' '}
            · 月薪 {money(citizen.salary)}
          </p>
          <p>
            實收薪資累計（紀錄起點後）{money(hc.lifetimeEarned)} · 失業 {hc.unemployedMonths} 個月
          </p>
          <h4>Explain · 任職資格</h4>
          <select
            aria-label="檢查職業資格"
            value={occupation}
            onChange={(e) => setOccupation(e.target.value as Occupation)}
          >
            {OCCUPATIONS.map((k) => (
              <option key={k} value={k}>
                {occupationLabels[k]}
              </option>
            ))}
          </select>
          <p role="status">
            {evidence.eligible ? '符合此職業能力門檻' : '尚不符合此職業能力門檻'}
            ；能力資格不代表有職缺、已獲聘或適齡。
          </p>
          <ul>
            {evidence.checks.map((x) => (
              <li key={x.name}>
                {x.name}：{x.actual} ≥ {x.required} {x.actual >= x.required ? '✓' : '未達'}
              </li>
            ))}
          </ul>
          <p className="muted">
            基準月薪 {money(occupationProfiles[occupation].baseWage)}
            ；薪資由職業、技能、相關經驗、企業現金區間與最低工資決定。工作中同職業的既有遷移任用可保留，重新招聘須達新門檻。
          </p>
          {qualificationEvent && (
            <>
              <h4>最近獲聘當時的證據</h4>
              <EventRow state={state} event={qualificationEvent} />
            </>
          )}
          <h4>薪資／職涯軌跡 · 事件紀錄</h4>
          {career
            .slice(-12)
            .reverse()
            .map((e) => (
              <EventRow key={e.id} event={e} state={state} />
            ))}
        </>
      )}
      {tab === 'mobility' && (
        <>
          <p>
            家庭起點{' '}
            <button
              className="text-button"
              onClick={() => usePresentation.getState().select('household', hc.origin.householdId)}
            >
              {hc.origin.householdId} ↗
            </button>{' '}
            · {classLabels[hc.origin.class]}
          </p>
          <p>
            起點家庭月收入 {money(hc.origin.income)} ·{' '}
            {hc.origin.childhoodObserved ? '曾觀測童年背景' : '成年加入，童年背景不可用'}
          </p>
          <p>
            目前家庭 <strong>{classLabels[household.mobility.class]}</strong> · 最近月度實收收入換算{' '}
            {money(household.mobility.monthlyIncome)}
          </p>
          <p className="muted">
            階層由家庭收入、淨財富與房租負擔推導；跨階層事件每年比較一次，不評價個人能力或道德。
          </p>
          {hc.adultComparison ? (
            <p>
              25 歲以上代際比較：{classLabels[hc.adultComparison.origin]} →{' '}
              {classLabels[hc.adultComparison.current]} · {hc.adultComparison.direction}
            </p>
          ) : (
            <p>代際結果尚不可用：須有觀測到的童年起點，且達 25 歲。</p>
          )}
          {events
            .filter((e) => /CLASS_MOVED|INTERGENERATIONAL/.test(e.type))
            .slice(-8)
            .reverse()
            .map((e) => (
              <EventRow key={e.id} event={e} state={state} />
            ))}
        </>
      )}
    </section>
  );
}
export function DevelopmentCards({ state }: { state: CityState }) {
  const data = useMemo(() => humanDevelopment(state), [state, state.day, controller.revision]);
  return (
    <section className="development-cards" aria-label="城市人力發展摘要">
      <h2>Human Development</h2>
      <div className="review-grid">
        <button onClick={() => usePresentation.getState().setPage('Development')}>
          <small>成年高等教育 · n={data.adults}</small>
          <strong>{pct(data.education.tertiary, data.adults)}</strong>
        </button>
        <button onClick={() => usePresentation.getState().setPage('Development')}>
          <small>家庭年度向上／向下轉變</small>
          <strong>
            {data.upward} / {data.downward}
          </strong>
        </button>
        <button onClick={() => usePresentation.getState().setPage('Development')}>
          <small>教育／職訓／補助累計支出</small>
          <strong>
            {money(data.educationSpending + data.vocationalSpending + data.subsidySpending)}
          </strong>
        </button>
      </div>
    </section>
  );
}
export function HumanDevelopmentPage({ state }: { state: CityState }) {
  const [cohort, setCohort] = useState('adults');
  const data = useMemo(() => humanDevelopment(state), [state, state.day, controller.revision]);
  const result = useMemo(
    () =>
      cohortAnalysis(
        state,
        cohort === 'born'
          ? { bornFromYear: 0, bornToYear: 4, adultOnly: true }
          : cohort === 'low'
            ? { lowIncomeOrigin: true, adultOnly: true }
            : cohort === 'tertiary'
              ? { tertiary: true, adultOnly: true }
              : { adultOnly: true },
      ),
    [state, cohort, state.day, controller.revision],
  );
  const samples = controller.history.humanDevelopment.samples;
  return (
    <section className="investigation human-development">
      <p className="eyebrow">IN THIS SIMULATED CITY</p>
      <h1>人力發展與社會流動</h1>
      <p>在這座模擬城市中，教育與家庭機會如何累積。這些關聯不是現實政策因果推論。</p>
      <p className="muted">
        本頁觀測自 {date(controller.history.humanDevelopment.availableFromDay)}；成年教育樣本 n=
        {data.adults}，現居人口 n={data.population}。初始／遷入能力包含有標記的起始值。
      </p>
      <h2>教育與就業</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>完成教育</th>
              <th>成年 n</th>
              <th>勞動人口 n</th>
              <th>失業／勞動人口</th>
              <th>成年平均月薪（含退休零薪）</th>
            </tr>
          </thead>
          <tbody>
            {EDUCATION_LEVELS.map((k) => (
              <tr key={k}>
                <td>{educationLabels[k]}</td>
                <td>{data.education[k]}</td>
                <td>{data.laborForceByEducation[k]}</td>
                <td>
                  {data.unemployedByEducation[k]} / {data.laborForceByEducation[k]} ·{' '}
                  {pct(data.unemployedByEducation[k], data.laborForceByEducation[k])}
                </td>
                <td>{money(data.incomeByEducation[k])}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h2>職業與家庭階層</h2>
      <div className="review-grid">
        {OCCUPATIONS.map((k) => (
          <div key={k}>
            <small>{occupationLabels[k]}</small>
            <b>{data.occupations[k]} 在職</b>
          </div>
        ))}
        {CLASS_BANDS.map((k) => (
          <div key={k}>
            <small>{classLabels[k]}</small>
            <b>{data.classes[k]} 家庭</b>
          </div>
        ))}
      </div>
      <p>
        向上 {data.upward}／向下 {data.downward} 次家庭年度轉變；已觀測{' '}
        {data.mobilityHouseholdYears} 個家庭年。{pct(data.upward, data.mobilityHouseholdYears)}{' '}
        向上轉變／家庭年，{pct(data.downward, data.mobilityHouseholdYears)} 向下轉變／家庭年。
      </p>
      <h2>Cohort · 同群分析</h2>
      <select aria-label="社會流動同群" value={cohort} onChange={(e) => setCohort(e.target.value)}>
        <option value="adults">現居成年人</option>
        <option value="born">Year 1–5 出生，現已成年</option>
        <option value="low">觀測童年經濟脆弱，現已成年</option>
        <option value="tertiary">現居高等教育成年人</option>
      </select>
      <p>
        同群 n={result.size}；在職 {result.employed}，在職／同群比例{' '}
        {result.employmentRate === null
          ? '無可比較樣本'
          : `${(result.employmentRate / 100).toFixed(1)}%`}
        （包含退休人口）。
      </p>
      <p>
        有 25 歲代際比較 n={result.reviewed}：向上 {result.up}／向下 {result.down}／穩定{' '}
        {result.stable}。
      </p>
      <div className="review-grid">
        {CLASS_BANDS.map((k) => (
          <div key={k}>
            <small>目前 {classLabels[k]}</small>
            <b>{result.classes[k]} 人</b>
          </div>
        ))}
      </div>
      <div className="relationship-list">
        {result.ids.slice(0, 12).map((id) => (
          <button key={id} onClick={() => usePresentation.getState().select('citizen', id)}>
            {state.citizens.find((c) => c.id === id)!.name} ↗
          </button>
        ))}
      </div>
      <h2>最近月度觀測</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>日期</th>
              <th>成年 n</th>
              <th>職業／高等完成</th>
              <th>向上／向下累計</th>
              <th>教育支出累計</th>
            </tr>
          </thead>
          <tbody>
            {samples
              .slice(-12)
              .reverse()
              .map((r) => (
                <tr key={r.day}>
                  <td>{date(r.day)}</td>
                  <td>{r.adults}</td>
                  <td>
                    {r.education.vocational} / {r.education.tertiary}
                  </td>
                  <td>
                    {r.upward} / {r.downward}
                  </td>
                  <td>{money(r.educationSpending + r.vocationalSpending + r.subsidySpending)}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
