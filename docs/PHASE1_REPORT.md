# Project CIVITAS — Phase 1 驗收報告

驗證日期：2026-10-03，Windows x64。本報告描述 v0.1.0 正式交付，不包含 Phase 2。**PHASE 1 COMPLETE：本輪目錄版與 portable 各三次原生關閉，所有自有程序均於 10 秒內自行退出，無強殺。歷史退出失敗未重現，根因仍未確認。**

## 交付與範圍

- Windows 可攜程式：`release/0.1.0/CIVITAS-0.1.0-Windows-portable.exe`。
- 檔案大小 85,641,251 bytes；SHA-256：`9d4cee1474c35a1aae8e834e8c74fb658e9f847dc7070e4029f8d20ba8a46ddd`。
- 解壓目錄版本：`release/0.1.0/win-unpacked/Project CIVITAS.exe`；整個資料夾需一起保留。
- 私人 GitHub：<https://github.com/oliverchenOVO/project-civitas>，分支 `main`。
- 可重現原始碼、鎖定依賴、CLI 基準、種子掃描、測試、Windows CI、實際 renderer 截圖與機器可讀 QA 報告。
- 採 TypeScript / React / Electron / PixiJS 2D；依 Phase 1 規格，Unity、Blender 與 LLM 不參與模擬。

## 已實作系統

`packages/domain` 定義唯一 canonical CityState 與實體、Command、DomainEvent。`packages/simulation` 執行固定日序；`packages/application` 持有唯一城市狀態並驅動速度與訂閱；`packages/narrative` 唯讀地描述事件；`packages/shared` 提供 canonical JSON / SHA-256。React / Pixi 只讀取狀態與發送 Command，Zustand 保存 UI 選取與篩選。

預設程序生成 250 居民、100 家庭、20 企業、116 住宅與四行政區。也驗證 100、500、1000 人配置。姓名、生日、家庭、雇用、住宅、企業與關係由固定種子生成，沒有 250 份硬寫人物檔。初始履歷只記錄真正建立的事實。

日序包含曆法、人口、家庭、就業、收入、政府、消費、企業、住宅、關係、遷移、統計與事件聚合。生日導出年齡；支援成年、退休、死亡、出生與遷移。家庭共同收支，具市有住宅租金、消費、存款、欠款、壓力及搬遷。企業生產與需求導出收入，支付薪資、營運成本、稅，產生盈虧、招聘、裁員、破產及新創。就業與破產修改真正的員工引用；事件保留因果鏈。

政策包括所得稅、企業稅、福利、最低薪資與住宅建設；全部經驗證 Command 套用，記錄日期、順序及事件。建屋扣除國庫，增加實際住宅與空置數。初始配偶、家人、朋友及後續同事關係可追蹤。金額為整數分，稅率為整數基點。

五個主頁為城市、居民、企業、事件與政府。提供可點擊實體地圖、真實統計、居民搜尋與分頁／篩選、居民與家庭及關係連結、企業財務及員工、人生履歷、因果事件、政策及建屋操作。暫停、1x、5x、20x、Max、單日步進均使用同一 deterministic tick；Max 為有限批次。診斷面板獨立提供日數、實體與事件數、處理時間、完整狀態雜湊與重播。

## 存檔與重播

JSON 存檔保存完整狀態：實體、政策、RNG streams、ID 計數器、事件、Command history、初始配置、simulation version 及 save version。讀入先驗證 100 MB 限額、完整 Zod schema、版本、SHA-256 與世界引用／不變量，再取代城市。原生寫檔採暫存檔再 rename，取消選擇不修改狀態。Web 版提供下載／上傳。

重播從原 seed/config 開始，按記錄的日期與順序重新套用 Command，包括 day 0 與同日多指令；比較包含事件、RNG、ID 的完整 canonical state，而非只比較統計。UI 狀態與時間量測不參與 canonical hash。未知存檔／模擬版本明確拒絕，目前 migration registry 為空，沒有聲稱支援未實作的遷移。

## 驗收結果

| Gate | 證據 | 結果 |
|---|---|---|
| Build | `pnpm typecheck`、`pnpm lint`、`pnpm build`、`pnpm package:win` | 通過 |
| Tests | Vitest：2 files、36 tests；27 模擬整合與 9 架構邊界測試 | 通過 |
| Simulation | 四人口配置 × 3650 日；100 seeds × 1825 日；預設 250 人十年可存檔／重播 | 通過 |
| Replay | 同 seed/config/Command 完整 hash；存讀檔續跑；day 0 / 同日多指令 | 通過 |
| Desktop | 真實 packaged renderer、原生存讀檔、正常重新啟動；兩種成品各三次原生退出 | 通過 |
| UX / visual | 五主頁、選取檔案、1000 人、兩桌面尺寸與手機尺寸 | 通過 |

