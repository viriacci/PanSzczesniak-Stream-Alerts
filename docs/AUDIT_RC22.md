# PSSA RC.22 – optimization and pre-Stable audit, pass 1

## Release boundary

Baseline: `2af0e04098d0f73c68e0542553cd300973b8b5e2` (published RC.22, Windows verification run 45574281592, success). Version remains 2.0.0-rc.22. Audit-only builds do not publish a new release or overwrite existing assets. Stable is explicitly out of scope.

## Findings and changes

| Area | Finding | Remedy | Verification |
|---|---|---|---|
| Guided tour | Unconditional animation-frame loop reads layout and writes CSS while idle | Event-driven, coalesced frame scheduling using resize, mutation, scroll, transition and animation events; observers removed on cleanup | Real Electron six-tour smoke, viewport and target resize |
| Scene player (OBS and editor) | Rewrites unchanged position, dimensions and crop every paint | Compare geometry and crop; invalidate on scene edits | Style-write-count unit test, existing serialized player and OBS playback smoke |
| Media import | Loads source and previous copy into RAM; empty files accepted but backup rejects them | Stream with incremental SHA256, actual 50 MiB bound, exclusive temp, cleanup, reject empty files and symlink destination | Corrupted-file repair and size/empty regression tests |
| Queue | Telemetry repeats count query; callbacks could see playing state after interruption or old gap deadline | Cache count until revision changes; commit current/gap state before change callback | Unchanged telemetry prepares test; transition callback test; existing 1000-event and soak tests |
| Twitch auth | Completion of obsolete login can clear new login device code | Check generation before clearing | Code inspection; existing authentication/EventSub tests |
| Updater | Channel switches may reuse an obsolete in-flight check; stale popup could launch different installer; unsigned stable was accepted via Beta consent | Channel-bound promise, bind UI action to exact version/digest, revalidate selection and shutdown state, allow unsigned only beta/RC | Signature policy unit test, typecheck, existing update smoke and installer tests |
| Verification | Previous benchmark compared only beta.2; binary assets counted as text lines | Pin RC.22 as additional benchmark baseline, gate SQL prepare regressions, classify binary assets, add per-line source triage artifact | Full Windows workflow |

## Audit coverage in this pass

Manual source inspection of the primary paths: IPC/preload/contracts/CSP; alert queue, persistence, import media, service and overlay server; SQLite schema and library store; Twitch auth, device flow and EventSub; live service and store, analytics store and transfer; OBS client, dock control and installer; Agent bridge and HTTP server; backup/restore, output, updater, preferences; shared scene schema, scheduling, player and legacy conversion; help renderer, polling and settings UI excerpts; WPF install engine and CI/publish scripts. Also reviewed relevant existing tests.

The generated `audit-source-lines.json` indexes mechanical review points by exact file and line, with SHA256, over tracked source/config/test files. `audit-inventory.json` fingerprints all tracked files and dependency metadata. These are not a completed manual line-by-line review and do not prove absence of vulnerabilities. The Windows workflow reruns npm audit, SBOM, performance comparison, TypeScript, tests, Electron UI and packaged smoke, native OBS dock build and integration, install/upgrade/uninstall and updater cleanup.

## Outstanding before Stable

- Complete manual review of every remaining file/line, especially native C++ dock, WPF UI and cleanup, PowerShell/NSIS scripts, full renderer/CSS and remaining contracts/test paths; verify every flagged point in the line ledger. Repeat on the final candidate after fixes.
- Review backup operation latency (large offline backups use synchronous SQLite/filesystem operations) and real streaming performance under representative OBS/Twitch workloads; synthetic tests do not measure GPU encoding or actual CPU/RAM on end-user machines.
- Real Windows OBS plugin compatibility, device OAuth and reconnect with live Twitch data; run multi-hour measurement on representative hardware.
- Stable publisher signing and upgrade from unsigned RC: unsigned Stable is now blocked for auto-launch; establish signing/trust and distribution process before Stable.
- No release approval is implied by a successful CI or this document. No claim of a completed line-by-line manual audit.
