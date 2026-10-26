# After Midnight — Part A review response

Scope: A1–A5 on `codex/watchmen-stories`, updating draft PR #6 into
`codex/bonus-three`. Part B has not been started. No merge or deployment.

A1–A5 and the focused checks are complete with the verification limits recorded
below. All seventeen requested suites pass on both source and rebuilt standalone:
34 sequential child processes, each with exit code zero.

## A1 — campaign cost

The expansion registered eighteen hero abilities in the original global power
list. Jon consequently scanned 25 definitions rather than seven in update,
power-effect rendering and the HUD, plus the conditional input-latch path.
The HUD also allocated a fallback icon function for each original icon per frame.

Optional gear now remains addressable by ID but belongs to each hero's six-item
loadout. Jon retains the seven-item registry and direct original icon path.
No post effect, resolution, lighting, weather or test threshold was reduced.

The reported slower-machine regression was **not reproduced on this Mac**.
Before the correction, the unchanged full visual suite already passed at
8.87 / 8.10 ms per DPR2 frame, post effects on / off. The review supplied
25.2 / 21.8 and 26.0 / 21.6 for the expansion and 20.6 / 18.6 for its baseline;
those are separate measurements, not measurements made in this pass.

Paired runs below use the exact timing function extracted from unchanged
`tests/visual.mjs`, the same Mars stage, DPR2 and three-second live warm-up.
Each page runs sequentially, with branch order alternating. Baseline is
`codex/bonus-three` at `ed65bbf`; the pre-fix expansion snapshot is `c60f5b1`.
All values are post effects on / off, in ms/frame.

| Pair | Before: expansion | Before: baseline | After: expansion | After: baseline |
| --- | --- | --- | --- | --- |
| 1 | 9.25 / 8.45 | 9.28 / 8.40 | 9.16 / 8.32 | 9.37 / 8.51 |
| 2 | 9.35 / 8.50 | 9.30 / 8.44 | 9.17 / 8.31 | 9.83 / 8.95 |
| 3 | 9.32 / 8.41 | 9.68 / 8.75 | 9.43 / 8.63 | 9.78 / 9.01 |

Every after pair passes the unchanged post-effect criterion, and expansion
cost without post effects stays below 105% of its paired baseline. The local
before pairs were also within that bound: removing the identified extra CPU
work does not establish the cause of the externally reported raster-cost delta.

Three consecutive complete, unchanged visual-suite runs then passed:

| Run | DPR1 on / off | DPR2 on / off | Exit |
| --- | --- | --- | --- |
| 1 | 2.51 / 2.29 | 10.12 / 9.15 | 0 |
| 2 | 2.60 / 2.36 | 9.47 / 8.66 | 0 |
| 3 | 2.58 / 2.38 | 9.01 / 8.20 | 0 |

The CI workflow now repeats the paired comparison against the actual PR base
and runs the visual suite three times. The originating slower host remains an
explicit reproduction limit until it is checked there.

## A2 — hero visibility

The existing map-light hook now supplies distinct green Owl spill and a short
forward cone, warm Silk Spectre spill and dim cold Rorschach spill. Post-darkness
costume rims and Owl lenses remain character-local; enemy lighting is untouched.
The hero artwork is 20% larger. Dark outdoor maps use reflected highlights;
bright museum floors use an ink silhouette with the same colored rim.

Live views exposed an additional occlusion bug: both modes put the extraction
terminal directly over the arriving hero. Those terminals now stand 90 world
units west of the arrival point; escort destinations and safe-passage rules
remain the same. Twelve mode checks guard against overlapping terminal artwork.

All 27 final views pass a fixed contrast threshold of 1.8; the minimum is
**1.907**. The metric compares median linear-sRGB luminance in the facing-aligned
hero ellipse against a local floor annulus, excluding other character bodies.
It is computed from the final canvas after ten wall-clock seconds of normal
RAF gameplay. Sample geometry, pixel counts, timings and health are retained.

This is a numerical visibility check. One-second recognition by an unfamiliar
human viewer has not been measured, nor has every later combat/lighting state.

## A3 — environment density and replay layouts