36 項測試涵蓋 RNG 隔離與續跑、稅及日薪整數分配、家庭／薪資支付、招聘、虧損裁員、破產員工清理、住宅搬遷與建造、政策後果、事件因果、唯讀敘事、指令失敗原子性、損壞存檔、未知版本、雜湊正確但引用損壞的存檔、確定性、重播、存檔續跑與十年長跑。數值、ID、引用、家庭／就業／住宅一致性、父母年齡及整體現金守恆都有檢查。

長跑測試對預設 250 人城市執行 3650 日，每年驗證不變量，完成後 save → load → full replay 的完整 SHA-256 一致；沒有 crash、NaN 或損壞引用。測試在最後一次執行中耗時約 1.658 秒（包含 save/load/replay，非純 tick 基準）。

## 實測效能

固定 seed：`CIVITAS-BENCHMARK-1`。以下為本機純 CLI 執行 3650 日與每年不變量檢查的 wall runtime，排除之後的 hash 計算。Heap 為該筆完成時的程序 heapUsed，並非峰值或每城獨立記憶體。

| 初始人口 | 年數 | ms | days/sec | 事件 | 最終人口 | 活躍企業 | 不變量錯誤 | Heap MiB |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 100 | 10 | 507 | 7202 | 4952 | 113 | 7 | 0 | 30 |
| 250 | 10 | 618 | 5908 | 11656 | 275 | 11 | 0 | 40 |
| 500 | 10 | 1380 | 2646 | 20035 | 530 | 22 | 0 | 77 |
| 1000 | 10 | 3581 | 1019 | 35918 | 1054 | 42 | 0 | 32 |

完整 hash 與原始數值見 [`artifacts/benchmark.json`](../artifacts/benchmark.json)，表格見 [`artifacts/benchmark.md`](../artifacts/benchmark.md)。250 人十年終態：`1997a1eb7452025de74d2a5b63e8167ec952e63b0e2617c24a29cbeebbece1cd`。

先量測發現大量線性實體查找造成瓶頸，才改為 ephemeral WeakMap 索引；優化前後當時的四組 canonical hash 完全相同。後續修正初始年齡及職缺規則後重新量測，以上為最後模型數值。沒有引入 Worker、WASM 或 Rust。

種子掃描：`CIVITAS-STABILITY-0` 到 `CIVITAS-STABILITY-99`，每城初始 250 人，執行五年（1825 日），每年驗證不變量並記錄終態 hash。100/100 完成、0 technical failures、0 collapse flags。崩潰旗標定義為人口低於 25 或活躍企業為零；這是有限樣本驗證，不代表任何政策／任意 seed 都必然穩定。完整逐種子人口、企業、事件、錯誤與 hash 見 [`stability.json`](../artifacts/stability.json) 及 [`stability.md`](../artifacts/stability.md)。

## 真實 Windows 與視覺 QA

`scripts/desktop-qa.ts` 使用 Playwright Electron 啟動 `release/0.1.0/win-unpacked/Project CIVITAS.exe`。使用成品的 renderer、preload、原生 IPC 與檔案系統，沒有使用 Web 頁面替代桌面驗收。檔案對話框只由 harness 控制選定路徑；資料的序列化、校驗、寫入、讀入、續跑都是真實流程。

操作路徑：建立 250 人種子城 → 20x 到至少 60 日 → 暫停 → 搜尋 Anna 並篩在職 → 選居民及雇主企業 → 改所得稅 → 支付 $40,000 建五戶 → 檢查真實政策新聞 → 存檔 → 關閉測試程序 → 重新啟動 → 讀檔完整 hash 相同 → 步進一天 → 再存檔，比較不中斷模擬與完整重播 → UI 重播驗證 → 1000 人城市 → 1x / 5x / Max。

本輪桌面 QA 使用正常 `ElectronApplication.close()`，驗證其程序 exit code 0，移除強殺結尾。另由 `scripts/native-close-qa.ps1` 不掛 inspector，對真正原生視窗送 WM_CLOSE，精確追蹤 main、renderer、GPU、utility 與 portable wrapper，驗證全部自行退出。hidden startup 的視窗由 Win32 枚舉識別。

