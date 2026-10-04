# Phase 2A native shutdown closure — 2026-10-04

Status: investigation in progress; no release authorization gate has passed. Phase 2B remains outside scope. Production remains Electron 38.8.6, simulation 0.2.0 and saveVersion 3. Models, migration and replay implementation have not been changed.

## History

- Phase 1, 2026-10-03 09:53 UTC: six native close repetitions passed on Electron 38.8.6.
- Phase 1A, 13:07 UTC: six accepted native closes passed. Earlier portable/dense-WMI failures remain historical evidence.
- Phase 1.1 / v0.2.0, 15:04 UTC: six closes passed on the same runtime.
- v0.2.1 3D investigation, 16:10 UTC: intermittent portable failures appeared.
- Phase 2A: unpacked and portable failures; some portable launches never obtained a window. Minimal Electron reached quit/process exit with empty Node handles while tracked kernel objects remained unsignaled.

The historical source/result SHA manifest is `artifacts/shutdown-closure-history.json`. The original `exit-investigation.ps1` acceptance algorithm is unchanged. The new diagnostic `shutdown-closure.ps1` retains the native WM_CLOSE / ten-second / kernel polling criterion, adds independent lifecycle/kernel/CIM state, launch failure preservation, launcher controls and read-only Job/thread evidence. Observer handles are released before CIM absence is evaluated. Failed-case cleanup is explicitly marked and never a pass.

## Exact environment

Windows 11 Home 25H2 x64 build 26200.9457. Original Electron 38.8.6 / Chromium 140.0.7339.249 / bundled Node 22.22.0. CLI Node 24.13.0, electron-builder 26.15.3 and Playwright 1.63.0. Read-only environment data is in `artifacts/shutdown-closure-environment.json`.

The original candidate is preserved at `release/0.3.0/CIVITAS-0.3.0-Windows-portable.exe`, 85,645,026 bytes, SHA-256 `e1a8570ade13912697bd40a165df06a7f4868d407fc4a21dfa97a4c4a0e7577d`.

## Controlled matrix

Each listed group has five repetitions with real WM_CLOSE and the ten-second gate. All failure counts include voluntary kernel termination failures, even when lifecycle events completed.

| Minimal runtime / control | Pass | Fail |
| --- | ---: | ---: |
| 37.10.3, Start-Process | 5 | 0 |
| 38.8.6, Start-Process | 5 | 0 |
| 39.8.10, Start-Process | 4 | 1 |
| 44.5.1, Start-Process | 5 | 0 |
| 38.8.6, console parent | 5 | 0 |
| 38.8.6, detached | 5 | 0 |
| 38.8.6, Playwright | 5 | 0 |
| 38.8.6, GPU off | 5 | 0 |
| 38.8.6, sandbox off | 5 | 0 |
| 38.8.6, fresh packaged minimal | 5 | 0 |

37–39 are historical diagnostic comparisons, not currently supported Electron branches. A currently supported older branch 43.7.7 download failed with ECONNRESET; it was not tested. Latest stable 44.5.1 is Chromium 152.0.7977.130 / Node 24.21.0. Runtime dates and support policy were checked against the official Electron release index and timeline.

The 39.8.10 minimal failure had complete lifecycle events but unsignaled main PID 62120, GPU 48828, renderer 61624 and utility 73708 at the deadline. Main 62120 remained enumerated by CIM after releasing observer handles, at 11996ms. Cleanup followed the measured failure. No application timers, CIVITAS, IPC, React, Pixi or 3D are present in that probe.

| Product case | Pass | Fail |
| --- | ---: | ---: |
| Original 38.8.6 unpacked, cold close | 5 | 0 |
| Exact original portable, cold close | 5 | 0 |
| Original unpacked, 1000 residents / 20 days / 3D, WM_CLOSE through tracked Playwright ownership | 3 | 2 |
| Isolated raw 44.5.1 + byte-identical original app.asar, same warm workload / WM_CLOSE | 5 | 0 |

Old warm run 1 left main 8812 and renderer 57920 unsignaled, as well as QA ownership processes 44596/76288 (Node), 72020 (CMD), 60476 (esbuild). Run 3 left main 13216, renderer 13732, GPU 75444, utility 37996, and QA ownership processes 15664/72020 (Node), 75184 (CMD). PIDs describe recorded runs, not claims that they still exist after cleanup. Per-run creation timestamps prevent PID reuse from being confused with the same process.

## Limits of the evidence

Portable-only ownership cannot explain a failing unpacked product or a failing raw minimal runtime. Product models/React/3D are not necessary for the minimal failure. Complete quit events, exit code 0 and empty Node active handles do not establish a signaled kernel process object. A stale CIM-only explanation does not explain the recorded unsignaled owned handles.

