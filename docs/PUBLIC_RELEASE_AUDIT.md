# Public Release Audit

## Before changes — 2026-10-04

- Branch: `main`
- HEAD: `ffa55808f7a3ba1a8188434cacb562fa4f7bc34f`
- Working tree: clean
- Existing tags: `v0.1.0-rc.1`, `v0.1.0`, `v0.2.0`, `v0.2.1`; none will be rewritten.
- Existing GitHub releases: v0.1.0 and v0.2.0, both published milestones; repository visibility is private.
- Git object storage: 14.65 MiB loose + 2.34 MiB packed, 624 objects before this pass. Full tracked/history size inventory follows in the audit summary.
- Largest tracked files: scene-remaster-concept.png (~3.18 MiB), scene-3d-fullscreen.png (~2.45 MiB), observatory-concept.png (~2.26 MiB); genuine migration fixture phase1-save-v2.json (~0.87 MiB) must remain.
- Original ignore rules: node_modules/, dist/, release/, .desktop-runtime/, artifacts/qa/, *.civitas, *.log.
- About description and topics: empty. Website: empty.

## Scope and release strategy

Documentation, security/privacy review, repository hygiene and showcase media only. Stable download remains v0.2.0. Main contains current Phase 2A and 3D development, with native shutdown acceptance blocked. No simulation, save, replay, dependency, packaging or shutdown behavior will change. No v0.3.0 release, tag, visibility change or Phase 2B work.

## Audit in progress

Current-tree and all-reachable-history secret scans, local paths, privacy, binary/media review, link/render checks and verification are pending. Historical commits contain real author identity and a private email address; exact personal values are intentionally not repeated in this public report. Preserving old tags limits historical privacy cleanup. No secret classification or publication safety claim has been made yet.

PUBLICATION READINESS: BLOCKED (audit in progress)

## Initial security and privacy findings

The initial scanner inspected 195 tracked files (20,159,510 bytes), all 624 reachable Git objects and all 361 history blobs (332 decoded text blobs), including commit messages/author metadata. No high-confidence token, credential assignment or private-key matches were detected. No tracked or historical .env file was found. Generic keyword findings are not treated as secrets. The apparent email-shaped strings in pnpm-lock.yaml are package/version references, not account credentials. This is a targeted pattern scan plus manual review, not a guarantee against every possible secret format.

The current tree contains machine paths primarily in raw QA dumps, and the shutdown report contains a local worktree path. These will be removed from public-facing tracked files; original raw bytes will remain locally ignored. Historical Git author metadata contains personal name/email, and old evidence blobs retain local account paths. Old tags must remain unchanged, so the pass will not rewrite those objects. Historical privacy exposure is explicitly pending user disposition; no private values are reproduced here.

No packaged executable, Electron runtime, node_modules or .civitas save is tracked. The largest history blob is 3,335,064 bytes, a concept PNG; no GitHub-size-limit binary is present. Selected PNGs will be converted to compressed WebP; original media will be preserved locally. Necessary genuine v1/v2 migration JSON fixtures remain unchanged.
