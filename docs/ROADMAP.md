# Roadmap

The plan for improving the game, package by package. Each package is a self-contained piece of work with a goal, the files it owns, and items with a proposal and acceptance criteria. Line numbers inside proposals refer to the ORIGINAL first build (commit 56505f5) and have drifted since: find code by content, and re-check each claim against the current code before acting on it.

Iteration 1 (packages A-G) is DONE and shipped: see the README for what it added.

## Iteration 2

Order that worked well: wave A = N, H, J (in parallel or one after another), merge and test, then wave B = I, K, L on top.

### Cross-package contracts (read before starting any package)

```text
ITERATION 2 runs on top of the shipped iteration 1 (packages A-G merged, reviewed and fixed). Iteration 2 is built in two waves:
WAVE A (in parallel): N, H, J.  WAVE B (later, on top of merged wave A): I, K, L.

WHAT EXISTS NOW (use directly, no feature detection):
- A: World.hitstop(t), world.slowmoT/slowmoTarget (scripted slow motion), world.slowmoScale (Sight speed) and world.sightFloor (tachyon clouds), Camera.kick, Player.damageMul/regenDelayBase/lastHit/hurtDirs, DM.Feedback, DM.FX.knockout/unbind/FloatText, the spared/gone ledger (only Disintegrate kills humans; enemy:down {lethal}).
- B: telekinesis throw model (velocity history, aim assist via isFoe in powers.js, set-down), buffered presses, Powers.renderReticle, Powers.teleportDest, channelRegen/regenMul, KO refund, Input actions telekinesis(C)/hint(H), tkMode setting.
- C: renderEmissive telegraphs on every machine and Veidt, HUD.renderThreats chevrons, DM.Enemies.TUNING.{BEHEMOTH,VEIDT}, Machine.powerDown(world) (sets downT), Mine (hazard), TachyonCloud, tests/encounters.mjs (fixed-step driver you can copy).
- D: DM.Lighting (dark layer) + per-map profiles in src/data/atmosphere.js (DM.Atmosphere.register), DM.Weather, Gfx.postFx, QUALITY tiers + frame governor (Engine.measure/governor/notice), world.lit / world.sightK / world.mapId, World.keepsColour(e) (isPlayer, isDuplicate, timeless, hazard, enemy projectiles, Memory keep colour under Sight), tests/visual.mjs.
  NEW CONTRACT: any entity can light itself by defining e.light(world, t) -> null | { r, i, color, k, cone, spread, x, y } (lighting.js). Glowing things you add should use it; text/markers you add that must read at night should draw in renderEmissive(ctx, world) and call it from render() only while !world.lit.
- E: src/core/audio.js recipes; DM.Audio.define(name, { gap, ui, fn(audio, opts) }) and Audio.has(name); src/data/ambience.js (per-map beds/zones, stage music cues 'chapter.stage'); src/game/audiodirector.js (wraps DM.Engine.frame; reads world/player state; threat via e.threatWeight). tests/audio.mjs FAILS if any Audio.play('name') in src/ has no recipe: define every new sound name you play, with DM.Audio.define in one of YOUR files (do not edit audio.js unless you own it).
- F: 'play:begin' {scene, chapter, stage, retry}; ctx.clearHostiles/tween/memo/once; Save v2 with per-chapter checkpoints and carry {stats, found memories, persistFlags}; ch.persistFlags; Save.data.seen.
- G: DM.SettingsSchema (add settings as self-contained schema entries), challenge levels, reduced flashing (SettingsSchema.reducedFlashing()/flashCap()), hints (ctx.hint / ctx.tutorial, H recalls), textCPS()/readTime().

CROSS-PACKAGE CONTRACTS FOR ITERATION 2
- N owns Engine.frame (fixed-step accumulator) and must keep calling this.frame through the object (the audio director wraps it) and keep Engine.measure/stats/governor working. N provides DM.dev.advance(seconds), DM.dev.seed(n), DM.rng (seeded gameplay RNG in util.js: DM.rng.random()/range(a,b)/pick(arr)) and DM.dev.onFrame(fn). Other packages: use DM.rng (fall back to Math.random if absent) for gameplay randomness; use DM.dev.advance in new tests when it exists (feature-detect in wave A).
- N owns tests/flows.mjs and tests/smoke.mjs conversions. H and J must NOT restructure flows.mjs/smoke.mjs: put new story checks in tests/story.mjs (H) and enemy checks in tests/encounters.mjs (J, append a section). Only touch an existing flows/smoke check if your change intentionally breaks it, and then minimally.
- superman.js: H owns it, except exactly two spawn lines J adds inside spawnGroup (J: mark them with a trailing comment '// J'). H's pier cops/witness/getaway live in buildPier and stage scripts.
- npc.js LOOKS: H adds 'cop' and 'witness'; J adds 'soldier'/'crewman'; I (wave B) adds what Laurie needs. Add entries; do not reorder.
- deterrent.js: J owns wave specs and Ch III humans; H adds ONE line of general's dialogue to deterrent's outro mentioning a private contractor with a gold V everywhere (coordinate by appending a single line inside the existing outro dialog array).
- overlays.js: H owns the Chapter Complete memory total (no hard-coded '/ 6': read the chapter's memory count) ; K (wave B) owns GameOver and the Pause LOG.
- engine.js: N owns frame(); L (wave B) may add an 'engine:resize' DM.Events emit inside Engine.resize.
- special.js: I (wave B) owns Atom, Memory, BodyForm, Vortex; L (wave B) owns Meteor, Afterimage, Duplicate and new VFX classes; C's Mine/TachyonCloud stay as they are unless a package needs a tiny fix.
- New sounds: DM.Audio.define in your own files. New lights: e.light. New hazards visible under Sight: e.hazard = true.

TESTS: every package keeps ALL suites passing in its worktree: node tests/{smoke,visual,audio,powers,saves,settings,ledger,encounters,flows}.mjs, plus its own new suite. Line numbers in the specs refer to the ORIGINAL 56505f5 code; iteration 1 moved a lot, so locate code by content and re-verify every claim before acting (some items may already be partly done by iteration 1 - then do the remainder and say so).
```

