# Dr. Manhattan: The Watchmaker's Son

A browser game inspired by *Watchmen*. You play Jon Osterman's journey: a physicist in 1959, an accident in an intrinsic field chamber, a body rebuilt atom by atom, and then Dr. Manhattan, gaining powers chapter by chapter until the Doomsday Clock reaches midnight.

It runs in any modern browser on Mac or PC, with no installs, no server and no build step.

## Play

- **Easiest:** open `dist/dr-manhattan.html` (one self-contained file). Double-click it, or drag it into Chrome, Safari, Firefox or Edge.
- **From source:** open `index.html` directly. It loads the files in `src/` as plain scripts, so `file://` works.

Progress saves automatically in the browser. The game needs a keyboard and mouse; a trackpad works fine (two-finger click or Ctrl+click is right-click on a Mac).

### Controls

| Action | Keys |
| --- | --- |
| Move | W A S D / arrow keys |
| Aim | Mouse |
| Interact / talk | E |
| Telekinesis | Hold left click or C, move, release to throw (a slow release sets things down) |
| Disintegrate | Q / right click (Ctrl+click on Mac) |
| Teleport | Space (the destination is previewed under the cursor) |
| Duplicate | R |
| Temporal Sight | Hold F / Shift |
| Expand | G |
| Recall the last hint | H |
| Advance dialogue | Space / click / E (hold to fast-forward) |
| Pause | Esc / P (shows the objective and last field note) |
| Mute | M |

Power presses made just before a cooldown ends are buffered, so they fire as soon as they can. Telekinesis can be switched from hold to toggle in **Settings → Controls**.

### Settings and accessibility

Settings has four tabs, and every option describes itself:

- **Audio:** music, sound effects and ambience volumes. Every place has its own ambient bed (the AMBIENCE slider).
- **Display & accessibility:** FLASHING LIGHTS (REDUCED caps full-screen flashes and removes strobes, and is the default when your system asks for reduced motion), SCREEN SHAKE (OFF also removes hit-freeze), film grain, quality, ambient effects, fullscreen.
- **Gameplay:** CHALLENGE (STORY, NORMAL, HARD; also changeable from Pause), INVULNERABILITY, HINTS (ALL or ESSENTIAL), TEXT SPEED, PAUSE WHEN UNFOCUSED.
- **Controls:** telekinesis HOLD or TOGGLE, and the full controls list.

After three decoherences at one checkpoint the game offers to switch to STORY challenge. Checkpoints never go backwards, CONTINUE says where it will take you, and Retry keeps what you'd already earned at that checkpoint.

### Reading the fight

- Every enemy attack is telegraphed: gangsters' aim lines reach you, drones and batteries light up before firing, the Behemoth spins up its guns and opens a hatch before a missile, and Veidt's discs wind up with a glint.
- Red chevrons at the screen edge point to off-screen enemies taking aim and to incoming missiles; orange rings show where shells will land.
- Red arcs around Jon show where a hit came from. Hits freeze the action for an instant and shake the camera (both follow the SCREEN SHAKE setting).
- Jon can't be hurt during dialogue or cutscenes.

### Listening to the fight

- The music reacts to the fight around you, quiets under dialogue, and changes for aftermaths and for the ending you earned.
- A knockout and an unmaking each have their own sound.
- A heartbeat warns of low coherence, tachyon emitters hum as you get close, and static means you're jammed.
- Temporal Sight slows and darkens the sound and adds a ticking pocket watch.
- Footsteps change with the surface, and Mute (M) silences echo tails too.

## The journey

| # | Chapter | Year | Clock | You play as | New powers |
| --- | --- | --- | --- | --- | --- |
| Prologue | The Watchmaker's Son | 1959 | 12 min | Jon, a man | none: walk, talk, repair Janey's watch |
| I | Reassembly | 1959–60 | 10 min | A lone hydrogen atom | **Coalesce**: gather your scattered atoms, rebuild nervous system, blood, bone, muscle |
| II | The Superman Exists | 1960–66 | 8 min | Dr. Manhattan | **Telekinesis**, **Disintegrate** (Nevada test range, then a mob raid in New York) |
| III | The Deterrent | 1971–77 | 5 min | Dr. Manhattan | **Teleport**, **Duplicate** (Operation Blue Fire, the Behemoth) |
| IV | The Watchmaker | 1985 | 3 min | Dr. Manhattan | **Temporal Sight**, **Expand** (the TV studio, building the glass palace on Mars) |
| V | Karnak | 1985 | 1 min | Dr. Manhattan | All of them: tachyon emitters, the Intrinsic Field Subtractor, Adrian Veidt |

