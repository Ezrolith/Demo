# Palace review response — verification and optional challenge rules

Current branch: `codex/glass-palace-refinements`. The existing draft PR targets
`codex/glass-palace`; no merge, deployment or protected Claude-branch update.

The [complete old/new matrix](CHALLENGE-RULES-V2-MATRIX.md) was published in
matrix-only commit `ce90d308ecf7532a7b9388c2777659bc7717725a` before challenge
implementation. The six campaign files, original music and engine presentation
remain unchanged. New field notes use the existing procedural drawing style.

## Item status

| Item | Current status | Evidence or remaining work |
| --- | --- | --- |
| 1a Reload instrumentation | DONE | Accepted pin, persisted bytes, fresh document and loaded state are checked without a delay. |
| 1a Actual reported race | PARTIAL | It has not reproduced here; no underlying race fix is claimed. |
| 1a Ten runs per final build | PENDING | Initial instrumentation and exact original controls both passed 10/10 per build; repeat on the final v2 build. |
| 1b Bounded performance investigation | DONE | Matched baseline/current source/current standalone probes and unchanged original visual suites; no optimization justified. |
| 2 Matrix before code | DONE | All 36 rows committed first and included in the PR. |
| 2 Rules-v2 implementation | DONE | Optional observations/restrictions, combat-end evidence and new optional field notes. |
| 2 Miss/earn and migration tests | DONE | Focused source optionality suite passes 143 checks, including 72 completed-story boundary cases. |
| 3 Real-input time sanity | IN PROGRESS | Known-route automation on Normal; incomplete controller attempts remain explicit. |
| 3 Full source/standalone suites | PENDING | Twenty-two suites per build, sequential, with real exit codes. |
| 3 Natural live captures | IN PROGRESS | Captures are taken only after ten active seconds in real-input runs. |
| 3 Peter's checklist | DONE | [10–15 minute human checklist](PLAYTEST-CHECKLIST.md). |
| 4 Tracking method refactor | NOT DONE | Optional last item; existing instance wrappers remain. |
| 4 Current review entry point | PENDING | Rewrite after the final evidence is recorded. |

## Verification time box

Verification work was bounded before the main implementation. Chromium
151.0.7922.34 ran the full instrumented tracking suite ten times per build, all
twenty exits zero. The exact original test was also run ten times per build in
an isolated unchanged revision, again all twenty exits zero. The stronger
instrumentation therefore cannot be presented as a demonstrated fix.

The test now verifies that the pin was accepted and stored before reload, then
compares exact stored bytes, a fresh-document nonce and the API-loaded pin.
Failures retain raw slot bytes, cached data, storage flags, writes and registry
identities. There is no extra delay intended to hide a race. The reviewer's
original failure state and browser/environment differences remain unestablished.

### High-DPI post effects

The matched diagnostic matrix ran three rotated trials for each build at DPR 2.
Every case stayed below 12% overhead, without changing graphics or thresholds:

| Diagnostic case | Three overhead measurements |
| --- | --- |
| Bonus baseline | 8.95%, 8.29%, 10.65% |
| Current source | 10.29%, 10.63%, 9.64% |
| Current standalone | 9.74%, 9.06%, 9.82% |

The unchanged original visual suite then passed on all three builds:

| Original visual suite | DPR2 effects / none (ms/frame) | Overhead | Exit |
| --- | --- | --- | --- |
| Current source | 7.74 / 7.00 | 10.57% | 0 |
| Current standalone | 7.93 / 7.21 | 9.99% | 0 |
| `codex/bonus-three` (`ed65bbf`) | 8.20 / 7.43 | 10.36% | 0 |

These measurements belong to the pre-redesign verification snapshot `39e3b23`.
The post-effect implementation, engine, world renderer and original visual test
are byte-identical to the bonus baseline. Diagnostic scenes had matching entity,
particle and cache-build counts, with no active pin. The benchmark includes
rendering and synchronous pixel readback; the controlled probe separates those
costs. These results do not reproduce or dismiss the reviewer's 15.4–18% result.
No production graphics optimization, visual-quality reduction or threshold change
was warranted, and the investigation stopped.

## Rule and save behavior

There are still 36 stable fragment slots. The palace save uses version 2 and
records the award's rules version. Every prior earned bit is retained as a
legacy award, never re-awarded or silently relabelled as new proof. Old backups
load through migration; the three original progression formats are unchanged.

Fresh run observations live only in the palace slot. Accepted damage, failed
Retry portions, lethal outcomes, vortex losses and forbidden casts are retained
across Retry. Matching rules-v2 checkpoints restore this evidence using a
canonical owner-normalized carry signature, including stage-zero checkpoints.
Old or mismatched Resume data is unknown for clean-run restrictions, not zero.

Speed goals keep the game's existing field-clock/checkpoint semantics: Pause
stops time; Retry restores the original checkpoint clock and discards time from
the failed portion. Fresh-run evidence or a matching v2 checkpoint is required.
The no-retry real-input sanity runs are reported separately from controlled tests.

Chapter III coherence is captured on actual Behemoth defeat, before the safe
outro. Forbidden Disintegrate casts are recorded at accepted cast start so that
the killing cast counts. Actual accepted post-guard health loss is counted;
healing cannot erase it. The emitter damage segment freezes when its last emitter
falls. Positive optional interactions and field notes have their own observations.

## Validation and remaining human work

Final suite lines/exits, final reload repeats, real-input target times, captures,
digests and any incomplete route will be recorded here before handover. Boundary
fixtures are not natural gameplay evidence. The human checklist samples target
fairness, discoverability and the Long Summer opening; known-route automation
does not replace an unfamiliar player's experience.
