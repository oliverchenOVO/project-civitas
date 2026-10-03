# Phase 2A — Human Development & Social Mobility

Status: **implementation complete; acceptance blocked by native shutdown, NOT a completed Phase 2A release**. Local application candidate **0.3.0**, simulation **0.2.0**, observatory save **3**. No release or release-candidate tag has been published or created by this development task. Published v0.2.0 and the v0.1.0 / v0.1.0-rc.1 tags remain unchanged.

## Model and evidence

Education is basic / secondary / vocational / tertiary; skills are integer general / technical / service / managerial values in 0–100. Childhood and parental education affect opportunity and performance, not inherited skill or guaranteed class. Initial adults and immigrants have marked starting capabilities; only observed childhood supports an intergenerational comparison. There is no invented pre-initialization education history.

Public schooling runs from age 6 through 17. Secondary completion at 18 uses bounded performance, support and household stress. Vocational completion is no earlier than 20 and tertiary completion no earlier than 22. Study requires a household reserve for uncovered expenses. Three underfunded months can cause dropout. Students are outside the unemployed labor-force denominator. Graduates enter the workforce; unemployed secondary graduates can later complete funded vocational training.

| Occupation   | Minimum completed education | Skills required           | Experience months | Base / cap, cents per month |
| ------------ | --------------------------- | ------------------------- | ----------------- | --------------------------- |
| Labor        | Basic                       | General 8                 | 0                 | 155000 / 270000             |
| Service      | Basic                       | Service 18                | 0                 | 175000 / 310000             |
| Clerical     | Secondary                   | General 35                | 0                 | 195000 / 350000             |
| Technical    | Vocational                  | Technical 45              | 0                 | 230000 / 420000             |
| Professional | Tertiary                    | General 60, technical 55  | 0                 | 270000 / 490000             |
| Management   | Secondary                   | General 55, managerial 55 | 24                | 300000 / 550000             |

Industry weights create real occupational vacancies using deterministic largest remainder allocation. Weekly matching builds six qualification buckets, considers higher-paying occupational categories first and orders employers by offered wage band, productivity and stable ID. Candidates rank by relevant skill and bounded experience, then stable ID. This avoids daily citizen × company matching. Eligibility never guarantees a vacancy or job.

Monthly salary is the policy floor or the bounded occupation wage, whichever is greater. The occupation component is `(base + relevantSkill × 500 + min(experience,240) × 200) × employerAbility / 100`; employer ability is 90 / 100 / 110 according to recorded cash bands, and the occupation cap limits that component. Hire, promotion and salary events store the calculation evidence. Current minimum-wage increases also produce a recorded salary change.

Employed citizens accumulate relevant experience monthly and relevant / managerial skills every three months. After 24 months, annual reviews can promote a qualified citizen into an actual higher-paying vacancy in their company. Annual wage reviews and layoffs can reduce career outcomes; long unemployment can erode technical skill. Every value is bounded. Monthly company skill productivity stays within 0.90–1.20 and modifies bounded export capacity. This is a modest link, not unlimited exponential productivity.

`QUALIFICATION_GAINED` records the checked thresholds and ranking evidence. Its education cause refers only to the recorded completion that actually crossed that occupation's eligibility boundary. Hiring / promotion refer to that qualification evidence; occupational and salary changes refer to their triggering event. Class changes expose the observed income window, wealth and housing burden; they do not fabricate a single causal event for a complex financial outcome.

## Class and mobility

Household class derives from observed monthly after-tax wages and welfare per member, net cash-minus-debt per member and rent burden. Initial classes bootstrap from declared current wages and benefits; later windows use actual paid daily income. Education grants and tuition affect cash / wealth and dedicated education accounts, rather than this wage/welfare income measure. Class is not a label copied from parents. Amounts below are cents:

1. Vulnerable: negative net wealth, or income < 80000 and net wealth < 100000.
2. Affluent: net wealth ≥ 2000000, or income ≥ 320000, wealth ≥ 500000 and rent burden < 35%.
3. Working: income < 180000, wealth < 300000 or rent burden > 50%.
4. Middle: remaining households.

Monthly classification supports annual upward / downward events, rather than reacting to each daily fluctuation. Mobility rates use actual observed household-year reviews as denominators. Affluent accumulated savings can keep a retired household affluent; actual depletion can still move it down. At 25, citizens with observed childhood compare their origin snapshot with their current household class once. Adult arrivals have no fabricated childhood comparison.

