import { useEffect, useState } from 'react';
import type { CityState } from '../../../../packages/domain/src/index';
import { controller } from '../../../../packages/application/src/controller';
import { chronicleFrames } from '../../../../packages/application/src/chronicle';
import { narrative } from '../../../../packages/narrative/src/index';
import { usePresentation } from '../store';
import { date, money } from '../format';
import { EventRow } from './EventFeed';
import { showAffected } from './Investigation';

export function ChroniclePage({ state }: { state: CityState }) {
  const frames = chronicleFrames(controller.history);
  const day = usePresentation((s) => s.chronicleDay);
  const [playing, setPlaying] = useState(false);
  const [majorOnly, setMajorOnly] = useState(false);
  const [limit, setLimit] = useState(12);
  const index = Math.max(
    0,
    frames.findIndex((f) => f.day === day),
  );
  const frame = frames[index];
  const previous = frames[index - 1]?.day ?? controller.history.historyAvailableFromDay - 1;
  const events = controller.events
    .range(previous, frame.day)
    .filter((e) => !majorOnly || e.severity === 'major');
  const news = [...events].reverse().slice(0, limit);
  const nextDay = frames[index + 1]?.day;
  useEffect(() => {
    if (!playing) return;
    if (nextDay === undefined) {
      setPlaying(false);
      return;
    }
    const timer = window.setTimeout(
      () => usePresentation.setState({ chronicleDay: nextDay }),
      1800,
    );
    return () => window.clearTimeout(timer);
  }, [playing, nextDay]);
  const choose = (i: number) => {
    setPlaying(false);
    setLimit(12);
    usePresentation.setState({ chronicleDay: frames[i].day });
  };
  return (
    <section className="city-chronicle">
      <p className="eyebrow">CITY CHRONICLE · RECORDED OBSERVATIONS</p>
      <h1>城市紀事</h1>
      <p>統計、人生與事件，在已記錄的時間點交會。</p>
      <div className="chronicle-timeline">
        <div className="section-heading">
          <h2>{date(frame.day)}</h2>
          <button
            disabled={frames.length < 2}
            onClick={() => {
              if (!playing && index === frames.length - 1)
                usePresentation.setState({ chronicleDay: frames[0].day });
              setPlaying((v) => !v);
            }}
          >
            {playing ? '暫停紀事' : '播放紀事'}
          </button>
        </div>
        <label>
          觀測時間點{' '}
          <input
            aria-label="城市紀事時間點"
            type="range"
            min="0"
            max={frames.length - 1}
            step="1"
            value={index}
            onChange={(e) => choose(Number(e.target.value))}
          />
        </label>
        <div className="filter-bar">
          <select
            aria-label="紀事觀測日期"
            value={frame.day}
            onChange={(e) => choose(frames.findIndex((f) => f.day === Number(e.target.value)))}
          >
            {frames.map((f) => (
              <option key={f.day} value={f.day}>
                {date(f.day)}
                {f.day === state.day ? ' · 最近觀测' : ''}
              </option>
            ))}
          </select>
          <button onClick={() => choose(0)}>最早觀測</button>
          <button onClick={() => choose(frames.length - 1)}>最近觀測</button>
        </div>
        <p className="muted">
          播放只切換觀測資料，不推進模擬。記錄始於{' '}
          {date(controller.history.historyAvailableFromDay)}
          ；年度收束與最近觀測之間不插值，不重建過去的 3D 城市。右側 City Pulse
          與居民檔案仍顯示目前狀態。
        </p>
      </div>
      <div className="review-grid" aria-label="紀事歷史統計" data-observed-day={frame.day}>
        <div>
          <small>人口</small>
          <b>{frame.values.population}</b>
        </div>
        <div>
          <small>企業</small>
          <b>{frame.values.companies}</b>
        </div>
        <div>
          <small>家庭</small>
          <b>{frame.values.households}</b>
        </div>
        <div>
          <small>失業率</small>
          <b>{(frame.values.unemploymentRate / 100).toFixed(1)}%</b>
        </div>
        <div>
          <small>平均房租</small>
          <b>{money(frame.values.averageRent)}</b>
        </div>
        <div>
          <small>家庭平均淨財富</small>
          <b>{money(frame.values.householdWealth)}</b>
        </div>
      </div>
      <div className="section-heading">
        <h2>有證據的城市新聞</h2>
        <label>
          <input
            type="checkbox"
            checked={majorOnly}
            onChange={(e) => {
              setMajorOnly(e.target.checked);
              setLimit(12);
            }}
          />{' '}
          只看重大事件
        </label>
      </div>
      <p className="muted">
        事件區間：{date(Math.max(0, previous + 1))} — {date(frame.day)}
        。標題來自確定性模板；只陳述事件記錄，不推測因果。人物連結開啟目前檔案。
      </p>
      {!news.length && <p className="empty">此區間沒有符合條件的已記錄事件。</p>}
      {news.map((event) => (
        <section className="chronicle-article" key={event.id}>
          <EventRow event={event} state={state} />
          <details>
            <summary>原始事件證據 · {event.id}</summary>
            <p>{narrative.generateNews(event).title}</p>
            <pre>{JSON.stringify(event.payload, null, 2)}</pre>
            <p>
              已記錄原因：
              {event.causeEventIds.length ? event.causeEventIds.join('、') : '無直接原因連結'}
            </p>
          </details>
          <button
            className="text-button"
            onClick={() => {
              showAffected([event], `紀事 ${date(event.tick)} · 目前可定位實體`);
            }}
          >
            在目前地圖定位事件實體
          </button>
        </section>
      ))}
      <p className="muted">
        已顯示 {news.length} / {events.length} 則事件。
      </p>
      {news.length < events.length && (
        <button onClick={() => setLimit((n) => n + 12)}>顯示更多新聞</button>
      )}
    </section>
  );
}