### H. Story stakes & ending payoffs

**Status:** IN PROGRESS: branch `claude/iter2-wip-H` (unverified WIP, see HANDOVER.md)

**Goal:** Turn the now-correct ledger into story. The ending reflects how you played, Chapter II's raid delivers what its briefing promises, and the prologue's last seconds belong to the player. Owns ending.js, a new src/data/ending.js, superman.js (except the spawn lines package J adds), prologue.js, the npc.js LOOKS for a cop and a witness, and props.js. Builds on F's persistFlags and ctx.once, and on A's ledger rule.

**Files:** `src/game/scenes/ending.js`, `src/data/ending.js`, `src/data/chapters/superman.js`, `src/data/chapters/prologue.js`, `src/game/entities/npc.js`, `src/game/entities/props.js`, `src/game/scenes/overlays.js`, `tests/flows.mjs`

1. **A data-driven ending with tone tiers and flag pages**
   - *Impact:* high: only page 4 of 5 varies (ending.js:35-44). An empty ledger renders 'I chose to set 0 people down gently' (review/content/shots/ending-p4.png), and the memory total is hard-coded as '/ 6' (ending.js:94, overlays.js:284).
   - *Proposal:* src/data/ending.js: pages: [{text | text(stats, flags), when?(stats, flags)}]. Ending reads this list. Tones: unknown (no human data: a neutral line), gentle (killed 0 and spared > 0), mixed, detached (killed > spared). Each tone has its own page set. Payoff pages appear for all memories found and for persisted flags (heldWatch, molochArrested or molochEscaped, and the witness and laurie flags from package I). Chapters declare memories, so the memory total is the sum from data. Ending exposes this.tone so package E can choose the track. All text is original.
   - *Acceptance:* On a fresh save, the Ending contains no '0 people' wording. Seeding (12 killed, 0 spared), (0, 12) and (5, 7) gives three distinct page sets. The memories row reads N/total. flows passes.
2. **The pier raid delivers its briefing: pinned officers, presses, a getaway, the river**
   - *Impact:* high: the captain says his men are pinned and a counterfeit plant is running (superman.js:294), but buildPier adds only the captain. The three stages are the same 'Clear the X' objective, and the river is decoration.
   - *Proposal:* (1) 3 cop NPCs (team 'player', targetable, hp 30) crouched behind the sedans at (620,1020), (1700,1060) and (140,930). Enemy.acquire already shoots at them. The yard objective gains the subline 'Officers safe n/3', and the aftermath line branches on the count. (2) 2 destructible counterfeit presses in the warehouse (hp 220, static, can be disintegrated) with an optional 'Shut down the presses' objective and a burst of money-paper particles. (3) A new 'getaway' stage: a sedan carrying Moloch drives west from the bottom door (1425,900) along y 1100. Catching and setting it down arrests him (spared+1, flags.molochArrested). Disintegrating it is lethal. If it escapes past x < 60, flags.molochEscaped. The aftermath and the newspaper line branch on the result. (4) River: a gangster thrown past y > 1300 gets a splash burst and is KO'd and 'fished out' (spared); crates sink. Use ctx.once for the briefing on retry. Fix the range floor label that is half-covered by the sandbag wall (superman.js:52, move it to y ≈ 300).
   - *Acceptance:* dev.start('superman', 1) shows officers taking fire behind the cars. The warehouse holds two destructible presses. After the office, 'Stop the getaway car' appears, and catching it versus disintegrating it gives different aftermath lines. Throwing a gangster into the water increments spared.
