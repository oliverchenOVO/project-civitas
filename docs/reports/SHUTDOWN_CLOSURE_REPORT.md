# Phase 2A — Native Shutdown Closure

**Engineering status: native shutdown acceptance remains BLOCKED. Root cause is undetermined.** This portfolio pass changes no runtime, simulation, save or replay behavior. Main remains on Electron 38.8.6, simulation 0.2.0 and saveVersion 3. The isolated Electron 44 experiment was not merged. v0.3.0 was not released.

## Three distinct observations

Electron reaching `quit` / `process exit`, a signaled Windows process kernel object, and absence from CIM enumeration are recorded independently. A complete lifecycle or exit code 0 is not substituted for a signaled kernel object. The acceptance criterion uses real WM_CLOSE and voluntary termination of all owned processes within ten seconds; forced cleanup after a measured failure is never a pass.

The minimal probe excludes CIVITAS, React, PixiJS, 3D, simulation, IPC and application-specific timers. It logs BrowserWindow close/closed, window-all-closed, before-quit, will-quit, quit, process exit and active resources / handles / requests.

## Historical timeline

| Milestone / observation | Recorded outcome |
| --- | --- |
| Phase 1, Electron 38.8.6 | Six accepted native closes passed |
| Phase 1A | Six accepted closes passed; earlier portable / dense-WMI failures retained |
| Phase 1.1 / v0.2.0 | Six accepted closes passed on the same runtime |
| 3D investigation / Phase 2A | Intermittent unpacked, portable and minimal failures; some launches obtained no owned window |

Historical failed evidence remains available in ignored local archives and original Git history. A later successful run does not erase an earlier failure.

## Controlled minimal and launcher matrix

Each group below has five repetitions under the same native WM_CLOSE, ten-second criterion and owned process-tree observation.

| Minimal runtime / control | Passed | Failed |
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
| 38.8.6, packaged minimal | 5 | 0 |

The 39.8.10 failure reached the full lifecycle with empty Node active handles, while main, renderer, GPU and utility kernel objects remained unsignaled. Main remained enumerated after observer handles were released. This is stronger evidence than a stale-CIM-only observation.

37–39 were historical diagnostic comparisons, not currently supported branches. A 43.7.7 download failed and was not tested. The 44.5.1 runtime was Chromium 152.0.7977.130 / bundled Node 24.21.0; original 38.8.6 was Chromium 140.0.7339.249 / bundled Node 22.22.0. The recorded host was Windows 11 25H2; electron-builder was 26.15.3 and Playwright 1.63.0. Runtime information was checked against the [official releases](https://releases.electronjs.org/releases.json) and [release policy](https://www.electronjs.org/docs/latest/tutorial/electron-timelines).

## Product evidence and rejected upgrade

| Case | Passed / completed | Interpretation |
| --- | --- | --- |
| Original unpacked, cold close | 5/5 | Passed this group |
| Exact original portable, cold close | 5/5 | Passed this group |
| Original unpacked, 1000 residents / 20 days / 3D | 3/5 | Two native WM_CLOSE failures |
| Isolated raw 44.5.1 + byte-identical original app.asar, same warm workload | 5/5 | Promising control, insufficient for acceptance |
| Formal packaged Electron 44 unpacked | 4/5 | Main, renderer, GPU and utility remained unsignaled in one run |
| Formal packaged Electron 44 portable, first group | 1/3 | Two close failures; launch four had no owned window; fifth never started |
| Installed-worktree 44 minimal repeat | 5/5 | Minimal success does not establish product acceptance |
| Formal 44 portable, separate follow-up | 5/5 | Demonstrates intermittency; does not erase first-group failures |

The formal upgrade acceptance completed only eight of ten expected repetitions and failed overall. Portable failures included both wrapper and extracted Electron main / descendants. The experiment changed only Electron and required lock entries; full upgraded regression was not started after the mandatory native prerequisite failed. Main and the original candidate remain unchanged.

## What the evidence does and does not show

A portable-only explanation is insufficient because unpacked and raw minimal cases also failed. CIVITAS models and rendering are not necessary to reproduce the minimal failure. Playwright launches through shell / pipe ownership, but actual main / GPU / utility kernel failures cannot be explained solely by a test-driver wait.

Read-only Job membership appeared in both successful and failed runs; this does not establish causation. GPU and sandbox controls do not support a production workaround. No relevant Application Error, WER or Defender event correlation was found in the queried interval. Driver, antivirus, Job, pipe and descendant-teardown causes remain unproven. Practical thread observations were captured where available; inaccessible process objects were not treated as a proven wait stack.

## Public limitation and next evidence

On the primary Windows development machine, Electron process shutdown can intermittently exceed the project's strict ten-second native-process QA threshold after heavier sessions. Minimal and cold-close controls also recorded intermittent failures. Simulation correctness, save integrity and deterministic replay have not been affected in the recorded validation.

A local reproduction kit preserves the exact original candidate, unpacked build, raw runtime and packaged minimal probe. It runs four five-repetition cold groups and offers the same five-run warm workload. The next discriminating experiment is another Windows x64 host or clean VM using identical bytes, recording OS build, artifact SHA, kernel latencies and CIM after observer-handle release. No second host was tested; preparing the kit is not a second-host pass or environment-specific diagnosis.

See [compact shutdown counts](../../artifacts/public/shutdown-summary.json), [public validation evidence](../../artifacts/README.md) and the [Phase 2A report](PHASE2A_REPORT.md). Original process dumps, local account paths and private reproduction bundles are excluded from the current tracked tree. Existing tags and historical evidence objects remain unchanged.
