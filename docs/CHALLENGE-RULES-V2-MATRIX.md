# Palace challenge rules v2 — replacement matrix

Design recorded before implementation on `codex/glass-palace-refinements`.
There are still twelve moments and thirty-six fragment slots. This proposal does
not edit the six campaign chapter files, original music or engine presentation.

**Status:** implementation and natural-input calibration pending. Time limits
below are proposed gameplay goals, not relaxed test assertions. The existing
visual-performance threshold and every existing assertion remain unchanged.
Reassembly's proposed six-minute limit replaces the unvalidated four-minute
limit; a real-input run must establish its reachable pace and headroom before it
is reported as validated. The other eleven initial time limits are unchanged.

## Award and evidence rules

- A story's mandatory flags alone cannot earn a v2 optional fragment.
- Each row below has a valid story-completion route that misses it and one that
  earns it. These route descriptions are design/test specifications, not claims
  that natural runs have already been completed.
- A **fresh run** starts the whole moment at stage zero. Retry retains the v2
  run's observed damage, power and loss totals; it does not erase a failed
  attempt. A matching v2 checkpoint can restore those observations from the
  palace slot. Old or mismatched Resume data cannot invent an observed clean
  segment. The UI must explain that a fresh replay is needed when evidence is
  unavailable.
- The original three save formats remain unchanged. New evidence belongs only
  to the palace slot. Actual completion is the only award point.
- Every old earned fragment is retained. Old records are marked as legacy
  awards; they are never reinterpreted as proof of the new goal or revoked.
  New awards are tagged with rules version 2. Older palace saves and backups
  migrate without losing fragments, epilogue history or a valid tracked slot.
- Existing IDs `mercy`, `swift`, and `detail` remain stable fragment-slot IDs for
  compatibility. Pane labels and predicates can differ by level.

## All thirty-six slots: old versus new

A miss route must still satisfy every mandatory story gate. A time miss waits
in ordinary active play beyond the target; Pause does not count as waiting.
A clean-condition miss takes a real avoidable hit/cast/loss, then finishes the
story normally. These are legitimate alternative outcomes, not invalid states.

