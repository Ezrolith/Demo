# Challenge tracking during play

This is an additive update to `codex/glass-palace-refinements` and its existing
draft pull request. No merge, deployment, protected chapter, original music or
engine presentation changes are included.

## Player behavior

Pin one of a moment's three challenges from its palace pane or from
Pause → Moment Challenges. The choice is stored only in the palace slot.
Playing that moment shows a compact live panel; other moments and replay modes
keep their existing HUD. Untracked play uses its original HUD methods.

The panel reads actual level statistics, flags, references and player state at
up to four samples per second. It shows time elapsed, the time target and time left,
people unmade, or the level-specific objective. Pause stops the actual timer.
Retry and Resume retain the original checkpoint's carried statistics. Recoverable
conditions, such as coherence or City Heat, remain provisional until completion.

The optional panel yields to dialogue, captions, cutscenes, flashes, interaction
prompts and the original HUD. Pause shows all three challenge definitions and
current attempt snapshots. Returning from that screen leaves the game paused.

The existing completion hook remains authoritative. Live checks never award
fragments. Challenge Details, available with H or its result-screen button,
explains new fragments, previously recovered fragments and missed conditions.
Those reasons are captured at completion; later state changes cannot rewrite them.
An already recovered fragment cannot be earned again.

## Persistence and compatibility

The palace slot gains an optional `tracking` selection. Missing selections load
as null. The three original progression slots and their formats remain unchanged.
Palace backups include the selection, accept older backups without it, and keep
their preview, explicit confirmation and storage-first restore behavior.
Blocked or protected storage keeps session selection and the existing warning;
no protected or newer slot is overwritten.

## Verification

**All twenty-one suites passed on source and standalone: 42 sequential processes, every exit 0.** The focused tracking suite passes 82 checks per build in Chromium and WebKit. It covers all twelve detail conditions, strict time/mercy boundaries, no provisional awards, carry/retry, pause freeze, pin/clear/reload, original no-pin HUD methods, source-slot read/write isolation, bounded sampling, prompt visibility, actual keyboard/mouse controls, completion-input interception and old/new/protected backups.

Tested code: `4dc727ee4261ffc24dd75b3c36cb7427e1005c0a`. The 71-script aggregate is `19ad614594d8737e3a701865e735c8436fcd493ad31649fbf7111f590ceae2ba`; standalone SHA-256 is `4d3560157c6c21f027825e5255a0a53c3b2f083328d696bc3f348abe7147a08a`. [Machine-readable results](challenge-tracking-results.json) retain every suite exit/final line, focused checks, protected hashes and live metadata.

### Source

| Suite | Exit | Actual final line |
| --- | --- | --- |
| smoke | 0 | Smoke test passed. |
| visual | 0 | All atmosphere checks passed. |
| audio | 0 | All audio checks passed. |
| powers | 0 | All mechanics checks passed. |
| saves | 0 | All save & robustness checks passed. |
| settings | 0 | All settings & accessibility checks passed. |
| ledger | 0 | All ledger & combat-feel checks passed. |
| encounters | 0 | All encounter checks passed. |
| flows | 0 | All story flow checks passed. |
| bonus | 0 | BONUS ACCEPTANCE PASSED: 42 checks (normal file loading). |
| ninth-minute | 0 | NINTH MINUTE PASSED: 75 checks (normal file loading). |
| long-summer | 0 | LONG SUMMER PASSED: 82 checks (normal file loading). |
| vigilantes | 0 | VIGILANTES PASSED: 43 checks (chromium, index.html). |
| after-midnight-cases | 0 | AFTER MIDNIGHT CASES PASSED: 75 checks (chromium, index.html). |
| after-midnight-modes | 0 | AFTER MIDNIGHT MODES PASSED: 45 checks (index.html). |
| after-midnight-integration | 0 | AFTER MIDNIGHT INTEGRATION PASSED: 36 checks (index.html). |
| surveyor-gear | 0 | SURVEYOR GEAR PASSED: 5 checks (index.html). |
| glass-palace | 0 | GLASS PALACE PASSED: 76 checks (chromium, index.html). |
| glass-palace-navigation | 0 | GLASS PALACE NAVIGATION PASSED: 47 checks (index.html). |
| glass-palace-backup | 0 | GLASS PALACE BACKUP PASSED: 46 checks (chromium, index.html). |
| glass-palace-tracking | 0 | GLASS PALACE TRACKING PASSED: 82 checks (chromium, index.html). |

