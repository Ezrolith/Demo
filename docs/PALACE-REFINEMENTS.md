# A clearer path through The Glass Palace

The current follow-up adds [challenge tracking during play](CHALLENGE-TRACKING.md)
to this same draft PR. The atlas/backup evidence below records the preceding
twenty-suite baseline; the tracking report records fresh checks for the new code.

This follow-up starts from finished Part B on `codex/glass-palace`.
The original six campaign files, original music and engine presentation remain
protected. No merge or deployment is part of this work.

## Implemented

**Moment atlas and walking guide.** H, the visible atlas button and the palace
pause menu open an overview. It shows only unlocked moment names, their earned
fragments and whether a checkpoint is available. Missing-fragment and checkpoint
filters help choose a next replay. Selecting a destination draws a collision-aware
walking trail and an edge pointer. Jon remains under the player's control;
arriving does not start a level. The ledger and unlocked Earth scene have routes
too. Selection is session-local and does not change any save slot.

**Palace progress backups.** The pause menu offers a palace-only JSON export and
restore. Choosing a file previews its fragment and reflection counts; an explicit
Restore action replaces only palace progress. Browser storage is committed before
session data is replaced. Invalid, oversized, incompatible or protected saves
cannot overwrite current progress. Campaign, bonus, After Midnight and settings
remain outside this backup. Session progress can still be exported when saving
is blocked. Closing the modal refreshes the palace structure.

## Recommended next enhancements

| Priority | Enhancement | What it adds | Bounded first version |
| --- | --- | --- | --- |
| Implemented follow-up | Challenge tracking | Keep the chosen objective understandable during a replay | One pinned challenge, provisional progress and a clear completion breakdown |
| 2 | Natural challenge balance | Establish how the targets feel in actual play | Twelve normal-input completions recording time, deaths and missed objectives |
| 3 | Branching detective case | Let the player interpret evidence and choose a conclusion | One district, three hypotheses, two evidence-supported resolutions |
| 4 | Paired-hero mission | Make complementary equipment matter | Two selected heroes, simple companion instructions, two cooperative obstacles |
| 5 | Neighbourhood aftermath | Show consequences beyond a score | One revisitable street with three authored outcome states |

The existing game already has rescues, looping time, City Heat, waves, equipment
upgrades, twelve replay moments and thirty-six challenges. Another badge economy
or another wave mode would add less than these changes. Rebinding and gamepad
support remain a separate, broader input project under the current engine rules.

## Verification

All twenty suites have a passing final result on source and standalone, run one at a time with real exit codes. **The initial source run was 19/20:** the original randomized whoosh measured −20.3 dBFS against the unchanged −20 dBFS limit. One unchanged full audio recheck passed at −18.5 dBFS. The first failure remains in the machine-readable results; this is not a claim of an entirely clean first run. The sound, music and audio test were not changed. An older preserved run also failed this measurement at −20.9 dBFS.

The new navigation suite passes 47 checks and backup suite 46 checks on both builds in Chromium and WebKit. Navigation independently samples all fourteen routes at the player collision radius and follows one route with real WASD and E. The backup checks include actual downloads, file preview/confirmation, failed transactions and stale-read/focus cleanup.

Tested code: `6f21f6cce865b59dfa2451663ab8ba0f94a7a44d`. Source aggregate: `71c7722cd27e64104e7759a820fbb974687173349db96b60d19afa842ea7a66a`. Standalone SHA-256: `facbe13aa9a266996c9c171715721860d3a3da6499f83da9635cc3bfe1d69f90`. [Machine-readable evidence](palace-refinements-results.json). Documentation and live views are a later follow-up with identical runtime files.

A first WebKit standalone navigation attempt raced the title click-to-begin gate. The new test now waits for the actual ready state; both builds pass the revised navigation test in Chromium and WebKit. The earlier timeout is retained in the results. Runtime files are unchanged.

### Source — final attempts

| Suite | Exit | Actual final line |
| --- | --- | --- |
| smoke | 0 | Smoke test passed. |
| visual | 0 | All atmosphere checks passed. |
| audio | 0 (recheck; initial 1) | All audio checks passed. |
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

### Live views

- [Moment atlas](screenshots/palace-refinements/atlas-fresh-live.png)
- [Selected walking guide](screenshots/palace-refinements/guide-fresh-live.png)
- [Capture provenance](screenshots/palace-refinements/capture-source.json)

Both views use fresh, zero-fragment progress after ten seconds of ordinary hub frames and actual menu input. They use no actor/camera placement, synthetic clock, invulnerability or renderer staging. Full-unlock fixtures in the separate navigation tests are explicitly controlled; they are not natural playthrough evidence.

### Remaining limits

The initial audio failure remains a known intermittent check. First-time human wayfinding, natural challenge-time balance, physical devices and assistive technology still need hands-on review. Touch remains unsupported. The original six campaign files, original music and engine presentation match the finished Part B baseline byte for byte.

[Independent validation](https://github.com/Ezrolith/Demo/actions/runs/41216601719): pending when last checked. Earlier Part B validation passed separately; it does not replace this run. No merge or deployment.
