# Save and replay

Save v1 is UTF-8 JSON in a `.civitas` file. Manifest contains saveVersion=1, simulationVersion=0.1.0, SHA-256 integrity hash and city metadata. State contains config/seed, day, RNG streams, next ID, entity stores, policy/treasury, external cash flows, metrics/history, events and timestamped commands. It is not a React snapshot. No network or API key is involved.

Loading checks a 100 MB limit, strict full Zod schema, supported save/simulation versions, SHA-256 and structural/financial invariants. The old city remains in place if any check fails. Unknown future versions are rejected; MIGRATIONS is the explicit registry for future version-specific upgrades, currently empty because v1 is the only supported format. There is no fake migration of incompatible rules.

Electron uses native save/open dialogs and validated sender IPC. A save writes a sibling `.tmp` file then renames it over the requested target. Browser preview downloads a JSON file and can upload the same file. Speed and selection are presentation state and pause on load.

Replay reconstructs createCity(config) on Day 0, applies commands in recorded order at their exact canonical days, including multiple commands on Day 0 or one later day, advances between them and runs to the source final day. IDs and RNG advancement reproduce the whole event ledger. Malformed chronology/version throws. SHA-256 comparison is exact, not approximate metric comparison. Diagnostics has a complete replay verification button.

Tests include corruption, unsupported format, missing schema fields, valid-hash broken references, same-day commands, uninterrupted versus loaded continuation and 250-person ten-year saveable/replayable history. Desktop QA additionally closes/relaunches the actual packaged app and compares persisted states before and after continued UI ticks.

Limits: JSON and the full retained event ledger increase file size over time. No compressed archive, incremental save, autosave or crash-recovery journal is implemented. Integrity hashes detect accidental edits, not authenticity against a party that can rewrite both content and hash. Long synchronous replay may briefly occupy the UI thread; the panel reports busy state and pauses progression.