City analytics expose education distributions, education-specific unemployment with labor-force denominators, occupation counts, household classes, mobility and actual spending. Average adult salary includes zero salaries for retirees and nonworkers, as labeled. Cohorts include Year 1–5 births now adult, observed vulnerable childhood now adult, tertiary adults and all current adults. Each query shows n, and the smaller n with a recorded age-25 comparison. These are current resident survivor cohorts; deaths and departures can create selection effects. Associations are simulated outcomes, not real-world policy causal estimates.

## Real education budgets

Public education funding and vocational funding pay for actual services and enter the external-flow ledger; tertiary subsidies transfer treasury money to households. Treasury caps constrain every payment. Uncovered vocational / tertiary costs are 20000 / 40000 cents per student month before actual support. Short unemployed training also requires an actual funded payment. Government cumulative accounts and year reviews show public education, vocational and subsidy costs separately. No free training, invented credit or hidden bank is added.

Education and family decisions use scoped deterministic RNG streams. Career review, skill accumulation, qualification and class derivation use explicit deterministic rules. Education does not draw from unrelated existing random streams. Identical version, seed, checkpoint and command sequence reproduce truth and history.

## Migration and replay boundary

Real v1 and v2 fixture bytes were generated by the tagged released simulation 0.1.0 code, not by merely relabeling new saves. Original schema and integrity are verified before migration. Upgrade adds deterministic per-ID marked inferred human capital, current occupation requirements and budgets; original events and observed history remain. Existing employed legacy roles may remain grandfathered while held, but rehiring uses new requirements.

Human-development availability begins on the upgrade day. The accepted upgraded state and history form a versioned checkpoint; replay reproduces future behavior from that point. It does not rerun old history with different rules. Existing old scenario branches migrate independently and keep their historical fork metadata; new comparisons requiring the same new-version checkpoint must Fork again. The UI explains this boundary. Current v3 saves retain state, observational sidecars, checkpoints, branches and integrity hashes. Cross-version replay without migration is rejected.

## Demographic calibration

The released baseline `CIVITAS-CENTURY-1`, population 1000, reaches 104 residents at year 100. By year 30 it has no fertile women with a living spouse; births stop at 69. The original model does not form new adult households, so initial marriage cohorts expire and no new generation replenishes them.

Phase 2A adds bounded annual formation of unrelated single / widowed adults aged 20–40, an age-gap limit, a scoped family draw, a real vacant residence and resource requirements. Cash / debt move proportionally from prior households; spouse and household references remain reciprocal. The original birth hazard is unchanged. This is a structural correction, not tuning births to a preferred population curve. Actual born IDs distinguish children reaching adulthood from immigrants born after day zero. The final calibration artifact reports all decadal cohorts and verifies `initial + births + arrivals − deaths − departures = final`.

## Verification results

### Automated correctness

The final quiet, single-worker run passed **110 / 110 tests** (`artifacts/phase2a-tests.json`). This includes fixed-seed examples, strict schema/integrity migrations, immutable genuine released v1/v2 saves, budget conservation, skills and qualification bounds, career regression, population/household references, generated command sequences and independent deterministic replay. Thirty-two seeds exercise 24 commands across all seven policies and construction, 360 days, repeated core saves and 30-day continuation. Eight additional generated education scenarios exercise six commands, 360 days, three compressed workspace round trips, branch/history replay and original-state preservation. The latter multi-operation cases have a 120-second test budget; existing ordinary five-second test budgets were not changed.

Earlier runs under concurrent host load timed out and are not accepted results. A separate old GUI harness stalled while shutting down an Edge `launchServer` connection, after its native CIVITAS processes had already exited. That incomplete run is not a pass. The harness now uses direct Edge launch and normal browser close. The final native acceptance below is independent of Playwright cleanup.

The final simulation version is **0.2.0**. Ten-year benchmarks intentionally have different hashes from simulation 0.1.0; changing education, employment and family rules changes truth. The released old tag and its evidence remain immutable.

| Initial population | 10-year runtime, ms | Events | Final population | New truth hash |
| --- | ---: | ---: | ---: | --- |
| 100 | 9994 | 5399 | 120 | `c58cf8a013283c3cf7e1f4581e3041fd88ee10d78b27bb95afc0b6eaa73db53b` |
| 250 | 17516 | 11494 | 272 | `93364b46af9689daeaca9cb841cebe9ec4c7d500cdef7ec04d0483a951cb32c1` |
| 500 | 27647 | 12915 | 527 | `27d756875cc366ad7601af0fc554ed64e86823968332269b49b24378a22970c4` |
| 1000 | 115102 | 33165 | 1034 | `6a43bd721d7d3686a07da4ab6fc9130dfd75a136125104f472c693bbe94fd3f8` |

