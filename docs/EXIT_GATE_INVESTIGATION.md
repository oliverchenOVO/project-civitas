# Phase 1 Exit Gate Investigation

2026-10-03；Windows 11 Home x64，10.0.26200；同一台主機。**Exit gate PASS，Phase 1 COMPLETE。** 未開始 Phase 2。

## 結論與根因界線

歷史候選版本的 60 秒退出失敗本輪未重現，歷史根因仍然 **undetermined**。未發現可證明需要修改產品的阻塞資源；不能將 GPU、驅動、防毒、Electron 版本或測試工具判定為歷史失敗原因。本輪 22 次受控測試全部通過，包括真實目錄成品、portable 成品各三次、不掛 inspector 的 Windows 原生 WM_CLOSE 驗收。

產品程式、Electron 38.8.6、electron-builder、preload、安全設定與 GPU 行為均未修改；保留正式 `window-all-closed → app.quit()`。本輪的具體修正是診斷與 QA：建立 PID + creation time 的精確程序樹、以 kernel process handle 確認是否仍在執行、釋放觀察者 handle 後再確認 CIM 中完全消失，並移除桌面操作 QA 的強殺結尾，改用正常 `ElectronApplication.close()` 並驗證 exit code 0。這是驗證方法改善，**不是已證明的產品修復**。

觀察到 CIM 在診斷程式持有 handle 時仍可列出已 signaled、exit code 0 的程序物件；釋放 handle 後 CIM 無殘留。程序物件仍被列出不等於程序仍在執行。舊式 `.NET WaitForExit(0)` 在本輪也成功，故這項觀察不足以解釋歷史 `WaitForExit` 逾時。

## 方法與固定證據

[`exit-investigation-summary.json`](../artifacts/exit-investigation-summary.json) 保存 22 次測試的結果、PID/PPID、角色、建立時間、時間取樣、lifecycle、資源與版本比較；[`native-close-qa.json`](../artifacts/native-close-qa.json) 保存六次正式驗收。完整本機原始 command line、executable path、JSONL 與取樣位於 ignored `artifacts/qa/exit-*/`，彙整拓撲及 runtime matrix 為 `artifacts/qa/exit-process-tree.json`、`artifacts/qa/electron-exit-matrix.json`，不提交暫存 runtime 或巨型紀錄。

以 root PID 與 creation time 遞迴辨識 main、renderer、GPU、utility、portable wrapper；本輪未觀察到 crashpad handler。關閉真正的 `Chrome_WidgetWin_1` / `Project CIVITAS` 原生視窗，記錄 t+0/1/3/5/10/30/60 秒。minimal、unpacked、portable 三組完整基線均於 10 秒內退出，並持續取樣至 60 秒；unpacked 基線 main PID 50908 在 t+3 仍執行、t+5 已退出，無後續孤兒程序。

工具啟動使用 hidden startup；是否可見不影響真正原生視窗的枚舉與 WM_CLOSE。所有 PASS 都在任何清理之前判定，`forceCleanupPerformed=false`。失敗時的工具清理只針對已識別的自有 PID，不能轉換為 PASS。

## 受控比較

| 比較 | 次數 | 結果與意義 |
|---|---:|---|
| 原始 minimal / unpacked / portable 完整時間基線 | 3 | 全通過；未重現 60 秒失敗 |
| Electron 38.8.6，normal GPU，raw minimal | 3 | 全通過；kernel 退出確認上界 572–667 ms |
| Electron 39.8.10，normal GPU，raw minimal | 3 | 全通過；上界 735–859 ms；僅隔離下載，未升級正式依賴 |
| GPU off before ready | 2 | 全通過，547–790 ms；normal 也通過，無證據支持關 GPU 修復 |
| Console parent / detached Start-Process / Playwright parent | 3 | 各一次通過；Playwright 的 launcher 與整棵自有程序樹也退出 |
| Packaged minimal | 1 | 通過；distribution 中 `resources/app` 加入 probe，改名 `Exit Probe.exe`，startup `app.isPackaged=true` |
| Minimal `app.exit(0)` 對照 | 1 | 通過；未改正式 app.quit 行為 |
| 真實 packaged 成品原生驗收 | 6 | 目錄版 ×3、portable ×3，全通過 |

`pnpm view electron@38 version --json` 為 38.8.6，已是同 major 最新 patch，沒有另一個較新 patch 可比較；相鄰 stable major 的 registry 結果是 39.8.10。兩版使用同 probe、同主機、同 WM_CLOSE、同 10 秒判定與同程序樹量測。單次 launcher 比較只能說本輪通過，不能證明永遠不存在 parent 或環境問題。

