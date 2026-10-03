import {
  Component,
  useEffect,
  useLayoutEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import {
  Map,
  Users,
  Building2,
  Newspaper,
  Landmark,
  Pause,
  Play,
  StepForward,
  Save,
  FolderOpen,
  Plus,
  Activity,
  CheckCircle2,
  X,
  RotateCcw,
} from 'lucide-react';
import { controller } from '../../../packages/application/src/controller';
import { stateHash } from '../../../packages/shared/src/canonical';
import { type CityState } from '../../../packages/domain/src/index';
import { usePresentation, type Page } from './store';
import { date, money } from './format';
import {
  CityPage,
  CitizensPage,
  CompaniesPage,
  EventsPage,
  GovernmentPage,
} from './components/Pages';
import { Inspector } from './components/Inspector';
import packageMetadata from '../../../package.json';
import {
  CityHistoryPage,
  GlobalSearch,
  InvestigationPage,
  ScenarioPage,
} from './components/Investigation';
declare global {
  interface Window {
    civitas?: { save: (text: string) => Promise<boolean>; load: () => Promise<string | null> };
  }
}
const nav = [
  { page: 'City' as Page, label: '城市', description: 'Map & overview', Icon: Map },
  { page: 'Citizens' as Page, label: '居民', description: 'People & households', Icon: Users },
  { page: 'Companies' as Page, label: '企業', description: 'Firms & economy', Icon: Building2 },
  { page: 'Events' as Page, label: '事件', description: 'History & evidence', Icon: Newspaper },
  { page: 'History' as Page, label: '城市歷史', description: 'Year in Review', Icon: Newspaper },
  {
    page: 'Scenarios' as Page,
    label: '情境比較',
    description: 'Simulation comparison',
    Icon: Landmark,
  },
  {
    page: 'Government' as Page,
    label: '政府',
    description: 'Policies & institutions',
    Icon: Landmark,
  },
];
function Pulse({ state }: { state: CityState }) {
  const m = state.metrics;
  return (
    <aside className="pulse">
      <h2>
        City Pulse <Activity size={16} />
      </h2>
      <p>每個數字，對應真實生活。</p>
      <div className="pulse-stat">
        <span>現居人口</span>
        <strong>
          <button
            className="metric-link"
            onClick={() => usePresentation.getState().select('metric', 'population')}
          >
            {m.population.toLocaleString()}
          </button>
          <small>人</small>
        </strong>
        <div>
          <span>{m.households} 家庭</span>
          <span>{m.companies} 企業</span>
        </div>
      </div>
      <div className="pulse-stat">
        <span>就業 / 求職</span>
        <strong>
          <button
            className="metric-link"
            aria-label="檢視在職居民"
            onClick={() =>
              usePresentation.setState({ page: 'Citizens', citizenFilter: 'employed' })
            }
          >
            {m.employed}
          </button>
          <small> / </small>
          <button
            className="metric-link"
            aria-label="檢視求職居民"
            onClick={() =>
              usePresentation.setState({ page: 'Citizens', citizenFilter: 'unemployed' })
            }
          >
            {m.unemployed}
          </button>
        </strong>
        <div>
          <span>勞動人口失業率</span>
          <button
            className="text-button"
            aria-label="解釋失業率"
            onClick={() => usePresentation.getState().select('metric', 'unemploymentRate')}
          >
            {(m.unemploymentRate / 100).toFixed(1)}%
          </button>
        </div>
      </div>
      <div className="pulse-stat">
        <span>家庭平均淨財富</span>
        <strong>
          <button
            className="metric-link"
            aria-label="解釋家庭淨財富"
            onClick={() => usePresentation.getState().select('metric', 'householdWealth')}
          >
            {money(m.householdWealth)}
          </button>
        </strong>
        <div>
          <span>平均月薪（全人口）</span>
          <button
            className="text-button"
            onClick={() => usePresentation.getState().select('metric', 'averageIncome')}
          >
            {money(m.averageIncome)}
          </button>
        </div>
      </div>
      <div className="pulse-stat">
        <span>住宅入住率</span>
        <strong>
          <button
            className="metric-link"
            aria-label="解釋住宅入住率"
            onClick={() => usePresentation.getState().select('metric', 'occupancyRate')}
          >
            {m.units ? Math.round((m.occupied / m.units) * 100) : 0}
          </button>
          <small>%</small>
        </strong>
        <div>
          <span>{m.vacancy} 戶空置</span>
          <button
            className="text-button"
            aria-label="解釋平均月租"
            onClick={() => usePresentation.getState().select('metric', 'averageRent')}
          >
            平均月租 {money(m.averageRent)}
          </button>
        </div>
        <div className="meter">
          <i style={{ width: `${m.units ? (m.occupied / m.units) * 100 : 0}%` }} />
        </div>
      </div>
      <div className="pulse-stat">
        <span>居民平均幸福</span>
        <strong>
          <button
            className="metric-link"
            aria-label="解釋居民幸福"
            onClick={() => usePresentation.getState().select('metric', 'happiness')}
          >
            {m.happiness}
          </button>
          <small> / 100</small>
        </strong>
        <div>
          <span>歷史事件</span>
          <span>{state.events.length.toLocaleString()}</span>
        </div>
      </div>
    </aside>
  );
}
function NewCityDialog({ close }: { close: () => void }) {
  const [seed, setSeed] = useState('CIVITAS-938291'),
    [population, setPopulation] = useState(250),
    [error, setError] = useState('');
  return (
    <div className="modal-backdrop">
      <form
        className="modal"
        onSubmit={(e) => {
          e.preventDefault();
          try {
            controller.newCity({ seed, population });
            usePresentation.setState({
              selected: undefined,
              page: 'City',
              stack: [],
              overlay: undefined,
              historyFilters: undefined,
            });
            close();
          } catch (e) {
            setError(String(e));
          }
        }}
      >
        <div className="section-heading">
          <h2>建立一座城市</h2>
          <button type="button" className="icon-button" aria-label="取消建立" onClick={close}>
            <X size={18} />
          </button>
        </div>
        <p>相同種子、政策與版本，會產生相同的城市歷史。</p>
        <label>
          城市種子
          <input
            aria-label="城市種子"
            required
            maxLength={128}
            value={seed}
            onChange={(e) => setSeed(e.target.value)}
          />
        </label>
        <label>
          初始人口
          <select
            aria-label="初始人口"
            value={population}
            onChange={(e) => setPopulation(Number(e.target.value))}
          >
            {[100, 250, 500, 1000].map((n) => (
              <option key={n} value={n}>
                {n} 位居民
              </option>
            ))}
          </select>
        </label>
        <p className="muted">建立後將取代目前城市。請先存檔以保留歷史。</p>
        {error && <p className="negative">{error}</p>}
        <button className="primary" type="submit">
          開始觀察
        </button>
      </form>
    </div>
  );
}
function Observatory() {
  const revision = useSyncExternalStore(controller.subscribe, controller.getSnapshot);
  const state = controller.state;
  const page = usePresentation((s) => s.page),
    setPage = usePresentation((s) => s.setPage),
    notice = usePresentation((s) => s.notice),
    notify = usePresentation((s) => s.notify);
  const stackLength = usePresentation((s) => s.stack.length);
  const navigationRevision = usePresentation((s) => s.navigationRevision);
  useLayoutEffect(() => {
    const scroll = usePresentation.getState().scroll;
    const main = document.querySelector('.main-view');
    if (main) main.scrollTop = scroll.main;
    const inspector = document.querySelector('.inspector');
    if (inspector) inspector.scrollTop = scroll.inspector;
    window.scrollTo(0, scroll.window);
  }, [navigationRevision]);
  const [newCity, setNewCity] = useState(false),
    [busy, setBusy] = useState(false),
    [diagnostics, setDiagnostics] = useState(false),
    [hash, setHash] = useState('');
  useEffect(() => {
    const timer = setInterval(() => {
      if (controller.speed) {
        try {
          controller.step(controller.speed === 100 ? 30 : controller.speed);
        } catch (e) {
          controller.setSpeed(0);
          notify(`模擬已暫停：${String(e)}`);
        }
      }
    }, 500);
    return () => clearInterval(timer);
  }, [notify]);
  useEffect(() => {
    if (notice) {
      const t = setTimeout(() => notify(''), 7000);
      return () => clearTimeout(t);
    }
  }, [notice, notify]);
  const task = async (fn: () => Promise<void>) => {
    controller.setSpeed(0);
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      notify(`操作失敗：${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  };
  const save = () =>
    task(async () => {
      const text = await controller.save();
      if (window.civitas) {
        if (await window.civitas.save(text))
          notify('城市已儲存。種子、政策、事件與隨機狀態完整保留。');
      } else {
        const blob = new Blob([text], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `CIVITAS-day-${state.day}.civitas`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        notify('存檔已下載。');
      }
    });
  const load = () =>
    task(async () => {
      if (window.civitas) {
        const text = await window.civitas.load();
        if (text !== null) {
          await controller.load(text);
          usePresentation.setState({
            selected: undefined,
            stack: [],
            overlay: undefined,
            historyFilters: undefined,
          });
          notify('城市已載入，可從相同狀態繼續。');
        }
      } else {
        document.getElementById('save-upload')?.click();
      }
    });
  return (
    <>
      <div className="app-shell">
        <header className="topbar">
          <div className="brand">CIVITAS</div>
          <div className="brand-note">
            A LIVING CITY OBSERVATORY<small>制度 · 生活 · 可以驗證的歷史</small>
          </div>
          <div className="clock">
            <strong>{date(state.day)}</strong>
            <small>第 {state.day} 個模擬日 · 1 tick = 1 day</small>
          </div>
          <div className="time-controls">
            <button
              className={controller.speed === 0 ? 'active' : ''}
              aria-label="暫停"
              onClick={() => controller.setSpeed(0)}
            >
              <Pause size={15} />
            </button>
            {[1, 5, 20, 100].map((speed) => (
              <button
                key={speed}
                className={controller.speed === speed ? 'active' : ''}
                disabled={busy}
                onClick={() => controller.setSpeed(speed)}
              >
                {speed === 100 ? 'Max' : `${speed}x`}
              </button>
            ))}
            <button
              aria-label="前進一天"
              disabled={busy}
              onClick={() => {
                controller.setSpeed(0);
                controller.step();
              }}
            >
              <StepForward size={16} />
            </button>
          </div>
          <div className="file-controls">
            <button aria-label="存檔" onClick={save} disabled={busy}>
              <Save size={15} />
              <span>存檔</span>
            </button>
            <button aria-label="載入" onClick={load} disabled={busy}>
              <FolderOpen size={15} />
              <span>載入</span>
            </button>
            <button
              aria-label="建立城市"
              disabled={busy}
              onClick={() => {
                controller.setSpeed(0);
                setNewCity(true);
              }}
            >
              <Plus size={17} />
            </button>
          </div>
        </header>
        <nav className="sidebar" aria-label="主要導覽">
          {nav.map(({ page: target, label, description, Icon }) => (
            <button
              key={target}
              aria-label={`${label} ${description}`}
              className={page === target ? 'active' : ''}
              onClick={() => setPage(target)}
            >
              <Icon size={23} />
              <span>
                {label}
                <small>{description}</small>
              </span>
            </button>
          ))}
          <div className="sidebar-foot">
            <span>
              SIMULATE
              <br />
              UNDERSTAND
              <br />
              REMEMBER
            </span>
            <small>
              v{packageMetadata.version}
              <br />
              離線自主運作
            </small>
            <button className="text-button" onClick={() => setDiagnostics((v) => !v)}>
              診斷與重播
            </button>
          </div>
        </nav>
        <main className="main-view">
          <div className="investigation-nav">
            <button
              aria-label="返回調查脈絡"
              disabled={!stackLength}
              onClick={() => usePresentation.getState().back()}
            >
              ← Back
            </button>
            <GlobalSearch state={state} />
          </div>
          {page === 'City' ? (
            <CityPage state={state} revision={revision} />
          ) : page === 'Citizens' ? (
            <CitizensPage state={state} />
          ) : page === 'Companies' ? (
            <CompaniesPage state={state} />
          ) : page === 'Events' ? (
            <EventsPage state={state} />
          ) : page === 'History' ? (
            <CityHistoryPage state={state} />
          ) : page === 'Metrics' ? (
            <InvestigationPage state={state} />
          ) : page === 'Scenarios' ? (
            <ScenarioPage />
          ) : (
            <GovernmentPage state={state} />
          )}
        </main>
        <div className="right-rail">
          <Pulse state={state} />
          <Inspector state={state} />
        </div>
        <footer className="statusbar">
          <span>
            <i className="dot mint" />{' '}
            {controller.speed ? (
              <>
                <Play size={12} /> 自主生活中
              </>
            ) : (
              '觀察已暫停'
            )}
          </span>
          <span className="seed">Seed: {state.config.seed}</span>
          <span>
            {state.commands.length} 個政策命令 · {state.events.length.toLocaleString()} 筆真實事件
          </span>
        </footer>
      </div>
      {notice && (
        <div className="toast" role="status">
          <CheckCircle2 size={19} />
          <span>{notice}</span>
          <button className="icon-button" aria-label="關閉通知" onClick={() => notify('')}>
            <X size={15} />
          </button>
        </div>
      )}
      {newCity && <NewCityDialog close={() => setNewCity(false)} />}
      <input
        hidden
        id="save-upload"
        type="file"
        accept=".civitas,.json"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f)
            void task(async () => {
              await controller.load(await f.text());
              usePresentation.setState({
                selected: undefined,
                stack: [],
                overlay: undefined,
                historyFilters: undefined,
              });
              notify('城市已載入。');
            });
          e.target.value = '';
        }}
      />
      {diagnostics && (
        <div className="diagnostics">
          <div className="section-heading">
            <h2>模擬診斷</h2>
            <button
              className="icon-button"
              aria-label="關閉診斷"
              onClick={() => setDiagnostics(false)}
            >
              <X size={16} />
            </button>
          </div>
          <p>
            Day {state.day} · {state.citizens.length} 居民記錄 · {state.events.length} 事件 ·
            上次批次 {controller.processingMs.toFixed(2)} ms
          </p>
          <button
            disabled={busy}
            onClick={() => void task(async () => setHash(await stateHash(controller.state)))}
          >
            計算 SHA-256
          </button>
          <button
            disabled={busy}
            onClick={() =>
              void task(async () => {
                await new Promise((r) => setTimeout(r, 50));
                const result = await controller.verifyReplay();
                setHash(result.actual);
                notify(
                  result.ok
                    ? '重播通過：城市完整狀態 SHA-256 完全一致。'
                    : '重播失敗：雜湊不一致。',
                );
              })
            }
          >
            <RotateCcw size={14} />
            驗證完整重播
          </button>
          <code>{hash || '尚未計算'}</code>
        </div>
      )}
    </>
  );
}
class ErrorBoundary extends Component<{ children: ReactNode }, { error: string }> {
  state = { error: '' };
  static getDerivedStateFromError(e: Error) {
    return { error: e.message };
  }
  render() {
    return this.state.error ? (
      <div className="fatal">
        <h1>城市介面遇到問題</h1>
        <p>{this.state.error}</p>
        <button onClick={() => window.location.reload()}>重新載入</button>
      </div>
    ) : (
      this.props.children
    );
  }
}
export function App() {
  return (
    <ErrorBoundary>
      <Observatory />
    </ErrorBoundary>
  );
}