All four have zero invariant violations. These timings include concurrent host contention and are not steady-state performance promises. Sources: `artifacts/benchmark.json`, `artifacts/benchmark.md`.

The **100-seed × 250-person × five-year** run has **zero technical failures and zero collapse cases**. Final populations range 253–273 (mean 262.75), upward household events 86–116 (mean 102.26), downward events 6–25 (mean 14.44). Actual public education costs range 12,360,000–21,710,000 cents, vocational costs 100,000–1,610,000 and tertiary subsidies 0–990,000. Sources: `artifacts/stability.json`, `artifacts/stability.md`. A five-year stability gate does not establish a stable century population.

### Thirty-year truth, history and save verification

Seed `CIVITAS-HUMAN-30` receives tertiary subsidy 40000 at year 3 and vocational funding 40000 at year 12. Both sizes retain the full observed monthly human-development history and year reviews, save/load through the real v3 compressed workspace format, reproduce truth and history, and reproduce the next 30 days after load and replay.

| Initial population | Runtime, ms | Events | Serialized history bytes | Save bytes | Simulation heap, MiB | Verification heap, MiB |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 250 | 86455 | 29698 | 6,655,973 | 2,188,147 | 91 | 176 |
| 1000 | 312442 | 111120 | 22,778,541 | 8,271,775 | 344 | 1138 |

Heap values are point measurements, not peaks or steady desktop memory. Verification deliberately holds several states and replay copies concurrently. The history byte measurements serialize ASCII records. Exact hashes are `e7a39a641818d49d6a382d36709525d348d1ba7554b26bc6ff0180b06265f3f9` (250) and `db29f49475a3f789dc041b00044c4a49c1002c0bc1837ce5798a6966890a2aa6` (1000). Independent evidence runs reproduce both hashes.

Qualification-index p95 is 3.9363 / 2.6004 ms for 123 / 522 actual living working-age candidates and 738 / 3132 checks (six roles each); these include students and measure the threshold index, not complete hiring execution. Observed vulnerable-childhood adult cohort-query p95 is 0.1900 / 0.2171 ms. Sources: `artifacts/phase2a-human-benchmark.json`, `artifacts/phase2a-human-evidence.json`.

Recorded outcomes in the 250 / 1000 runs include secondary completion 51 / 227, vocational completion 29 / 131, tertiary completion 20 / 82, promotions 106 / 413, firing events 109 / 480, salary changes 3888 / 15420, household upward events 144 / 536 and downward events 68 / 266. This demonstrates progression and regression, not universal prosperity. For example, recorded `CLASS_MOVED_DOWN` event 32273 at day 3650 in the 250 run moves an affluent household to working with income 90000, total net wealth 2571903 and rent 122396; classification uses per-member wealth and housing burden rather than total wealth alone. Event payloads identify the affected members and financial window.

| Current resident adult cohort at year 30 | 250: n / age-25 reviewed / up / down / stable | 1000: n / age-25 reviewed / up / down / stable |
| --- | --- | --- |
| All adults | 210 / 53 / 43 / 5 / 5 | 847 / 220 / 191 / 11 / 18 |
| Born in years 1–5 | 11 / 9 / 5 / 0 / 4 | 33 / 31 / 17 / 0 / 14 |
| Observed vulnerable childhood | 3 / 3 / 3 / 0 / 0 | 11 / 11 / 10 / 0 / 1 |
| Tertiary completed | 44 / 16 / 14 / 0 / 2 | 188 / 76 / 62 / 3 / 11 |

Birth-date cohorts can include immigrants born within the interval; only observed childhood supports a review. Demographic birth statistics instead count actual `CITIZEN_BORN` actor IDs. Small vulnerable cohorts and survivor selection limit inference.

### Actual budgeted policy comparison

