# Current review entry point

Review `codex/glass-palace-refinements` in the existing
[draft PR](https://github.com/Ezrolith/Demo/pull/8), targeting
`codex/glass-palace`. No merges, deployments or pushes to
`claude/dr-manhattan-game` are authorized. Preserve the six original campaign
chapter files, original music and engine presentation. Procedural canvas and
WebAudio only.

## Current work

The [Undertow breaker follow-up](UNDERTOW-BREAKER-FIX.md) fixes a marker that
kept pointing to the west breaker after it had already been isolated. It records
fresh regression results separately from the rules-v2 review below.

The current pass responds to the independent review with **optional challenge
rules v2**. The [36-row old/new matrix](CHALLENGE-RULES-V2-MATRIX.md) was committed
before implementation (`ce90d308`). Runtime implementation is `4ab7710`;
subsequent controller/evidence changes are identified in the final report.

Read these in order:

1. [Review response and per-item status](PALACE-REVIEW-RESPONSE.md).
2. [Challenge matrix and evidence rules](CHALLENGE-RULES-V2-MATRIX.md).
3. [Peter's 10–15 minute checklist](PLAYTEST-CHECKLIST.md).
4. [Glass Palace player guide](GLASS-PALACE.md).
5. [After Midnight player guide](AFTER-MIDNIGHT.md).

The palace keeps all earlier fragments as legacy awards and records new awards
under rules v2. It stores run evidence in its own slot; the three original save
formats remain unchanged. Missing clean-run evidence is unknown, not zero.
Actual completion remains the only award point.

## Verification and limits

Run suites sequentially and record real exit codes. Never weaken an assertion,
performance threshold or visual quality to get a pass. The full wrapper now has
22 suites:

```sh
node tools/build.mjs
node tools/verify-palace-refinements.mjs index.html
node tools/verify-palace-refinements.mjs dist/dr-manhattan.html
node tests/glass-palace-reload.mjs
```

The response report records final suite lines/exits, the bounded baseline/source/
standalone performance comparison, exact-original and instrumented reload
controls, and natural-input target results. Distinguish these evidence types:

- Controlled fixtures prove each of 36 goals has a valid completion that misses
  it and one that earns it. They are not natural playthroughs.
- Real-input routes use Normal damage, actual menus/powers/movement and ordinary
  RAF. Initial campaign-unlock fixtures do not prove natural campaign history.
- Failed or interrupted controllers remain failures. Mars's actual completion
  has a controller teardown qualification; Last Broadcast remains unverified.
- The reported reload race did not reproduce locally. Do not call diagnostics
  a demonstrated persistence fix. Check the report for exact environment/results.
- Live captures require at least ten active seconds of normal play, with no
  tester actor/camera placement, health/clock edits or staged rendering.
- Known-route target headroom does not establish unfamiliar-human fairness.
  Physical devices and assistive technology remain unverified; touch is unsupported.

## Historical reports

These describe their own revisions; their older branch, suite-count and CI
snapshots are not current instructions:

- [Tracking implementation and 21-suite baseline](CHALLENGE-TRACKING.md).
- [Atlas/backups and 20-suite baseline](PALACE-REFINEMENTS.md).
- [Glass Palace Part B](GLASS-PALACE-HANDOVER.md).
- [After Midnight Part A review response](AFTER-MIDNIGHT-PART-A.md).
- [After Midnight expansion](AFTER-MIDNIGHT-HANDOVER.md).
- [Earlier gameplay QA](QA-POLISH-HANDOVER.md).
- [Platform QA](PLATFORM-QA-HANDOVER.md).
