# Bonus adventures

Two optional, original fan stories for Dr. Manhattan: The Watchmaker's Son.
Open `index.html` or `dist/dr-manhattan.html` in a desktop browser, enable
audio with a click, and choose **BONUS LEVELS**. Select either adventure
with the cards or left/right arrows. No campaign completion is required.
Keyboard and mouse/trackpad are required; mobile controls are not included.

## The Last Broadcast

New York, November 1976. Join Nite Owl and Rorschach to investigate three
missing radio engineers. Cross the rooftops, free the engineers, use
telekinesis to place two coils into their docks, and disable the shielded
Carrier by breaking its three pylons. Three optional evidence records
affect the conclusion. Broadcasting the evidence brings interceptors;
shutting down quietly avoids that final fight. Nite Owl uses stun darts;
Rorschach closes with enemies and stuns them. All six powers are available.

## The Ninth Minute

New York, February 1977. Join Silk Spectre and Nite Owl at Harrow Street,
where six passengers are caught in a repeating moment. Set the route to
SERVICE, clear security drones, and cross the rail hazards. At each of
three carriages, E calls Laurie to open the door; nearby enemies interrupt
her work. Passengers count only when they reach the exit. The Pendulum
exposes its core for the final three seconds of its nine-second cycle;
a returned missile can open it early. Three optional lost moments use
Temporal Sight. Release the loop immediately, or hold F in the temporal
anchor to preserve its records. Both routes rescue the passengers.

## Style and saves

Both adventures use the existing procedural figures, portraits, dialogue,
lighting, weather, powers and WebAudio synthesizer. Five added musical
arrangements do not replace any campaign track. Each adventure has its
own checkpoint and completion record in `dr-manhattan.bonus.v1`, separate
from campaign progress, Continue and the campaign ending. Settings are
shared. Storage can be blocked by the browser; in that case progress is
session-only. Cross-file save migration is not guaranteed.

## Source and tests

Shared integration: `src/game/bonus.js`. Chapters:
`src/data/chapters/last-broadcast.js` and `ninth-minute.js`.
The original campaign chapter registry list is not extended.

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

`npm test` runs the original nine suites. The two bonus suites are also
required. Run suites sequentially and retain their actual exit codes.
Their setup uses positioning shortcuts and some invulnerability, so
they are not complete human playthroughs or balance assessments. The
optional `--offline` harness is not proof of real file loading/storage.
Safari, Firefox, subjective music quality and mobile support have not
been independently verified. Do not infer them from Chromium results.

## Polish continuation

Work is isolated on `codex/bonus-polish`, based on the existing bonus
branch. Step one lowers only `bonus_noir` (4 dB) and `ninth_platform`
(2.5 dB), restores the browser title, and consolidates documentation.
The eleven-suite results, screenshots and remaining work will be recorded
in the draft PR/handover. No merge, deployment or campaign edits are
authorised. The third adventure is gated on completion of Part A.