| Moment / slot | Old goal | New pane label and description | Valid completion that misses it | Valid completion that earns it |
| --- | --- | --- | --- | --- |
| Prologue / mercy | No one unmade; impossible here | **Palisades Park.** Look at the workshop photograph before leaving Gila Flats. | Repair, calibrate and retrieve the coat without inspecting the photograph. | Inspect the existing photograph, then finish the same story route. |
| Prologue / swift | Under 8 minutes | **Before the chamber seals.** Finish a fresh run in under 8 minutes. | Finish after at least 8 minutes of active field time. | Complete the normal route before 8 minutes. |
| Prologue / detail | Repair watch and calibrate; both mandatory | **Beyond the assignment.** Read the chalkboard, listen to the canteen radio and check the records files. | Omit any named optional interaction while completing the required route. | Use all three existing optional interactions, then finish. |
| Reassembly / mercy | No one unmade; no people exist | **Keep the pattern.** Fresh run: lose no carried atoms to vortices; Retry retains losses. | Lose at least one carried atom to a vortex, recover and finish. | Gather/deposit all layers while steering carried atoms clear of vortices. |
| Reassembly / swift | Under 4 minutes, uncalibrated | **A quickened pattern.** Finish a fresh run in under 6 minutes. | Finish after at least 6 active minutes. | Gather/deposit normally and finish before 6 minutes; target needs real-input calibration. |
| Reassembly / detail | Reassemble; mandatory | **A gentler pull.** Absorb 30 atoms while Coalesce is not held, then finish the reconstruction. | Hold Coalesce for every absorption, or release for fewer than 30. | Deliberately gather at least 30 using the existing passive pull, then finish. |
| Superman / mercy | No one unmade | **A hand left open.** Fresh run: finish without unmaking a person; Retry retains outcomes. | Unmake one warehouse gangster, then clear the remaining story gates. | Clear the warehouse through knockouts rather than unmaking people. |
| Superman / swift | Under 8 minutes | **Before the pier sleeps.** Finish a fresh run in under 8 minutes. | Finish after at least 8 active minutes. | Complete range and pier before 8 minutes. |
| Superman / detail | Spare four people; overlaps mercy | **Someone's badge.** Inspect the smiley-face badge in the pier office before finishing. | Finish the raid without inspecting the desk badge. | Use the existing “Look at the badge” interaction, then finish. |
| Deterrent / mercy | No one unmade; only machines/protected NPCs | **Return fire.** Fresh run: defeat the Behemoth without firing Disintegrate during its fight. | Fire Disintegrate once during that fight, then defeat it. | Use returned missiles, throws, copies and movement to defeat it without that cast. |
| Deterrent / swift | Under 9 minutes | **Before the next warhead.** Finish a fresh run in under 9 minutes. | Finish after at least 9 active minutes. | Finish the required combat and story before 9 minutes. |
| Deterrent / detail | 75% coherence after safe outro | **A steady outline.** Have at least 75% coherence when the Behemoth falls, before the safe outro. | Defeat it below 75%; later regeneration must not repair this result. | Defeat it at or above 75%; freeze the actual combat-end value. |
| Mars / mercy | No one unmade; all cast protected | **Weather the red sky.** Fresh run: take no meteor damage on Mars; Retry retains hits. | Take a meteor hit, then build the palace and finish. | Avoid the existing meteor warnings while completing the palace. |
| Mars / swift | Under 10 minutes | **Before the red dust settles.** Finish a fresh run in under 10 minutes. | Finish after at least 10 active minutes. | Finish studio, palace and story before 10 minutes. |
| Mars / detail | All six memories | **Every remembered year.** Recover all six optional memories in this run. | Build the required palace while leaving at least one memory uncollected. | Visit and collect all six existing memories, then finish. |
| Karnak / mercy | No one unmade; Veidt always yields | **Hands, not light.** Fresh run: defeat Veidt without firing Disintegrate during his fight. | Fire Disintegrate at least once in his fight, then make him yield. | Use throws, copies and Temporal Sight to make him yield without that cast. |
| Karnak / swift | Under 10 minutes | **Before the last hand turns.** Finish a fresh run in under 10 minutes. | Finish after at least 10 active minutes. | Finish courtyard, subtractor and Veidt before 10 minutes. |
| Karnak / detail | Four emitters; mandatory | **A quiet approach.** Fresh run: take at most 40 coherence damage before the last courtyard emitter falls. | Accumulate more than 40 courtyard damage, survive and finish. | Disable the four emitters within the damage budget; freeze it before later fights. |
| Last Broadcast / mercy | No one unmade | **Bring them home.** Fresh run: finish without unmaking a person; Retry retains outcomes. | Unmake a guard and still complete the rescue/carrier story. | Knock out guards and finish without a human unmaking. |
| Last Broadcast / swift | Under 10 minutes | **Before the carrier signs off.** Finish a fresh run in under 10 minutes. | Finish after at least 10 active minutes. | Complete the required route and departure before 10 minutes. |
| Last Broadcast / detail | All evidence plus mandatory engineers | **Names on the air.** Recover all three evidence records and choose to broadcast them. | Omit a record, or choose silence even with all three; finish normally. | Find all three existing optional records and choose Broadcast. |
| Ninth Minute / mercy | No one unmade | **A second chance.** Fresh run: finish without unmaking a person; Retry retains outcomes. | Unmake a transit guard, then rescue passengers and finish. | Avoid or knock out human guards while finishing the route. |
| Ninth Minute / swift | Under 12 minutes | **Beyond the ninth minute.** Finish a fresh run in under 12 minutes. | Finish after at least 12 active minutes. | Complete the station/train/engine route before 12 minutes. |
| Ninth Minute / detail | Six passengers; mandatory | **Three lost moments.** Use Temporal Sight to find and hear all three optional gold echoes. | Leave at least one Lost Moment unheard while saving all six passengers. | Activate the three existing Lost Moment terminals in Temporal Sight, then finish. |
| Long Summer / mercy | No one unmade | **A city left standing.** Fresh run: finish without unmaking a person; Retry retains outcomes. | Unmake a rioter or driver and still reach an ending. | Finish using nonlethal tools rather than human unmaking. |
| Long Summer / swift | Under 12 minutes | **Before the street burns out.** Finish a fresh run in under 12 minutes. | Finish after at least 12 active minutes. | Finish avenue, tenement and truck before 12 minutes. |
| Long Summer / detail | Six residents and Heat below 30 | **A cooler street.** Rescue all six residents and finish with City Heat below 30. | Finish with fewer residents or Heat at least 30. | Take the full rescue route and control Heat below 30 at completion. |
| Dead Air / mercy | No one unmade; all hero attacks nonlethal | **A clean frequency.** Fresh run: take at most 80 total health damage; healing and Retry do not reset it. | Accumulate more than 80 damage across the run and still finish. | Use cover and field gear to finish within the observed damage budget. |
| Dead Air / swift | Under 8 minutes | **Before the channel closes.** Finish a fresh run in under 8 minutes. | Finish after at least 8 active minutes. | Investigate, tune and clear the uplink before 8 minutes. |
| Dead Air / detail | Traces and buyer list; mandatory | **Off the call sheet.** Read the optional tower-maintenance note and dispatch handover note on the roofs. | Complete required clues/aerials/uplink while omitting either optional note. | Investigate both clearly labelled optional field notes, then finish. |
| Undertow / mercy | No one unmade; all hero attacks nonlethal | **A steady crossing.** Fresh run: take at most 100 total health damage; healing and Retry do not reset it. | Accumulate more than 100 damage, recover and finish the rescue. | Manage threats and escorts while remaining within the observed damage budget. |
| Undertow / swift | Under 10 minutes | **Before the tide turns.** Finish a fresh run in under 10 minutes. | Finish after at least 10 active minutes. | Restore the winch, escort four workers and depart before 10 minutes. |
| Undertow / detail | Four rescued and cast off; mandatory | **Not listed as cargo.** Read the optional pier lease and cargo tally beside the harbour stores. | Rescue four workers and cast off while omitting either optional note. | Read both optional harbour field notes, then finish the rescue. |
| Glass Archive / mercy | No one unmade; all hero attacks nonlethal | **An unbroken line.** Fresh run: take at most 120 total health damage; healing and Retry do not reset it. | Accumulate more than 120 damage and still capture the Surveyor/return the archive. | Use cover, guard/traversal and gear to finish within the observed damage budget. |
| Glass Archive / swift | Under 8 minutes | **Before the gallery goes dark.** Finish a fresh run in under 8 minutes. | Finish after at least 8 active minutes. | Isolate circuits, defeat the Surveyor and return before 8 minutes. |
| Glass Archive / detail | Ledger, Surveyor and archive; mandatory | **The missing catalogue.** Read the optional loan register and private index in the museum side galleries. | Complete all required security/boss/archive steps while omitting either note. | Read both optional museum field notes and complete the case. |

