# QA continuation — 25 October 2026

**Branch:** `codex/gameplay-qa-polish`, from `codex/bonus-three` at
`ed65bbfb0416f08e5aa507bf221bdcc7ca413dff`. Draft PR targets `codex/bonus-three`.
No merge or deployment. Original campaign, graphics, lighting, music and Claude
branches are unchanged. `dist/dr-manhattan.html` is generated from source.

## Reviewed and changed

Read README, HANDOVER, BONUS, GAMEPLAY-AUDIT-FOLLOWUP, PLATFORM-QA-HANDOVER,
HUMAN-PLAYTEST, the four existing draft PRs and relevant source/tests. PR #4 has
no discussion comments. Older branch/integration instructions are historical;
the later platform handover supersedes earlier unverified-browser statements.

Two independently reproduced player problems were fixed:

- **Silent bonus-save failure.** A bonus-only quota/storage exception left an
  apparent Resume checkpoint in memory with nothing on disk and no warning.
  Failed reads/writes now set an accurate availability status. A write failure
  displays one in-game warning per outage, and Bonus Levels permanently reminds
  the player to export before closing. In-memory progress remains exportable.
  A successful write or restore clears the warning; failed restores retain data.
  Campaign progress/settings are isolated. Source: `bonus.js`,
  `bonus-portability.js`; regression: `tests/bonus-storage.mjs`.
- **Repeated Rorschach interrogation.** Requesting guard A, then B before
  Rorschach arrived, left A pending. After B's interrogation, approaching A
  replayed the dialogue and reset the dispatch marker. Retargeting now cancels
  the old request; only the active, unfinished request can complete. Source:
  `last-broadcast.js`; regression: `tests/bonus-interrogation.mjs`.

All three read-only workflows now accept PRs into `codex/bonus-three` and test
updates via `synchronize`. Browser/Safari concurrency is scoped per PR. The
regression workflow retains the original twelve suites and adds the focused
checks on source and standalone, plus full real-input Summer journeys on both.

## Gameplay and verification

The existing real-RAF runner now supports `--complete`: after the six-resident
rescue, it reloads and resumes the actual truck checkpoint, fights the moving
truck with Q aimed at machinery, restrains the Comedian, uses E to rescue the
driver and verifies the Mercy ending. Normal damage stays enabled. After the
initial scene/settings setup it uses no actor relocation, state edits,
health/energy refills, invulnerability or stage skips. Read-only position
telemetry guides this known route; this is not first-time human play.

Initial full source route: **18 checks passed, minimum coherence 66**, six
residents rescued, driver spared, zero human deaths. Focused source tests:
storage **14/14**, interrogation **7/7**, zero page errors. Before the fixes,
storage fault injection produced no warning; the interrogation regression
reproduced two dialogues/two marker updates and exited 1. Final sequential
regression and fresh hosted browser/Safari results will be recorded here when
complete; do not treat their dispatch as success.

Artifacts are under `tests/out/qa-polish/`, `tests/out/bonus-storage/`,
`tests/out/bonus-interrogation/` and `tests/out/audit-followup/<engine>/<build>/`.
Source and standalone full-journey evidence now have separate directories.
Screenshots of the new warning and interrogation outcome were inspected.

Rebuild using `node tools/build.mjs`. Run `npm test` (original nine), then the
three adventure suites, `bonus-portability`, `bonus-storage` and
`bonus-interrogation`. Run those six bonus/focused suites against
`dist/dr-manhattan.html` too. Finally run
`node tests/play-audit-followup.mjs index.html --complete` and the same with
`dist/dr-manhattan.html`. Keep actual exits/logs; do not weaken assertions.

## Performance and remaining work

The first local full-regression attempt exposed an inherited sequencing race in
`tests/saves.mjs`: its "yard ready" predicate could pass during the frame between
instant map construction and the start of the briefing/guard spawn. It attacked
an empty encounter, then timed out waiting for the warehouse. Readiness now
requires four actual live guards, no dialogue/context lock and an unlocked
player. The four-kill Retry/Continue assertions and their tolerances are
unchanged. No campaign source changed. The initial failure log is retained in
`tests/out/qa-polish/saves.log`; the corrected suite is rerun separately.

Reviewed the existing three-engine, native Safari and 4x CPU-throttle evidence.
The measured slow-CPU High/Low gap remains a limitation. No render quality,
lighting, rain, fire, musical or ambience reduction was introduced. A repeated
static-puddle scan was investigated, but its measured cost was modest
(approximately 0.029 ms per puddle/frame on this Mac); it was left alone.
The suspected Summer Pause-objective overflow was also ruled out by screenshot
and canvas measurement: approximately 601 px of text fits its 656 px content
width, including with web-font requests blocked.

Still needed: an unbiased first-time human playthrough; subjective listening at
fixed volume; real slow-device/long-session testing; native Safari direct-file
opening; assistive-technology review. Touch gameplay remains unsupported. The
controlled bonus suites use setup shortcuts; passing them does not establish
every story's natural difficulty or certify that the game has no other bugs.
