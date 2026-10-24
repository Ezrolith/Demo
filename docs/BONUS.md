# Bonus adventures

Three original optional fan adventures for **Dr. Manhattan: The Watchmaker's Son**.
This branch remains **unmerged**. `codex/bonus-three` builds on the finished
`codex/bonus-polish` branch. The original six chapters, music and ending are
unchanged. PR #1 and all `claude/*` branches are untouched.

## Play

Open `index.html` or the generated `dist/dr-manhattan.html` in a desktop browser.
Click once to enable sound, choose **BONUS LEVELS**, then select one of the three
cards (or use left/right). No campaign completion is required. Keyboard and
mouse/trackpad are required; touch gameplay has not been added.

The original controls apply: WASD/arrows move, mouse aims, C/left mouse holds
telekinesis, Q disintegrates, Space teleports, R duplicates, F/Shift uses Temporal
Sight, G expands, E interacts, H recalls the hint, Esc pauses and M mutes.

## The Last Broadcast — Bonus I

New York, November 1976. Nite Owl and Rorschach trace three missing radio engineers
to a relay station and transmitter roof. Rescue the engineers, ground two coils
with telekinesis, break the shield pylons and disable the Carrier. Broadcasting
the evidence brings interceptors; shutting down quietly avoids that last fight.

Rorschach can question a knocked-out guard: stand beside the spared person and
press E. A guard who was unmade cannot provide evidence. At the supervisor's booth,
E calls Nite Owl to the console. Keep enemies away for four uninterrupted seconds;
the cyan ring shows progress. Interrogation, the hacked booth and the transmitter
record provide three evidence items. Both final routes also respond to the human
ledger and include a companion reaction. Nonlethal attacks spare people; only
Disintegrate unmakes them.

The Carrier tracks Jon with its dishes, telegraphs a sweeping beam, exposes a
casing and releases a damaged dish after half health. The encounter camera keeps
it on screen. All six powers are available from the start.

## The Ninth Minute — Bonus II

New York, February 1977. Silk Spectre and Nite Owl help six passengers caught at
Harrow Street. The visible train follows the same nine-second world clock as the
hazards: arrival, doors, departure and rewind. Temporal Sight slows both the
visual train and the cycle cues; dedicated ambience continues around them.

Set routing to SERVICE and clear the station. At each stranded carriage, E calls
Laurie to open its door. Nearby enemies interrupt her. Passengers count only when
they reach the safe exit. Four human transit guards repeat their short patrols
until engaged; they use the ordinary human spared/gone ledger. Laurie reacts once
to the first unmaking. The conclusion has gentle, mixed and detached readings in
addition to the temporal choice.

The Pendulum has a physical weighted arm. Its brass shutters open for the final
three seconds of the nine-second cycle; a returned missile can open them early.
After half health it fractures into two arms and the music deepens. The warning
arc precedes the swept contact. Keep moving, use Sight or teleport, and attack the
open core. The camera frames Jon and the full machine, including at arena edges.

Three optional lost moments need Sight. The final choice releases the loop at
once or asks Jon to hold F at an anchor to preserve the records. Both rescue routes
remain playable; the human ledger changes the closing meaning.

## The Long Summer — Bonus III

New York, August 1977. Restrain the Comedian, calm Blackout Avenue, rescue six
residents from a five-storey tenement and stop a stolen riot truck. City Heat
responds to actions throughout the adventure; the final Mercy, Order or Silence
outcome is not selected by a last-button choice.

[Full play guide](LONG-SUMMER.md) ·
[Exact tests, caveats and successor handover](LONG-SUMMER-HANDOVER.md).

## Art and sound

All adventures retain procedural figures, dialogue, lighting, weather, powers and
the original WebAudio synthesizer. The first two retain their Part A scenery and
sound improvements; the third adds summer streets, a furnished building, fire and
truck machinery, dedicated ambience and two new arrangements. Existing campaign
tracks and recipes are not replaced. Music normalization is measured, not a claim
of subjective listening or artistic parity.

## Saves

`last_broadcast`, `ninth_minute` and `long_summer` each have their own checkpoint and
completion record in `dr-manhattan.bonus.v1`. They do not advance the campaign's
Continue point, change its ending or add bonus statistics to campaign totals.
Settings are shared. If storage is blocked, progress is session-only. Cross-file
save migration is not guaranteed. Retry restores a stage-entry checkpoint, not
continuous mid-room progress.

## Shared code and tests

`src/game/bonus-kit.js` supplies common label, ring, burst, terminal, sign, companion
and boss-framing helpers. Bonus portrait masks use the existing optional
`look.mask(ctx, t)` interface, without replacing the global portrait function.
There is no Ninth Minute dependency on the Last Broadcast chapter file. Summer
adds separately named encounter, truck, atmosphere and chapter scripts; see its
play guide for file ownership.

```sh
npm install --ignore-scripts
npx playwright install chromium
node tools/build.mjs
npm test
node tests/bonus.mjs
node tests/ninth-minute.mjs
node tests/long-summer.mjs
node tests/bonus.mjs dist/dr-manhattan.html
node tests/ninth-minute.mjs dist/dr-manhattan.html
node tests/long-summer.mjs dist/dr-manhattan.html
```

`npm test` remains the original nine suites. Run all three bonus suites too,
sequentially, and retain actual exit codes. Tests use setup positioning and some
invulnerability; they are not unassisted human playthroughs or balance reviews.
The optional offline harness is not proof of real file loading or persistence.

Part A comparisons remain in `docs/screenshots/bonus-polish/`; its reproducible
capture script is `tests/capture-bonus-polish.mjs`. The new adventure's 14 review
views are in `docs/screenshots/long-summer/`, produced by
`node tests/capture-long-summer.mjs`. Use the handovers for the authoritative tested
commits and exact results. Nothing is automatically merged or deployed.