## Existing content and new add-on content

The prologue photograph, chalkboard, radio and files are real optional `flavor`
interactions. The Superman pier badge is another real optional interaction.
Mars's six Memory entities and Ninth Minute's three Lost Moment terminals already
exist and remain optional. Last Broadcast evidence and its broadcast/silence
choice remain independent of the engineers/carrier completion gates.

The six After Midnight field-note objects are **new optional content**, not
renamed mandatory clue objects. They must be supplied from a new palace add-on
module, with the existing procedural Prop/Terminal drawing and interaction
conventions. Give every object a unique ID, named interaction label and one short
original observation. Both notes in a case must lie on reachable playable floor,
outside mandatory E-target ranges, with clear field labels. Placement and
reachability are acceptance checks, not assumed from decorative art coordinates.
No new notes are injected into replay modes or preview worlds.

## Telemetry contract for implementation

Use one explicit run record attached to the actual Play instance:
`play.glassPalaceRun`. This is independent of the displayed pin. New goals must
remain observable even when no challenge is pinned, without polling save slots.
Prefer event/lifecycle boundaries and existing events over method patching.

Proposed scalar evidence fields (names are an implementation contract):

| Field | Evidence source / freeze boundary |
| --- | --- |
| `rulesVersion`, `chapterId`, `eligible`, `runId` | Version 2; canonical actual Play; fresh start or matched palace-local checkpoint record. |
| `photoSeen`, `researchMask`, `badgeSeen` | Explicit successful interaction notification for the existing named optional props. Research bits: chalkboard 1, radio 2, files 4. |
| `vortexAtomsLost` | Sum positive amounts from existing `vortex:hit`; retain across Retry. |
| `passiveAtoms` | Existing `atom:absorbed` while the actual Coalesce input is not held. |
| `unmade` | Existing human lethal `enemy:down` outcomes for this run, retained across Retry. |
| `behemothSeen`, `behemothDefeated`, `behemothDisintegrations` | Observe actual boss introduction/defeat; count accepted cast starts during that live fight, before any target damage/death. |
| `behemothCoherence`, `behemothMaxCoherence` | Capture on actual Behemoth defeat, before safe wait/dialogue/outro or health regeneration can change it. |
| `marsSeen`, `marsDamage` | Actual damage while the Mars map is active; its damaging hazards are the meteors. Retain across Retry. |
| `emittersSeen`, `emittersComplete`, `emittersDamage` | Actual courtyard segment; freeze once the last live emitter is disabled, before subtractor/Veidt. |
| `veidtSeen`, `veidtDefeated`, `veidtDisintegrations` | Accepted cast starts in the actual Veidt fight only; exclude scripted subtractor audio/effects. |
| `damageTaken` | Sum actual post-armour health/coherence reductions across the full AM case, including failed portions before Retry. Healing does not subtract. |
| `fieldNotesMask` | Two unique optional note interactions, bit 1 and bit 2, per story case. |