Job membership was observed in both successful and failed processes. The observer job flags were 0x2800 (BREAKAWAY_OK plus KILL_ON_JOB_CLOSE), with no configured active process or memory limit. This does not prove Job ownership causes the stall. Playwright launches through a CMD shell and waits for process close/stdio ownership; actual product main/GPU/utility kernel failures mean the driver alone does not explain every failure. GPU on/off and sandbox controls both passing provide no basis for a production workaround. No relevant Application Error/WER/Defender event correlation was found in the queried interval (`artifacts/shutdown-closure-os-events.json`); antivirus or driver causality is undetermined. OS thread queries were recorded where available; inaccessible terminated-looking process objects are not interpreted as a proven wait stack.

## Isolated upgrade experiment

`experiment/shutdown-electron44` is a separate Git worktree at `F:\CodeX開發小東東\civitas-shutdown-electron44`. The app worktree tool could not resolve a Git repository from the parent chat directory, so the repository's native `git worktree add` was used. Only Electron and its necessary lock entries are changed in the experiment. The original primary checkout and candidate remain unchanged. No merge is permitted before native and full regression gates pass.

## Second-host reproduction

A self-contained cold-case QA kit is at `artifacts/qa/shutdown-closure/CIVITAS-native-shutdown-repro.zip`, SHA-256 `717d39b884cbffb593ea67b78bf12f753e5620b3c1526abc1b59f445eb776854`, 507,892,125 bytes. It includes the exact original portable, unpacked, current raw runtime and fresh packaged minimal probe, a PowerShell runner and optional warm-workload driver. Four cold groups run five times each, recording OS build, artifact SHA and all exit states. Warm reproduction additionally requires Node 24 and the pinned Playwright/tsx dependencies described in its README.

No second machine or VM has been tested. No VM runner was found through the read-only command inventory. Preparing this kit is not an environment-specific diagnosis or a second-host pass.

Sources: https://releases.electronjs.org/releases.json ; https://www.electronjs.org/docs/latest/tutorial/electron-timelines ; https://learn.microsoft.com/en-us/windows/win32/api/jobapi/nf-jobapi-isprocessinjob ; https://learn.microsoft.com/en-us/windows/win32/api/synchapi/nf-synchapi-waitforsingleobject

## Final decision: PHASE 2A NATIVE SHUTDOWN GATE STILL BLOCKED

The formal isolated Electron 44.5.1 build did not pass consistent shutdown. Portable artifact: 100,393,569 bytes, SHA-256 `9f6371192f44abfd01519cfb83234319927c4fd0e463f162b7de2c95b567046d`. Experiment dependency-only commit: `02a89ed7b4fea17467548777823c89f5bb7e77e3`; it is not merged into main.

Existing native acceptance produced 8 of 10 required completed runs:

- Unpacked: 4/5 passed. Run 3 left main **48276**, renderer **76700**, GPU **44608**, utility **20684** unsignaled at 10 seconds, despite recorded exit codes 0.
- Portable: 1/3 completed closes passed. Run 1 left wrapper **21572**, main **74172**, renderer **41476**, GPU **5632**, utility **50544** unsignaled. Run 2 left wrapper **47336**, main **31996**, renderer **24964** unsignaled. Run 4 could not obtain an owned native window within the launch budget; run 5 did not start after that harness exception. Neither missing run is a pass.
- Raw minimal in the installed worktree: 5/5 passed.
- A separate five-run portable follow-up using the diagnostic harness passed 5/5. This follow-up establishes intermittency; it does not erase the original failures or satisfy consistent shutdown for this candidate.

All PID lists refer to the measured failed deadline, before identity-checked cleanup; they are not a claim those PIDs are presently running. Actual kernel state is the acceptance criterion. Product lifecycle logging was not added, so product `lifecycleComplete` is unknown; minimal lifecycle evidence remains separate and complete. Raw formal/follow-up evidence is preserved in `artifacts/shutdown-electron44-*-raw.json` and in the combined matrix; the incomplete acceptance summary is `artifacts/shutdown-electron44-native-close.json`.

The main checkout still uses Electron 38.8.6. Its new diagnostics passed typecheck, lint and 110/110 tests. The existing 100-seed, 30-year, century, migration and scenario evidence remains preserved. Electron 44 full regression was not started because its mandatory native prerequisite failed; this experiment is not an accepted runtime change. No simulation/model/save/replay code has been altered, no runtime upgrade merged, no v0.3.0 tag created, no release published and no Phase 2B started.

Next precise experiment: run the prepared original-candidate QA archive on another Windows x64 host or clean Windows VM, with the four five-run cold cases and the optional five-run 1000-resident/20-day warm WM_CLOSE case. Record OS build, exact artifact SHA, kernel exit latencies and CIM results after observer-handle release. Repeat the identical cases on this host under the same launch ownership and compare. If failure remains host-specific, collect a Windows process/thread wait trace around a failing close; Job, pipe, driver and antivirus causes remain unproven. No available second host was provided during this task, and no installed VM runner was found, so external verification remains pending.