3. **The prologue lockdown's last 16 seconds belong to the player**
   - *Impact:* medium: during lockdown only the door and the window can be used (prologue.js:297-298), against a 16 s countdown.
   - *Proposal:* Add 4 futile interactables, each enabled only while flags.lockdown and each with one original line: the intercom (Wally reassures, then breaks off), the override lever (turns and does nothing), the coat (take Janey's watch out and hold it; sets flags.heldWatch, which changes the post-flash narration and persists for the ending), and the generator housing. Janey arrives at the window at about 8 s via NPC.walkTo. Add 1-2 flavour props to the Records room.
   - *Acceptance:* At least 5 prompts can be reached within 16 s. Holding the watch changes the post-flash narration. flows still reaches 'August 1959. I am taken apart.'
4. **Plant Veidt before Chapter V**
   - *Impact:* medium: grep finds Veidt only in karnak.js, so 'an old friend is waiting' has nothing behind it.
   - *Proposal:* Chapter II: a pier billboard decal 'VEIDT ENTERPRISES: TOMORROW, TODAY' (an original slogan) and gold-V stencils on two warehouse crates. A one-line general's remark about a private contractor with a gold V everywhere goes into deterrent's outro dialogue, coordinated with package J, which owns deterrent.js in iteration 2. The Chapter V callback line goes in package I's Karnak work.
   - *Acceptance:* Chapters II and III each show a V motif or line in a screenshot. No verbatim Watchmen text.

### I. Chapter set pieces: Reassembly, Mars, Karnak

**Status:** NOT STARTED

**Goal:** Give each late chapter a distinct beat instead of repeating one loop. Chapter I's four layers change and show the story, Mars has landmarks and Laurie walks with Jon, Karnak's courtyard and emitters become real encounters, and the climax ends in a choice made through the player's own actions. Starts by extracting the duplicated reassembly routine. Owns reassembly.js, mars.js, karnak.js, a new src/game/routines.js, and the Atom, Memory, BodyForm and Vortex classes in special.js.

**Files:** `src/game/routines.js`, `src/data/chapters/reassembly.js`, `src/data/chapters/mars.js`, `src/data/chapters/karnak.js`, `src/game/entities/special.js`, `src/game/entities/npc.js`, `index.html`, `tests/flows.mjs`

1. **Extract DM.Routines.reassemble, then give Chapter I's layers twists and witnesses**
   - *Impact:* high: the reassembly mechanic exists twice (reassembly.js:73-87, karnak.js:148-189). Chapter I is four copies of one gather loop: the bot took 270 s, with layers of 68/76/68/58 s. The layer captions describe guards and curtains, but bakeVoid draws only a grid.
   - *Proposal:* routines.js: reassemble(ctx, {at, H, depositR, layers or quota, atoms: {initial, ring, bounds, maintain, cluster}, vortexSpeed, objective, onLayer}). BodyForm gains deposit(), setProgress() and *materialize(). Chapters I and V call it. Each LAYERS entry gets a twist: 'orbit' (clusters move tangentially), 'storm' (clusters spawn on vortex paths), 'hunt' (vortices 30% faster, but a pickup gives a speed surge). An observation-window decal at the top of the grid shows a tableau that changes per layer: two guards, a recoiling technician with curtains closing, a scientist with a clipboard, then Janey alone. Each layer has one golden memory atom with an original 1959-60 caption, feeding stats.memories. Layer 4's quota drops to 45.
   - *Acceptance:* karnak.js contains no deposit loop. Each of the 4 layers shows a different tableau and behaviour. 4 golden atoms raise memories. The bot finishes in 270 s or less, and flows and smoke pass.
2. **Mars: landmarks, memory cues, and Laurie walking with you**
   - *Impact:* high: rocks cover 1.4% of a 2400×2400 map. Memories are invisible without F (a 10 px glint at 0.35 alpha shown about 13% of the time) and are lost for good once the chapter ends. Laurie appears only in a 6-line locked cutscene (mars.js:343-352).
   - *Proposal:* Landmarks: a NE chasm (wall style copied from deterrent's chasm) with a great crystal on the far side, so the player must teleport over, Expand, then lift it back; two crater rims with gaps; a rust-tinted dust-devil Vortex field that shoves shards; a ridge whose shadow hides memories; a drifting Phobos shadow. Move each memory next to a landmark. Memory cues: an 18 px glint shown about 35% of the time, plus a clock tick that speeds up within 500 px. Before the Laurie stage, if any memories are missing, Jon remarks that something is still hidden and the palace waits for an E press. Laurie stage: she follows Jon via NPC.walkTo. Objective 'Show Laurie what you see 0/3'. Her 3 memories (colour #c7a2c2) reveal only under Sight while she is within 200 px, each with an original 2-line exchange, and the third triggers the existing realisation lines. Add the studio sponsor V line and the 1966 memory line. flags.laurie persists.
   - *Acceptance:* The map overview shows at least 5 landmarks and at least 5% wall coverage. One great crystal requires teleport plus Expand. A blind sweep notices at least 3 memories through the cues. The Laurie stage runs 0/3 → 3/3. flows completes the chapter.
3. **Karnak: a Hall of Screens, four different emitters, and the witness in the snow**
   - *Impact:* high: the 24-pillar courtyard is an empty corridor. All four emitters are the same puzzle (karnak.js:23). Veidt explains himself only after the fight, and the climax is a locked dialogue with no player choice.
   - *Proposal:* New checkpointed 'hall' stage between emitters and subtractor: monitor-wall decals with static and tickers, 3 original Veidt PA lines, TachyonDisc projectors on 6 pillars firing on staggered timers, 2 turrets on the carpet, and side alcoves. Emitter options: E1 open; E2 inside a ring of ice walls whose gap faces away; E3 on a rail (moving shield, rail code from Dummy, props.js:239-256); E4 with a turret inside the shield plus 3 drones. Laurie waits at the gate and speaks one original line during reassembly. 3 unarmed technicians flee west when the gate opens, and the ledger counts them. Final 'witness' stage with no objective text: a masked investigator walks toward the west edge. Disintegrating him sets flags.witness = 'silenced' (killed+1). Letting him leave sets 'free'. Teleporting in front of him and pressing E plays a 3-line exchange, then 'heard'. Add the 'You were in every room, Adrian' callback.
   - *Acceptance:* Crossing the hall takes at least 30 s with the PA playing, and its checkpoint reloads. A screenshot shows the ice ring, the moving emitter and the turret inside a shield. All three witness outcomes set the persisted flag, and the ending (package H) shows a different page for each.

### J. Enemy depth: smarter mobs, new archetypes, humans in every war

**Status:** IN PROGRESS: branch `claude/iter2-wip-J` (unverified WIP, see HANDOVER.md)

**Goal:** Make fights ask for more than one answer. Gangsters use cover and can surrender, new archetypes showcase telekinesis, machines show their damage, and Chapter III puts human lives back in the player's hands. Owns enemies.js and projectiles.js, plus deterrent.js wave specs, and adds exactly two spawn lines in superman.js spawnGroup (package H must not edit those lines).

**Files:** `src/game/entities/enemies.js`, `src/game/entities/projectiles.js`, `src/data/chapters/deterrent.js`, `src/data/chapters/superman.js`, `src/game/entities/npc.js`, `tests/encounters.mjs`

1. **Machines show progress: HP pips, damage states, knockback**
   - *Impact:* medium: a tank takes 4 Disintegrates (240 hp) and a battery or emitter takes 3, with no sense of progress beyond a 0.12 s flash. Non-boss enemies have no HP display.
   - *Proposal:* Machine.renderPips: a segmented bar for maxHp > 70, one pip per 70 hp, shown for 1.8 s after a hit (in renderEmissive). Below 50% hp, a dark smoke puff about every 0.25 s and a scorch decal on tank hulls. Duplicate bolts apply an impulse of 60.
   - *Acceptance:* After one Q on a tank, its pips show 3/4 for 1.8 s, and below half hp smoke appears.
2. **Gangsters use cover, hear gunfire and can surrender**
   - *Impact:* high: the only behaviour is strafe-and-fire in the open (enemies.js:152-187). In one run the yard's last gangster stood idle behind a wall while his allies went down.
   - *Proposal:* Cover: when not aiming, every 1.5-3 s sample 8 points within 160 px, pick one without line of sight to the target that is near a peek point, move there, then step out to aim. alertNear(450) on gunshots and on KOs. Morale: when at least half of the allies within 500 px are neutralised, or Jon lifts a vehicle or expands within 300 px, each remaining gangster has a 35% chance to surrender: drop the gun, raise hands, bark, and take a die('surrender') path that emits enemy:down with lethal false.
   - *Acceptance:* With cover available, a gangster with clear line of sight moves out of it within 3 s. Neutralising 3 of the 4 yard gangsters makes at least one surrender across 20 seeded runs, and surrender increments spared.
3. **New archetypes that teach catch-and-return: Grenadier, Bruiser, Kamikaze drone**
   - *Impact:* medium-high: players first meet 'catch it and throw it back' in Ch III via a hint, and the mob has only one AI.
   - *Proposal:* Grenadier: lobs a grabbable Grenade (1.6 s fuse, red landing ring, switches team when grabbed). Bruiser: hp 60, a 0.5 s crouch telegraph, then a 420 px/s rush that stuns Jon for 0.3 s; grabbing him mid-charge keeps his momentum. Kamikaze drone: dives and explodes; when grabbed it becomes a thrown bomb. Place one Grenadier in the Ch II office and one Bruiser in the warehouse (the two spawn lines), and add kamikazes to Ch III waves.
   - *Acceptance:* A grabbed grenade thrown at a gangster KOs him under A's ledger rule. All three appear in play, and smoke checkpoints pass.
4. **Humans in Chapter III, and Operation Blue Fire from every side**
   - *Impact:* high: every enemy after Chapter II is a machine, so the ending is decided in about three minutes of Chapter II. All waves spawn from one 180 px strip on the east edge (deterrent.js:110-116).
   - *Proposal:* Tank.onDeath (when not disintegrated) spawns 2 unarmed Crewmen (a new soldier look) who flee to the command post (1450,900). Reaching it counts as spared; disintegrating one is lethal; disintegrating the whole tank emits 2 lethal downs. Wave specs gain from: ['east','north','south','west'], used by edgeSpot. Wave 3 'INCOMING': batteries target the command post, with the objective 'Protect the command post (hits 0/3)'.
   - *Acceptance:* Destroying a tank by impact spawns 2 crew, and the deterrent ChapterComplete shows SPARED and DISINTEGRATED rows. Logged spawn positions differ by lane. Wave 3 fails and retries after 3 hits. flows reaches the outro.

### K. Readability & onboarding UI

**Status:** NOT STARTED

**Goal:** Make the HUD and the overlays teach and inform. The objective marker, power slots, death screen and dialogue history give players what they need to recover and keep going. Owns hud.js (except package C's threats and boss bar), overlays.js, dialog.js and interlude.js text layout, plus a new src/data/tips.js.

**Files:** `src/game/ui/hud.js`, `src/game/scenes/overlays.js`, `src/game/ui/dialog.js`, `src/game/scenes/interlude.js`, `src/data/tips.js`, `src/core/gfx.js`

1. **Objective marker and power slots that explain themselves**
   - *Impact:* medium: the offscreen marker is a 20×18 px yellow arrow with no label (hud.js:354-368), barely visible on the prologue wall (12-prologue-11s.png). Power slots show only an icon and a key (hud.js:242-249).
   - *Proposal:* Marker: a 28 px chevron with an ink stroke and glow, a backed label '<LABEL> 12m' kept on screen, and a 1.5 s pulse when the marker changes. The on-screen label sits on a backed pill at 13 px. Power slots show their name for 6 s after unlock and on hover, with a pulsing border for new powers. Add a 'MEMORIES n/6' chip in Mars after the first find.
   - *Acceptance:* In the prologue at 11 s, the screenshot shows a labelled 'JANEY 12m' arrow. A newly unlocked slot shows its name.
2. **UI scale and a minimum font size**
   - *Impact:* medium: in a 1024x600 window, 10-11 px HUD labels render at 8 px; at 900x900 about 7 px (30-size-900x900.png).
   - *Proposal:* settings.uiScale 100/125/150%: each anchored HUD block uses save/translate/scale. A global DM.UI_MIN_FONT of 12 logical px is respected by HUD text.
   - *Acceptance:* At 1024x600 no HUD text is below 9.6 CSS px. At 150% the blocks do not overlap the boss bar.
3. **A Game Over screen that says what happened**
   - *Impact:* medium: GameOver always shows the same line and two buttons (26-gameover.png).
   - *Proposal:* Read player.lastHit (package A) and render 'Last hit: <kind>', one tip from src/data/tips.js (keyed by chapter stage, falling back to damage kind), and 'Retry from: <stage label>' (add labels to the checkpoint stages).
   - *Acceptance:* Dying to a tank shell in waves1 shows the explosion tip and 'Retry from: Wave 1'. Dying to Veidt shows a Veidt tip.
4. **Dialogue backlog, auto-advance and an interlude that respects its gutters**
   - *Impact:* medium: a missed line is gone for good. The interlude narration and epigraph run across the black gutter at x = 432-444 (tests/out/prologue-0-interlude.png).
   - *Proposal:* DM.Log, a 60-entry ring buffer fed by Dialog.open and HUD.caption, with a LOG entry in Pause that scrolls. An auto-advance option waits 1.2 s + 0.035 s per character. The interlude draws merged panels from a layout list (wide title panel and wide narration panel in caption boxes), panels fade in with the narration index, and text never crosses a gutter.
   - *Acceptance:* Auto-advance completes the Mars studio dialogue with no input. Pause → LOG shows the last Janey lines. A layout-rectangle test asserts no interlude text overlaps a gutter in any chapter.

### L. VFX II & render quality

**Status:** NOT STARTED

**Goal:** Second graphics pass, after lighting lands. Explosions that never hide the action and leave marks, a floor that stays sharp on Retina screens, objects that visibly lift, and powers with readable motion. Owns World.render's particle and floor passes and World.bake, particles.js, the Meteor, Afterimage and Duplicate classes in special.js, and small VFX hunks in powers.js.

**Files:** `src/game/world.js`, `src/core/particles.js`, `src/core/gfx.js`, `src/game/entities/special.js`, `src/game/powers.js`, `src/core/engine.js`

1. **Explosions with soft smoke under characters, a shockwave sprite, and lasting scorch, craters and ash**
   - *Impact:* medium: explosion smoke is hard black discs drawn over Jon (h09-duplicate.png). Meteor craters push a new closure into world.decals for every impact (special.js:629), so the per-frame decal cost grows without limit.
   - *Proposal:* World.stamp(fn) draws once into floorCanvas and keeps a replay list for re-bakes. Use it for scorch marks, craters (replacing the decal closure), A's ash silhouettes and tyre skids. Add a 'puff' particle (cached soft sprite, rising and growing) with a below-entities layer, a gradient-ring shockwave sprite with a 2-frame core flash, and shards that bounce once.
   - *Acceptance:* world.decals.length stays constant after meteor impacts. Smoke never fully hides Jon, and a scorch mark remains after the smoke clears.
2. **A floor that stays sharp at DPR 2**
   - *Impact:* medium-high: the floor bake is 1 px per world unit and magnified up to 2.5× at DPR 2 (world.js:95-96), so painted text and speckle are visibly soft (dpr2-range-crop.png).
   - *Proposal:* Keep drawFn. Scale s = min(baseZoom·dpr·Engine.scale, sqrt(14e6/(w·h))). Re-bake after a 300 ms debounce on an 'engine:resize' event or a matchMedia DPR change, then replay stamps.
   - *Acceptance:* A DPR 2 crop shows sharp 'RANGE 4' text. Floor memory stays within budget, and a resize re-bakes once without stutter.
3. **Lift height, thrown smear, and readable teleport, duplicate and expand**
   - *Impact:* medium: a lifted jeep looks like it is sliding along the floor. Nothing links teleport's start and end points (e04/e05), and duplicates simply appear.
   - *Proposal:* Held or thrown entities get a separate soft shadow offset by height and a 1 + 0.12h scale. Fast thrown entities leave 3 ghost smears. Special.TeleportStreak: 6-8 silhouettes along the path, a core line with a blue halo, and ion particles. Duplicates spawn at Jon and ease out to their positions over 0.2 s along a ribbon. Expand adds an expanding ring of radial streaks.
   - *Acceptance:* A held crate visibly rises. A screenshot 100 ms after a teleport shows the trail. powers.mjs passes.

### N. Deterministic simulation & balance test gate

**Status:** IN PROGRESS: branch `claude/iter2-wip-N` (unverified WIP, see HANDOVER.md)

**Goal:** Make gameplay independent of refresh rate and testable quickly. Run the simulation on a fixed step, let tests advance time synchronously, and turn the reviewers' bot playtests into a balance regression gate. Owns the Engine.frame loop, Input edge latching, DM.dev hooks in main.js, a gameplay RNG in util.js, and tests.

**Files:** `src/core/engine.js`, `src/core/input.js`, `src/main.js`, `src/core/util.js`, `tests/flows.mjs`, `tests/smoke.mjs`, `tests/playtest.mjs`

1. **Fixed 60 Hz simulation with latched input edges**
   - *Impact:* medium: one update per rAF means the AI runs 2.4× as often at 144 Hz, and at 20 fps dt clamps to 0.05 and the game slows down (engine.js:102-134). Impact damage depends on collision speed.
   - *Proposal:* Accumulator: acc += dt; while (acc >= STEP && steps++ < 5) { top.update(STEP); Input.endFrame(); acc -= STEP }; then render once. Pressed edges latch until a step consumes them.
   - *Acceptance:* Per-second simulation steps are identical at 60 and 144 Hz, and the feel at 60 Hz is unchanged.
2. **DM.dev.advance and seed, and a promoted bot playtest**
   - *Impact:* medium: flows takes 2m16s of wall-clock sleeps. The playtester's bot found the stats bug, the Karnak deaths and the Veidt imbalance, which flows and smoke cannot see.
   - *Proposal:* DM.dev.advance(seconds) steps the top scene synchronously. DM.dev.seed(n) seeds DM.rng for AI and spawns. DM.dev.onFrame(fn). Convert flows and smoke to advance(). Port review/playtester bot.js, brains.js and run.mjs into tests/playtest.mjs with balance bands: pacifist pier spared == 12; waves under 120 s with fewer than 2 downs; Behemoth 30-90 s; each Veidt tactic yields within 150 s; no decoherence after the last emitter; retry-to-control at most 2-3 s.
   - *Acceptance:* flows finishes in under 40 s. The same seed and inputs reproduce identical stats. Reverting one balance fix makes playtest.mjs fail.
3. **Carry-over balance items from iteration 1 (tune via named constants, verified by the new balance gate)**
   - *Impact:* medium: three balance misses were measured in iteration 1.
   - *Proposal:* (1) Telekinesis can hold light objects forever: with B's channelRegen 0.5 the regen is 10/s while the hold drain is 3 + 1.1*mass, so anything under mass ~6.4 (gangsters, drones, crates, missiles) is held indefinitely with energy rising, and a held enemy stays stunned and harmless. Make holding an ENEMY cost net energy (e.g. a per-enemy hold drain or held enemies struggling free after a few seconds, Veidt already breaks free at 0.7/1.5 s) while holding props for puzzles stays comfortable. (2) Energy below 20 for 34-45% of wave time in Chapter III with a competent bot (target under 25%). (3) Veidt with Temporal Sight dies in ~24 s (target >= 40 s), and one Disintegrate-only run exceeded 120 s: find a tuning that keeps every hinted tactic winning in 40-120 s. Tunables live in DM.Enemies.TUNING (VEIDT, BEHEMOTH) and the power defs in powers.js; change numbers there (small hunks), not structure.
   - *Acceptance:* tests/playtest.mjs asserts the bands: a held gangster is released or drains Jon within 12 s from full energy; holding a crate for 20 s does not empty the meter; Chapter III waves with the bot keep energy < 20 under 25% of the time; Veidt TTK with each hinted tactic within 40-120 s.

## Iteration 3 (later)

### O. Audio II: positional, material and character sound

**Goal:** Once the entity code is stable after iterations 1-2: sounds come from where they happen, sound different by material and weapon, and characters get voices. Touches many entity call sites with one-line changes, which is why it waits until no other package is editing those files.

**Files:** `src/core/audio.js`, `src/game/world.js`, `src/game/entity.js`, `src/game/entities/enemies.js`, `src/game/entities/projectiles.js`, `src/game/entities/special.js`, `src/game/entities/npc.js`, `src/game/ui/dialog.js`, `src/game/scenes/interlude.js`, `src/game/scenes/overlays.js`, `src/data/chapters/prologue.js`, `src/game/scenes/minigames.js`

1. **Positional audio: stereo pan and distance attenuation**
   - *Impact:* high: a tank 1500 px away sounds as loud as one beside Jon, and the player cannot tell which side fire comes from (audio.js:139, 163 connect straight to sfxBus).
   - *Proposal:* Audio.listener is set from the camera. Audio.playAt(name, x, y): vol = 1/(1 + (d/(700/zoom))²), skipped below 0.04; pan = clamp((x - lx)/(640/zoom), -1, 1)·0.75. Each call builds a StereoPanner → Gain chain set as a.dest. Switch explosions, impacts, enemy shots, mines, meteors, emitters and the disintegrate resolve to playAt.
   - *Acceptance:* Offline: playAt at +600 px puts the right channel at least 8 dB above the left, and a sound 1400 px away is at least 12 dB quieter.
2. **Material impacts, cannons, incoming shells and missile loops**
   - *Impact:* medium: crates, the jeep, people and crystals all share 'impact', and Mars shards are silent because their hp is null (entity.js:89).
   - *Proposal:* An entity material field, with impact_wood, impact_metal, impact_flesh and impact_crystal played at a speed-scaled gain even when hp is null. A falling whistle for incoming shells. A loop per missile, capped to the 3 nearest.
   - *Acceptance:* A crate into a wall plays impact_wood, the jeep impact_metal, a shard impact_crystal.
3. **Voices, a typewriter, bells and set-piece cues**
   - *Impact:* medium: every speaker shares one 'type' blip, the generator charge is silent, and the minigame needle has no sound.
   - *Proposal:* LOOKS gain voice {f, wave, formant}: a 'voice' recipe every second character, with Manhattan resonant and sent to the echo. Interlude key and carriage sounds. A bell recipe for ChapterComplete and a midnight toll. A generator hum ramping with power. An accelerating countdown in its own register, then silence before the flash. Needle zone clicks in the minigame. A per-meteor whistle voice that ends on the impact frame.
   - *Acceptance:* Janey and Manhattan log distinct voice frequencies. The countdown doubles its rate in the last 5 s. The minigame plays one click per zone entry.

### P. Foundation & sandbox

**Goal:** Build the layer above the clean engine core that the README roadmap needs: an entity registry, world query helpers, a map kit, and a free-play sandbox that cannot touch campaign saves.

**Files:** `src/game/registry.js`, `src/game/world.js`, `src/game/mapkit.js`, `src/game/chapters.js`, `src/game/scenes/play.js`, `src/game/scenes/title.js`, `src/game/scenes/overlays.js`, `src/data/chapters/sandbox.js`, `index.html`

1. **Entity registry and spawning by name**
   - *Impact:* medium-high: constructors use 8 signatures, and chapters use instanceof in 8 places.
   - *Proposal:* DM.Registry.register(name, factory, meta) with adapters (no constructor rewrites); world.spawn(name, props); tags instead of instanceof; wave specs written as {spawn: [['drone', 6]]}.
   - *Acceptance:* No instanceof remains in src/data/chapters. world.spawn('tank', {...}) works from the console. Tests pass.
2. **World queries with a uniform grid**
   - *Impact:* medium: there are 28 hand-written full scans, and bullets against entities is O(B·N) (400×400 takes 4.03 ms).
   - *Proposal:* A tag index, a 128 px grid rebuilt each frame, and world.nearest, queryCircle, querySegment and findFree. Switch Bullet, Missile, Duplicate, acquire, findGrab and explode to them. Delete edgeSpot and freeSpot.
   - *Acceptance:* bullets.mjs at 400×400 takes under 1.5 ms. Behaviour is unchanged.
3. **MapKit helpers and a sandbox mode**
   - *Impact:* medium: the README roadmap lists a sandbox, but Play writes campaign saves unconditionally (play.js:67, 133, 150-163).
   - *Proposal:* MapKit.speckle, examine (moved from the prologue's flavor helper), scatter and markNearest. Chapters with mode:'sandbox' are kept out of the campaign list, and save writes are guarded. An arena where every power is unlocked, with a TAB palette that spawns registered entities and toggles god mode, infinite energy and endless waves (DM.Routines.waves).
   - *Acceptance:* localStorage is byte-identical before and after a sandbox session. Any registered entity spawns at the cursor.

### Q. Progression & replay: upgrades, watch parts, challenges

**Goal:** Give reasons to replay, and tie the moral choice to progression without lecturing. Power stats become data with upgrades bought using insight, a watch part is hidden in every chapter, and each chapter offers optional challenges.

**Files:** `src/game/powers.js`, `src/game/entities/player.js`, `src/core/save.js`, `src/game/scenes/overlays.js`, `src/game/scenes/title.js`, `src/game/scenes/ending.js`, `src/game/entities/special.js`, `src/data/chapters/prologue.js`

1. **Power stats as data, with upgrades between chapters**
   - *Impact:* medium-high: costs, ranges and cooldowns are literals inside the update bodies (powers.js:101, 196-198, 268-270, 315-316, 374-375).
   - *Proposal:* Each power declares stats and reads them through p.stat(def, key), which applies multipliers and additions from p.mods compiled from Save.data.upgrades. An UpgradeScene after ChapterComplete spends insight earned from memories and spared lives. Save migration to v3.
   - *Acceptance:* No numeric cost, cooldown or range literals remain inside power update bodies. A teleport range upgrade visibly lengthens the clamp.
2. **Watch parts in every chapter, and per-chapter challenges**
   - *Impact:* medium: the only optional collectibles are the 6 Mars memories, and chapter cards show only a time.
   - *Proposal:* A Collectible entity, with one watch part per chapter. Collecting all 6 adds an ending page where Jon rebuilds the watch. Chapter challenges are stored as badges and shown on ChapterSelect cards.
   - *Acceptance:* Each chapter has one findable part. Badges appear on cards. An old save migrates.

### R. Input breadth: prompts from bindings, rebinding, gamepad

**Goal:** Support the players the fixed keyboard layout leaves out: prompts generated from the actual bindings (AZERTY), rebinding, a gamepad through the existing action layer, and a fullscreen toggle that works on Safari.

**Files:** `src/core/input.js`, `src/core/gfx.js`, `src/game/powers.js`, `src/game/ui/hud.js`, `src/game/ui/dialog.js`, `src/game/scenes/overlays.js`, `src/data/chapters/mars.js`, `src/data/chapters/karnak.js`, `src/data/chapters/reassembly.js`, `src/data/chapters/prologue.js`

1. **Token-based key prompts and rebinding**
   - *Impact:* medium: about 20 hard-coded key names, and on AZERTY the prompts name keys that are not where the game expects them.
   - *Proposal:* Input.label(action) built from navigator.keyboard.getLayoutMap(). DM.Input.fmt(text) substitutes tokens like {teleport}. Save.settings.bindings merged over the defaults. An interactive Controls screen with PRESS A KEY, conflict warnings and RESET.
   - *Acceptance:* Rebinding teleport to V updates the tutorial, the unlock card and the HUD. grep finds no literal key names in src/data.
2. **Gamepad and the Safari fullscreen gesture**
   - *Impact:* medium: there is no getGamepads anywhere. On Safari before 16.4, fullscreen requested from inside rAF is refused silently.
   - *Proposal:* Poll pads into virtual codes in BINDINGS. The right stick drives Input.mouse around Jon. Input.onNextGesture(fn) runs toggleFullscreen inside the event handler, and Engine.resize runs on fullscreenchange.
   - *Acceptance:* With a mocked pad, the player can navigate menus, move, aim, throw, teleport and pause. Fullscreen enters on Safari 15/16.0.

### S. Comic presentation

**Goal:** Lean into the source's comic-page identity: illustrated interlude panels, nine-panel transitions and establishing shots, a glass palace that rises in 2.5D, set dressing on the empty maps, and an ending image that reflects how you played.

**Files:** `src/game/scenes/interlude.js`, `src/core/engine.js`, `src/game/entities/special.js`, `src/data/chapters/mars.js`, `src/core/gfx.js`, `src/game/scenes/ending.js`, `src/game/scenes/title.js`, `src/data/chapters/superman.js`, `src/data/chapters/deterrent.js`, `src/data/chapters/karnak.js`

1. **Illustrated interlude panels and nine-panel transitions**
   - *Impact:* medium: six of the nine interlude panels are always empty, and every transition is a flat fade (engine.js:87).
   - *Proposal:* Chapters provide panels: [fn(g, w, h, t, k)], procedural silhouette vignettes clipped into panels with ink borders and a halftone overlay. Engine.fadeTo with style 'panels' closes and reopens a 3×3 grid. newWorld accepts establish: {from, zoom} for an opening pan, skippable.
   - *Acceptance:* Every chapter interlude shows at least 3 illustrated panels in sequence, and map changes use the panel transition.
2. **A palace with height, rocks that read as rocks, and maps that are not empty**
   - *Impact:* medium: Palace.render is a floor diagram (special.js:503-566), the range is 9000 specks of sand, and Karnak is bare.
   - *Proposal:* Perspective-extruded spires (top = p + (p - camCentre)·h·0.0011), sorted far to near, with glass faces and clockwork rings. Faceted Mars rocks. Gfx.scatter with seeded mini-painters (shrubs, poles, bollards, puddles, sastrugi, monitor walls) baked into each map.
   - *Acceptance:* Spires parallax between two camera positions. Each map shows environmental detail. Bake time stays under 150 ms per map.
3. **An ending image and title that reflect the run**
   - *Impact:* low-medium: the ending is a static clock (ending.js:76-104) that differs only in text.
   - *Proposal:* Animate the clock to midnight with the blood mark running. Detached: pull back into a receding particle galaxy. Humane: the hydrogen atom settles above an open hand. A stats page laid out as a 3×3 comic grid. Parallax stars on the title.
   - *Acceptance:* The ending visibly differs between a run that spared most people and one that killed most.

### T. Performance II: figure sprites and garbage

**Goal:** Prepare for crowd scenes: cache character figures as sprites and remove per-frame allocations.

**Files:** `src/core/gfx.js`, `src/game/entities/enemies.js`, `src/game/entities/npc.js`, `src/game/entities/player.js`, `src/game/world.js`, `src/core/particles.js`, `src/core/util.js`, `src/core/camera.js`, `src/game/script.js`, `src/game/ui/hud.js`

1. **Cache figures as sprites**
   - *Impact:* medium: each figure costs 0.153 ms as vectors versus 0.064 ms as a cached sprite, and 80 figures take 19.4 ms to record (stress.mjs). There is also an Object.assign per figure per frame.
   - *Proposal:* Gfx.figureSprite(look, pose, res), cached by look id, walk frame quantised to 8, flags and a resolution bucket. Gfx.figure(ctx, look, pose) drops the per-frame Object.assign. Keep the vector path for portraits and while Jon is expanded.
   - *Acceptance:* render-80-figures drops below 8 ms with no visible quality loss at DPR 1 and 2.
2. **Cut per-frame garbage**
   - *Impact:* low: about 17 KB per frame (1 MB/s) in the pier fight.
   - *Proposal:* U.compact for in-place filtering, reuse of the visible list and the camera view object, U.normInto, and a particle pool.
   - *Acceptance:* micro.mjs reports under 4 KB per frame, and no minor GC pause exceeds 2 ms in 30 s of Ch III.

### U. Content III: Vietnam and Chapter II hostages

**Goal:** Play the chapter's most Watchmen-flavoured idea instead of only narrating it, and give the Chapter II choice real consequences, using the registry, AI and humans-everywhere work from earlier iterations.

**Files:** `src/data/chapters/deterrent.js`, `src/game/entities/enemies.js`, `src/game/entities/npc.js`, `src/data/chapters/superman.js`

1. **A playable Vietnam stage with awe-surrender and an unmarked intervention**
   - *Impact:* high: the Ch III intro tells how Jon ended the war (deterrent.js:159) but never lets the player play it.
   - *Proposal:* A 1800×1200 jungle map (river, bridge, huts, canopy walls). Soldiers kneel after seeing Jon within 170 px for 1.2 s (counted as spared). Near the bridge, an unmarked moment: an allied officer raises a pistol at a kneeling prisoner. Within 5 s the player may grab the officer or disintegrate the pistol, setting flags.intervened; the narration differs either way and the flag persists. All lines original.
   - *Acceptance:* dev.start('deterrent', 0) opens in the jungle. Both outcomes set the flag, and the ending reflects it.
2. **Hostages in the pier raid**
   - *Impact:* medium: killing is still the faster option in Chapter II.
   - *Proposal:* 3-4 dock workers whom gangsters grab as human shields. Disintegrate's 50 px radius takes both, while a careful throw frees the hostage.
   - *Acceptance:* At least one hostage moment per playthrough. The lethal and pacifist bots finish within 30% of each other's time.

