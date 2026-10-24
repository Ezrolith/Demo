# Bonus polish — review and successor handover

## 1. GitHub state

- Repository: `Ezrolith/Demo`; branch: `codex/bonus-polish`.
- Draft PR: https://github.com/Ezrolith/Demo/pull/3 (base `chatgpt/bonus-adventures`, NOT the original game).
- Gameplay/build tested commit: `9a03c688738462e1133a824940924d4239d99097`.
- Documentation/evidence cleanup checkpoint: `0f2b88450f05bc680e0e70b97528efe94a751d12`.
- Later screenshot/documentation/CI cleanup commits do not change the tested game scripts or standalone build. Read the current PR head before continuing; do not reset it to the tested commit.
- No merge, deployment, force-push or changes to PR #1 / any `claude/*` branch.

**Part A is implemented and its final gameplay build is green. Part B is NOT STARTED.**
This handover stops at the requested Part A reporting checkpoint (step 7.4).

## 2. Requested steps

| Step | Status | Delivered |
| --- | --- | --- |
| 1 | DONE | `bonus_noir` level 3 to -1; `ninth_platform` 3 to 0.5; title restored; publication hashes/tooling removed; bonus documentation consolidated; read-only test CI retained. |
| 2 | DONE | Shared helpers and configurable companions; character-local masks; no global portrait/HUD/follower replacement; no Ninth Minute dependency on Last Broadcast; hints <=95 characters with an assertion. |
| 3 | DONE | Subway architecture/props, three-car train and seven ghosts; shared nine-second cycle for movement/hazards/sounds; dedicated tunnel ambience and synth recipes; fewer labels; clock-room gears/pipes/steam/lights. |
| 4 | DONE | Physical weighted arm, swept contact and warning arc; fractured two-arm phase, brass shutters, deeper music and encounter camera. |
| 5 | DONE | Rooftop/relay/transmitter art and ambience; Carrier tracking dishes/sweeps/casing/phase change/camera; Rorschach's spared-guard interrogation; Nite Owl's interruptible four-second hack; moral summaries and companion reactions. |
| 6 | DONE | Four human transit guards on looping patrols until engaged; normal human ledger; once-only Laurie reaction; three distinct moral conclusions and spared/gone display. |
| 7 | DONE for Part A | All eleven sequential suites and both standalone checks passed; rebuilt HTML; 41 committed screenshots captured via normal file navigation and inspected; draft PR, docs and handover; temporary transfer/publishing workflows removed. |
| Part B | NOT DONE | The Long Summer has no implementation, branch or tests yet. Its exact specification is preserved below. |

### Deviations and caveats

1. The base branch lacks the proposed generic entity-light hook. Map `lights(world, add)` callbacks forward bonus entities' `light()` profiles instead, leaving the original lighting engine unchanged.
2. Atmospheric drawings/recipes live in two ordinary classic scripts: `src/data/bonus-broadcast-atmosphere.js` and `src/data/bonus-ninth-atmosphere.js`. No gameplay assets, project dependencies or new build system were added.
3. The only new core rendering hook is optional `look.mask(ctx, t)` (two lines in gfx.js). The original six chapters, original music, ending, engine, physics and powers are unchanged.
4. Full CI validated isolated per-step snapshots while subsequent work was prepared locally. Every step received an eleven-suite run; the final game also received both standalone runs.
5. Bonus tests were minimally adjusted for intentionally changed behaviour: evidence now requires interrogation/hacking, and the rescue test must acknowledge Laurie's new dialogue after a kill. No original test assertion, tolerance or suite was weakened.
6. Temporary transfer/publishing workflows were removed. Failed setup/transfer attempts remain in history; they are not current gameplay failures. Only read-only test CI remains.
7. Map overviews use identical framing. Boss shots use matching player positions and the actual encounter camera. Normal and Sight shots have different world-time progress because Sight really slows time.

## 3. Test results

Authoritative normal-file Chromium run: https://github.com/Ezrolith/Demo/actions/runs/40055755526

Every source suite passed on its first attempt. These are retained actual exit codes, not piped output.

| Suite | Exact final output line | Exit |
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
| bonus, standalone | `BONUS ACCEPTANCE PASSED: 42 checks (normal file loading).` | 0 |
| ninth-minute, standalone | `NINTH MINUTE PASSED: 75 checks (normal file loading).` | 0 |

Per-step eleven-suite runs, all successful:

| Step | Run |
| --- | --- |
| 1 | https://github.com/Ezrolith/Demo/actions/runs/40051054284 |
| 2 | https://github.com/Ezrolith/Demo/actions/runs/40051880722 |
| 3 | https://github.com/Ezrolith/Demo/actions/runs/40052773689 |
| 4 | https://github.com/Ezrolith/Demo/actions/runs/40054124293 |
| 5 | https://github.com/Ezrolith/Demo/actions/runs/40055080154 |
| 6 / final gameplay | https://github.com/Ezrolith/Demo/actions/runs/40055755526 |

The PR also reruns read-only regression checks for its own head. Check that status separately;
the table describes the verified gameplay commit, not an unfinished duplicate job.
`npm test` is still the original nine; run both bonus suites separately as well.

## 4. Before/after evidence

Capture run: https://github.com/Ezrolith/Demo/actions/runs/40056176431
41 images at 1280x720 through normal file navigation, no page errors. All were visually inspected.

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

