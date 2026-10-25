# The Long Summer — continuation and successor handover

## 1. Starting point, branches and verified version

The preceding session finished Part A and explicitly left Part B unstarted. This
continuation cross-checked the user's original prompt, that report, PR #3 and the
final Part A state. The Part B specification is preserved in
`BONUS-POLISH-HANDOVER.md` and the conversation's pasted-text attachment.

- Part A base: `codex/bonus-polish`, `9aec9bb0eaf3d76511201fb769b2af7512e60dad`.
- Part B branch: `codex/bonus-three`.
- Draft PR: https://github.com/Ezrolith/Demo/pull/4, into `codex/bonus-polish`.
- Tested game/source/build: `9e7718f751e05950aaf48e8ac629e2207b43fb46`.
- Screenshot checkpoint: `6c9fd7c196cac5bed86991aceb68ea31e6721c0e`.
- Authoritative run: https://github.com/Ezrolith/Demo/actions/runs/40084597144.
- The final delivery commit adds only documentation and read-only CI cleanup;
  the game source and standalone remain identical to the tested version.

No merge, deployment, force-push, default-branch change, modification of any
`claude/*` branch or update to PR #1 was performed. The existing hosted play link
is not changed by saving source to GitHub or providing a new HTML download.

## 2. Prompt cross-reference

| Requirement | Status | Implementation / evidence |
| --- | --- | --- |
| Continue from finished Part A; isolated new branch and draft PR | DONE | Correct base and PR #4; original/development branches retained. |
| Original 1977 police-strike story with Manhattan, Comedian and Nite Owl | DONE | Three stages and original dialogue; no Watchmen dialogue copied. |
| Comedian look: black mask, cigar, smiley badge | DONE | New look using Part A's existing local mask hook; menu inspected. |
| Live fire/gas, finishing a knocked-out rioter, TK disarm for ten seconds, remembered restraint | DONE | Swept live projectiles, casualty reclassification, held/released timer and dialogue; tested. |
| Owl nonlethal support, explicit balcony grapple and protests | DONE | Existing companion base plus E-operated grappling job and dialogue. |
| Heat 0–100, human outcomes/fire/restraint, reinforcement and peaceful-departure thresholds | DONE | Encounter-local CityState and focused tests. |
| Avenue: two Molotov throwers, catchable bottles, hydrant pools, Heat <40 gate | DONE | Real restraint/hydrant inputs and actual exit interaction. |
| Five-storey tenement; six physical escorts/carries; beam; spreading fire; three-second Sight forecast | DONE | Actual-room escort test does not reposition residents to the exit; prediction matches spread. |
| Duplicate help, Expand roof ventilation, only one looter | DONE | Nearby duplicate starts escort; G then E opens roof; one combatant. |
| Moving truck, cannon/four wheels, nonlethal components versus lethal cab | DONE | Separate mechanical/human targets; both resolutions tested. |
| Water warning/knockback, gas dim/slow, half-health ram, threatened driver, camera | DONE | Harmless warning versus physical damage, slow restoration and four-corner bounds checks. |
| Calm/mixed/burning endings based on Heat and ledger, distinct Comedian dialogue and figures | DONE | Mercy/Order/Silence, not a final-choice button; rendered endings and tier checks. |
| Two normalized tracks, summer street/fire ambience and distance-dependent fire noise | DONE | Original synth and new recipes only; normalization measured, not a listening review. |
| Third card, own saves, previous bonus records and campaign preserved | DONE | Three-card layout, separate ID, byte-for-byte campaign save check and old-record checks. |
| All twelve suites plus standalone; build, screenshots, handover | DONE | All 15 commands passed first attempt; 14 normal-file images committed and inspected. |

## 3. Interpretations and deliberate limits

1. **Comedian casualties are not labelled Jon's unmakings.** They have a separate
   row. A prior knockout is removed from spared and counted once as a casualty;
   it is not double-counted. Both fatality types affect the ending.