A controlled ten-year fork of seed `CIVITAS-HUMAN-30`, population 250, compares public education 0 versus 50000 cents per eligible student month. Both end at 269 residents and 227 adults, and independently reproduce truth and history while preserving the original state. Actual public education costs are **0 versus 196,900,000 cents ($1,969,000)**, vocational costs 1,850,000 versus 1,900,000, and tertiary subsidies 3,010,000 versus 3,630,000. Recorded secondary / vocational / tertiary completions change **14 / 4 / 5 → 16 / 6 / 6**. Adult completed-education distributions change 58 / 63 / 64 / 42 → 56 / 62 / 66 / 43.

Upward household events change 131 → 134 with 12 downward events in each branch and 1069 reviewed household-years each. Classes change vulnerable / working / middle / affluent 7 / 9 / 0 / 100 → 7 / 8 / 0 / 101. Average bounded productivity changes **11805 → 11802**, so increased spending does not improve every outcome. This is an internally reproducible simulation comparison, not a calibrated real-world estimate. Source: `artifacts/phase2a-policy-evidence.json`.

### Century demographic calibration and persistence

| Year | Released 0.1.0 population | New 0.2.0 population | New children / working age / elderly |
| --- | ---: | ---: | --- |
| 0 | 1000 | 1000 | 200 / 709 / 91 |
| 100 | 104 | 170 | 10 / 81 / 79 |

At year 100, old versus new cumulative births are 69 → 171, deaths 1106 → 1117, arrivals 141 → 122, departures 0 → 6. Actual locally born children reaching 18 are 69 → 161, and those still alive as adults are 16 → 89. The new run forms 197 households. By year 30, the old run has zero fertile women with a living spouse; the new run has 34. At year 100, the new run still has 10 fertile women, nine with a living spouse and resources. Population accounting is exactly **1000 + 171 + 122 − 1117 − 6 = 170**. Full decadal rows are in `artifacts/demographic-baseline-0.1.0.json` and `artifacts/phase2a-demographic-calibration.json`.

The new century truth hash is `6908153f9f94509ffe0200f1072dd29b5fd561fd2427f56b8c33bbde535615b3`. The independent century persistence run verifies that hash, v3 save/load and replay plus identical 30-day continuation. Its compressed save is **12,261,735 bytes**, with **136,491,581 bytes** of expanded current state; encoded 100 MB and decoded 500 MB limits remain enforced. This run retains full simulation truth and events but starts observational history availability at the measured year-100 checkpoint. It does not claim a full century of recorded financial/human history. An uncompressed helper save exceeded the existing cap and was rejected; it is not the accepted product-format test. Source: `artifacts/phase2a-century-verification.json`.

Population still falls 83% over a century and ages substantially. Family formation corrects the exhausted initial marriage cohort; it does not make this a demographically calibrated real city.

### Genuine migration fixtures

Fixtures were generated from released commit `371e16adc9b538154ba1ccfb4215e7fd5621f0c1`, original simulation 0.1.0, seed `LEGACY-MOBILITY-MIGRATION`, 100 residents, checkpoint day 30 and scenario day 60. SHA-256: v1 `9e2afb61d628a67a00dbd72b284f3651ab897389266df1b87b8c59b65b1a81c3`; v2 `966c81d73529dcc1312e53df8856a459016df08d04ca516bb765f1622fd14e76`. Provenance is in `tests/fixtures/README.md`; tests verify upgrade integrity, deterministic inferred abilities, preserved old events, availability day and new checkpoint continuation. Native QA additionally loads genuine released v2 bytes via IPC and checks that an existing legacy employee with unmet new skill thresholds is described as grandfathered, rather than falsely qualified under new recruitment rules.

### Final desktop, package and delivery gates

Typecheck, lint and the clean Windows package build pass. `artifacts/phase2a-package-regression.json` verifies all **five** active payload files against the fresh renderer/Electron sources byte for byte, verifies the deliberate versioned benchmark hash changes, and confirms 100-seed stability. Packaging now removes only the validated workspace `dist` directory before building, rejecting a redirected/reparse target, so stale hashed bundles cannot accumulate in the deliverable.

Final candidate: `release/0.3.0/CIVITAS-0.3.0-Windows-portable.exe`, **85,645,026 bytes**, SHA-256 **`e1a8570ade13912697bd40a165df06a7f4868d407fc4a21dfa97a4c4a0e7577d`**. The companion unpacked application is `release/0.3.0/win-unpacked/Project CIVITAS.exe`. This is a local, unsigned development candidate, not an accepted release. No GitHub assets, published versions or old tags were replaced.

