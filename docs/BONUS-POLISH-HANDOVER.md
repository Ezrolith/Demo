# Part A polish — review and handover

## 1. Branch, implementation checkpoint and PR

- Branch: `codex/bonus-polish`, based on `chatgpt/bonus-adventures` at `5f64f6dd98bb649d15f435e136a816deb96157c3`.
- Draft PR: https://github.com/Ezrolith/Demo/pull/3 (base is the bonus branch, NOT the original game).
- Gameplay/build tested commit: `9a03c688738462e1133a824940924d4239d99097`.
- Documentation/evidence cleanup checkpoint: `0f2b88450f05bc680e0e70b97528efe94a751d12`.
- The later screenshot, documentation and CI cleanup commits do not alter the tested game scripts or standalone build.
- No merge, deployment, force-push or changes to PR #1 / any `claude/*` branch.

## 2. Requested steps

| Step | Status | Delivered |
| --- | --- | --- |
| 1 | DONE | `bonus_noir` level 3 to -1; `ninth_platform` 3 to 0.5; browser title restored; hash verification machinery removed; bonus docs consolidated; test-only CI retained. |
| 2 | DONE | Shared labels/rings/bursts/terminal/sign/companion helpers; configurable follower behaviour; character-local portrait masks; no global portrait/HUD/follower replacement; no Ninth Minute dependency on Last Broadcast; hints <=95 characters with an assertion. |
| 3 | DONE | Tiled subway/station details; visible three-car train, seven passenger ghosts, headlamp/doors; shared nine-second clock for arrivals/departure/rewind/hazards and cues; dedicated bed and original synth recipes; reduced scenery labels; pipe/gear/steam/light engine-room detail. |
| 4 | DONE | Physical 330px weighted pendulum arm; swept capsule contact and warning arc; fractured two-arm phase; actual brass shutters; deeper phase track; camera framing tested at all four arena corners and released on death. |
| 5 | DONE | Rooftop/relay/transmitter procedural art and dedicated ambience; proximity static and filtered Switchman cadence; Carrier tracking dishes/sweeps/casing/phase change/camera; Rorschach's spared-guard interrogation; Nite Owl's interruptible four-second booth hack; moral summaries and companion line; focused tests. |
| 6 | DONE | Four human transit guards on repeating patrols until engaged; normal human ledger; exactly-once Laurie reaction; three distinct completion paragraphs plus spared/gone counts; real-input lethal and nonlethal checks. |
| 7 | DONE for Part A | All eleven sequential suites and both standalone checks passed; rebuilt HTML; 41 committed before/after screenshots captured via normal file navigation and visually inspected; draft PR and this handover; temporary transfer/publishing workflows removed. |

### Implementation deviations and caveats

1. The bonus branch lacks the proposed generic `e.light` hook in the lighting engine. Rather than alter the protected core, map `lights(world, add)` callbacks forward bonus entities' `light()` profiles. The visual result is tested; original lighting code is unchanged.
2. Extra atmospheric drawing/recipes live in `src/data/bonus-broadcast-atmosphere.js` and `src/data/bonus-ninth-atmosphere.js`. These are ordinary classic scripts in the existing load list, not assets, libraries or a new build step.
3. Full CI ran on isolated committed snapshots while the next step was prepared locally; it was not used as a reason to skip any step's eleven-suite run. Each step's successful run is recorded below.
4. Existing bonus tests were minimally adjusted where the new content intentionally changes progression: evidence now needs interrogation/hacking, and the rescue test must acknowledge Laurie's new dialogue after a kill. No original test assertion, tolerance or suite was weakened.
5. Temporary source/capture transport workflows were needed because the local runtime cannot push/download through ordinary network tools. They are deleted at the review head. Failed setup/transfer attempts remain in GitHub history; they are not current gameplay test failures.
6. Matching screenshots use fixed overview framing. Boss screenshots deliberately use the actual encounter camera, from matching player positions, to demonstrate the camera fix. Normal-versus-Sight images have different world-time progress because Sight genuinely slows time.

## 3. Test results

Authoritative normal-file Chromium run: https://github.com/Ezrolith/Demo/actions/runs/40055755526

Every source suite passed on its first attempt. Exact final output and retained exit code:

