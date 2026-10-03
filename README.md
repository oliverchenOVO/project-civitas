# Project CIVITAS

一座只能透過制度影響、會留下可驗證歷史的微型城市。Phase 1 是離線運作的 deterministic agent society simulation；不需要 API key、LLM、Unity 或 Blender。

## 使用

Phase 2A 本機候選版：`release/0.3.0/CIVITAS-0.3.0-Windows-portable.exe`。
也可執行 `release/0.3.0/win-unpacked/Project CIVITAS.exe`，並保留同資料夾其他檔案。已發布 v0.2.0 與歷史成品保留；新版尚未發布。

Phase 2A 的模型、長期重播與功能已實作，但最終桌面／原生關閉 gate 尚未通過：視窗關閉後，部分 Windows 程序超過 10 秒仍未完全退出。候選版不能視為正式驗收完成；失敗證據與可重現的最小 Electron 對照見 [驗收報告](docs/PHASE2A_REPORT.md)。

1. 用右上角「＋」輸入種子，選擇 100／250／500／1000 人。
2. 透過 1x／5x／20x／Max 推進；「前進一天」可逐日觀察。
3. 點城市建築、居民清單或事件中的實體，開啟真實生活與企業歷史。
4. 「政府」調整稅、福利、最低工資、公共教育、職訓及高等教育補助，或增加住宅。
5. 「存檔」儲存 `.civitas`；重開程式後「載入」即可繼續。
6. 左下角「診斷與重播」可驗證相同種子與命令是否重建相同 SHA-256。
7. 點 City Pulse 指標，再按 Explain，查看真正的居民、企業與相關事件；事件可追查已記錄的原因與後果。
8. 「城市歷史」查看年度回顧；「Focus on Map」回到實體目前可定位的位置，「Back」恢復調查脈絡。
9. 「情境比較」從目前城市建立 A/B 分支，調整 B 政策，推進 30 日／1 年／5 年／10 年／20 年並驗證雙分支重播。
10. 地圖左下方可連續調整 0°–90° 仰角，或使用俯視／斜視／水平按鈕。拖曳旋轉、右鍵平移、滾輪縮放；觸控可雙指操作。選取實體後可「靠近選取」，返回城市會恢復相機位置。「全螢幕」可用退出按鈕或 Esc 離開。聚焦地圖後，方向鍵控制角度，＋／－縮放，R 重設。
11. 居民檔案的「教育／職涯／流動」顯示技能、任職資格證據及家庭起點。左側「人力發展」可查教育、職業、階層與同群樣本。

候選版採用 simulation 0.2.0、save v3。v1／v2 舊存檔先驗證原始完整性再升級；人力發展資料從載入日開始，起始推導能力有標記。舊分支各自從升級 checkpoint 續跑；要比較相同新版起點，請重新 Fork。成年起始居民沒有可觀測的童年，不能捏造代際結果。

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
pnpm benchmark:human
pnpm exec tsx scripts/human-development-qa.ts
pnpm benchmark:observatory
pnpm exec tsx scripts/observatory-longrun.ts
pwsh -NoProfile -File scripts/native-close-qa.ps1 -AppVersion 0.3.0 -CasePrefix human-acceptance -ReportName phase2a-native-close-qa.json
```

基準與種子掃描寫入 `artifacts/`，實際桌面 QA 與螢幕圖寫入 `artifacts/qa/`。請見 [Phase 2A 驗收報告](docs/PHASE2A_REPORT.md)、[Phase 1.1 與 3D 更新驗收報告](docs/PHASE1_1_REPORT.md)、[Phase 1A 場景報告](docs/SCENE_REMASTER_REPORT.md) 與 [Phase 1 報告](docs/PHASE1_REPORT.md)。3D 地圖圖層可切換居民、住宅及企業；點位表示真實住所，建築高度、地標與街景外觀是視覺示意，並非新增樓層或交通模擬資料。

## 原則

Simulation creates reality. Narrative only describes reality.
貨幣使用整數分，統計由實體推導；新聞、人生履歷與企業歷史都查詢同一個事件帳本。新增系統不能跳過 deterministic、存檔續跑與重播測試。
