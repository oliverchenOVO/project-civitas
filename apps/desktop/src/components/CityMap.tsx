import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Users, House, Building2, Navigation } from 'lucide-react';
import { Application } from 'pixi.js';
import type { CityState } from '../../../../packages/domain/src/index';
import { usePresentation } from '../store';
import { CityScene, type MapLayers, type View } from '../scene/renderer';
import type { SceneData } from '../scene/data';
import type { MapSelection } from '../scene/data';
const mapSelection = (selected?: { kind: string; id: string }): MapSelection | undefined =>
  selected && ['citizen', 'company', 'household', 'district'].includes(selected.kind)
    ? { kind: selected.kind as MapSelection['kind'], id: selected.id }
    : undefined;

const INITIAL_LAYERS: MapLayers = { residents: true, housing: true, companies: true };
const controls = [
  { key: 'residents', label: '居民', Icon: Users },
  { key: 'housing', label: '住宅', Icon: House },
  { key: 'companies', label: '企業', Icon: Building2 },
] as const;
export function CityMap({ state, revision }: { state: CityState; revision: number }) {
  const host = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const sceneRef = useRef<CityScene | null>(null);
  const selected = usePresentation((s) => s.selected);
  const overlay = usePresentation((s) => s.overlay);
  const select = usePresentation((s) => s.select);
  const [layers, setLayers] = useState(INITIAL_LAYERS);
  const current = useRef({ state, layers, selected });
  current.current = { state, layers, selected };
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const [view, setView] = useState<View>({ scale: 1, x: 0, y: 0, width: 1000, height: 650 });
  const [data, setData] = useState<SceneData>();
  const [hover, setHover] = useState('');
  useEffect(() => {
    let disposed = false;
    let observer: ResizeObserver | undefined;
    const app = new Application();
    void app
      .init({
        background: '#101e28',
        antialias: true,
        resolution: Math.min(window.devicePixelRatio, 2),
        autoDensity: true,
        resizeTo: host.current!,
        preference: 'webgl',
        autoStart: false,
      })
      .then(() => {
        if (disposed) {
          app.destroy(true, { children: true });
          return;
        }
        appRef.current = app;
        app.canvas.setAttribute('aria-label', '互動城市場景：點選居民、企業、家庭或行政區');
        host.current?.prepend(app.canvas);
        const scene = new CityScene(app, select, setHover);
        sceneRef.current = scene;
        const { state, layers, selected } = current.current;
        scene.update(state, layers, mapSelection(selected));
        scene.setAffected(overlay);
        const resize = () => {
          app.resize();
          setView(scene.resize());
          app.render();
        };
        resize();
        observer = new ResizeObserver(resize);
        if (host.current) observer.observe(host.current);
        setData(scene.data);
        setReady(true);
      })
      .catch((e) => {
        if (!disposed) setError(`城市圖形載入失敗：${String(e)}`);
      });
    return () => {
      disposed = true;
      observer?.disconnect();
      sceneRef.current = null;
      if (appRef.current === app) {
        appRef.current = null;
        app.destroy(true, { children: true });
      }
    };
  }, [select]);
  useEffect(() => {
    const scene = sceneRef.current,
      app = appRef.current;
    if (!scene || !app || !ready) return;
    scene.update(state, layers, mapSelection(selected));
    const overlayStart = performance.now();
    scene.setAffected(overlay);
    const overlayMs = performance.now() - overlayStart;
    setData(scene.data);
    if (host.current) {
      host.current.dataset.renderMs = (scene.renderMs + overlayMs).toFixed(3);
      host.current.dataset.overlayMs = overlayMs.toFixed(3);
    }
    app.render();
  }, [state, revision, layers, selected, ready, overlay]);
  const layouts = sceneRef.current?.layout.districts ?? [];
  return (
    <div
      className="map-host"
      ref={host}
      role="region"
      aria-label="城市地圖：四個行政區、真實住宅、企業與居民"
      data-scene-ready={ready}
      data-buildings={data?.buildings.length ?? 0}
      data-residents={data?.residents.length ?? 0}
      data-selected-id={selected?.id ?? ''}
      data-affected-count={
        overlay?.refs.filter((r) => overlay.mode === 'all' || overlay.mode === r.kind).length ?? 0
      }
      data-view={JSON.stringify(view)}
    >
      {error && <div className="empty">{error}</div>}
      {overlay && (
        <div className="map-evidence">
          <span>{overlay.label} · 目前可定位住所 / 建築</span>
          <select
            aria-label="受影響實體圖層"
            value={overlay.mode}
            onChange={(e) =>
              usePresentation
                .getState()
                .setOverlay({ ...overlay, mode: e.target.value as typeof overlay.mode })
            }
          >
            <option value="all">全部</option>
            <option value="company">企業</option>
            <option value="citizen">居民住所</option>
            <option value="household">家庭住所</option>
          </select>
          <button onClick={() => usePresentation.getState().setOverlay(undefined)}>
            清除調查圖層
          </button>
        </div>
      )}
      <div className="map-compass" aria-label="地圖北向">
        <Navigation size={21} strokeWidth={1.2} />
        <span>N</span>
      </div>
      <div className="map-layers" role="group" aria-label="地圖圖層">
        {controls.map(({ key, label, Icon }) => (
          <button
            key={key}
            aria-label={`${label}圖層`}
            aria-pressed={layers[key]}
            onClick={() => setLayers((previous) => ({ ...previous, [key]: !previous[key] }))}
          >
            <Icon size={13} />
            <span>{label}</span>
          </button>
        ))}
      </div>
      <div className="map-district-labels">
        {layouts.map((district) => {
          const count = data?.districts.get(district.id);
          return (
            <button
              key={district.id}
              className={`district-label ${selected?.kind === 'district' && selected.id === district.id ? 'chosen' : ''}`}
              aria-label={`選取行政區 ${district.name}`}
              aria-pressed={selected?.kind === 'district' && selected.id === district.id}
              title={`${district.name} · 區域風格標記；地標為視覺示意`}
              style={
                {
                  left: view.x + district.label.x * view.scale,
                  top: view.y + district.label.y * view.scale,
                  '--district-color': district.color,
                } as CSSProperties
              }
              onClick={() => select('district', district.id)}
            >
              <strong>{district.name}</strong>
              <small>{district.tags}</small>
              <span>
                {count?.population ?? 0} 居民 · {count?.companies ?? 0} 企業
              </span>
            </button>
          );
        })}
      </div>
      <div className="map-scale" aria-label="示意比例，無實際距離單位">
        <i />
        <span>示意比例</span>
      </div>
      <div className="map-hover" role="status">
        {hover}
      </div>
      <div className="map-legend" aria-label="城市地圖圖例">
        <span>
          <i className="dot mint" />
          在職
        </span>
        <span>
          <i className="dot gold" />
          其他居民
        </span>
        <span>
          <i className="legend-vacant" />
          空置
        </span>
        <span>
          <i className="legend-stressed" />
          家庭承壓
        </span>
        <span className="map-truth-note">
          居民點位表示住所{data?.unlocated ? ` · ${data.unlocated} 人無可定位住所` : ''}
        </span>
      </div>
    </div>
  );
}
