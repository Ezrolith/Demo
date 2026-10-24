# The Long Summer — Bonus III

Original optional fan story for Dr. Manhattan: The Watchmaker's Son. This guide includes the independent-review corrections. Current evidence and successor notes: [SUMMER-REVIEW-HANDOVER.md](SUMMER-REVIEW-HANDOVER.md). The older LONG-SUMMER-HANDOVER.md is a historical first-version report.

## Play

Open `dist/dr-manhattan.html`, click to enable audio, then choose **BONUS LEVELS → 03 THE LONG SUMMER → PLAY THE LONG SUMMER**. The same file contains the campaign and all three bonus adventures. No earlier completion is required.

Desktop keyboard and mouse/trackpad are required. WASD/arrows move; mouse aims; C/left mouse holds telekinesis; Q disintegrates; Space teleports; R duplicates; F/Shift uses Temporal Sight; G expands; E interacts; H recalls hints; Esc pauses; M mutes. Touch gameplay is not implemented.

## Blackout Avenue

Bring CITY HEAT below 40 **and** settle at least two of the original rioters (nonlethal knockouts or peaceful departures). Opening a hydrant alone will not clear the mission. Then use E at the balcony to call Nite Owl and enter the building. At Heat 70 or above, bounded reinforcements arrive; below 30, unengaged rioters can leave peacefully. Sparing people, water, rescues and restraint lower Heat.

The Comedian cannot start aiming during the first thirty playable world seconds of a stage. After that, a raised gun, emissive aim line, “Comedian takes aim” bark and two-tone cue give 2.2 seconds of warning. Lift him with C to cancel the shot. Releasing him leaves him disarmed for ten seconds. He can cause at most one casualty per thirty seconds. Repeated grabs while already disarmed do not farm Heat reductions. Temporal Sight slows these world-time timers.

Autonomous Heat rises at most 0.4/second in the opening thirty seconds and 1.5/second thereafter, including queued shots and Comedian casualties. Fire contributes at most 0.5/second within that budget. Casualty counts update immediately. Jon's deliberate killings still have an immediate Heat consequence.

Lift a red hydrant to release water. Catch or throw Molotovs into the puddle to snuff them. Nite Owl's E-operated grapple opens the balcony. Warm firelight, hostile outlines and actual water spray make hazards and resources readable.

## The Tenement

Six residents must physically reach the green exit to count. E asks them to follow; telekinesis can carry them. A held resident counts only after release at safety. A nearby duplicate can start another escort while Jon works elsewhere.

Lift the fallen stair beam. At the top landing, press G to expand, then E at the roof latch. Ventilation stops further spread and reduces smoke; existing flames remain dangerous. F previews the next three world seconds of propagation.

There are five initial burning cells. The first propagation is at sixteen active world seconds, then once every five seconds. A source cell must have burned for six seconds. Each beat adds at most one frontier cell, avoiding exponential growth. Extinguished cells remain wet/scorched. The looter remains a combatant; residents have no hidden death timer.

The automated normal-damage rescue demonstrates one viable route: clear the stairs, ventilate first, then escort residents through the corridor. It does not prove every route equally forgiving.

## The Armoury Truck

The cannon and four wheels are mechanical targets. Q or impacts can disable them without killing the driver. The cab contains a person: Q there is lethal. Water attacks warn before sweeping; gas drifts, dims vision and slows Jon. At half mechanical health, a marked lane warns of a ram.

After disabling the machinery, guide the living driver with E or carry him to SAFE PASSAGE. The Comedian remains a threat after his protected opening; use his warning to intervene. The camera and relocated safe passage reserve the lower HUD area for hints.

## Consequences and saves

Mercy requires no fatalities, six residents rescued and Heat below 40. Silence follows Heat at least 70 or fatalities exceeding people spared. Order covers the mixed remainder. The Comedian's casualties are separate from Jon's unmakings; a previously spared victim is reclassified once rather than double-counted.

ID `long_summer` uses the separate bonus-save slot. Each adventure retains its own checkpoint and completion record. Retry restores stage-entry state, not a continuous quicksave. Campaign and older bonus records remain; settings are shared. Browser storage and cross-file migration are not guaranteed.

## Development and verification

Summer-specific rules, scenery, layout and framing changed. The only older-adventure change is the relay floor's wear, matting and connected cables. Campaign chapters, core engine, combat/physics/powers, original music and older bonus chapters remain unchanged.

Run the original nine suites with `npm test`, then `node tests/bonus.mjs`, `node tests/ninth-minute.mjs` and `node tests/long-summer.mjs`, one at a time. Rebuild using `node tools/build.mjs`, then run each bonus suite with `dist/dr-manhattan.html` as its argument. Retain actual exits and retries.

`tests/capture-summer-review.mjs` records ten seconds of real RAF simulation after initial dialogue, without actor edits, health cheats or posed attacks. `*-live` images retain the gameplay camera; matching comparisons re-render that live state at identical camera coordinates. See the current handover for exact evidence, results and limitations.

This remains a draft on `codex/bonus-three`, PR #4 into `codex/bonus-polish`. No merge or deployment. Human playtesting/listening, Safari/Firefox and low-end-device testing remain separate from automated Chromium acceptance.
