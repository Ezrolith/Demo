# Bonus II — The Ninth Minute

An original optional fan-story expansion for **Dr. Manhattan: The Watchmaker's Son**. This branch includes the original six-chapter campaign, **The Last Broadcast**, and **The Ninth Minute**. It is based on the supplied playable Last Broadcast source, not on the unfinished H/J/N branches.

## Play

Open `dist/dr-manhattan.html` in a desktop browser. Click to enable audio. Choose **BONUS LEVELS**, select **02 THE NINTH MINUTE**, and choose **PLAY THE NINTH MINUTE**. The new adventure is selected by default. Click either adventure card or use left/right arrows to change selection. Each adventure has its own Resume entry. Keyboard and mouse/trackpad are required; touch gameplay has not been added. No campaign completion is required.

## The story

New York, 1977. A subway train keeps arriving at Harrow Street every nine seconds. Six passengers are trapped in a repeating moment. Silk Spectre and Nite Owl join Dr. Manhattan below the city to bring them home. This is an original, non-canonical fan story with newly written dialogue, not a reproduction of a Watchmen chapter.

### Three connected areas

1. **A station out of time.** Defeat the security drones, set the signal box to SERVICE, and cross to the tunnel entrance. Electrical rails warn before firing and slow under Temporal Sight.
2. **The people between seconds.** Call Laurie to each of three carriage doors with E. Protect her while she opens them; nearby drones interrupt her work. Six visible passengers walk to the exit and count as rescued when they actually reach safety.
3. **The minute engine.** Fight the Pendulum, whose sweeps, missiles and pulses follow a nine-second cycle. The core opens for the final three seconds. A returned missile disrupts its shield early. The closing decision offers immediate release or a Temporal Sight stabilisation challenge to preserve the machine's records.

Three optional **lost moments** are revealed with F and heard with E. They persist independently through checkpoints. Both final routes save the passengers.

## Preserved style and scope

The same figures, portraits, renderer, lighting, grain, powers, combat, dialogue boxes and synthesizer are used. Three new arrangements are additive: `ninth_platform`, `ninth_pendulum`, and `ninth_dawn`.

The first adventure's chapter source, all six original campaign chapter files and their music data are unchanged. The shared bonus menu selects between both adventures and their own completion screens. Longer hints wrap only on the new adventure's HUD instance.

Main-story progress and its ending are not advanced by either bonus. `dr-manhattan.bonus.v1` stores checkpoints/completions under each adventure's ID. Settings remain shared. File-origin storage availability and sharing saves between downloaded HTML filenames depend on the browser; migration between filenames has not been tested.

## Build and tests

```
npm install
npx playwright install chromium
npm run build
npm run test:ninth-minute
npm run test:bonus
node tests/ninth-minute.mjs dist/dr-manhattan.html
node tests/bonus.mjs dist/dr-manhattan.html
```

Both suites accept `--offline` for restricted runtimes. This inlines the same game scripts and substitutes in-memory storage; it is not a substitute for file navigation or browser-persistence testing.

### Development verification

56 new-adventure checks and 29 first-adventure checks passed on both source and standalone HTML in the offline Chromium harness. The new checks include menu/introduction flow, movement/teleport, companion combat, interlocks, slowed hazards, pause, three defended door openings, six evacuations, memories, shield timing, both final routes, death/retry, checkpoint separation and campaign-save isolation. All 14 original campaign checkpoints also constructed without engine errors. The three music arrangements started without a reported engine/audio-director error. Screenshots were inspected.

These tests use positioning shortcuts and invulnerability for some objectives. The returned-missile check is collision-level, not an entire mouse-driven catch-and-throw. This is not an unassisted human playthrough, a difficulty/performance benchmark or subjective music assessment. Safari, Firefox and mobile are not verified. The original nine full suites were not rerun during bonus development; the checkpoint smoke check is not equivalent.

### GitHub publication

The source and generated game are on `chatgpt/bonus-adventures`. Publication checks exact file hashes against the downloadable build and runs the focused suites in GitHub-hosted Chromium with normal file navigation/storage. See the workflow result for current status. The default branch and live site remain unchanged until a separately reviewed merge/deployment.

New code is `src/data/chapters/ninth-minute.js`; new checks are `tests/ninth-minute.mjs`. Shared integration lives in `src/game/bonus.js`, `index.html` and the existing save/play/title systems. See [BONUS-README.md](BONUS-README.md) and [CHANGELOG.md](CHANGELOG.md).
