# Bonus adventures

Open `index.html` or `dist/dr-manhattan.html` in a desktop browser. Click once for sound,
then choose **BONUS LEVELS**. Select an adventure with its card or the left/right keys.
Neither requires campaign completion. Keyboard and mouse/trackpad are required; touch
controls are not implemented. Both begin with all six Manhattan powers.

## The Last Broadcast

New York, November 1976. Nite Owl and Rorschach investigate three missing radio engineers.
Cross the rooftops, free the engineers, put the blue circular and gold square coils in
matching docks with telekinesis, then break three shield pylons and disable the Carrier.
The optional evidence changes the conclusion. Broadcasting brings interceptors; shutting
down quietly avoids that fight.

The polished rooftops have wet tar, water towers, fans, antenna beacons, skylights and a
neon station sign. The relay has meters, tape reels, cables, a glass booth and engineer
cages. The transmitter sits beneath a lattice mast and guy wires. Rain, relay hum,
Switchman's radio cadence and distance-sensitive static give the place its own sound.
The Carrier tracks Jon with two dishes, warns before sweeping a beam, drops its casing
when the shield fails, and detaches both dishes for its damaged phase.

**Companion jobs:** knock out a guard rather than unmaking them, then press E nearby to
let Rorschach question them for evidence. At the locked booth, E calls Nite Owl to hack;
keep nearby enemies away for four uninterrupted seconds. Killing the guard removes the
interrogation opportunity. Neither job is required to finish the main rescue objective.
The ending and Rorschach's final line distinguish no human deaths, mixed actions, and
more people unmade than spared. Damage from ordinary throws remains nonlethal.

## The Ninth Minute

New York, February 1977. Join Silk Spectre and Nite Owl at Harrow Street, where six people
are caught in a repeating moment. Set the signal to SERVICE, clear drones and cross the
rail hazards. E calls Laurie to each carriage; protect her while she opens it. Passengers
count only when they reach the exit. There are three optional memories revealed by F.

The station has cream/green tiles, masonry signage, benches, a newsstand, litter and
platform lights. A three-car ghost train arrives, opens, departs and rewinds on the same
nine-second clock as the hazards. Its seven silhouettes gain colour under Temporal Sight.
Tunnel rumble, wheel squeal, doors, a sparse announcement and rewind sound follow that
clock. Four human transit guards repeat their patrol until engaged. Laurie reacts once
to the first one unmade; the completion screen records spared/gone and has three moral
conclusions.

The Pendulum now swings a weighted arm with real contact. Its amber arc warns before a
sweep; the brass shutter visibly opens on its core. Below half health the clock fractures
into two counter-swinging arms. Returning a missile still opens the core early. The camera
frames both Jon and the boss rather than leaving the boss beneath the HUD. Release the
loop immediately, or hold F in the anchor to preserve its records. Both routes can rescue
the passengers.

## Preserved campaign and saves

The original six chapter files, their soundtrack data and original ending remain unchanged.
Both bonus records live in `dr-manhattan.bonus.v1`, separate from campaign progress,
Continue and ending totals. Settings are shared. Blocked browser storage permits only
session progress; cross-file save migration is not guaranteed. This is original fan fiction,
not official Watchmen continuity.

## Architecture

- `src/game/bonus.js`: bonus registry, menu and isolated persistence.
- `src/game/bonus-kit.js`: shared labels, terminals, lights, companions, masks, swept-contact
  geometry, encounter camera framing and moral summaries.
- `src/data/chapters/last-broadcast.js` and `ninth-minute.js`: story/maps/encounters.
- `src/data/bonus-broadcast-atmosphere.js` and `bonus-ninth-atmosphere.js`: procedural scenery,
  original bonus ambience/recipes and timed environmental animation.
- `src/core/gfx.js`: the only new core rendering hook is optional `look.mask(ctx, t)`.
  It does nothing for existing campaign looks. No global portrait/HUD/follower override is used.

The base branch lacks the proposed generic entity-light callback. Bonus map lighting
profiles therefore forward each bonus entity's `light()` through the existing profile
`lights(world, add)` API. This keeps the original lighting engine unchanged.

## Test and rebuild

```sh
npm install
npx playwright install chromium
node tools/build.mjs
npm test
node tests/bonus.mjs
node tests/ninth-minute.mjs
node tests/bonus.mjs dist/dr-manhattan.html
node tests/ninth-minute.mjs dist/dr-manhattan.html
```

Run all eleven suites sequentially, retain real exit codes, and retry a failure once before
diagnosing it. The original nine suites are not weakened. The bonus tests use real inputs
with setup shortcuts and some invulnerability; they do not prove balance or a complete
unassisted playthrough. Offline harness results do not prove file loading or persistence.
GitHub runners use real file navigation and normal browser storage.

To reproduce the visual comparison, check out baseline `5f64f6dd98bb649d15f435e136a816deb96157c3`
in a separate folder, then run:

```sh
node tests/capture-bonus-polish.mjs --before-root=/path/to/baseline
```

It produces 41 screenshots at 1280x720: six maps before/after, each normally and under Sight;
both phases of both bosses before/after, normally and under Sight; and the original pier.
The capture settings are recorded beside the images. They use actual four-second gameplay,
clear dialogue and restore coherence each second. Map overview cameras match literally;
boss comparison uses the same player position and the actual encounter camera.

## Review boundary

Work is on `codex/bonus-polish`, for a draft PR into `chatgpt/bonus-adventures`. Nothing is
merged or deployed. PR #1 and all `claude/*` branches remain separate. The future third
adventure is gated by the Part A review, not bundled into this build.
