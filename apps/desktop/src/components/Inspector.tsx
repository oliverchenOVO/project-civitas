import { UserRound, ArrowUpRight, X } from 'lucide-react';
import { age, type CityState } from '../../../../packages/domain/src/index';
import { usePresentation } from '../store';
import { money, employmentLabels, date } from '../format';
import { EventFeed } from './EventFeed';
function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="field">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
export function Inspector({ state }: { state: CityState }) {
  const selected = usePresentation((s) => s.selected);
  const select = usePresentation((s) => s.select);
  if (!selected)
    return (
      <aside className="inspector">
        <h2>生活觀察</h2>
        <div className="empty">
          <UserRound size={32} />
          <p>選擇一位居民、一戶家庭或一家企業，追溯這座城市正在發生的故事。</p>
        </div>
        <button className="primary" onClick={() => select('citizen', state.citizens[0].id)}>
          認識第一位居民 <ArrowUpRight size={15} />
        </button>
      </aside>
    );
  const citizen =
    selected.kind === 'citizen' ? state.citizens.find((c) => c.id === selected.id) : undefined;
  const firm =
    selected.kind === 'company' ? state.companies.find((f) => f.id === selected.id) : undefined;
  const household = state.households.find(
    (h) => h.id === (citizen?.householdId ?? (selected.kind === 'household' ? selected.id : '')),
  );
  const unit = state.units.find((u) => u.id === household?.residenceId);
  const district = state.districts.find((d) => d.id === (unit?.districtId ?? firm?.districtId));
  if (!citizen && !firm && !household)
    return (
      <aside className="inspector">
        <p>此城市中找不到選取的實體。</p>
      </aside>
    );
  const history = state.events.filter((e) => e.entityRefs.some((r) => r.id === selected.id));
  return (
    <aside className="inspector">
      <div className="section-heading">
        <h2>{citizen ? '居民檔案' : firm ? '企業檔案' : '家庭檔案'}</h2>
        <button
          className="icon-button"
          aria-label="關閉檔案"
          onClick={() => usePresentation.setState({ selected: undefined })}
        >
          <X size={17} />
        </button>
      </div>
      <div className="identity">
        <div className="avatar">{(citizen?.name ?? firm?.name ?? 'H').slice(0, 1)}</div>
        <div>
          <h3>{citizen?.name ?? firm?.name ?? `家庭 ${household!.id.split('-')[1]}`}</h3>
          <small>
            {selected.id} · {district?.name ?? '無住所'}
          </small>
        </div>
      </div>
      {citizen && (
        <>
          <Field
            label="年齡 / 狀態"
            value={`${age(state, citizen)} 歲 · ${citizen.lifecycleStatus === 'alive' ? employmentLabels[citizen.employmentStatus] : citizen.lifecycleStatus === 'dead' ? '已離世' : '已遷出'}`}
          />
          <Field label="職業" value={citizen.occupation ?? '—'} />
          <Field label="每月薪資" value={money(citizen.salary)} />
          <Field label="個人備用金" value={money(citizen.cash)} />
          <Field
            label="雇主"
            value={
              citizen.employerId ? (
                <button
                  className="text-button"
                  onClick={() => select('company', citizen.employerId!)}
                >
                  {state.companies.find((f) => f.id === citizen.employerId)?.name} ↗
                </button>
              ) : (
                '—'
              )
            }
          />
          <Field
            label="家庭"
            value={
              <button
                className="text-button"
                onClick={() => select('household', citizen.householdId)}
              >
                家庭 {citizen.householdId.split('-')[1]} ↗
              </button>
            }
          />
          <Field label="幸福 / 壓力" value={`${citizen.happiness} / ${citizen.stress}`} />
          <div className="meter">
            <i style={{ width: `${citizen.happiness}%` }} />
          </div>
          <h4>人際關係</h4>
          <div className="relationship-list">
            {state.relationships
              .filter((e) => e.citizenA === citizen.id || e.citizenB === citizen.id)
              .slice(0, 12)
              .map((edge) => {
                const cid = edge.citizenA === citizen.id ? edge.citizenB : edge.citizenA;
                return (
                  <button key={edge.id} onClick={() => select('citizen', cid)}>
                    {state.citizens.find((c) => c.id === cid)?.name}
                    <small>{edge.relationshipType}</small>
                  </button>
                );
              })}
          </div>
        </>
      )}
      {household && (
        <>
          <Field label="家庭存款" value={money(household.cash)} />
          <Field label="租金欠款" value={money(household.debt)} />
          <Field
            label="本日實收 / 支出"
            value={`${money(household.income)} / ${money(household.expenses)}`}
          />
          <Field label="每月房租" value={money(household.housingCost)} />
          <Field label="財務狀況" value={household.socioeconomicStatus} />
          {!citizen && (
            <div className="relationship-list">
              {household.memberIds.map((cid) => (
                <button key={cid} onClick={() => select('citizen', cid)}>
                  {state.citizens.find((c) => c.id === cid)?.name} ↗
                </button>
              ))}
            </div>
          )}
        </>
      )}
      {firm && (
        <>
          <Field label="產業 / 狀態" value={`${firm.industry} · ${firm.status}`} />
          <Field label="創立日期" value={date(firm.foundedDay)} />
          <Field
            label="員工 / 招募職缺"
            value={`${firm.employeeIds.length} / ${firm.openPositions}`}
          />
          <Field label="本日營收" value={money(firm.revenue)} />
          <Field
            label="本日薪資 / 營運支出"
            value={`${money(firm.payroll)} / ${money(firm.expenses - firm.payroll)}`}
          />
          <Field
            label="本日稅前盈虧"
            value={<span className={firm.profit < 0 ? 'negative' : ''}>{money(firm.profit)}</span>}
          />
          <Field label="企業現金" value={money(firm.cash)} />
          <div className="relationship-list">
            {firm.employeeIds.slice(0, 12).map((cid) => (
              <button key={cid} onClick={() => select('citizen', cid)}>
                {state.citizens.find((c) => c.id === cid)?.name} ↗
              </button>
            ))}
          </div>
        </>
      )}
      <h4>
        {citizen ? '真實人生履歷' : firm ? '企業歷史' : '家庭歷史'}{' '}
        <small>{history.length} 筆事件</small>
      </h4>
      <EventFeed state={state} events={history} limit={30} />
    </aside>
  );
}