2. **The mixed tier remains meaningful.** Mercy requires no fatalities, six saved
   residents and Heat <40. Silence requires Heat >=70 or fatalities exceeding
   spared people. All other outcomes are Order. Treating every single unmaking as
   Silence would remove the brief's mixed/uneasy tier.
3. **Residents have no hidden death timer.** They are rescue targets, not
   destructible combatants. Fire threatens Jon and escalates the city. This avoids
   making the fixed six-person objective unrecoverably impossible without a
   separate resident-loss/retry design. Difficulty still needs human assessment.
4. **Duplicate assistance is autonomous.** A nearby duplicate reassures a resident
   and starts their escort while Jon works elsewhere; there is no new character-
   switching control scheme.
5. **Roof ventilation is G then E.** Growing elsewhere does not instantly vent the
   whole building. Ventilation stops propagation/reduces smoke, not all flames.
6. **Checkpoints are at the three stage entries.** Retry recreates the map from
   its carried entry state. It is not a continuous mid-room quicksave.
7. **Tests are not a human playthrough.** They use setup positioning and some
   invulnerability. The six-resident walking check uses residents' actual room
   positions; the test player may be positioned to activate interactions.
8. **Only intentional old menu assertions changed.** The Ninth Minute now expects
   three registered cards and explicitly selects itself rather than the newest
   default card. Its mechanics assertions and all nine original suites are
   unchanged; no timing/loudness tolerance was weakened.

## 4. Values and architecture useful to the successor

Heat starts at 46, clamped to 0–100. Jon unmaking +18; human spared/rescued/peaceful
exit -7; Comedian casualty +20; live shot +3; newly applied restraint -10; new
hydrant -4; dousing up to -10 per update; spreading cell +0.65; ignition +1.5;
ventilation -8; cleared beam -3; stopped truck -10. Quiet streets can decay very
slowly when fire and the Comedian are controlled. These are balance choices, not
claims of optimal difficulty.

At Heat >=70, the avenue adds two rioters every fourteen seconds, capped at three
waves. Below 30, unengaged rioters can leave. The tenement gate requires Heat <40
and Owl's opened balcony. Re-grabbing an already disarmed Comedian and repeatedly
lifting the cleared beam do not farm Heat reductions.

Fire cells are 66 pixels, spread every three world seconds and cap at 75 active
cells. Wet cells cannot reignite. Bounds, walls and line of sight restrict spread.
Sight's three-second preview copies the same deterministic update, in world time.

The truck's mechanical pool is 420 HP: cannon 140, four wheels 70 each. Its cab is
a separate 30-HP Q-lethal human target. At <=210 mechanical HP the truck enters the
ram phase. A surviving driver has his own safe exit and remains threatened by the
Comedian until secured.

File ownership and the play guide are in `LONG-SUMMER.md`. Only
`src/game/bonus.js` changes among pre-existing production JavaScript files, for
three-card layout. Other production work is in four new Summer scripts plus the
load-list additions. The six original chapters, earlier two bonus chapters and
atmospheres, original music and core engine/input/physics/rendering/lighting/
weather/powers/save/audio code are unchanged.

Shared BonusKit utilities are reused. The Heat meter is an encounter-local entity
using the existing emissive render interface. Frontages use map-local wall styles,
so collision walls do not cover the baked art. There is no global HUD or portrait
replacement, asset pack, runtime dependency or new build framework.

Temporary compressed-source transport was needed because ordinary network git
push is unavailable in this runtime. Its checksum was verified before application.
All transfer files and the installer/recovery workflows are removed at delivery;
only read-only regression CI remains. CI reruns on gameplay/test/build changes and
when the PR is opened, reopened or marked ready; documentation-only edits do not
start another long run. Historical preparation commits are retained.

## 5. Exact test results

**Normal-file Chromium run 40084597144 completed successfully.** It tested game
commit `9e7718f751e05950aaf48e8ac629e2207b43fb46`, using real file navigation and
browser storage. All commands passed on their first attempt; no retry was needed.

