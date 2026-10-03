# Project CIVITAS

一座只能透過制度影響、會留下可驗證歷史的微型城市。Phase 1 是離線運作的 deterministic agent society simulation；不需要 API key、LLM、Unity 或 Blender。

## 使用

Phase 1.1 加上 3D 城市視角版：`release/0.2.1/CIVITAS-0.2.1-Windows-portable.exe`。
也可執行 `release/0.2.1/win-unpacked/Project CIVITAS.exe`（必須保留同資料夾其他檔案）。先前 0.2.0、0.1.1 成品與既有 GitHub v0.1.0 release 保留。

1. 用右上角「＋」輸入種子，選擇 100／250／500／1000 人。
2. 透過 1x／5x／20x／Max 推進；「前進一天」可逐日觀察。
3. 點城市建築、居民清單或事件中的實體，開啟真實生活與企業歷史。
4. 「政府」調整稅、福利、最低工資或增加住宅。
5. 「存檔」儲存 `.civitas`；重開程式後「載入」即可繼續。
6. 左下角「診斷與重播」可驗證相同種子與命令是否重建相同 SHA-256。
7. 點 City Pulse 指標，再按 Explain，查看真正的居民、企業與相關事件；事件可追查已記錄的原因與後果。
8. 「城市歷史」查看年度回顧；「Focus on Map」回到實體目前可定位的位置，「Back」恢復調查脈絡。
9. 「情境比較」從目前城市建立 A/B 分支，調整 B 政策，推進 30 日／1 年／5 年並驗證雙分支重播。
10. 地圖左下方可連續調整 0°–90° 仰角，或使用俯視／斜視／水平按鈕。拖曳旋轉、右鍵平移、滾輪縮放；觸控可雙指操作。選取實體後可「靠近選取」，返回城市會恢復相機位置。「全螢幕」可用退出按鈕或 Esc 離開。聚焦地圖後，方向鍵控制角度，＋／－縮放，R 重設。

新版存檔包含每日／月度／年度觀測及政策分支。舊 v1 存檔可以載入，詳細數值歷史從載入日開始；先前未記錄的數值不會被補造。

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
pnpm qa:scene
pnpm qa:observatory
pnpm benchmark:observatory
pnpm exec tsx scripts/observatory-longrun.ts
pwsh -NoProfile -File scripts/native-close-qa.ps1 -AppVersion 0.2.1 -CasePrefix spatial-confirmation -ReportName scene-3d-native-close-qa.json
```

基準與種子掃描寫入 `artifacts/`，實際桌面 QA 與螢幕圖寫入 `artifacts/qa/`。請見 [Phase 1.1 與 3D 更新驗收報告](docs/PHASE1_1_REPORT.md)、[Phase 1A 場景報告](docs/SCENE_REMASTER_REPORT.md) 與 [Phase 1 報告](docs/PHASE1_REPORT.md)。3D 地圖圖層可切換居民、住宅及企業；點位表示真實住所，建築高度、地標與街景外觀是視覺示意，並非新增樓層或交通模擬資料。

## 原則

Simulation creates reality. Narrative only describes reality.
貨幣使用整數分，統計由實體推導；新聞、人生履歷與企業歷史都查詢同一個事件帳本。新增系統不能跳過 deterministic、存檔續跑與重播測試。
