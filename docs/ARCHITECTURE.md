# Architecture

CIVITAS separates canonical simulation truth from observation, investigation and presentation. Current main includes Phase 2A and 3D development; the stable v0.2.0 binary implements the earlier observatory milestone.

![Architecture overview](media/architecture-overview.svg)

## Boundaries

| Layer | Responsibility |
| --- | --- |
| `apps/desktop` | React UI, Three.js / PixiJS scene presentation, navigation and Electron shell |
| `packages/application` | Controller, historical observations, queries, scenarios and workspace persistence |
| `packages/simulation` | Sole canonical CityState, daily systems, commands, event ledger and replay |
| `packages/domain` | Plain entity, event and command types |
| `packages/shared` | Canonical ordered serialization and browser / Node SHA-256 |
| `packages/narrative` | Deterministic event templates that describe existing events |

Imports flow from presentation to application to simulation to domain. Domain and simulation do not import React, Electron, Three.js, PixiJS, narrative, Zustand or wall-clock APIs. The controller owns canonical state; Zustand stores presentation state such as navigation, selection, notices and filters. Controller wall-clock timing is diagnostic only.

## Deterministic truth

A versioned daily system pipeline progresses the city. Scoped RNG draws, stable IDs and deterministic tie-breaking govern outcomes. Entity stores preserve historical citizens, companies and events. Ephemeral indexes and lookup caches are excluded from saves and hashes. The same simulation version, seed and command history reproduce the same canonical truth.

Simulation creates reality. Narrative describes recorded events and never changes simulation truth. Current operation is offline and requires no LLM API.

## Observation and investigation

Historical sidecars store actual observations; they do not recreate missing past values from the present. Statistics link to contributing events and entity histories. Explicit `causeEventIds` support bounded recorded causal graphs; associated events are labeled separately. A/B scenarios fork an accepted checkpoint into independent command histories, preserving the baseline.

Current v3 saves verify structure, integrity and invariants before replacing a live workspace. Genuine released v1/v2 fixtures verify migration. Migrated human-development history begins at its explicit availability boundary; old history is not rerun under new simulation rules. See [save and replay](SAVE_AND_REPLAY.md).

## Presentation and desktop shell

The schematic city projects actual buildings, residences, companies and household residents. Building height, district styling, camera, roofs, rivers and streets are presentation, not simulated GIS, traffic or physical movement. Selection and investigation overlays reference real entities. Camera changes do not advance simulation state or RNG.

Electron uses context isolation, a sandboxed preload, no renderer Node access, denied window creation/navigation and sender-validated persistence IPC. Saving writes a temporary sibling file and renames it; loading enforces a size limit before full renderer-side validation. Browser-mode download/upload shares the persistence implementation.

Windows packaging stages the compiled renderer and Electron entrypoints into a dependency-free `.desktop-runtime` directory. Vite bundles runtime dependencies; development libraries are excluded from the packaged application. Current build outputs are local development candidates and are ignored by Git. Native shutdown acceptance remains unresolved; see the [engineering report](reports/SHUTDOWN_CLOSURE_REPORT.md).