正常 minimal lifecycle：`loaded → close → closed → window-all-closed → before-quit → will-quit → node-exit(0) → quit → after-quit-call`。Node beforeExit 已掛監聽，但正常 Electron shutdown 未觸發它；沒有把未發生事件補入紀錄。close、window-all-closed、after-quit-call 的 active resources、handles、requests 皆空。diagnostic-only 私有 Node API 未加入產品。關閉後的延遲診斷 timer 使用 unref，不維持程序存活；正常退出使它們不再執行。

讀取測試時間範圍內 Application Error / Windows Error Reporting 1000、1001，對 Electron/CIVITAS executable 篩選後沒有相關事件；紀錄在 `artifacts/qa/exit-application-events.json`。沒有更動 Windows、driver 或 security software。未做第二台主機驗證，亦未把 GitHub build CI 當作 GUI exit 驗收。

## 六次正式成品驗收

下列時間從 WM_CLOSE 算起。kernel 退出與最終 CIM 消失時間均包含輪詢／CIM 查詢開銷，是確認時間上界，不是精準的實際退出瞬間。每次主程序與全部自有子程序自行退出，沒有 force kill；觀察 handle 釋放後 CIM 殘留為零。

| 成品 | 次數 | root / main PID | kernel 確認上界 ms | CIM 完全消失確認 ms |
|---|---:|---|---:|---:|
| unpacked | 1 | 61528 / 61528 | 1228 | 2171 |
| unpacked | 2 | 77688 / 77688 | 720 | 1589 |
| unpacked | 3 | 30892 / 30892 | 643 | 1350 |
| portable | 1 | 55992 / 60868 | 4291 | 5530 |
| portable | 2 | 63216 / 69596 | 2085 | 3260 |
| portable | 3 | 53948 / 51856 | 5870 | 7150 |

portable 的 root 是 wrapper，main 是解壓後的 Electron 程序。兩者與 renderer/GPU/utility 全部退出。最慢的完整消失確認為 7.150 秒，小於 10 秒。

## 回歸與成品

`pnpm typecheck`、`pnpm lint`、`pnpm test`、`pnpm benchmark`、`pnpm stability`、`pnpm build`、`pnpm qa:desktop` 通過。36 tests、100 seeds 無失敗；四組十年 benchmark 與全部 100 seed 的 canonical hash 和候選版本完全相同。250 人十年 save/load/replay 測試約 1.658 秒。桌面 13 項操作通過、0 console errors，正常 close exit code 0；存讀檔／完整 replay hash 相符。

benchmark 本輪 100/250/500/1000 人分別為 507/618/1380/3581 ms，候選量測為 296/503/1038/3999 ms。單輪 wall time 有變動，尤其短測試相對比例較大；1000 人沒有退步，產品 simulation 未改，不能將這些單輪差值推論為產品效能修正或退化。正式數值見 [`benchmark.json`](../artifacts/benchmark.json)。

本輪無 production/runtime 改動，正式發布沿用**實際通過六次驗收的同一成品**，沒有重新封裝再換成未驗收檔案。`scripts/verify-exit-regression.cjs` 驗證既有 app.asar 中全部 50 個 production 檔案與本輪 fresh build 逐 byte 相同，並驗證上述 deterministic hash；結果納入固定摘要。候選版本已完成 package:win；本輪沒有聲稱重新執行封裝。

- portable：`CIVITAS-0.1.0-Windows-portable.exe`，85,641,251 bytes。
- SHA-256：`9d4cee1474c35a1aae8e834e8c74fb658e9f847dc7070e4029f8d20ba8a46ddd`。
- 正式 tag：`v0.1.0`；原候選 `v0.1.0-rc.1` 保持不動。
- 私人 Release：[v0.1.0](https://github.com/oliverchenOVO/project-civitas/releases/tag/v0.1.0)。發布時重新下載 portable asset，要求其 hash 與上述值一致。

## 重現

```powershell
# production preview 需先在另一終端運作，才執行 desktop 操作 QA
pnpm qa:desktop
pwsh -NoProfile -File scripts/native-close-qa.ps1 -Repetitions 3
# 完整 minimal 時間基線（預設持續觀察到 60 秒）
pwsh -NoProfile -File scripts/exit-investigation.ps1 -Target Minimal -Case baseline-minimal
# 10 秒 controlled GPU 比較，只影響 probe
pwsh -NoProfile -File scripts/exit-investigation.ps1 -Target Minimal -Case current-gpu-off -GpuOff -TimeoutSeconds 10 -Repetitions 2 -StopWhenExited
node scripts/verify-exit-regression.cjs
node scripts/summarize-exit-investigation.cjs
```

歷史失敗紀錄仍見 [`quit-probe.json`](../artifacts/quit-probe.json) 與 immutable rc tag；它們是歷史 evidence，不代表當前驗收失敗。若未來再現，應先保留 exact PID、kernel state 與 lifecycle，再調查原因，不能以本輪成功倒推歷史根因。