Thrown, blasted or bolted people are knocked out: they lie greyed out, drop their gun and get a "spared" tag. Only Disintegrate kills, and the person comes apart into light. A SPARED · GONE tally sits under the objective, and the ending changes with how you treated people. Knocking someone out also gives Jon back a little energy and coherence.

The bosses have rules you can learn. The Behemoth is armoured at the front, weak at the rear (and at its vent once it's in its last phase), and its own missiles hurt it far more when you throw them back. Veidt can't dodge while stunned, held, pinned by a duplicate, recovering from his own dash or winded after three quick dodges, and Temporal Sight catches him most of the time.

## Project layout

```
index.html               Entry point. Declares script load order.
dist/dr-manhattan.html   Single-file build (node tools/build.mjs)
src/
  core/                  Engine-level, game-agnostic
    namespace.js           window.DM, constants, fonts, palette
    util.js                math, easing, colour, geometry, seeded RNG
    events.js              pub/sub bus
    input.js               keyboard/mouse/touch -> named actions
    audio.js               synthesised SFX recipes, ambient beds, hums + step-sequencer music (no audio files)
    settings.js            settings schema: defaults, ranges, labels, descriptions
    save.js                versioned localStorage saves with migrations
    gfx.js                 procedural drawing: characters, portraits, icons, clock, glow
    particles.js, camera.js
    engine.js              loop, letterboxing, scene stack, fades, crash screen
  game/
    entity.js, world.js    entity base + physics, collisions, hitstop/slow motion, rendering
    entities/              player, NPCs, props, projectiles, enemies, chapter specials, fx (knockout, unbinding)
    powers.js              the power registry (one definition per power)
    chapters.js            chapter registry + power progression
    audiodirector.js       picks ambience, music intensity and danger hums from game state
    script.js              ChapterContext: the scripting API chapters use
    ui/                    menu widget, dialogue box, HUD, hit feedback
    scenes/                title, chapter select, interlude, play, overlays, minigames, ending
  data/
    music.js               music tracks as data (layers can fade with fight intensity)
    ambience.js            per-map ambient beds, zones and stage music cues
    chapters/*.js          the six chapters: maps + stage scripts + narration
tests/                   Playwright checks (see Tests below)
tools/build.mjs          single-file bundler (no dependencies)
```

Everything is drawn and synthesised in code, so there are no image or sound assets to manage.

## Extending it

The pieces are designed to be added to without touching the engine.

### Add a power
Register it in `src/game/powers.js`:

```js
Powers.register({
  id: 'gravity', name: 'Gravity Well', action: 'gravity', color: '#9f7bff',
  cost: 30, cooldown: 4,
  desc: 'Bend space around a point.',
  tip: 'Press V to pull everything near the cursor together.',
  update(p, s, world, dt) {
    if (!p.canUsePowers || !DM.Input.pressed('gravity') || s.cd > 0 || !p.spend(this.cost)) return;
    s.cd = this.cooldown;
    // ...affect world.entities around world.mouse...
  },
});
```

Then bind a key in `src/core/input.js` (`gravity: ['KeyV']`, plus `labels`/`short`), add an icon case in `Gfx.icon`, and grant it from a chapter stage: `grants: ['gravity']` and `yield ctx.unlock('gravity')` at the moment you want the unlock card to appear. Later chapters inherit it automatically.

### Add a chapter
Create `src/data/chapters/mychapter.js` and add a `<script>` line for it in `index.html` (chapters play in that order):

```js
DM.Chapters.register({
  id: 'mychapter', numeral: 'CHAPTER VI', title: 'Who Watches', date: '1986', place: 'New York',
  clock: 0, color: '#2a4a6a', music: 'action', form: 'manhattan',
  epigraph: { text: '...', by: '...' },
  intro: ['Narration line one.', 'Line two.'],
  maps: {
    city(ctx) {
      const W = ctx.newWorld({ w: 2000, h: 1400, zoom: 1.2 });
      W.room(0, 0, 2000, 1400);
      W.spawn = { x: 200, y: 700 };
      ctx.add(new DM.Enemies.Gangster({ x: 900, y: 700 }));
      return W;
    },
  },
  stages: [
    {
      id: 'arrive', map: 'city', checkpoint: true,
      run: function* (ctx) {
        yield ctx.dialog([['laurie', 'Jon, look.'], ['manhattan', 'I see it.']]);
        ctx.objective('Find out what happened');
        yield ctx.until(() => ctx.player.x > 1500);
        ctx.objectiveDone();
      },
    },
  ],
});
```

The scripting API (`src/game/script.js`) covers waits, dialogue, narration captions, banners, objectives with progress, hints, markers, power unlocks, minigames, countdowns, camera focus, cutscene locks, map changes, parallel side-scripts (`ctx.fork`) and scoped event listeners (`ctx.on`). Stages marked `checkpoint: true` are where Retry and Continue resume; give earlier stages a `restore(ctx)` if their effects must persist.

### Add an enemy
Extend `DM.Enemies.Enemy` (see `enemies.js`): implement `think(dt, world)` and `render(ctx, world)`. Targeting, stuns, being held by telekinesis, knockouts vs. kills and the stats events all come from the base class.

### Add a character
Add an entry to `DM.LOOKS` in `src/game/entities/npc.js`. The same look drives the top-down figure and the dialogue portrait, and the key is the speaker name in dialogue lines.

### Add music
Add a track to `src/data/music.js` (chord progression + arp/pad/bass/tick/kick layers) and reference it from a chapter's `music` field.

### Add sounds and ambience
Sound effects are recipes in `src/core/audio.js`; another file can add one with `DM.Audio.define('name', { fn(audio, opts) { ... } })`. A place's ambient bed, footstep surface and zones, and the music cue for each story beat, live in `src/data/ambience.js`. `npm run test:audio` fails if any `Audio.play('name')` in `src/` has no recipe.

## Developer mode

Add `?dev` (or `#dev`) to the URL:

- every chapter unlocked in Chapter Select
- <kbd>]</kbd> skips the current stage
- <kbd>`</kbd> toggles a debug overlay (fps, entities, stage, player state)
- `DM.dev.start('mars', 2)` in the console jumps to any chapter and stage

## Tests

The tests drive the real game in headless Chromium via Playwright (`npm install`, then `npx playwright install chromium` the first time).

```
npm test                   # every suite below
npm run test:powers        # each power, driven by simulated mouse/keyboard input
npm run test:flows         # story triggers: the prologue's full path, Chapter I, Chapter II's range
npm run test:smoke         # every chapter start to finish, every checkpoint, death -> retry; screenshots in tests/out/
npm run test:saves         # save migrations, checkpoints, Continue/Retry, boot robustness
npm run test:settings      # settings schema, challenge levels, reduced flashing, hints, text speed
npm run test:ledger        # spared/gone accounting, hit feedback, hitstop and slow motion, decoherence
npm run test:encounters    # enemy telegraphs, threat chevrons, Behemoth and Veidt fairness, mines
npm run test:audio         # every sound name has a recipe, ambience, reactive music, Sight's pitch bend
npm run build              # rebuild dist/dr-manhattan.html after changing src/
```

## Roadmap ideas

- Touch controls (virtual stick + power buttons) for tablets
- Gamepad support (the input layer is already action-based)
- Free-play sandbox with every power and spawnable enemies
- More chapters: the Crimebusters meeting, the Keene Act riots, the Comedian, Rorschach in Antarctica
- Power upgrades between chapters (range, cost, duration) using the existing per-power state
- Branching consequences: the spared/disintegrated tally already feeds the ending
- Accessibility: key rebinding UI, colour-blind-safe telegraphs

## Credits

A non-commercial fan project inspired by *Watchmen* by Alan Moore, Dave Gibbons and John Higgins. Not affiliated with or endorsed by DC. All dialogue and narration is original writing; chapter epigraphs are quotations from public figures. Fonts: Oswald, Special Elite and Patrick Hand (SIL Open Font License) via Google Fonts, with system fallbacks.