Earlier candidate GUI runs completed all desktop, observatory, 3D and human-development checks, including normal close/relaunch and old-save IPC load. They are historical observations, not a pass for the final shutdown gate. The final fresh payload run verified the following assertions before shutdown failed:

- **3D:** 136 real buildings, 250 real address markers, top 90° / oblique 45° / ground-parallel 0°, orbit/keyboard/zoom/reset, real citizen/company raycast selection and residence focus, actual layers/fullscreen/ESC, unchanged simulation truth, and a 1000-person scene advancing 20 days. No runtime errors. Overall `artifacts/scene-3d-qa.json` is **failed**, because normal close exceeds ten seconds; its later mobile step was not reached.
- **Desktop:** seeded city creation, 20× advance/pause, search/filter/inspector, actual employer finances/history, policy/construction, real news references and native validated save/command ledger. No runtime errors. Overall `artifacts/desktop-qa.json` is **failed** at normal close; subsequent relaunch/load/replay/responsive steps were not reached in this final run.
- **Observatory:** five actual years of history, unemployment causes and honest association distinction, company inspection/back context, citizen Life/household monthly finances, recorded layoff/bankruptcy causality, presentation-only overlays, annual review, and policy forks compared for 30 days / one year / five years with deterministic replay. No runtime errors. Overall `artifacts/observatory-qa.json` is **failed** at normal close; its subsequent reload/migration/mobile steps were not reached.
- **Human development:** native child `citizen-508` grows to adulthood at observed day 5490, completes tertiary education, enters professional work, exposes real degree/skill qualification evidence and an observed age-25 origin comparison. Current skills and historical hiring checks are distinguished. City cohort counts and labor-force denominators are visible. Native tertiary subsidy branches advance **10 years then another 20 years**, with budget/class/education tables and identical A/B truth/history replay. The original city/container stays unchanged by the fork. The actual **8,585,743-byte** scenario save is retained at `artifacts/qa/phase2a/education-scenarios.civitas`; its checksum is in `artifacts/phase2a-human-qa.json`. That overall result is **failed**, because close stalled after these assertions; final close/relaunch/load was not accepted.

The targeted legacy UI diagnostic separately verifies genuine released v2 IPC load, the day-30 availability boundary, an employed legacy technical worker with insufficient new education/skill thresholds, and the explicit grandfathered-employment warning. Its current screenshot shows secondary < vocational and technical skill 28 < 45, while explaining why existing employment can remain. It also checks 390×844 human-development/cohort usability. Its native Playwright close returns exit code 0 within ten seconds, but Edge browser cleanup exceeds ten seconds, so the **overall diagnostic fails** despite its completed UI assertions. Cleanup status is recorded separately in `artifacts/phase2a-legacy-ui-qa.json`; neither a returned main/wrapper exit code nor successful UI assertions substitute for the strict descendant/kernel/CIM gate. Browser plugin capabilities are absent in this session, so native Playwright Electron and installed Edge are the recorded QA fallback.

**Strict native exit gate: FAIL.** Of six required runs, **four completed observations fail**: unpacked repetitions 1–3 and portable repetition 1 all retain main/descendant processes beyond ten seconds after WM_CLOSE. Windows are closed, but kernel handles do not signal full exit. Cleanup was attempted only after recording failures and is never counted as success. Portable repetition 2 cannot find an owned window within the 60-second launch deadline; repetition 3 is not reached. Therefore there are **zero accepted runs, four failed observations and two uncompleted repetitions**, not six passes. Summary: `artifacts/phase2a-native-close-failed-qa.json`; raw identity, handles and creation-time evidence: `artifacts/qa/exit-human-acceptance-{unpacked,portable}/result.json`. A subsequent isolated retry without other project-owned heavy tests is retained in `artifacts/phase2a-native-close-qa.json`, with raw evidence at `artifacts/qa/exit-human-acceptance-quiet-{unpacked,portable}/result.json`. Its first unpacked repetition also fails; this does not establish recovery. Completed and uncompleted counts for the retry are reported by its own artifact.

The original minimal Electron probe reproduces the same failure without CIVITAS, simulation, IPC or 3D: normal close/closed/window-all-closed/before-quit/will-quit/node-exit(code 0)/quit occur, with no active Node resources, handles or requests, yet kernel termination exceeds ten seconds. This narrows the investigation to native Electron/Windows shutdown; it does **not** establish an exact OS, driver or Electron root cause. Source: `artifacts/phase2a-native-diagnostic.json`. Disabling rendering, extending the gate, calling forced exit or killing a process cannot substitute for passing acceptance.