| Suite | Final output line | Exit |
| --- | --- | --- |
| smoke | `Smoke test passed.` | 0 |
| visual | `All atmosphere checks passed.` | 0 |
| audio | `All audio checks passed.` | 0 |
| powers | `All mechanics checks passed.` | 0 |
| saves | `All save & robustness checks passed.` | 0 |
| settings | `All settings & accessibility checks passed.` | 0 |
| ledger | `All ledger & combat-feel checks passed.` | 0 |
| encounters | `All encounter checks passed.` | 0 |
| flows | `All story flow checks passed.` | 0 |
| bonus | `BONUS ACCEPTANCE PASSED: 42 checks (normal file loading).` | 0 |
| ninth-minute | `NINTH MINUTE PASSED: 75 checks (normal file loading).` | 0 |
| bonus, standalone HTML | `BONUS ACCEPTANCE PASSED: 42 checks (normal file loading).` | 0 |
| ninth-minute, standalone HTML | `NINTH MINUTE PASSED: 75 checks (normal file loading).` | 0 |

Per-step full regression runs, all successful:

| Step | Run |
| --- | --- |
| 1 | https://github.com/Ezrolith/Demo/actions/runs/40051054284 |
| 2 | https://github.com/Ezrolith/Demo/actions/runs/40051880722 |
| 3 | https://github.com/Ezrolith/Demo/actions/runs/40052773689 |
| 4 | https://github.com/Ezrolith/Demo/actions/runs/40054124293 |
| 5 | https://github.com/Ezrolith/Demo/actions/runs/40055080154 |
| 6 / final gameplay | https://github.com/Ezrolith/Demo/actions/runs/40055755526 |

The draft PR also reruns the read-only regression workflow against its own head. Check that
status separately; the table above describes the verified gameplay commit, not a claim
that a still-running duplicate job has finished. `npm test` is still the original nine;
run `node tests/bonus.mjs` and `node tests/ninth-minute.mjs` as well.

## 4. Before/after evidence

All files below are in this branch, at 1280x720. Capture run:
https://github.com/Ezrolith/Demo/actions/runs/40056176431
The capture completed successfully with 41 images and no page errors.

| Area | Before | After | Sight before | Sight after |
| --- | --- | --- | --- | --- |
| Rooftops | [before](screenshots/bonus-polish/lb-roofs-before.png) | [after](screenshots/bonus-polish/lb-roofs-after.png) | [before](screenshots/bonus-polish/lb-roofs-before-sight.png) | [after](screenshots/bonus-polish/lb-roofs-after-sight.png) |
| Relay | [before](screenshots/bonus-polish/lb-relay-before.png) | [after](screenshots/bonus-polish/lb-relay-after.png) | [before](screenshots/bonus-polish/lb-relay-before-sight.png) | [after](screenshots/bonus-polish/lb-relay-after-sight.png) |
| Transmitter | [before](screenshots/bonus-polish/lb-tower-before.png) | [after](screenshots/bonus-polish/lb-tower-after.png) | [before](screenshots/bonus-polish/lb-tower-before-sight.png) | [after](screenshots/bonus-polish/lb-tower-after-sight.png) |
| Station | [before](screenshots/bonus-polish/nm-platform-before.png) | [after](screenshots/bonus-polish/nm-platform-after.png) | [before](screenshots/bonus-polish/nm-platform-before-sight.png) | [after](screenshots/bonus-polish/nm-platform-after-sight.png) |
| Train | [before](screenshots/bonus-polish/nm-train-before.png) | [after](screenshots/bonus-polish/nm-train-after.png) | [before](screenshots/bonus-polish/nm-train-before-sight.png) | [after](screenshots/bonus-polish/nm-train-after-sight.png) |
| Clock chamber | [before](screenshots/bonus-polish/nm-engine-before.png) | [after](screenshots/bonus-polish/nm-engine-after.png) | [before](screenshots/bonus-polish/nm-engine-before-sight.png) | [after](screenshots/bonus-polish/nm-engine-after-sight.png) |
| Pendulum phase 1 | [before](screenshots/bonus-polish/nm-pendulum-phase1-before.png) | [after](screenshots/bonus-polish/nm-pendulum-phase1-after.png) | [before](screenshots/bonus-polish/nm-pendulum-phase1-before-sight.png) | [after](screenshots/bonus-polish/nm-pendulum-phase1-after-sight.png) |
| Pendulum phase 2 | [before](screenshots/bonus-polish/nm-pendulum-phase2-before.png) | [after](screenshots/bonus-polish/nm-pendulum-phase2-after.png) | [before](screenshots/bonus-polish/nm-pendulum-phase2-before-sight.png) | [after](screenshots/bonus-polish/nm-pendulum-phase2-after-sight.png) |
| Carrier phase 1 | [before](screenshots/bonus-polish/lb-carrier-phase1-before.png) | [after](screenshots/bonus-polish/lb-carrier-phase1-after.png) | [before](screenshots/bonus-polish/lb-carrier-phase1-before-sight.png) | [after](screenshots/bonus-polish/lb-carrier-phase1-after-sight.png) |
| Carrier phase 2 | [before](screenshots/bonus-polish/lb-carrier-phase2-before.png) | [after](screenshots/bonus-polish/lb-carrier-phase2-after.png) | [before](screenshots/bonus-polish/lb-carrier-phase2-before-sight.png) | [after](screenshots/bonus-polish/lb-carrier-phase2-after-sight.png) |

