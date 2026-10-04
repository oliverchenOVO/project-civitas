# Public validation evidence

This directory contains compact public validation summaries. All Phase 2A values describe current development, not the stable v0.2.0 binary.

| Summary | Purpose |
| --- | --- |
| [benchmark-summary.json](public/benchmark-summary.json) | Four ten-year runs, invariants and exact truth hashes; timings have host-contention limits. |
| [stability-summary.json](public/stability-summary.json) | 100 seeds, five-year technical failures, collapse flags and population range. |
| [validation-summary.json](public/validation-summary.json) | Tests, 30-year persistence/replay, century validation, migration and release boundary. |
| [shutdown-summary.json](public/shutdown-summary.json) | Failed and successful repetitions, incomplete runs and unresolved native acceptance. |

Large raw QA logs, local process traces, temporary packaged builds and local test saves are excluded from the current public-facing tree. Original evidence, including failures, is retained locally under ignored directories; local legacy diagnostic inputs may also remain at their previous ignored paths. Historical Git objects are preserved and are covered by the publication audit.
