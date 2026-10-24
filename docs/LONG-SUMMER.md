# The Long Summer — Bonus III

An original optional fan story for *Dr. Manhattan: The Watchmaker's Son*.

## Play

Open `dist/dr-manhattan.html` in a desktop browser, click to enable sound, choose
**BONUS LEVELS**, select **03 THE LONG SUMMER**, then **PLAY THE LONG SUMMER**.
The same file contains the original campaign and all three bonus adventures.
No earlier completion is required. Keyboard and mouse/trackpad are required.
Touch gameplay has not been implemented.

WASD/arrows move, mouse aims, C/left mouse holds telekinesis, Q disintegrates,
Space teleports, R duplicates, F/Shift uses Temporal Sight, G expands, E interacts,
H recalls the hint, Esc pauses and M mutes.

## Blackout Avenue

Bring **CITY HEAT below 40**, use E to ask Nite Owl to open the balcony, then enter
the tenement. Unmaking people, the Comedian firing and spreading flames raise
Heat. Nonlethal restraint, peaceful departures, rescues and extinguishing fires
reduce it. At 70 or above, bounded reinforcement waves arrive. Below 30,
unengaged rioters may leave instead of attacking.

Aim at the Comedian, hold C and release: he is disarmed for ten seconds. Otherwise
he can shoot a knocked-out rioter. An amber aim line warns before he fires.
Re-grabbing him while already disarmed does not repeatedly award the Heat reduction.

Lift a red hydrant to create water. It extinguishes nearby fire. Molotovs can be
caught and guided or thrown into the water to snuff them. E at the balcony makes
Nite Owl grapple across and open the route; Manhattan does not simply open it.

## The Tenement

Six residents must physically reach the green street exit. E asks them to follow;
telekinesis can carry them. A held resident is not counted as safe until released
at the exit. A nearby duplicate can start another resident's escort while Jon
works elsewhere.

Lift the fallen beam to clear the staircase. At the top landing, G to expand,
then E at the roof latch: ventilation stops the spread and reduces the smoke,
not every existing flame. F shows amber outlines of the fire's next three world
seconds, using the same deterministic rule as its actual spread.

The looter is the only human combatant in the building. Residents are rescue
targets rather than destructible combat targets. Fire threatens Jon and raises
Heat; residents do not have a hidden death timer. This avoids an unrecoverable
six-person objective. Natural pacing and difficulty still need human review.

## The Armoury Truck

The cannon and four wheels are teal mechanical targets. Q or impacts can disable
them without killing the driver. The amber cab contains a person: Q on the cab
is lethal. Normal impact on it does not count as disintegrating the driver.

The cannon warns before sweeping water, which damages and pushes Jon. Mortars
mark their landing area before gas appears. Gas dims the view and slows Jon while
he is inside. Below half mechanical health, a marked lane warns of a physical ram.

A surviving driver can be guided with E or carried to the green safe passage.
The Comedian may try to finish him. Restraining the Comedian is part of securing
the nonlethal outcome, not just dialogue.

## Consequences

- **Mercy:** no fatalities, six residents rescued and Heat below 40.
- **Silence:** Heat at least 70, or fatalities exceed people spared.
- **Order:** the remaining mixed/uneasy outcomes.

Jon's unmakings and the Comedian's casualties are separate. A knocked-out person
later killed by the Comedian is removed from spared and counted once as his
casualty, not falsely labelled an unmaking by Jon. Both fatality types influence
the ending. The final screen reports spared/unmade, Comedian casualties, rescued
residents and Heat, with a different Comedian line for each tier.

## Saves

The adventure uses ID `long_summer` within `dr-manhattan.bonus.v1`, with its own
checkpoint/completion record. Retry recreates the current map from its starting
carry; it is not a continuous quicksave. The campaign and both previous adventures'
records are retained. Settings are shared. Browser storage availability and
cross-file save migration are not guaranteed.

## Source

| File | Responsibility |
| --- | --- |
| `src/game/long-summer-kit.js` | Heat, fire, water, Molotovs, rioters, Comedian, residents, beam |
| `src/game/long-summer-truck.js` | Mechanical targets, driver, water/gas, ram, boss framing |
| `src/data/bonus-summer-atmosphere.js` | New looks, procedural scenery, synth recipes, ambience, two tracks |
| `src/data/chapters/long-summer.js` | Maps, scripts, original dialogue, Owl grapple, endings |
| `tests/long-summer.mjs` | Input-driven acceptance, saves, consequences, loudness |
| `tests/capture-long-summer.mjs` | Reproducible map/Sight/attack screenshots |

The existing BonusKit is reused. The only modified existing production JavaScript
file is `src/game/bonus.js`, to fit three menu cards. Script-list additions are in
`index.html`. Street facades use the existing per-map wall-style interface; Heat
and hazards use existing entity rendering. No global HUD/rendering replacement,
new runtime library or build framework is introduced. Original chapters, music,
physics, powers, lighting, weather and the earlier two bonus chapter files remain
unchanged.

## Verification / review

Rebuild with `node tools/build.mjs`. Run the original nine via `npm test`, then
`node tests/bonus.mjs`, `node tests/ninth-minute.mjs` and
`node tests/long-summer.mjs`, sequentially. Run each bonus suite again with
`dist/dr-manhattan.html` as its argument. `node tests/capture-long-summer.mjs`
produces normal and Sight views of all maps plus the truck's water sweep and ram.

The optional `--offline` harness is only a restricted-runtime fallback, not proof
of real file loading/storage. The final normal-file results are in
[the handover](LONG-SUMMER-HANDOVER.md). Tests use positioning shortcuts and some
invulnerability, not an unassisted human playthrough. Subjective listening,
Safari/Firefox, mobile gameplay and low-end-device performance remain unverified.

The initial truck tutorial strip can overlap Jon near the lower screen area;
it expires, but this deserves a readability pass. Do not confuse passing bounds
checks with proof that every transient UI overlay is ideal.

This is a draft candidate on `codex/bonus-three`, PR #4 into `codex/bonus-polish`.
No merge or external live-site deployment has been performed.
