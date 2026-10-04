# Public Release Audit — 2026-10-04

## Decision and scope

Public portfolio preparation passed. Repository visibility remains private pending explicit owner instruction. This pass changes no simulation, save, replay, runtime, packaging or shutdown behavior. No v0.3.0 release, new tag or Phase 2B work.

Stable download: [v0.2.0](https://github.com/oliverchenOVO/project-civitas/releases/tag/v0.2.0). Current main is Phase 2A / 3D active development; native desktop acceptance remains blocked.

## Before changes

| Item | Snapshot |
| --- | --- |
| Branch / HEAD | main / ffa55808f7a3ba1a8188434cacb562fa4f7bc34f |
| Working tree | Clean |
| Tags | v0.1.0-rc.1, v0.1.0, v0.2.0, v0.2.1 |
| GitHub releases | Published v0.1.0 and v0.2.0 |
| GitHub visibility | Private |
| Tracked tree | 195 files; 20,159,510 bytes |
| Git object storage | 14.65 MiB loose + 2.34 MiB packed |
| About / Website | Description/topics empty; Website empty |

Original ignore rules: node_modules/, dist/, release/, .desktop-runtime/, artifacts/qa/, *.civitas, *.log.

Largest tracked files: scene-remaster-concept.png (3,335,064 bytes), scene-3d-fullscreen.png (2,565,710), observatory-concept.png (2,374,057), and necessary phase1-save-v2.json (915,736). No executable, packaged runtime, node_modules or .civitas save was tracked.

## Current-tree security

Rules cover GitHub classic/fine-grained tokens, OpenAI-style keys, AWS access IDs, Google API keys, Slack tokens, private-key delimiters, Bearer values and quoted credential assignments. Generic secret/token/apikey/api_key/password/passwd/credential/authorization/bearer/private_key/cookie/session occurrences were reviewed. Suspected values are identified by file, line, type and digest rather than copied into output.

The working-project scan inspected 646 own text files, including ignored local QA logs/helpers. No high-confidence secret match, .env file or private-key container was found. Email-shaped lockfile occurrences are package/version references, not account credentials. No credential rotation was required.

Dependency/runtime distributions, Git internals, built outputs and binary copies were excluded from own-text scanning; tracked file types and media were reviewed separately. External credential stores were not read or exported. This is a targeted pattern/inventory scan plus manual review, not a proof against every possible secret encoding.

## Full Git history

The initial scan covered all 624 reachable objects across all local refs, including the unmerged runtime experiment, and all 361 blobs (332 decoded text blobs). Historical deleted text was scanned as blobs; commit messages and author metadata were scanned separately. A separate filename-history check searched for deleted .env and private-key container files. No high-confidence secret or historical .env/private-key file was found. The final post-cleanup rescan likewise found no high-confidence secret.

Existing commits contain the owner's real author name/email. The owner explicitly authorized retaining that Git author attribution during this pass. Public documents attribute only `oliverchenOVO` and do not repeat private contact values.

Old tagged diagnostic blobs still contain developer-machine paths and account-directory names. Removing files from HEAD does not erase those objects. They contained no detected credentials or unrelated private-project material. This historical exposure is disclosed; it is not claimed to have been purged. Old tags and historical commits remain unchanged, as requested.

## Paths and personal information

Current public documents use repository-relative paths. Original process dumps, environment records, absolute local paths and unnecessary machine identifiers are excluded from the tracked public artifact tree. Raw bytes, including failed shutdown cases, remain in ignored local archives. Legacy ignored input copies remain at their original local paths so existing diagnostic scripts work.

Showcase screenshots/video contain the application viewport only: no external desktop, browser tabs, bookmarks, account email, notification popups, terminal, filesystem dialog, raw JSON or process monitor. Simulation resident/company names are generated fictional entities. WebP conversion omits original PNG metadata. The public GitHub username is intentionally retained.

## Repository cleanup and large files

Raw root artifacts are no longer tracked. Five compact summaries in artifacts/public preserve benchmark hashes, stability, long-run validation, failed/successful shutdown counts and preparation verification. Failures are not relabeled as successes. Large saves, executables, runtime copies, dumps, captures and bundles remain ignored.

Ignore rules include node_modules, dist, release, win-unpacked, *.exe, .desktop-runtime, artifacts/qa/raw/tmp/local, generated root artifact JSON/Markdown, *.civitas, *.log, *.dmp, .env and .env.*. Intentional .env.example files remain reviewable. Small tests/fixtures/*.civitas are exempted; genuine v1/v2 JSON fixture bytes remain unchanged.

Reports are preserved under docs/reports with compressed WebP links. Original PNGs are locally archived. Public Markdown links do not point to ignored raw downloads. Historical inline evidence stays labeled by milestone; current summaries do not substitute changed-rule truth for old stable results.

Measured tracked tree after showcase commits, before final audit additions: 11,244,728 bytes, approximately 11.2 MB versus 20.2 MB before. Largest current asset is the approximately 3.2 MB MP4. Largest historical blob remains the 3,335,064-byte concept image. Git object storage increased to approximately 23.49 MiB loose + 2.34 MiB packed because old history remains and new assets were added; a smaller HEAD does not imply a smaller historical clone.

## Public presentation and license

README leads with concept, actual oblique city, demo/stable/architecture links and five core capabilities. It separates current Phase 2A education/career/mobility/3D work from stable v0.2.0. Validation figures explicitly describe current development.

LICENSE is All Rights Reserved — Portfolio Review License. It permits viewing, cloning/downloading and local review of unmodified copies, without modification, redistribution, commercial, sublicensing or derivative-work permission. Third-party licenses retain their own terms. The project is not labeled open source. CONTRIBUTING does not invite external feature contributions.

Five new actual UI screenshots use WebP quality 88, approximately 73–214 KB each. Demo: 50-second H.264 MP4, approximately 3.2 MB; 20-second animated WebP, approximately 0.6 MB. Actual UI operations and saved workspaces are used; no outcomes were invented. Captions/title card label current development. SVG architecture and 1280×640 social-preview PNG were rendered and visually reviewed.

GitHub About description and twelve requested topics were updated and read back. Website remains empty. Social preview artwork is prepared; uploading it via Settings is a documented owner action, not a completed setting change. Issues/Discussions/Wiki/Projects recommendations are documented only. Visibility and releases were not changed. Portfolio commits are local and have not been pushed by this pass.

## Release strategy and limitations

Stable remains v0.2.0. Current main remains active Phase 2A / 3D development. The unaccepted local 0.3.0 candidate is not presented as a stable download. Existing releases/tags remain untouched.

The shutdown wording describes intermittent exceeding of the strict ten-second native-process QA threshold after heavier sessions, and also acknowledges minimal/cold-close counterexamples. It does not claim the application cannot close or that upgrading runtime fixed it. Recorded simulation correctness, save integrity and replay validation have not been affected.

Other limits: coarse education/occupation categories, demographics not calibrated to a real city, schematic rather than GIS geography, unsigned Windows builds. See the [engineering report](reports/SHUTDOWN_CLOSURE_REPORT.md).

## Verification

- Typecheck and lint passed. An initial lint attempt found CommonJS-import rules in local capture helpers; diagnostic-only annotations corrected those helpers without runtime changes.
- Configured Vitest suite via `pnpm exec vitest run --maxWorkers=1`: 110/110 tests across eight files passed.
- Build passed. Existing third-party Rollup annotation warnings remain; renderer JS/CSS asset hashes stayed unchanged.
- Source, dependencies, test logic, genuine v1/v2 fixtures, runtime/packaging configuration and CI are unchanged against initial HEAD.
- No full 100-seed/30-year rerun was needed: gitignore changes tracking only; packaging inputs and simulation code are unchanged. Existing long-run evidence remains preserved.
- Local GitHub-compatible Markdown preview: desktop 1440×1000 and mobile 390×844; all six images loaded, gallery interaction passed, no console errors or horizontal overflow. An initial SVG encoding problem was corrected to UTF-8; a preview favicon-only 404 was removed. This is not claimed as a live GitHub screenshot.
- Markdown links: zero missing targets or ignored-only raw targets. Stable asset metadata/digest was verified using authenticated GitHub metadata.
- MP4: 50.000 seconds. Animated WebP: 54 compressed frames, 20,000 ms total.

See [preparation checks](../artifacts/public/preparation-checks.json), [public evidence](../artifacts/README.md), [portfolio copy](PORTFOLIO_COPY.md), [media](media/README.md) and [GitHub recommendations](GITHUB_PRESENTATION.md).

## Completion boundary

Changes are split into audit, artifact hygiene, license, README/reports, media, demo and final audit commits on main. Final commit and clean-tree verification are reported at handoff. Models/save/replay/runtime behavior is unchanged. Repository remains private, with no new application release or tag.

The prepared HEAD is suitable for portfolio review under the license and disclosed historical attribution/path boundary. A future request to remove historical identity/paths would require a separate history-cleanup decision and cannot silently rewrite existing tags.

PUBLICATION READINESS: PASS
