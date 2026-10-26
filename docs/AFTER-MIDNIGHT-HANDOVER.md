# After Midnight — technical handover

Optional expansion on `codex/watchmen-stories`, based on reviewed snapshot
`b67f8b6`. Draft review targets `codex/bonus-three`. No merge or deployment.
[Player guide](AFTER-MIDNIGHT.md).

The current [Part A review response](AFTER-MIDNIGHT-PART-A.md) covers the later
performance, visibility, environment, menu and style corrections. Its fresh
verification supersedes the historical counts below. Part B is not started.

## Content and architecture

Three selectable human heroes: Nite Owl, Silk Spectre and Rorschach, each with
six distinct gear actions. Three cases have three checkpoint stages each:
Dead Air, Undertow and The Glass Archive. Night Patrol and Rescue Clock support
the rooftop, harbour and museum themes. App version is 0.2.0.

- `src/game/vigilantes.js`: vulnerable player subclass, gear, nonlethal combat,
  physical traversal, smoke, parry, feint, visor and investigative weakness.
- `src/game/after-midnight.js`: registry, independent save, run configuration,
  checkpoints, score/history and completion.
- `src/game/after-midnight-menu.js`: selection, field manuals, safe restart and
  backup preview/explicit restoration.
- `src/data/after-midnight-atmosphere.js`: additive art, weather, lights,
  ambience and three arrangements using the existing synthesizer.
- `src/data/after-midnight-cases.js`: maps, clues, tuning, winch/physical
  escorts, security circuits, archive and phased Surveyor encounter.
- `src/game/after-midnight-modes.js`: paced waves, gear choices, extraction,
  timed escorts, hazards, records and navigation.

The original registries remain six campaign chapters and three bonus adventures.
Expansion chapters use `am_` IDs in their own registry and `Chapters.byId`.
Play/Save have optional player-factory and progress hooks. HUD, controls, audio
and defeat/retry effects opt into player profile metadata; original actors keep
their existing paths. New heroes use form `vigilante`, not Jon's immune human
form. Original music, graphics data and enemy prototypes are retained.

## Progress invariants

Save key: `dr-manhattan.after-midnight.v1`. Neither existing progress slot is
written. Story checkpoints belong to hero and case. Next Case resumes an
existing matching checkpoint; explicit restart asks first. A downed hero cannot
complete a story or erase its retry point. Human heroes fall and recover with
checkpoint grace rather than atom reassembly.

Live challenges restart with fresh gear, wave and timer. Current completion is
separate from historical success: a timeout after a previous win remains a
timeout while personal bests survive. Rescue progress is awarded only when a
civilian physically reaches safety. Patrol gear choices are capped, one choice
per cleared wave; field kits are once per cleared wave.

Backups use format `dr-manhattan-after-midnight`, version 1. File selection is a
preview; restoration is explicit and writes storage before replacing memory.
Blocked storage retains exportable session progress. The modal owns Escape/Tab
even after disabled controls send focus to the body.

Surveyor stagger handling is boss-local. Actual stun bolts must not suppress
the visible phase warnings, charges and recovery windows. Powered visor aim
assist reads the live focus input because Q runs before F's display update.

## Verification status

### 26 October pre-review follow-up

Corrected Silk Spectre's guard movement penalty. The player calculates movement
before powers refresh their damage/render flags, so `speedMax` now reads live,
eligible guard input. Pressing and releasing F affect movement immediately;
parry timing and damage reduction remain on their existing path.

Five new movement regressions first reproduced the original failure. Actor/gear
checks now total 42 and pass on source and standalone in Chromium and WebKit.
The other four expansion suites also pass again on both builds: 186 checks per
build in Chromium, plus the separate WebKit actor checks. See the
[pre-review check](PRE-REVIEW-CHECK.md) for the final route results and Git state.
The full CI evidence below is the earlier baseline; consult the PR's latest
checks for the new guard-fix revision.

