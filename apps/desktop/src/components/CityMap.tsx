import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Users, House, Building2, Navigation } from 'lucide-react';
import { CityScene3D, type CameraView, type LabelPosition } from '../scene/renderer3d';
import type { CityState } from '../../../../packages/domain/src/index';
import { usePresentation } from '../store';
import type { MapLayers } from '../scene/renderer';
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
  const sceneRef = useRef<CityScene3D | null>(null);
  const selected = usePresentation((s) => s.selected);
  const overlay = usePresentation((s) => s.overlay);
  const select = usePresentation((s) => s.select);
  const [layers, setLayers] = useState(INITIAL_LAYERS);
  const current = useRef({ state, layers, selected, overlay });
  current.current = { state, layers, selected, overlay };
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const [view, setView] = useState<CameraView>({ elevation: 55, azimuth: -12, distance: 1050 });
  const [labelPositions, setLabelPositions] = useState<LabelPosition[]>([]);
  const [data, setData] = useState<SceneData>();
  const [hover, setHover] = useState('');
  const [fullscreen, setFullscreen] = useState(false);
  useEffect(() => {
    const changed = () => setFullscreen(document.fullscreenElement === host.current);
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && document.fullscreenElement === host.current) {
        event.preventDefault();
        void document.exitFullscreen();
      }
    };
    document.addEventListener('fullscreenchange', changed);
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('fullscreenchange', changed);
      document.removeEventListener('keydown', key);
    };
  }, []);
  useEffect(() => {
    let scene: CityScene3D | undefined;
    try {
      scene = new CityScene3D(host.current!, select, setHover, (view, labels) => {
        setView(view);
        setLabelPositions(labels);
        if (scene)
          usePresentation.setState({
            mapCamera: {
              ...view,
              target: scene.controls.target.toArray() as [number, number, number],
            },
          });
      });
      sceneRef.current = scene;
      const savedCamera = usePresentation.getState().mapCamera;
      const { state, layers, selected, overlay } = current.current;
      scene.update(state, layers, mapSelection(selected), overlay);
      if (savedCamera) scene.restore(savedCamera);
      else scene.setElevation(55, true);
      setData(scene.data);
      setReady(true);
    } catch (e) {
      setError(`城市 3D 載入失敗：${String(e)}`);
    }
    const release = () => scene?.dispose();
    window.addEventListener('beforeunload', release);
    return () => {
      window.removeEventListener('beforeunload', release);
      scene?.dispose();
      sceneRef.current = null;
    };
  }, [select]);
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || !ready) return;
    scene.update(state, layers, mapSelection(selected), overlay);
    setData(scene.data);
    if (host.current) {
      host.current.dataset.renderMs = (scene.renderMs + scene.overlayMs).toFixed(3);
      host.current.dataset.overlayMs = scene.overlayMs.toFixed(3);
    }
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
      data-elevation={view.elevation.toFixed(2)}
      data-renderer="three-webgl"
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
        <Navigation
          size={21}
          strokeWidth={1.2}
          style={{ transform: `rotate(${-view.azimuth}deg)` }}
        />
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
          const position = labelPositions.find((p) => p.id === district.id);
          return (
            <button
              key={district.id}
              className={`district-label ${selected?.kind === 'district' && selected.id === district.id ? 'chosen' : ''}`}
              aria-label={`選取行政區 ${district.name}`}
              aria-pressed={selected?.kind === 'district' && selected.id === district.id}
              title={`${district.name} · 區域風格標記；地標為視覺示意`}
              style={
                {
                  left: position?.x ?? 0,
                  top: position?.y ?? 0,
                  display: position?.visible ? undefined : 'none',
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
      <div className="map-camera" role="group" aria-label="城市視角控制">
        <label>
          仰角 <output>{Math.round(view.elevation)}°</output>
          <input
            aria-label="城市觀看仰角"
            type="range"
            min="0"
            max="90"
            step="1"
            value={Math.round(view.elevation)}
            onChange={(e) => sceneRef.current?.setElevation(Number(e.target.value))}
          />
        </label>
        <div>
          <button onClick={() => sceneRef.current?.setElevation(90)}>俯視 90°</button>
          <button onClick={() => sceneRef.current?.setElevation(45)}>斜視 45°</button>
          <button onClick={() => sceneRef.current?.setElevation(0)}>水平 0°</button>
          <button aria-label="向左旋轉城市" onClick={() => sceneRef.current?.rotate(-30)}>
            ↶
          </button>
          <button aria-label="向右旋轉城市" onClick={() => sceneRef.current?.rotate(30)}>
            ↷
          </button>
          <button aria-label="放大城市" onClick={() => sceneRef.current?.zoom(0.8)}>
            ＋
          </button>
          <button aria-label="縮小城市" onClick={() => sceneRef.current?.zoom(1.25)}>
            －
          </button>
          <button onClick={() => sceneRef.current?.focus()} disabled={!mapSelection(selected)}>
            靠近選取
          </button>
          <button onClick={() => sceneRef.current?.setElevation(55, true)}>重設視角</button>
          <button
            onClick={() => {
              if (document.fullscreenElement) void document.exitFullscreen();
              else void host.current?.requestFullscreen();
            }}
          >
            {fullscreen ? '退出全螢幕' : '全螢幕'}
          </button>
        </div>
        <small>拖曳旋轉 · 右鍵 / 雙指平移 · 滾輪 / 捏合縮放</small>
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
