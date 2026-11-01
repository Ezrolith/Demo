# The Glass Palace — Part B handover

Branch: `codex/glass-palace`, from finished Part A `c206ae6` on
`codex/watchmen-stories`. [Draft PR #7](https://github.com/Ezrolith/Demo/pull/7) targets `codex/watchmen-stories`.
No merge, deployment or protected Claude-branch changes.

[Player guide](GLASS-PALACE.md). Part A's four independent workflows passed
before this branch was created; those results do not stand in for this branch's
new verification.

## B1 — hub and moments

The title retains its existing actions and adds The Glass Palace immediately
after New Game. The longer Continue menu uses a small spacing adjustment to keep
its last action above the footer; the hub acceptance suite tests that layout.

`glass-palace-scene.js` supplies a walkable, combat-free Mars hall, twelve moment
positions, the ledger slab and an Earth terminal. Visible panes follow normal
unlock rules. Play and Resume delegate to normal level entry; Challenges opens
a read-only list. The After Midnight hero is named before launching.

Campaign checkpoint metadata normalizes a deep copy through the existing pure
save sanitizer. This preserves supported numeric-string carry stats during
Resume, without loading or rewriting the source slot.

Vignettes instantiate the level's actual map builder in isolated preview
contexts. No stage generator, checkpoint, challenge configuration or source-save
write is run. Cosmetic clocks advance and one small preview is refreshed per
150 ms, rather than rendering twelve full worlds every frame. Contexts are
disposed on exit or rebuild. Hub status and ledger snapshots are cached outside
render loops and refreshed on entry/resume.

The real-input tour visits all twelve pane approaches, enters their own menus,
reads challenges and returns without actor placements, clock stepping, combat
or source-save writes. Its unlock setup is explicitly a validation save.

## B2 — combined ledger

`glass-palace-progress.js` reads campaign totals once, bonus completion stats
and After Midnight's retained per-slot record stats. It never adds campaign
completed records to campaign totals a second time. The UI explicitly explains
the mixed retention semantics; unavailable historical attempts are not invented.

Four original reflection tiers are unwritten, mercy, balance and detached.
All existing save formats and keys remain intact. Source reads use raw snapshots
or available session data without invoking a source loader or writer.

## B3 — challenges and structure

Twelve canonical moments each define three challenges as data: no human unmade,
a positive finishing time below the level target, and a real level-specific
condition. Detail predicates were checked against original chapter state fields.
Replays can earn missing challenges; an earned challenge cannot add another
fragment. Historical completions do not auto-grant challenges.

The new key is `dr-manhattan.glass-palace.v1`, version 1. It contains only palace
challenges, epilogue variants seen and palace-local metadata. Blocked storage
keeps session progress and displays a warning. Corrupt and newer palace saves
are protected against overwrites. Source slots remain read-only in the hub.

Narrow hooks after the three existing completion paths observe the actual
completion context and reject failed/downed/mode/fake-context completions.
Only the new slot is written by that observer. A small instance-specific result
decoration shows `2 / 3 MOMENTS`; there is no global gameplay-render wrapper.

The count drives actual structure pieces and the existing Mars Palace object's
rise/slots. Hub reconstruction responds to changed fragment counts, unlocks,
hero selection and epilogue availability when the hub resumes.

## B4 — epilogue

The gate requires all six campaign completions and all three bonus completions.
It does not require After Midnight or all fragments. Nine missing-record cases
are tested separately.

`glass-palace-epilogue.js` extends the existing Ending scene and uses its
narration renderer plus the existing Dialog class. Six timed segments total
ninety seconds at normal reading pace; the reading-time setting scales them.
Three original stories select return, observe or depart from the combined
ledger. Escape returns early without marking a completed epilogue. Finished
playback records the variant actually watched in the new slot only.

## B5 — sound

`glass-palace-atmosphere.js` adds a thin wind, glass-like resonance and distant
clock bed, plus a separate calm arrangement. Original music data is unchanged.
The audio director recognizes the hub as a quiet live scene, retaining ambience
through its overlays without writing settings.

The existing 26-second / loudest-50-ms measurement produced:

| Sample | RMS50 dBFS | Peak amplitude |
| --- | --- | --- |
| Title, full intensity | -24.086 | 0.1281 |
| Palace, full test intensity | -25.067 | 0.1362 |
| Palace, calm runtime intensity | -26.866 | 0.1179 |

The new arrangement fits the existing loudness band and is quieter at the hub's
calm intensity. No original track, SFX threshold, lighting or ambient setting
was reduced to manufacture a pass.

## B6 — verification

The focused acceptance suite now has 76 checks, including the Continue-menu fit
regression, an actual-map check of Karnak's four emitters and legacy Resume carry
normalization. It covers real completion methods, unlocks, source-slot byte/write
isolation, ledger aggregation, fragments and structure, epilogue gates/variants,
timing, reload and blocked/corrupt/future storage. Controlled completion fixtures
are distinguished from natural gameplay.

<!-- GLASS_PALACE_SUITE_TABLES -->
All eighteen suites passed on source and standalone: 36 sequential processes,
every exit zero. The new hub suite passes 76 checks per build. Additional WebKit
hub runs pass 76 per build, and the actual keyboard tours pass 56 per build.

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

[Machine-readable results](glass-palace-results.json) pin the tested code revision,
source/build digests, suite outcomes, tours and protected-file hashes.
The [independent CI run](https://github.com/Ezrolith/Demo/actions/runs/40532192903)
has now passed, including both builds, the other browser engines and the walking
tour. This result is for the finished Part B code, before the later palace
navigation and backup follow-up.
<!-- END_GLASS_PALACE_SUITE_TABLES -->

## Live views and limits

<!-- GLASS_PALACE_CAPTURE_LINKS -->
| Fragments | Live view | Progress provenance |
| --- | --- | --- |
| 0 | [View](screenshots/glass-palace/palace-0-fragments-source-live.webp) | Fresh progress |
| 18 | [View](screenshots/glass-palace/palace-18-fragments-source-live.webp) | Controlled completion-fixture save |
| 36 | [View](screenshots/glass-palace/palace-36-fragments-source-live.webp) | Controlled completion-fixture save |

[Capture metadata](screenshots/glass-palace/capture-source.json) and
[pixel integrity](screenshots/glass-palace/pixel-integrity.json). Published WebPs
are lossless and decode to the exact original PNG pixels. Original PNGs and
manifests remain locally under `tests/out/glass-palace/raw-captures/`.
<!-- END_GLASS_PALACE_CAPTURE_LINKS -->

The zero-fragment view is fresh. Half/full progress was prepared through actual
completion methods with explicitly controlled stats and level flags, not by
editing fragment totals or drawing a showcase scene. Each running hub then uses
real W movement followed by ten seconds of ordinary RAF before raw canvas
capture. Source-slot bytes and write attempts are checked during that live phase.

**These are live views from validation saves, not evidence of naturally earning
all thirty-six challenges.** A full natural replay of all twelve levels and
challenge-time balance have not been established. The setup is disclosed in
the capture manifest so these images are not mistaken for natural playthroughs.

The six original campaign files, original music and original engine presentation
files remain protected. No map art, music or ending writing is replaced. Physical
device behavior, subjective listening and assistive-technology review remain
outside the automated evidence. Touch gameplay remains unsupported.

## Reproduction

`node tools/build.mjs` rebuilds the standalone from 68 scripts. Never edit it
separately. `node tools/verify-glass-palace.mjs` runs the requested seventeen suites
plus `glass-palace`, sequentially, retaining every real exit and final line.
Pass `dist/dr-manhattan.html` to repeat all eighteen against the standalone.

`tests/glass-palace.mjs` accepts `QA_BROWSER=chromium|firefox|webkit`.
`tests/play-glass-palace.mjs` is the real-input pane tour.
`tests/capture-glass-palace.mjs` produces the explicitly labeled validation-save
live views. It must not be described as a full natural challenge playthrough.
The new read-only CI workflow targets draft PRs into `codex/watchmen-stories`.
