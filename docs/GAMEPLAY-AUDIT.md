# Virtual gameplay audit — 24 October 2026

## Scope and safeguards
Branch `codex/bonus-three`, draft PR #4. Only the truck component targeting logic,
its regression suite and rebuilt standalone game were changed. No merge or deployment;
all original campaign and other bonus chapters are unchanged.

This is an **independent gameplay check**, not a claim of a complete human playthrough.
The local runner cannot navigate `file://` URLs, so the browser audit used a
headless Chromium page with identical classic scripts inlined and an in-memory save.
Player movement and powers were driven by **actual Playwright keyboard and mouse
actions with uninterrupted requestAnimationFrame**. No actor relocation, godMode,
damage immunity or level-skipping commands were used during those journeys.

### Routes exercised
- Long Summer (Story and Normal): from the original avenue spawn, aim and hold C
  on the Comedian, cross the avenue by walking along the frontage, call Nite Owl
  using E, wait for his grapple, enter the tenement, walk through a room doorway
  and ask a resident to follow with E. The Normal route entered the tenement
  and activated a genuine escort without a developer shortcut.
- Long Summer truck (Normal): walk from the original spawn toward the moving
  vehicle; aim and press Q repeatedly at individual teal parts while the
  machine attacks, turns and enters phase two.
- All three adventures: live ten-second WASD movement sweeps from the stage
  spawn, with no page errors; this is only initial movement/survival coverage.

## Reproduced issue and correction
During the real-input truck run on the previous candidate, a Disintegrate
burst aimed at a moving **wheel** destroyed the **cab** during the ram turn.
The intended wheel remained alive while `driverOutcome` became `unmade`.
Because an indiscriminate area pulse resolves 0.16 seconds after firing, a
newly moved cab could enter the pulse radius despite never being targeted.

Fix: the cab's existing `onDisintegrateCast` extension point records whether
the **blast centre was directly over the cab at cast time**. The existing area
pulse may still damage wheels/cannon, but a cab is lethal only if specifically
aimed at when fired. This does not change the global Disintegrate mechanic.
The same manual Q sequence after the fix left the driver alive.

New automated regression in `tests/long-summer.mjs` checks a wheel-centred
cast when the cab enters the explosion radius, and separately confirms that
deliberately aiming at the cab still causes exactly one fatality.

## Verification boundary
The offline local harness passed **42 Last Broadcast**, **75 Ninth Minute**
and **74 Long Summer** targeted checks. The GitHub publisher ran the Long
Summer source and standalone tests against normal file loading and both
passed; the published standalone is the rebuilt game.

Review the follow-up **read-only full regression workflow** for the original
nine suites and all three bonus suites plus standalone runs. Previously
successful results are not automatically proof of the new commit.

Natural difficulty beyond these traversed sections, a full normal-damage
end-to-end playthrough, subjective audio quality, Safari/Firefox, mobile
and cross-file save migration remain unverified.

## Reproduction script for future reviewers
With an unmodified original truck stage, walk towards the vehicle, aim Q at
the cannon, then wheel targets as the truck begins ramming. Keep an eye on
`ctx.flags.driverOutcome` and the amber cab. The fix must protect the driver
from **wheel-centred** blasts but permit a deliberate **cab-centred** Q to kill.
For longer checks use `node tests/long-summer.mjs` (plus a standalone run),
then all original/bonus regression suites sequentially.

See [PR #4](https://github.com/Ezrolith/Demo/pull/4) and
[`docs/SUMMER-REVIEW-HANDOVER.md`](SUMMER-REVIEW-HANDOVER.md)
for the broader artwork/fairness changes and caveats.


## Additional user-input review: avenue and rescue exit

A separate real-keyboard/mouse play route reproduced an **avenue bypass**: from Jon's
actual spawn, hold C on the first hydrant, teleport across the map in ordinary
380-unit steps, call Nite Owl with E and enter the tenement. Previously this
worked in under ten seconds **with every original rioter still active**.
The story objective ("Calm the avenue") had been satisfied by water alone.

**Correction:** at least two of the initial six rioters must now be knocked out
(nonlethally), otherwise neutralised, or depart peacefully, in addition to
Heat below 40 and the balcony grapple. Progress appears under the mission objective.
This is a gameplay gate, not a request to kill people. A second physical-input
route used R duplicates, subdued three rioters nonlethally, opened the balcony,
and advanced to the tenement at normal vulnerability. The fast bypass remained
blocked when retried against the corrected game.

A normal tenement screenshot also revealed **"Leave for the armoury"** overlapping
the green SAFE EXIT residents use. The onward-route console is now 174 world units
to the side and is disabled until all six residents have reached the street.
The SAFE EXIT remains visible and distinct.

Regression checks were added to tests/long-summer.mjs for the bypass,
the two-person nonlethal resolution, exit-console separation and delayed activation.
The three focused bonus suites were rechecked locally; Long Summer passed
75 checks in the restricted inlined-script harness. This **does not** replace
the normal-file GitHub CI run, which must pass on the final combined build.
The earlier cab-centred disintegration correction is preserved separately.

Unverified: full first-time end-to-end playthrough, subjective sound quality,
Safari/Firefox and any gameplay balance effects beyond these reproducible routes.


### Menu, failure and retry (real physical inputs)

The title's **BONUS LEVELS** entry was activated with a mouse click, the first
bonus card was selected by clicking its visible rectangle, and Enter opened the
correct interlude. A separate Long Summer run used Escape to pause, Escape to
resume, and ordinary teleports into a hostile cluster to test actual damage.
Jon ran out of coherence, the REASSEMBLE screen appeared, and pressing Enter
restored the avenue at its initial checkpoint with full coherence and Heat 46,
without an engine/page error. This is a deliberately failed combat encounter,
not an endorsement of standing idle in the middle of a riot.

The truck was approached from its original stage spawn using held WASD keys;
mouse-targeted Q attacks struck mechanical parts without modifying actors or
player invulnerability. The cab-splash regression identified above comes from
a more aggressive sequence as the vehicle turns. The source and standalone
acceptance checks verify intentional and incidental cab targeting separately.

The targeted local builds were tested with Chromium scripts inlined only
because local browser navigation is blocked. The authoritative combined build
has also been validated via the GitHub normal-file publisher, with the full
read-only regression workflow providing the complete original-suite result.