**Exit blocker resolved：**真實目錄版與 portable 各三次，6/6 啟動、原生視窗關閉與全程序退出通過；無 force kill。kernel 退出確認上界：目錄版 1228 / 720 / 643 ms，portable 4291 / 2085 / 5870 ms；釋放診斷 handles 後 CIM 完全消失確認：2171 / 1589 / 1350、5530 / 3260 / 7150 ms，均在 10 秒內。這些是包含輪詢／查詢的確認上界，並非精準退出瞬間。結果見 [native-close-qa.json](../artifacts/native-close-qa.json)。

本輪共 22/22 受控退出測試通過。Electron 38.8.6 已是同 major 最新 patch；相鄰 39.8.10 也通過。normal / GPU off、console / detached / Playwright launcher、raw / packaged minimal 與 app.exit 對照均通過。正式 Electron 版本、GPU、安全設定與產品程式完全未改，保留 window-all-closed → app.quit()。歷史 60 秒失敗未重現，根因仍未知；CIM 可保留已退出程序物件的觀察不足以解釋歷史 WaitForExit 逾時。完整方法、lifecycle、active handles 與根因界線見 [EXIT_GATE_INVESTIGATION.md](EXIT_GATE_INVESTIGATION.md) 和 [固定摘要](../artifacts/exit-investigation-summary.json)。歷史失敗 [quit-probe.json](../artifacts/quit-probe.json) 及原 rc tag 保留。

發布沿用本輪實際驗收的同一 portable 檔案；fresh build 的全部 50 個 production payload 檔案與成品 app.asar 逐 byte 相同。四組 benchmark 及全部 100 seed 的 canonical hash 未改。候選時已通過 package:win，本輪無 production/runtime 改動，沒有重新封裝換成未驗收檔案。

最終桌面／responsive QA：**13 項操作檢查通過、0 console errors**；結果見 [`desktop-qa.json`](../artifacts/desktop-qa.json)。手機檢查使用 Edge headless 開啟 **built production preview** `http://127.0.0.1:4173/`。早期 dev server 的 load 等待逾時與缺少 favicon 的 404 均已修正；失敗測試不計入通過結果。Edge test browser 亦透過正常 browser.close / browserServer.close 結束。另曾用 Codex Browser/IAB 操作真實搜尋、居民檔案、步進及政策；原生驗收依使用者要求採 Playwright Electron。

實際 logical viewport：1536×1024、1280×800，額外 390×844 responsive。Windows 顯示縮放 125%，原生截圖像素分別為 1920×1280 與 1600×1000。已用 `view_image` 檢查設計概念及同一輪最新實作截圖：城市、居民選取、企業選取、企業表、政策、新聞、1000 人與手機城市／政府。主區域與右欄分別捲動，表格在自己的容器中捲動；沒有 body 水平溢出、主要按鈕遮擋、空白 renderer 或假統計。

### 設計對照 ledger

概念：[`observatory-concept.png`](design/observatory-concept.png)。正式設計約定見 [`DESIGN_SYSTEM.md`](design/DESIGN_SYSTEM.md)。以下是相同檢查回合的至少五項對照，包含有意差異。

| 對照點 | 概念 → 實作及檢查 |
|---|---|
| 配色 | 深海軍藍、灰藍線條、mint 選取與 gold 行政區一致；無 neon 或額外漸層 |
| 字體 | CIVITAS serif wordmark、分散字距副標、清楚的控制字體保留；繁體中文依本地字型顯示 |
| Shell | 上方曆日／速度／存讀檔、左五導航、中間地圖／表、右 City Pulse／inspector 與底部狀態列保留 |
| 導航／圖示 | Lucide outline 一致；修正窄畫面導航與存讀檔隱藏文字後的 accessible name |
| 地圖 | 保留四區、河流、mint/gold 居民識別；有意使用真實 entity 的 Pixi 幾何示意圖，取代概念中未模擬的航空照片、道路與交通 |
| 統計 | 同樣在右欄；有意改為開放列，顯示真實人口、就業、財富、住宅與幸福，不使用概念的假百分比增長 |
| 選取／履歷 | 右欄提供真實 ID、雇主、家庭、薪資、關係與事件；資料較長，採欄內捲動；修正未選取住宅因 undefined equality 全亮的問題 |
| 事件／文案 | above-the-fold copy 逐項檢查；有意繁體化、加入必要的新城／單步／Max；真實日序事件取代概念的時分、早餐與通勤虛構履歷 |
| 小畫面／1000 人 | 1280×800 及 390×844 實際檢查，右欄在手機往下排列；高人口點較密，精準查詢可用居民列表 |

