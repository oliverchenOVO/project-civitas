# Determinism

The simulation core has no Math.random, Date.now, performance.now, UUIDs, wall-clock timers, network, LLM, React or Electron. It is callable from Node. Seed hashing uses FNV-1a UTF-16 traversal and each named stream uses unsigned xorshift32. Persisted stream state is in CityState.rng. Stream keys include population, employment foundation, company, household and housing; systems only consume the streams they need. Relationship processing currently uses no randomness. Determinism means equal simulation version, exact seed/config, daily ticks and ordered commands → equal entire canonical state.

Scoped randomness isolates unused random draws in another stream; naturally a _real change_ in citizens, family size or firms can affect economy through shared simulation state. Independence does not promise that real inter-system causal effects disappear.

System traversal uses stored arrays. Deterministic ties use ordinal string IDs rather than machine-locale collation. Monetary settlements and probabilities are integer-derived. Canonical JSON sorts object keys, omits absent optional properties and preserves semantically relevant array order. SHA-256 uses WebCrypto, available in Node 24, localhost browser and Electron file renderer. It includes population, RNG, IDs, commands, events, policy and metric history, excluding UI state, caches and diagnostics because those never enter CityState.

Each 10-year benchmark records the final SHA-256. Tests verify repeat generation, scoped RNG isolation/persistence, same seed/commands, exact command replay, saved continuation and long-run reference/financial integrity. Seed sweep runs 100 fixed seeds × five years, with complete invariant audits annually and at final year. A failing state throws instead of silently being repaired.

Lookup optimization was validated against four pre-optimization hashes with no result changes. `artifacts/raw/public-preparation-baseline/benchmark-baseline.json` preserves those original measurements; subsequent correctness adjustments to initial vacancies, parent/child age ordering and migrant ages required the final benchmark to be regenerated. Do not compare a changed-rule world to the earlier baseline hash as if it were the same ruleset.

Speed only changes ticks per UI batch (500 ms). Max is bounded to 30 days per batch. Thus equally many executed ticks with commands at equally numbered days yields the same city, regardless of chosen speed or elapsed real time.