[Original night pier](screenshots/bonus-polish/pier-reference.png) ·
[Capture settings](screenshots/bonus-polish/capture-settings.json).

## 5. Uncertainties

No unassisted end-to-end human playthrough or subjective music-listening assessment was done.
Music balance is supported by the original loudness check; taste and atmosphere still need listening.
Safari, Firefox and low-end performance remain unverified. Mobile controls are not implemented.
Tests use setup positioning and some invulnerability: they verify mechanics/routes/regressions,
not fun, difficulty or artistic parity. Screenshots do not prove every animation or puzzle is intuitive.

## 6. Known issues and successor boundary

No reproducible failing gameplay assertion remains in the tested Part A build. That is not a claim
that no bugs exist. Review hack pressure, transit-guard difficulty, boss sweeps, audio and persistence.
Keep PR #3 draft. Do not merge/deploy, overwrite `claude/*` or alter PR #1.

**Part B has not been started.** Use a NEW `codex/bonus-three` branch from the finished Part A
head, draft PR targeting `codex/bonus-polish`. No additional numerical Heat/balance values have
been established. Earlier proposed values and ending names are not requirements. The requested
truck components are cannon/wheels versus the lethal CAB; the endings are calm/uneasy/burning.

### User's Part B specification (preserved verbatim)

Build on a new branch `codex/bonus-three` created from the finished `codex/bonus-polish`. Draft PR into
`codex/bonus-polish`. Same ground rules, code standard, testing and screenshot rules as Part A, written to the Part A
standard FROM THE START (atmosphere, sound, labels, framing - not as a later polish pass).

Premise (original writing only; Watchmen is the inspiration, not the source text):
New York, August 1977. The police are on strike, the city is in a heatwave, and the streets are boiling over. Jon is sent
in with the Comedian and Nite Owl to "restore order". The Comedian's idea of order is the problem. This adventure is the
one built around the game's central question: who do you spare, and what does your power cost the people in front of you?

Companions:
- The Comedian (new LOOKS entry with a `mask` per step 2.2: black leather, a small smiley badge, a cigar): fights hard and
  ESCALATES - if not restrained he fires tear gas and live rounds, and his shots can turn knocked-out rioters into
  casualties. Jon can stop him: Telekinesis can lift him (a quick hold disarms him for 10 s) and he remembers it in dialogue.
- Nite Owl: non-lethal support, opens routes (grapple point he can use on E to reach a balcony), and protests the Comedian.

Core mechanic - THE HEAT meter (one new HUD element, drawn in the style of the existing coherence bar):
- City heat 0-100 rises when people are unmade, when the Comedian fires, when fires spread; it falls when Jon spares
  rioters, rescues civilians and stops the Comedian. High heat spawns more rioters and molotov throwers; low heat calms
  crowds so some rioters simply leave.
- Every human counts in the spared/gone ledger as in the campaign.

Areas (three, each one checkpointed stage, like the other adventures):
1. "Blackout Avenue": a dark street lit only by burning cars, a looted storefront and Jon's own light (the light layer is
   the mood). Rioters, two molotov throwers (molotovs are grabbable and can be caught and thrown into a hydrant puddle to
   snuff them). Objective: calm the avenue (heat below 40) and reach the tenement. The Comedian escalates here first.
2. "The Tenement": a burning five-storey tenement shown top-down as rooms. Fire spreads cell-by-cell on a timer (hazard,
   in colour under Sight). Rescue 6 residents trapped in rooms: Teleport in, carry/escort out; Telekinesis lifts a burning
   beam; Duplicate lets Jon be in two rooms; Expand lets him tear the roof open to vent smoke. Temporal Sight shows where
   the fire will be in 3 seconds. No combat here except one looter who started the fire (spare or unmake).
3. "The Armoury Truck" (boss): rioters have taken a National Guard riot-control truck with a water cannon (knockback,
   telegraphed sweep) and tear-gas mortars (clouds that dim vision and slow Jon). The driver is a frightened kid. Disable
   it without killing him: destroy the cannon and wheels with Disintegrate/thrown objects; disintegrating the CAB is
   lethal and counts as unmade. Phase 2 at 50%: the truck rams; the Comedian wants to shoot the driver - Jon can stop him.
   Same camera framing rule as step 4.2.

Endings (three tiers from the ledger AND final heat): calm (spared everyone, heat low), uneasy (mixed), and burning (people
unmade or heat high). The Comedian's last line differs in each. Show PEOPLE SPARED / UNMADE, RESIDENTS RESCUED (x/6),
CITY HEAT.

Sound and music:
- New beds: `summer_street` (heat-haze drone, distant crowd, sirens, glass breaking events), `summer_fire` (fire roar that
  rises near burning cells via a positional hum).
- Two new tracks in the original synth style: a slow, humid one for the streets and a driving one for the truck - each
  `level` tuned so tests/audio.mjs passes.

Registration and saves: register it with DM.Bonus.register exactly like the other two (own id `long_summer`, own
checkpoints in the bonus slot, never touching campaign saves). It appears as the third card in BONUS LEVELS.

Tests: add tests/long-summer.mjs covering: menu -> intro -> each stage reachable; heat rises/falls by the stated rules;
the Comedian can be disarmed; residents count only when they reach safety; fire spreads and is visible under Sight;
truck cab disintegration counts as unmade while cannon/wheel destruction does not; all three ending tiers; checkpoint
resume per stage; campaign save untouched. Plus all 11 existing suites.