The existing `power:disintegrate` notification fires after target damage and death. Do not decide fight membership from a still-alive boss at that event: the killing cast must count. Add an explicit accepted cast-start notification, and an accepted-damage notification after armour/guard/invulnerability filtering. Sampling health after healing is not an adequate damage counter.

For a negative condition, `eligible` plus the relevant observed/frozen segment
flags must be true. An absent counter or unobserved resumed segment is **unknown**,
not zero. Successful story completion can therefore miss a challenge because its
full-run evidence is unavailable, and the pane must describe the fresh-run rule.

Existing trustworthy carried level state supplies memories, evidence, choice,
Lost Moments, rescued residents and Heat. Speed uses the actual active field
clock and existing carried time, never wall-clock pauses or a fabricated timer.
The implementation must document exactly how failed-attempt time is treated;
normal no-retry time-target sanity runs are the first calibration evidence.

## Required acceptance evidence

1. Thirty-six successful completions that miss the selected condition and
   thirty-six that earn it, using actual completion methods and valid mandatory
   state. Controlled boundary fixtures must be labelled as such.
2. Retention/migration tests for every old earned slot; rules-v2 awards never
   revoke a legacy bit, duplicate its fragment, or reinterpret it as new proof.
3. Fresh-run, Retry and matched/mismatched Resume tests for negative counters and
   captured combat-end values. Missing telemetry must not appear clean.
4. Real-input scripted time sanity runs on Normal: actual movement/aim/actions,
   no placement, health, statistics, clock edits, developer stage skips or forged
   completions. Record each elapsed value and target headroom honestly.
5. Natural-play captures only. A fixture boundary test is not a live capture or
   proof of natural challenge-time balance.
