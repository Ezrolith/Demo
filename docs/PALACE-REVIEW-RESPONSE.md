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
| 1a Ten runs per final build | DONE | Final v2 tracking suite passed 10/10 source and 10/10 standalone, all exits 0, 86 checks per run. |
| 1b Bounded performance investigation | DONE | Matched baseline/current source/current standalone probes and unchanged original visual suites; no optimization justified. |
| 2 Matrix before code | DONE | All 36 rows committed first and included in the PR. |
| 2 Rules-v2 implementation | DONE | Optional observations/restrictions, combat-end evidence and new optional field notes. |
| 2 Miss/earn and migration tests | DONE | Source and standalone optionality suites pass 143 checks each, including 72 completed-story boundary cases per build. |
| 2 Normal feasibility evidence | PARTIAL | Optional predicates and routes are grounded in real mechanics, but controlled boundaries do not prove every goal's human difficulty; Last Broadcast's time remains unverified. |
| 3 Real-input time sanity | PARTIAL | 11/12 actual Normal completions with at least 25% headroom; Last Broadcast remains unverified. Mars has a post-completion controller error. |
| 3 Full source/standalone suites | DONE | Twenty-two suites per build, all 44 sequential exits 0; independent CI also passed. |
| 3 Natural live captures | DONE | Nine byte-identical raw captures after ten active seconds; opening captures were not recorded and are explicitly missing. |
| 3 Peter's checklist | DONE | [10–15 minute human checklist](PLAYTEST-CHECKLIST.md). |
| 4 Tracking method refactor | NOT DONE | Optional last item; existing instance wrappers remain. |
| 4 Current review entry point | DONE | One current entry page links this report and historical reports. |

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

Final suite lines/exits, reload repeats, real-input target times, captures,
digests and incomplete routes are recorded below and in the linked evidence.
Boundary fixtures are not natural gameplay evidence. The human checklist samples
target fairness, discoverability and the Long Summer opening; known-route
automation does not replace an unfamiliar player's experience.

## Public review evidence

- [Natural completion and target summary](palace-natural-play-results.json), with
  exact raw attempt reports under `palace-natural-play-attempts/`.
- [Natural capture manifest](screenshots/palace-rules-v2/natural/capture-manifest.json),
  including missing/qualified captures and unchanged image hashes.
- [Reload/performance evidence manifest](evidence/palace-rules-v2/verification/manifest.json)
  and [evidence guide](evidence/palace-rules-v2/verification/README.md).

The originally requested race fix remains partial: neither the exact original
suite nor the instrumented version reproduced the reported failure here. Stronger
preconditions and diagnostics are delivered, but an arbitrary wait or a claimed
fix would misrepresent the evidence. Last Broadcast's target also remains partial:
its scripted Normal attempts reached the Carrier and suffered actual defeats.
They establish no target-reachability result. The human checklist prioritises
this remaining timing/combat check.


## Final validation

Tested runtime revision: `4ab771004135300ca2014b086aa2250d1b829506`. Source aggregate: `9fd4fc95b30891912cc1391d1097ef7168fa9921a039829ed2b26f220c99e38d`; standalone SHA-256: `3a2c291531576f5abda7aa1f70f64fa9502827da4fa3285199ba47b5c24854e4`.

[Machine-readable evidence](palace-rules-v2-results.json) records every result, retained qualification and protected-file hash.

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
| glass-palace-tracking | 0 | GLASS PALACE TRACKING PASSED: 86 checks (chromium, index.html). |
| glass-palace-optionality | 0 | GLASS PALACE OPTIONALITY PASSED: 143 checks; 36 misses + 36 earns (chromium, index.html). |

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
| glass-palace-tracking | 0 | GLASS PALACE TRACKING PASSED: 86 checks (chromium, dist/dr-manhattan.html). |
| glass-palace-optionality | 0 | GLASS PALACE OPTIONALITY PASSED: 143 checks; 36 misses + 36 earns (chromium, dist/dr-manhattan.html). |

### Real-input target sanity

| Moment | Completion / target (seconds) | Headroom | Controller qualification |
| --- | --- | --- | --- |
| prologue | 107.57 / 480 | 77.59% | Clean input controller |
| reassembly | 192.92 / 360 | 46.41% | Clean input controller |
| superman | 157.06 / 480 | 67.28% | Clean input controller |
| deterrent | 106.23 / 540 | 80.33% | Clean input controller |
| mars | 320.88 / 600 | 46.52% | Actual completion observed; controller teardown error |
| karnak | 67.85 / 600 | 88.69% | Clean input controller |
| last_broadcast | NOT VERIFIED | — | Normal defeat; target unverified (see raw attempts) |
| ninth_minute | 144.83 / 720 | 79.88% | Clean input controller |
| long_summer | 112.42 / 720 | 84.39% | Clean input controller |
| am_dead_air | 58.48 / 480 | 87.82% | Clean input controller |
| am_undertow | 68.53 / 600 | 88.58% | Clean input controller |
| am_glass_archive | 55.46 / 480 | 88.45% | Clean input controller |

Every successful route used Normal damage, real menus/movement/powers and ordinary RAF. Only initial eligibility/settings fixtures were prepared before boot. No tester actor, health, statistics, flag or clock edits were used. The raw attempts preserve genuine defeats, controller errors and interruptions; they are not converted into clean suite passes.

The 10–15 minute [human checklist](PLAYTEST-CHECKLIST.md) remains necessary for first-time discovery, reasonable time pressure and the Long Summer opening. The large known-route headroom is not a claim of optimal challenge tuning.

Independent CI: [completed](https://github.com/Ezrolith/Demo/actions/runs/41247111731) when last checked. Local and CI evidence are separate.