已依記錄的設計約定與明確差異完成 fidelity inspection；未聲稱與航空照片概念逐像素相同。沒有剩餘重大非預期版面差異。示意建築是正式狀態視覺編碼，並非未完成的藝術占位圖。地圖無交通、逐時行為或 3D 功能。

截圖存於 `artifacts/qa/`：`city-1536.png`、`citizen-1536.png`、`company-inspector-1536.png`、`companies-1536.png`、`government-1536.png`、`events-1536.png`、`replay-verified.png`、`city-1280.png`、`city-1000-1280.png`、`city-mobile.png`、`government-mobile.png`。這些本機 QA 產物及存檔不提交 Git。

## Git 與重現

私人 repository 分支 `main`，正式 tag `v0.1.0` 指向本次最終交付 commit；用 `git rev-parse v0.1.0^{commit}` 取得完整 SHA。原候選 `v0.1.0-rc.1` 仍指向 `ff4775cd89e2a53cd0f3e099c0693356249b721e`，沒有移動或覆寫。正式 [GitHub Release](https://github.com/oliverchenOVO/project-civitas/releases/tag/v0.1.0) 提供通過退出驗收的 portable artifact；下載後 SHA-256 須與本報告交付指紋一致。

本輪採小 commits 記錄 topology / minimal diagnostics、正常退出 QA 與固定 evidence、最後報告。Windows GitHub Actions 執行 compile、lint、36 tests、benchmark、100 seed suite、portable package 並上傳 build artifact。既有 [Windows CI run 37107047840](https://github.com/oliverchenOVO/project-civitas/actions/runs/37107047840) 成功；CI build 與本機 GUI 原生退出是分開的驗證，本輪 GUI gate 由上述六次真實成品實測通過。

```powershell
pnpm install --frozen-lockfile
pnpm typecheck
pnpm lint
pnpm test
pnpm benchmark
pnpm stability
pnpm package:win
# 另一個終端機保持 production preview 運作
pnpm exec vite preview --host 127.0.0.1 --port 4173 --strictPort
pnpm qa:desktop
pwsh -NoProfile -File scripts/native-close-qa.ps1
```

## 已知限制

- Phase 1 經濟有明確外部部門：出口需求、新創／移民注資、進口與營運／建設支出。它們各自有帳，整體現金守恆檢查為 opening + exports + financing − imports；不是完整封閉供應链或銀行貸款模型。
- 家庭共用薪資收入；居民個人備用金不被當成家庭日常薪資。住宅簡化為市有出租；福利受國庫限制，債務以欠款表示。月度預算使用固定 30 日分攤；人口、關係與產業為規則模型，尚無進階教育、健康、政治、犯罪或細緻戀愛。
- 事件帳本保留完整歷史，JSON 存檔上限 100 MB；尚無自動存檔、壓縮、歷史分段或大型城市 worker。完整重播同步執行，長歷史可能短暫占用 renderer。
- 可攜版未配置使用者程式簽章憑證；Windows app 使用 Electron 預設應用程式圖示，瀏覽器已有 CIVITAS favicon。尚無安裝器、自動更新或商業分發簽章。
- GUI／可攜版驗證為本機 Windows x64，未宣稱跨平台 GUI 或多台硬體驗證。高人口點位密集，人物列表是主要精準查詢方式。
- 歷史退出失敗根因未確認；本輪在同主機完整原生退出通過。尚未做第二台硬體／OS 的 GUI 驗證，不把有界成功推論成所有環境永遠沒有退出問題。
- 36 測試與 100 seeds 有界驗證；尚無 property-based 大規模任意政策 fuzzing、長期遷移版本相容性或真實世界人口／經濟校準。

## Phase 2 建議（尚未開始）

優先新增 policy scenario regression 與 property-based invariant fuzzing、事件分段存檔及版本 migration、追溯統計到家庭／企業的更完整 drill-down；再評估多城市／更細勞動與教育模型。只有 benchmark 證明需要時再加入 worker。LLM 可沿唯讀 NarrativeProvider 擴充敘事，但不能修改真實城市或補造事件。