| Suite | Exact final output | Exit |
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
| long-summer | `LONG SUMMER PASSED: 58 checks (normal file loading).` | 0 |
| bonus / standalone | `BONUS ACCEPTANCE PASSED: 42 checks (normal file loading).` | 0 |
| ninth-minute / standalone | `NINTH MINUTE PASSED: 75 checks (normal file loading).` | 0 |
| long-summer / standalone | `LONG SUMMER PASSED: 58 checks (normal file loading).` | 0 |

Syntax checks and the build passed. Screenshot capture produced 14 images with no
page errors; maps, Sight variants, truck attacks, the menu and pier reference were
inspected. Source/results/screenshots are retained in the run's artifacts.

The standalone is 896,143 bytes, SHA-256
`8a28c929db1295bde9b059c765f2bddb83685606cfda1eb1937ba5a38ca1620c`.
The delivered file and published build were compared byte-for-byte. This is a
record of verification, not a new hash framework/build dependency.

Earlier local 42/75/58 checks used an offline inlined-code/memory-storage harness.
Those local results were not substituted for the normal-file results above.

The new music tracks passed the original audio suite and the explicit loudness
comparison in the Long Summer suite, using its existing plus/minus 3 dB tolerance.
Noise causes small variation. No subjective listening claim is made.

## 6. Screenshot evidence

This new adventure has no earlier version to use as a genuine before image.
The original pier is a style reference; the previous Part A comparison set remains
in `docs/screenshots/bonus-polish/`.

| Area / state | Normal | Temporal Sight |
| --- | --- | --- |
| Blackout Avenue | [view](screenshots/long-summer/avenue.png) | [view](screenshots/long-summer/avenue-sight.png) |
| Tenement overview | [view](screenshots/long-summer/tenement.png) | [view](screenshots/long-summer/tenement-sight.png) |
| Tenement detail | [view](screenshots/long-summer/tenement-detail.png) | [view](screenshots/long-summer/tenement-detail-sight.png) |
| Truck encounter | [view](screenshots/long-summer/truck.png) | [view](screenshots/long-summer/truck-sight.png) |
| Water sweep | [view](screenshots/long-summer/truck-water.png) | [view](screenshots/long-summer/truck-water-sight.png) |
| Ram | [view](screenshots/long-summer/truck-ram.png) | [view](screenshots/long-summer/truck-ram-sight.png) |

[Original pier](screenshots/long-summer/pier-reference.png) ·
[Three-card menu](screenshots/long-summer/bonus-menu.png) ·
[Capture settings](screenshots/long-summer/capture-settings.json).

These are controlled review views. Attack states are staged and use the real
encounter camera. They are not a recorded unassisted player playthrough or proof
of artistic parity with the original game.

## 7. Outstanding / next developer

**Observed visual caveat:** in some initial truck views the temporary tutorial
strip can overlap Jon near the lower screen area. It expires and the boss remains
fully framed. Camera tests check object bounds, not text-over-character occlusion.
Assess a small encounter-local framing/hint-placement adjustment in the human
readability pass; do not hide this behind green tests.

No reproducible failing automated assertion remains in the verified build. This
does not mean the level is bug-free. A human should play with normal damage and
assess the Comedian's warning/restraint pressure, fire-growth breathing room,
ventilation prompt, resident navigation, truck component/cab targeting, safe-driver
extraction, and camera/readability. Also try TK toggle mode and accessibility
settings in sustained play and listen carefully to the whole soundtrack.

Safari, Firefox, mobile gameplay, low-end-device performance, cross-file save
migration, natural difficulty and total playtime have not been verified. Desktop
keyboard/mouse remains required. Automated loudness is not a music-quality review.

For any discovered issue, add a focused reproduction, make a small change on this
branch, run all twelve suites sequentially, rebuild and retest all three standalone
adventures. Keep PR #4 draft until human review. No merge or deployment is
authorised. Preserve PR #1 and all `claude/*` branches.

**Implementation status:** Part B's requested adventure, test suite, screenshots,
source publication and successor handover are delivered. Remaining work is the
explicit human review and visual caveat above, not an unimplemented third level.