[Original night pier reference](screenshots/bonus-polish/pier-reference.png) ·
[Exact capture settings](screenshots/bonus-polish/capture-settings.json).

## 5. Uncertainties

- No unassisted end-to-end human playthrough or subjective listening assessment was completed.
- Safari, Firefox, mobile controls and low-end-device performance remain unverified.
- The focused tests use setup positioning and occasional invulnerability. They verify mechanics,
  routes and regressions, not fun, difficulty or artistic parity with the original.
- The original performance test passes on the GitHub runner; that is not a general device benchmark.
- Map images were inspected, including Sight and boss phases. That does not establish that every
  transient animation is attractive or every puzzle is intuitive to a first-time player.

## 6. Known issues and next handover

No reproducible failing gameplay assertion remains in the verified Part A build. Do not
translate that into a claim that no bugs exist. Browser persistence depends on storage being
available; keyboard/mouse remain required. Human review should specifically assess the
protected hack's pressure, transit-guard difficulty, boss sweep readability and sound balance.

**Part B status at this checkpoint: NOT STARTED.** There is no third-adventure implementation
or test file in this branch. It must be a separate branch `codex/bonus-three`, based on the
finished Part A head, with its draft PR targeting `codex/bonus-polish`.

The requested third adventure is **The Long Summer**, 1977: Manhattan, the Comedian and Nite
Owl during the police strike. Its required work is not optional:

1. A 0–100 city Heat system responding to kills, nonlethal restraint, rescues, fires and the
   Comedian; high Heat brings reinforcements, low Heat allows crowds to leave.
2. A deliberately dangerous Comedian using live fire/tear gas and potentially finishing a
   knocked-out rioter. He is grabbable: holding him disarms him for ten seconds after release.
   Track his casualties separately. Nite Owl has an explicit E-operated balcony grapple.
3. Blackout Avenue: procedural summer streets, fires, human rioters and grabbable Molotovs;
   rip hydrants with telekinesis, water extinguishes nearby fires; clear the route with Heat <40.
4. Five-storey burning tenement: six residents, spreading fire/smoke grid, Sight's three-second
   fire prediction, a liftable stair beam, Expand roof ventilation and Duplicate distraction.
5. Riot-line climax: a mobile black truck, telegraphed water cannon/tear gas and a half-health ram;
   disable pump/engine nonlethally or unmake the frightened driver; stop the Comedian if necessary.
6. Three distinct endings (Mercy, Order, Silence) using Heat and casualties, not just a last-button
   choice. Keep all writing original and introduce each mechanic through a companion exchange.
7. Third bonus card with its own checkpoint/completion record, old saves intact; two properly
   normalised music tracks and summer/crowd/fire/siren ambience in the original synth.
8. `tests/long-summer.mjs`: complete all maps through real inputs, both truck resolutions, Heat,
   Comedian restraint/casualties, fire/prediction/ventilation, rescues, retries and save isolation.
   Run all eleven existing suites plus the new suite sequentially, then test the standalone.
9. Screenshot every map normally and under Sight plus the truck mid-sweep and mid-ram; inspect
   actual renders. Push source/tests/docs/rebuilt HTML; draft PR only, never merge/deploy.

Read the user's full specification before implementing: this handover is a checklist, not a
replacement for its numerical thresholds and acceptance criteria. Keep the original six
chapters, core combat/physics/lighting/weather, original music and all `claude/*` branches intact.
