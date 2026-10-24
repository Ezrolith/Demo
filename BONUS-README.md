# Bonus adventures

This branch contains **The Last Broadcast** and **The Ninth Minute**, two original optional fan-story expansions for Dr. Manhattan: The Watchmaker's Son.

Open `dist/dr-manhattan.html` in a desktop browser, click to enable sound, then choose **BONUS LEVELS**. Select either adventure with its card or the left/right keys. Both are available immediately, without completing the campaign. Keyboard and mouse/trackpad are required; touch gameplay has not been added.

## Bonus I: The Last Broadcast

New York, November 1976. Three radio engineers have disappeared. Dr. Manhattan joins Nite Owl and Rorschach to stop the Switchman hijacking the city's emergency broadcasts.

Three connected areas:
1. Rain-soaked rooftops: cross the service bridge or teleport, defeat guards and find evidence.
2. Radio relay floor: rescue three engineers and lift two coils into their numbered docks.
3. Transmitter roof: break three shield pylons, disable the Carrier, and choose what the city hears.

Nite Owl fires nonlethal stun darts. Rorschach closes with enemies and stuns them. Three optional evidence records affect the conclusion. Broadcasting the evidence brings interceptors; shutting the transmitter down silently avoids that final fight.

## Bonus II: The Ninth Minute

A subway train keeps arriving at the same station every nine seconds. Join Silk Spectre and Nite Owl to rescue six trapped passengers, defeat the Pendulum and decide whether to preserve the machine's records. Full details are in [THE-NINTH-MINUTE.md](THE-NINTH-MINUTE.md).

## What is preserved

All six original campaign chapter files, their original music data and the original ending scene are unchanged. Both adventures use the existing procedural figures, powers, lighting, weather, dialogue, sound effects and music synthesizer. Five additional musical arrangements are additive, not replacements.

The bonus registry is separate from the main chapter list. All six powers are available inside either bonus without changing campaign unlocks. Bonus checkpoints and completion records live under each adventure's ID in `dr-manhattan.bonus.v1`. They do not advance the main Continue point or add bonus deaths/kills to campaign totals. Settings are shared. Browser storage can be blocked, and save migration between separate downloaded HTML filenames has not been verified.

## Build and test

```
npm install
npx playwright install chromium
npm run build
npm run test:adventures
node tests/bonus.mjs dist/dr-manhattan.html
node tests/ninth-minute.mjs dist/dr-manhattan.html
```

`npm test` retains the original nine regression suites. The new suites have 29 and 56 focused checks, respectively. They use real game inputs but also positioning shortcuts and invulnerability for some checks; they are not unassisted human playthroughs or difficulty/performance benchmarks. The returned-missile test in Bonus II is collision-level, not a full mouse-driven catch-and-throw sequence.

During development both suites passed on source and standalone HTML in restricted Chromium with `--offline` and in-memory storage. The GitHub workflow runs the same checks with normal file navigation and browser storage; consult its result for current verification. Safari, Firefox and mobile gameplay are not verified. The new suite's 14-campaign-checkpoint smoke check is not equivalent to all nine original regression suites.

## Repository status

The full bonus source is published on `chatgpt/bonus-adventures`, with the rebuilt playable game in `dist/dr-manhattan.html`. The publication process verifies hashes against the supplied download. The default `claude/dr-manhattan-game` branch and external live link are not changed by this branch.

Earlier story/checkpoint work remains separately on `chatgpt/story-h-validation` (PR #1). Unfinished Claude H/J/N development branches are not silently combined with this expansion. See [CHANGELOG.md](CHANGELOG.md) for the plain-English summary.