### Standalone

| Suite | Exit | Actual final line |
| --- | --- | --- |
| smoke | 0 | Smoke test passed. |
| visual | 0 | All atmosphere checks passed. |
| audio | 0 | All audio checks passed. |
| powers | 0 | All mechanics checks passed. |
| saves | 0 | All save & robustness checks passed. |
| settings | 0 | All settings & accessibility checks passed. |
| ledger | 0 | All ledger & combat-feel checks passed. |
| encounters | 0 | All encounter checks passed. |
| flows | 0 | All story flow checks passed. |
| bonus | 0 | BONUS ACCEPTANCE PASSED: 42 checks (normal file loading). |
| ninth-minute | 0 | NINTH MINUTE PASSED: 75 checks (normal file loading). |
| long-summer | 0 | LONG SUMMER PASSED: 82 checks (normal file loading). |
| vigilantes | 0 | VIGILANTES PASSED: 43 checks (chromium, dist/dr-manhattan.html). |
| after-midnight-cases | 0 | AFTER MIDNIGHT CASES PASSED: 75 checks (chromium, dist/dr-manhattan.html). |
| after-midnight-modes | 0 | AFTER MIDNIGHT MODES PASSED: 45 checks (dist/dr-manhattan.html). |
| after-midnight-integration | 0 | AFTER MIDNIGHT INTEGRATION PASSED: 36 checks (dist/dr-manhattan.html). |
| surveyor-gear | 0 | SURVEYOR GEAR PASSED: 5 checks (dist/dr-manhattan.html). |
| glass-palace | 0 | GLASS PALACE PASSED: 76 checks (chromium, dist/dr-manhattan.html). |
| glass-palace-navigation | 0 | GLASS PALACE NAVIGATION PASSED: 47 checks (dist/dr-manhattan.html). |
| glass-palace-backup | 0 | GLASS PALACE BACKUP PASSED: 46 checks (chromium, dist/dr-manhattan.html). |
| glass-palace-tracking | 0 | GLASS PALACE TRACKING PASSED: 82 checks (chromium, dist/dr-manhattan.html). |

### Live views

- [Running prologue tracker](screenshots/challenge-tracking/tracking-hud-source-live.png)
- [Actual pause challenge overview](screenshots/challenge-tracking/tracking-pause-panel-source-live.png)
- [Capture provenance](screenshots/challenge-tracking/capture-manifest.json)

Both images use fresh zero-fragment progress, actual title/interlude/pause input and real movement. The running view follows at least ten active wall-clock and world seconds of normal RAF. The second view is the actual paused overview afterward. No actor, camera, health, statistics, flags, clock or renderer was positioned or overridden. Pinning and reading phases preserve the three source slots and settings, with write attempts recorded. Published PNGs match the original raw-canvas hashes.

These captures do not claim a natural completion. The separate focused tests use explicit controlled conditions to test all twelve levels. Natural challenge balance, full natural replays, physical devices and assistive technology remain outside this evidence. Original audio recipes, music, six campaign chapters, engine presentation and the original HUD file remain byte-identical to the prior refinement baseline.

[Independent CI](https://github.com/Ezrolith/Demo/actions/runs/41219463278) is in_progress when last checked. The local results are reported separately. No merge or deployment.

Run `npm run test:palace-refinements` for all twenty-one suites, and pass `dist/dr-manhattan.html` to the underlying wrapper for the downloadable build. `npm run test:palace-tracking` runs the focused suite; `npm run test:palace-tracking-capture` records the two live views.
