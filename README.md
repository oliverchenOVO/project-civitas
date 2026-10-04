# Project CIVITAS

> **Every statistic has a story.**

**A deterministic living-city simulation and civic observatory.**

Project CIVITAS is a deterministic living-city simulation where hundreds of autonomous citizens study, work, form households, change careers, move through social classes, and respond to public policy over decades. Investigate the people behind the numbers: when unemployment rises, follow recorded firing events to the companies, citizens and households involved, then inspect the recorded causal chain.

![Current development: an actual oblique 3D city with City Pulse](docs/media/hero-city.webp)

[**Watch Demo**](docs/media/civitas-demo.mp4) · [**Stable Windows Build — v0.2.0**](https://github.com/oliverchenOVO/project-civitas/releases/tag/v0.2.0) · [**Architecture**](docs/ARCHITECTURE.md)

*Screenshots and demo show current Phase 2A / 3D development. These features are not all included in the stable v0.2.0 binary.*

## Highlights

- **Deterministic simulation:** the same simulation version, seed and command history reproduce the same city.
- **Living citizens:** education, skills, careers, income, households, housing and social mobility in current development.
- **Recorded causality:** statistics → events → companies → citizens → households. Recorded causal edges are distinguished from associations.
- **Scenario experiments:** fork one city into independent A/B policy histories and compare outcomes.
- **Interactive civic observatory:** inspect real simulation entities in 2D / 3D views across the stable and current milestones.

## Why CIVITAS?

Most city simulations tell you what happened. CIVITAS lets you investigate why.

```text
Unemployment
    ↓
Recorded firing events
    ↓
Companies → Citizens → Households
    ↓
Recorded causes / effects
```

Every entity link opens an actual simulation entity. Historical values come from recorded observations and events. Missing history is shown as unavailable; an association is not presented as a proven cause.

## Human development — current Phase 2A candidate

Current development includes education, skills, occupations, promotions, wage progression, household economic class, intergenerational mobility and education-policy experiments. A citizen's qualifications expose actual education, skill and experience thresholds; observed childhood and age-25 reviews support intergenerational comparisons.

![Current development: a citizen's career and qualification evidence](docs/media/citizen-life.webp)

This work is implemented and remains under final desktop-runtime acceptance. It is **not** part of the stable v0.2.0 download.

<details>
<summary>Explore recorded causality, scenario comparison and map evidence</summary>

![Recorded causal graph from actual firing and household events](docs/media/causality.webp)

![Current development: persisted policy A/B outcomes](docs/media/scenario.webp)

![Current development: real affected entities in the 3D investigation overlay](docs/media/city-overlay.webp)

</details>

## Architecture

![Architecture overview](docs/media/architecture-overview.svg)

The simulation creates reality. Narrative may describe it, but does not decide it. LLMs do not determine simulation truth; the current application uses deterministic event templates and requires no LLM service or API key.

The React observatory queries application history and real domain entities. The simulation owns canonical state, scoped RNG streams and the event ledger. Camera movement, schematic geography and rendering remain outside simulation truth. See [architecture](docs/ARCHITECTURE.md), [determinism](docs/DETERMINISM.md) and [save / replay](docs/SAVE_AND_REPLAY.md).

## Engineering evidence

Seeded execution, scoped RNG streams, canonical hashing, deterministic replay, integrity-checked save migration, scenario checkpoints, property tests, long-run simulation, Windows packaging and data-driven 3D rendering.

**Current Phase 2A development validation:**

| Validation | Recorded result |
| --- | --- |
| Automated correctness | 110 tests passed |
| Stability | 100 seeds × 250 citizens × five years; zero technical failures |
| Persistence / replay | 250 / 1000 initial citizens × 30 years, save/load/replay and continuation |
| Demographic stress | 1000 initial citizens × 100 years, invariants and persistence/replay checks |
| Desktop release acceptance | **Blocked by intermittent native shutdown** |

These are current development results, not stable v0.2.0 acceptance figures. [Compact public evidence](artifacts/README.md) includes exact truth hashes and limitations. [Phase 2A report](docs/reports/PHASE2A_REPORT.md) records functional success and failed desktop gates separately.

## Technology

TypeScript · React · Electron · Three.js · PixiJS · Zustand · Zod · Vitest · Playwright · pnpm

## Run locally

Use Node 24 and pnpm 11. Dependencies are locked in `pnpm-lock.yaml`.

```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

Run `pnpm dev` for the browser observatory, or `pnpm desktop` after building for the Electron application. Windows packaging requires Windows x64 and PowerShell 7:

```bash
pnpm package:win
```

Packaging current main produces an **unaccepted development candidate**. Use the stable release link above for the accepted milestone.

## Releases

### v0.2.0 — Observatory, History & Causality

**Latest stable release.** Historical metrics, recorded causal investigation, citizen life history, household/company history, map evidence, Year in Review, A/B policy scenarios and v2 saves.

[Release notes and Windows download](https://github.com/oliverchenOVO/project-civitas/releases/tag/v0.2.0) · [Stable milestone report](docs/reports/PHASE1_1_REPORT.md)

Current development: **Human Development & Social Mobility**, plus the interactive 3D presentation. No v0.3.0 release or preview has been published.

## Project status

**Active development.** The latest stable milestone is **v0.2.0 — Observatory, History & Causality**. Current main extends CIVITAS with human development, education, careers, intergenerational mobility, deeper demographic behavior and an interactive 3D city presentation. Phase 2A functionality is implemented and remains under final desktop-runtime acceptance.

## Known limitations

CIVITAS is an active research-style simulation project rather than a production commercial game.

- Human-development models use intentionally coarse education and occupation categories.
- Long-term demographic behavior is simulated but is not calibrated to represent a real city.
- The 3D city is a deterministic schematic visualization rather than GIS geography.
- On the primary Windows development machine, Electron process shutdown can intermittently exceed the project's strict 10-second native-process QA threshold after heavier sessions. The investigation also recorded intermittent failures in minimal and cold-close controls.
- Simulation correctness, save integrity and deterministic replay have not been affected in the recorded validation.
- Windows builds are unsigned.

See the [Shutdown Closure report](docs/reports/SHUTDOWN_CLOSURE_REPORT.md) for engineering details. No runtime workaround is claimed.

## Reports

[Phase 1](docs/reports/PHASE1_REPORT.md) · [Scene Remaster](docs/reports/SCENE_REMASTER_REPORT.md) · [Phase 1.1 / 3D](docs/reports/PHASE1_1_REPORT.md) · [Phase 2A](docs/reports/PHASE2A_REPORT.md) · [Publication audit](docs/PUBLIC_RELEASE_AUDIT.md)

## License

Copyright © 2026 oliverchenOVO. All rights reserved.

Public source repository for portfolio and academic review only. Modification, redistribution, commercialization, sublicensing and derivative works are not permitted without explicit written permission. This is not an open-source license. Third-party dependencies retain their own licenses.

See [LICENSE](LICENSE) and [CONTRIBUTING](CONTRIBUTING.md). External feature contributions are not currently accepted.