Each theme has 28 additional baked props plus its larger landmarks: aerials,
skylights, puddles and neon; crates, bollards, ropes, crane and bell; display
cases, plinths, barriers, paintings, rugs and light pools. The bare museum
checkerboard is replaced with marble and gallery dressing.

Patrol and Rescue Clock each have two presets that alternate with recorded
attempts. Presets move cover and change actual lamp positions, color and
intensity. Cover art and collision use the same rectangles. Story collision
geometry is preserved, and the arrival footprint stays clear.

The density supplement passes **53 checks** across fifteen story/theme/preset
entries. It checks critical sliding 400px windows at normal zoom against real
prop metadata, excludes floor patterns/noise, verifies requested prop kinds,
cover/art agreement, reachable spawn/escort seeds, actual lamp callback output
and unchanged original save bytes. Live views provide the visual evidence.

## A4 — two-step case board

The first screen has three large portraits and one style line per hero. The
second contains cases and replay modes. Direct UI text is at least 13px.
Mouse and keyboard navigation, Escape/back, field manuals, backup access on
both screens, resume/restart and hero-bound selection remain available.

The integration suite retains the previous assertions and now passes 36 checks,
including the actual two-step navigation. Menu-driven gameplay and native
Safari helpers follow the new screen transition through real controls.

## A5 — code style

The six requested files had **89 lines over 140 characters**; they now have
zero, with a maximum line length of 116. Sibling statements occupy separate
lines. Formatting was checked against normalized Babel ASTs, with constant
string concatenations folded for comparison; the formatting step is equivalent.

## Final suite results

<!-- PART_A_SUITE_TABLES -->
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
<!-- END_PART_A_SUITE_TABLES -->

Additional ordinary-input checks pass for all five source routes and standalone
Patrol, including real field supplies, upgrades and extraction. The Archive route
measures seven actual boss melee hits; Rescue Clock brings four civilians to
safety with positive time remaining. Each of these six processes exits zero.

[Machine-readable results](after-midnight-part-a-results.json) retain the source
and standalone digests, all suite outcomes, route summaries and protected-file
hashes.

## Live evidence

All gameplay captures start an actual stage, dismiss its opening through real
keyboard input, then run at least ten wall-clock seconds with normal damage.
There are no actor placements, health edits, camera edits, quest edits, clock
steps or invulnerability. Before views use `c60f5b1`; after views include all
three heroes in every case and every replay location.

The published WebP copies are lossless, with decoded pixels verified against
the raw PNGs. They preserve the captured frame; they are not staged renders.
Menu captures are labeled as live UI, rather than gameplay.

