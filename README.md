# Project CIVITAS

一座只能透過制度影響、會留下可驗證歷史的微型城市。Phase 1 是離線運作的 deterministic agent society simulation；不需要 API key、LLM、Unity 或 Blender。

## 使用

Windows 可攜版：`release/0.1.0/CIVITAS-0.1.0-Windows-portable.exe`。
也可執行 `release/0.1.0/win-unpacked/Project CIVITAS.exe`（必須保留同資料夾其他檔案）。

1. 用右上角「＋」輸入種子，選擇 100／250／500／1000 人。
2. 透過 1x／5x／20x／Max 推進；「前進一天」可逐日觀察。
3. 點城市建築、居民清單或事件中的實體，開啟真實生活與企業歷史。
4. 「政府」調整稅、福利、最低工資或增加住宅。
5. 「存檔」儲存 `.civitas`；重開程式後「載入」即可繼續。
6. 左下角「診斷與重播」可驗證相同種子與命令是否重建相同 SHA-256。

## 開發

Node 24、pnpm 11.19.0。所有依賴鎖在 `pnpm-lock.yaml`。

```powershell
pnpm install --frozen-lockfile
pnpm dev
# 另一個終端機
pnpm build
pnpm desktop
```

Web 開發預览位址為 `http://127.0.0.1:5173/`；Web 存檔以下載／上傳方式提供，桌面版使用原生檔案選擇器。

```powershell
pnpm typecheck
pnpm lint
pnpm test
pnpm benchmark
pnpm stability
pnpm package:win
pnpm exec vite preview --host 127.0.0.1 --port 4173 --strictPort # 另一個終端機
pnpm qa:desktop # 需先打包，並保持 4173 的 production preview 運作
```

基準與種子掃描寫入 `artifacts/`，實際桌面 QA 與螢幕圖寫入 `artifacts/qa/`。請見 `docs/PHASE1_REPORT.md` 的實測結果與限制。

## 原則

Simulation creates reality. Narrative only describes reality.
貨幣使用整數分，統計由實體推導；新聞、人生履歷與企業歷史都查詢同一個事件帳本。新增系統不能跳過 deterministic、存檔續跑與重播測試。
