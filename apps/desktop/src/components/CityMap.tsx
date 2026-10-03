import { useEffect, useRef, useState } from 'react';
import { Application, Container, Graphics, Text } from 'pixi.js';
import { type CityState } from '../../../../packages/domain/src/index';
import { usePresentation } from '../store';
export function CityMap({ state, revision }: { state: CityState; revision: number }) {
  const host = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;
  const selected = usePresentation((s) => s.selected);
  const select = usePresentation((s) => s.select);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let disposed = false;
    const app = new Application();
    void app
      .init({
        background: '#101e28',
        antialias: true,
        resolution: Math.min(window.devicePixelRatio, 2),
        autoDensity: true,
        resizeTo: host.current!,
        preference: 'webgl',
      })
      .then(() => {
        if (disposed) {
          app.destroy(true, { children: true });
          return;
        }
        appRef.current = app;
        host.current?.appendChild(app.canvas);
        setReady(true);
      })
      .catch((e) => setError(`城市圖形載入失敗：${String(e)}`));
    return () => {
      disposed = true;
      if (appRef.current === app) {
        appRef.current = null;
        app.destroy(true, { children: true });
      }
    };
  }, []);
  useEffect(() => {
    const app = appRef.current;
    if (!app || !ready) return;
    const draw = () => {
      const s = stateRef.current;
      const old = app.stage.removeChildren();
      old.forEach((c) => c.destroy({ children: true }));
      const w = app.screen.width,
        h = app.screen.height;
      const g = new Graphics();
      app.stage.addChild(g);
      // Geometry is presentation-only. Each footprint and resident dot refers to an actual entity.
      for (let x = 0; x < w; x += 32) g.moveTo(x, 0).lineTo(x, h);
      for (let y = 0; y < h; y += 32) g.moveTo(0, y).lineTo(w, y);
      g.stroke({ color: 0x25333c, width: 0.5, alpha: 0.45 });
      g.poly([w * 0.46, 0, w * 0.54, 0, w * 0.62, h, w * 0.53, h]).fill(0x193849);
      const positions = [
        [0.035, 0.05],
        [0.575, 0.05],
        [0.04, 0.55],
        [0.625, 0.55],
      ];
      s.districts.forEach((district, index) => {
        const [px, py] = positions[index];
        const dx = px * w,
          dy = py * h;
        const dw = w * 0.345,
          dh = h * 0.37;
        const container = new Container();
        container.x = dx;
        container.y = dy;
        app.stage.addChild(container);
        const outline = new Graphics()
          .roundRect(0, 0, dw, dh, 8)
          .fill({ color: district.color, alpha: 0.025 })
          .stroke({ color: district.color, width: 1, alpha: 0.22 });
        container.addChild(outline);
        const label = new Text({
          text: district.name,
          style: { fontFamily: 'Segoe UI', fontSize: 16, fill: district.color, fontWeight: '600' },
        });
        label.x = 14;
        label.y = 12;
        container.addChild(label);
        const population = s.citizens.filter(
          (c) =>
            c.lifecycleStatus === 'alive' &&
            s.units.find((u) => u.id === c.residenceId)?.districtId === district.id,
        ).length;
        const caption = new Text({
          text: `${population} 居民 · ${s.companies.filter((f) => f.districtId === district.id && f.status === 'active').length} 企業`,
          style: { fontFamily: 'Segoe UI', fontSize: 11, fill: '#91a5b1' },
        });
        caption.x = 14;
        caption.y = 36;
        container.addChild(caption);
        const buildings = s.buildings.filter((b) => b.districtId === district.id);
        const columns = Math.max(4, Math.ceil(Math.sqrt(buildings.length * 1.4)));
        const rows = Math.ceil(buildings.length / columns);
        const cellW = (dw - 28) / columns,
          cellH = (dh - 72) / Math.max(rows, 1);
        buildings.forEach((b, i) => {
          const firm =
            b.type === 'commercial' ? s.companies.find((f) => f.id === b.ownerId) : undefined;
          const unit = s.units.find((u) => b.unitIds.includes(u.id));
          const household = s.households.find((h) => h.id === unit?.occupantHouseholdId);
          const chosen =
            !!selected &&
            (selected.id === firm?.id ||
              selected.id === household?.id ||
              (selected.kind === 'citizen' && household?.memberIds.includes(selected.id)));
          const x = 14 + (i % columns) * cellW,
            y = 62 + Math.floor(i / columns) * cellH;
          const shape = new Graphics()
            .roundRect(x, y, Math.max(5, cellW - 8), Math.max(6, cellH - 9), 2)
            .fill({
              color: firm
                ? firm.status === 'active'
                  ? district.color
                  : '#495057'
                : household
                  ? '#385b64'
                  : '#22313d',
              alpha: firm ? 0.75 : 1,
            })
            .stroke({
              color: chosen ? '#edf7ed' : district.color,
              width: chosen ? 2 : 0.5,
              alpha: chosen ? 1 : 0.35,
            });
          shape.eventMode = 'static';
          shape.cursor = 'pointer';
          shape.on('pointertap', () => {
            if (firm) select('company', firm.id);
            else if (household) select('household', household.id);
          });
          container.addChild(shape);
          if (household)
            household.memberIds.forEach((cid, j) => {
              const dot = new Graphics()
                .circle(x + 4 + j * 4, y + 4, 1.4)
                .fill(
                  s.citizens.find((c) => c.id === cid)?.employmentStatus === 'employed'
                    ? '#a3e0c8'
                    : '#d4b778',
                );
              dot.eventMode = 'static';
              dot.cursor = 'pointer';
              dot.on('pointertap', () => select('citizen', cid));
              container.addChild(dot);
            });
        });
      });
      const river = new Text({
        text: 'C I V I T A S  R I V E R',
        style: { fontFamily: 'Segoe UI', fontSize: 10, fill: '#6090a3' },
      });
      river.x = w * 0.46;
      river.y = h * 0.46;
      river.rotation = 0.13;
      app.stage.addChild(river);
    };
    draw();
    const observer = new ResizeObserver(() => {
      app.resize();
      draw();
    });
    if (host.current) observer.observe(host.current);
    return () => observer.disconnect();
  }, [revision, selected, select, ready, state]);
  return (
    <div className="map-host" ref={host} aria-label="城市地圖：四個行政區、真實住宅、企業與居民">
      {error && <div className="empty">{error}</div>}
      <div className="map-legend">
        <span>
          <i className="dot mint" />
          在職居民
        </span>
        <span>
          <i className="dot gold" />
          其他居民
        </span>
        <span>點選建築或居民檢視生活</span>
      </div>
    </div>
  );
}
