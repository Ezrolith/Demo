# QA continuation — 25 October 2026

**Review:** [draft PR #5](https://github.com/Ezrolith/Demo/pull/5), `codex/gameplay-qa-polish` → `codex/bonus-three`.
Base: `ed65bbfb0416f08e5aa507bf221bdcc7ca413dff`.
**Verified code/test commit:** `c52043db57ac8058953fa21174fdb143e2f802a6`.
The final evidence revision changes this handover and results JSON only.
No merge or deployment. Original campaign, graphics, renderer, lighting, music,
atmosphere, PR #4 and Claude branches are unchanged.

## Assessment and changes

Read README, HANDOVER, BONUS, GAMEPLAY-AUDIT-FOLLOWUP, PLATFORM-QA-HANDOVER,
HUMAN-PLAYTEST, the four existing draft PRs, source, tests and visual evidence.
The branch already contains the three adventures, companions, bosses, moral
outcomes and portable saves; earlier branch instructions and platform caveats are historical.

Two independently reproduced player problems were fixed:

- **Silent bonus-save failure:** a quota/storage exception left Resume progress
  in memory without writing it to disk or telling the player. Failed reads and
  writes now set accurate status; a write failure produces one warning per
  outage, and Bonus Levels reminds the player to export before closing.
  Unsaved progress remains exportable. Successful writes/restores clear the
  warning; failed restores retain existing data. Campaign/settings are isolated.
- **Repeated interrogation:** requesting guard A, then B before Rorschach arrived,
  left A pending. Visiting A after B replayed dialogue and reset the dispatch
  marker. Retargeting now cancels the earlier request; only the active unfinished
  request can complete.

Production edits: `src/game/bonus.js`, `src/game/bonus-portability.js`,
`src/data/chapters/last-broadcast.js`, and rebuilt `dist/dr-manhattan.html`.
The read-only workflows now cover PRs into `codex/bonus-three`, including updates.
Browser/Safari concurrency is per PR.

## Final results

| Verification | Actual result |
| --- | --- |
| Original campaign | All nine suites passed |
| Three adventures, source and standalone | Last Broadcast 42, Ninth Minute 75, Long Summer 82 checks per build; all exit 0 |
| Backup / storage faults / interrogation, both builds | 17 / 14 / 7 checks per build; all exit 0 |
| Full real-input Summer, source and standalone | 18 checks each; Mercy, 14 spared, 0 unmade, 0 Comedian casualties, 6/6 rescued; lowest observed coherence 66 locally |
| Three browser engines, both builds | 64 platform checks and 17 backup checks per browser/build; all exit 0 |
| Chromium, Firefox, WebKit rescue/reload route | 15 checks per engine; all exit 0 |
| Native macOS Safari over loopback HTTP | 90 checks; exit 0 |
| Build and code | Syntax, YAML/shell checks, reproducible standalone, clean working tree |

**23 required local commands pass**, after correcting inherited test setup.
Fresh hosted runs on the verified commit: [full regression](https://github.com/Ezrolith/Demo/actions/runs/40222735874),
[browser/performance](https://github.com/Ezrolith/Demo/actions/runs/40222735867),
[native Safari](https://github.com/Ezrolith/Demo/actions/runs/40222735894).
**All three runs succeeded.** The twelve source suites passed on their first
attempt; all standalone/focused checks and both full journeys exited 0.
The evidence-only commit skips duplicate CI; source, tests, workflows and HTML
remain identical to the verified commit.

`tests/play-audit-followup.mjs --complete` extends the existing route through the
moving truck fight, Comedian restraint, driver escort and ending, after a genuine
checkpoint reload. After explicit initial scene/settings setup, it uses ordinary
keyboard/mouse and real RAF, without placement, refills, invulnerability, quest
edits or skips. Read-only telemetry guides this known route; it is not a first-time
human playthrough. Source and standalone evidence have separate directories.

Additional normal-menu, normal-damage play: Last Broadcast rooftop encounter
(six guards spared and natural E interrogation); Ninth Minute platform (five
drones cleared, SERVICE selected, safe-tunnel marker and H hint recall).
No developer start, placement, refills or invulnerability. Screenshots inspected.

## Test failures retained and resolved

The first local save-suite attempt timed out: its readiness predicate passed
between instant map construction and guard spawning, so it attacked an empty
yard. A second attempt passed persistence but exposed the same early-ready window
in wave/input fixtures and a non-Mac check assuming Linux on this Mac.
The fixtures now wait for actual guards/objectives and unlocked dialogue/context;
Linux and Mac shortcut policies are explicitly exercised in separate contexts.
All 46 original assertion lines and 50 wait/timing/tolerance lines are unchanged;
production input and campaign code were not modified.

Earlier failures: `tests/out/qa-polish/saves.log`, `saves-corrected.log`.
Final complete success: `saves-final.log`. The isolated six-check input probe also
passed. Before-fix storage/interrogation evidence and after-fix screenshots are
under `tests/out/bonus-storage*` and `tests/out/bonus-interrogation*`.

## Performance and remaining verification

Fresh artifact measurements, median of nine scene medians: unthrottled Chromium
High approximately 60 fps; 4x CPU slowdown with requested High approximately
30 fps, requested Low approximately 60 fps. The normal quality governor remained
enabled. These are different runner conditions from the older 20/30 fps report,
not evidence of an optimisation: this review did not change the renderer,
quality defaults or atmospheric effects. Firefox was approximately 58.5 fps;
automated WebKit approximately 41.7 fps. Real slow-device and long-session
performance remain unverified.

A static-puddle scan was investigated but its measured cost was modest, so it
was left alone. The suspected Summer Pause-text overflow was ruled out by
screenshot/measurement: approximately 601 px fits 656 px of content width.

Still needed: first-time human discovery/pacing, subjective listening at fixed
volume, physical slow devices, native Safari direct downloaded-file opening and
assistive technology. Touch gameplay remains unsupported. Controlled suites use
setup shortcuts; green checks do not certify every story's natural difficulty.

## Continue safely

Keep PR #5 draft; no merge/deploy. Build with `node tools/build.mjs`; never edit the
standalone by hand. `npm test` runs the original nine; additionally run the three
adventures, `bonus-portability`, `bonus-storage` and `bonus-interrogation`.
Run those six bonus/focused suites on the standalone too, and the full
`play-audit-followup.mjs <index.html|dist/dr-manhattan.html> --complete` route.
Evidence summary: [qa-polish-results.json](qa-polish-results.json).
Logs/screenshots remain in `tests/out/` locally and the linked CI artifacts
(retained for 14 days).

Standalone: **933,374 bytes**, SHA-256
`45bd1cf75d5e192d56911ef439980588fcdde222265cbd0724c95246d75dac46`.
