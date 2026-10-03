# Genuine released save fixtures

Generated inside a `git archive v0.2.0` source tree at commit `371e16adc9b538154ba1ccfb4215e7fd5621f0c1`, using its original simulation **0.1.0**, persistence and observatory implementations. The tagged source was installed with its frozen lockfile. No new-version state was relabeled.

Seed `LEGACY-MOBILITY-MIGRATION`, population 100. Advance the original city 30 days while capturing its real history. Fork A/B, set B income tax to 2500, then advance both branches 30 days. Save the original city with old `saveCity` for v1 and old `saveObservatory({state,history,scenarios})` for v2. Both original integrity and truth hashes are verified by the new loader before upgrade. The v2 original state is day 30; branches are day 60.

| Fixture             | SHA-256                                                            |
| ------------------- | ------------------------------------------------------------------ |
| phase1-save-v1.json | `9e2afb61d628a67a00dbd72b284f3651ab897389266df1b87b8c59b65b1a81c3` |
| phase1-save-v2.json | `966c81d73529dcc1312e53df8856a459016df08d04ca516bb765f1622fd14e76` |

These files are intentionally immutable test input. Corruption tests modify an in-memory copy.