<!-- PART_A_CAPTURE_LINKS -->
| Case / mode location | Before | After: Owl | After: Silk | After: Rorschach |
| --- | --- | --- | --- | --- |
| dead-air | [Nite Owl](screenshots/after-midnight-part-a/before/dead-air-niteowl-before-live.webp) | [Nite Owl](screenshots/after-midnight-part-a/after/dead-air-niteowl-after-live.webp) | [Silk Spectre](screenshots/after-midnight-part-a/after/dead-air-silkspectre-after-live.webp) | [Rorschach](screenshots/after-midnight-part-a/after/dead-air-rorschach-after-live.webp) |
| undertow | [Silk Spectre](screenshots/after-midnight-part-a/before/undertow-silkspectre-before-live.webp) | [Nite Owl](screenshots/after-midnight-part-a/after/undertow-niteowl-after-live.webp) | [Silk Spectre](screenshots/after-midnight-part-a/after/undertow-silkspectre-after-live.webp) | [Rorschach](screenshots/after-midnight-part-a/after/undertow-rorschach-after-live.webp) |
| glass-archive | [Rorschach](screenshots/after-midnight-part-a/before/glass-archive-rorschach-before-live.webp) | [Nite Owl](screenshots/after-midnight-part-a/after/glass-archive-niteowl-after-live.webp) | [Silk Spectre](screenshots/after-midnight-part-a/after/glass-archive-silkspectre-after-live.webp) | [Rorschach](screenshots/after-midnight-part-a/after/glass-archive-rorschach-after-live.webp) |
| patrol-rooftops | [Nite Owl](screenshots/after-midnight-part-a/before/patrol-rooftops-niteowl-before-live.webp) | [Nite Owl](screenshots/after-midnight-part-a/after/patrol-rooftops-niteowl-after-live.webp) | [Silk Spectre](screenshots/after-midnight-part-a/after/patrol-rooftops-silkspectre-after-live.webp) | [Rorschach](screenshots/after-midnight-part-a/after/patrol-rooftops-rorschach-after-live.webp) |
| patrol-harbour | [Silk Spectre](screenshots/after-midnight-part-a/before/patrol-harbour-silkspectre-before-live.webp) | [Nite Owl](screenshots/after-midnight-part-a/after/patrol-harbour-niteowl-after-live.webp) | [Silk Spectre](screenshots/after-midnight-part-a/after/patrol-harbour-silkspectre-after-live.webp) | [Rorschach](screenshots/after-midnight-part-a/after/patrol-harbour-rorschach-after-live.webp) |
| patrol-museum | [Rorschach](screenshots/after-midnight-part-a/before/patrol-museum-rorschach-before-live.webp) | [Nite Owl](screenshots/after-midnight-part-a/after/patrol-museum-niteowl-after-live.webp) | [Silk Spectre](screenshots/after-midnight-part-a/after/patrol-museum-silkspectre-after-live.webp) | [Rorschach](screenshots/after-midnight-part-a/after/patrol-museum-rorschach-after-live.webp) |
| rescue-rooftops | [Rorschach](screenshots/after-midnight-part-a/before/rescue-rooftops-rorschach-before-live.webp) | [Nite Owl](screenshots/after-midnight-part-a/after/rescue-rooftops-niteowl-after-live.webp) | [Silk Spectre](screenshots/after-midnight-part-a/after/rescue-rooftops-silkspectre-after-live.webp) | [Rorschach](screenshots/after-midnight-part-a/after/rescue-rooftops-rorschach-after-live.webp) |
| rescue-harbour | [Nite Owl](screenshots/after-midnight-part-a/before/rescue-harbour-niteowl-before-live.webp) | [Nite Owl](screenshots/after-midnight-part-a/after/rescue-harbour-niteowl-after-live.webp) | [Silk Spectre](screenshots/after-midnight-part-a/after/rescue-harbour-silkspectre-after-live.webp) | [Rorschach](screenshots/after-midnight-part-a/after/rescue-harbour-rorschach-after-live.webp) |
| rescue-museum | [Silk Spectre](screenshots/after-midnight-part-a/before/rescue-museum-silkspectre-before-live.webp) | [Nite Owl](screenshots/after-midnight-part-a/after/rescue-museum-niteowl-after-live.webp) | [Silk Spectre](screenshots/after-midnight-part-a/after/rescue-museum-silkspectre-after-live.webp) | [Rorschach](screenshots/after-midnight-part-a/after/rescue-museum-rorschach-after-live.webp) |

[Old combined board](screenshots/after-midnight-part-a/menu/combined-board-before-live.webp) · [New hero screen](screenshots/after-midnight-part-a/menu/hero-screen-after-live.webp) · [New case/mode screen](screenshots/after-midnight-part-a/menu/case-screen-after-live.webp).

[Pixel integrity](screenshots/after-midnight-part-a/pixel-integrity.json), [before metadata](screenshots/after-midnight-part-a/before/capture-before.json) and [after metadata](screenshots/after-midnight-part-a/after/capture-after.json).

The 39 images comprise 36 live gameplay views and three live UI views. Raw PNGs
and original manifests are retained locally under `tests/out/part-a/raw-captures/`.
<!-- END_PART_A_CAPTURE_LINKS -->

## Limits and next step

The originating performance failure and unfamiliar-viewer recognition time
remain unverified on their original terms. Guided captures and scripted suites
do not replace first-time human discovery, exhaustive later-wave balance,
subjective listening, physical-device or assistive-technology checks. Native
Safari direct-file opening is not established by the loopback WebDriver probes.
Touch gameplay remains unsupported.

The six campaign chapter files, original music and original engine presentation
files remain unchanged. Continue from this Part A report only after the requested
stop; The Glass Palace branch and Part B have not been created.