### Full baseline before the guard follow-up

Chromium source and rebuilt standalone acceptance: 37 actor/gear checks,
75 story checks across all nine case/hero combinations, 33 mode checks,
31 selection/save/focus/defeat checks, and five actual-gear boss checks.
Original campaign/adventure/save suites pass after synchronizing an existing
bonus-storage fixture with its real initial checkpoint. Assertions are retained.

Ordinary-input routes use normal damage, actual menus/interludes, real RAF and
read-only navigation telemetry, without placement, tester refills, quest edits
or invulnerability. Source and standalone routes complete all three cases,
Patrol and all four timed rescues. Full routes use Nite Owl for Dead Air,
Silk Spectre for Undertow and Rescue Clock, and Rorschach for The Glass Archive;
the acceptance suites separately exercise all nine hero/case combinations.
Archive specifically measures actual boss melee hits; its driver must earn
three before ranged gear can finish the encounter.

New arrangements were measured with the existing 26-second/50 ms RMS method:
within 0.24 dB of title, without clipped samples. Original arrangements and SFX
are unchanged. The original stochastic-noise peak check can vary between runs;
retain failure and repeat logs instead of lowering its threshold.

On test revision `e6f6b5f`, Chromium, Firefox and WebKit pass the four expansion
suites on source and standalone: 24 invocations. Native Safari passes 251 new
checks and 90 original checks across both builds. All four workflows pass.
The expansion regression completes all 43 commands without a failed exit:
20 source suites, 11 standalone suites and 12 ordinary-input routes. The
independent original regression passes all twelve source suites on their first
attempt, plus its standalone/save checks and full Summer journeys.
At that baseline, playable files matched game commit `2df0c1b`. The later guard
follow-up changes `vigilantes.js` and rebuilds the standalone from source.

[Expansion workflow](https://github.com/Ezrolith/Demo/actions/runs/40244798203),
[original regression](https://github.com/Ezrolith/Demo/actions/runs/40244798197),
[original browser/performance](https://github.com/Ezrolith/Demo/actions/runs/40244798338)
and [original Safari](https://github.com/Ezrolith/Demo/actions/runs/40244798297).
[Machine-readable results](after-midnight-results.json) record the tested
revision, suite counts, build digest, route coverage and measurement limits.

Standalone performance/audio probes pass 36 checks each at baseline High,
4x CPU slowdown High and 4x Low, with the normal governor enabled. Across three
opening scenes, median frame times are approximately 16.7, 33.3 and 16.7 ms
respectively. These are CI measurements, not a minimum-FPS guarantee for later
waves, boss encounters or physical devices.

Checks are defined in `.github/workflows/after-midnight-validation.yml`.
Native checks use managed macOS WebDriver over loopback HTTP, not personal
Safari settings or Finder/direct-file proof.

## Build and test

`node tools/build.mjs` rebuilds the standalone from the 63 scripts in
`index.html`. Never edit the generated HTML separately.

`npm test` retains the original nine suites. Run the three original adventures,
`bonus-portability`, `bonus-storage`, and `bonus-interrogation` as well.
`npm run test:after-midnight` runs the five expansion suites; repeat them with
`dist/dr-manhattan.html` as target.

Normal-input drivers: `play-after-midnight.mjs`,
`play-after-midnight-undertow.mjs`, `play-after-midnight-archive.mjs`,
`play-after-midnight-patrol.mjs`, `play-after-midnight-clock.mjs`.
Also retain the original full Summer route.
`after-midnight-performance.mjs` supports CPU factors 1/4 and High/Low; it reports
effective quality/frame timings without removing atmosphere or imposing 60 fps.

Local evidence is under `tests/out/`; CI artifacts retain logs and screenshots.
Remaining limits: first-time human discovery/pacing, subjective listening,
physical slow devices, assistive technology and native Safari direct-file
opening. Touch gameplay remains unsupported.