GUI cleanup now has a bounded ten-second watchdog and reports failure instead of hanging indefinitely. The strict native harness also preserves completed failures when later launch repetitions error, and requires the exact expected number of completed runs. This changes QA bookkeeping only; product shutdown code and the ten-second criterion remain unchanged. Stalled old test Node launchers were stopped separately after recording incomplete runs; that action does not count as a native exit pass. Other projects and user applications were not stopped.

Reviewed native screenshots are checked into `docs/design/phase2a/`: city development/cohorts, career qualification, intergenerational comparison, education policies, 20-year policy outcomes, legacy qualification and mobile layout. Screenshots document functionality; they do not imply process-exit success.

Frozen product implementation commit: **`e369033`**. Final implementation/QA commit: **`27e668c1162f879505f5c9fdd8f37e4843f3d95b`**. The documentation/evidence delivery commit is the commit adding this report (`git log -1 --format=%H -- docs/PHASE2A_REPORT.md`); its exact SHA and final clean working-tree check are recorded in the local `artifacts/qa/phase2a-delivery.json` receipt, avoiding a self-referential document hash. No local `v0.3.0-rc.1` tag is created while the shutdown gate fails. Published v0.2.0 remains at `371e16adc9b538154ba1ccfb4215e7fd5621f0c1`; v0.1.0 and v0.1.0-rc.1 remain at `deec84edd26d543c501a65bb36b794cc7ceaf2f8` and `ff4775cd89e2a53cd0f3e099c0693356249b721e` respectively.

The isolated native retry finishes with **three failed unpacked observations and three uncompleted portable repetitions**: no owned portable window appears in its first launch deadline, so later repetitions are not reached. It is not a quiet-run pass. Combined retries and diagnostics are retained separately rather than replacing failure history with selected successes.

### Product questions and stopping state

| Question | Verified behavior | Acceptance status |
| --- | --- | --- |
| Why does a citizen qualify? | Explicit education/skill/experience checks and recorded hiring evidence | YES |
| Can education change a trajectory? | Childhood study/completion → eligibility → actual job; real policy comparison | YES |
| Can careers progress/regress deterministically? | Recorded promotion, wage review, unemployment/layoff/decay and replay | YES |
| Can households move up/down? | Actual income/wealth/rent classification, both transition directions | YES |
| Can the city measure intergenerational mobility? | Observed origin and age-25 reviews; cohort n and reviewed denominators | YES |
| Can policy affect outcomes through actual budgets? | Paid education services/subsidies, bounded treasury and measured A/B outcomes | YES |
| Can policy scenarios replay identically? | Core properties, controlled ten-year fork, native 10 + 20-year truth/history replay | YES |
| Can released v0.2.0 saves migrate safely? | Genuine v1/v2 integrity-tested fixtures and native IPC/legacy qualification diagnostics | YES for migration; final normal-close/reload gate fails |
| Can the 3D city function without regression? | Camera/picking/layers/isolation and thousand-person checks pass | Functionality YES; full desktop acceptance NO |
| Can multi-decade cities avoid technical corruption? | 100 seeds, 250/1000 × 30 years, 1000 × 100 years and persistence/replay | YES |

These functional answers do **not** override the explicit native/desktop acceptance requirements. Phase 2A is **not declared complete**. Resume with the recorded native shutdown investigation, then repeat all required final desktop/close gates against the same candidate or a newly verified fix. Do not begin Phase 2B or publish v0.3.0 while this gate fails.

## Limits and scope

Careers use six coarse occupation categories; family formation is bounded and intentionally simple. Lifetime earnings are actual earnings since the availability boundary; displayed income trajectories use recorded career / salary events, not fabricated daily individual snapshots. Existing household finance sidecars cover wage/welfare income and basic living costs, not a complete tuition/subsidy transaction series; actual education payments are accounted in wallets, external flows and government education accounts. Aggregate human-development history samples monthly and at year boundaries. No new mobility overlay is required; existing 3D overlays remain.

The historical portable-close latency risk requires the established strict ten-second gate; forced cleanup never counts as success. Idempotent scene disposal also runs on `beforeunload`, but passing tests alone cannot establish the root cause of historical intermittent failures.

No crime, police, courts, political parties, elections, healthcare, banks, stocks, supply chains or LLM narrative has been started. Phase 2A is the stopping boundary.
