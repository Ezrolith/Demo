# Challenge tracking during play

This is an additive update to `codex/glass-palace-refinements` and its existing
draft pull request. No merge, deployment, protected chapter, original music or
engine presentation changes are included.

## Player behavior

Pin one of a moment's three challenges from its palace pane or from
Pause → Moment Challenges. The choice is stored only in the palace slot.
Playing that moment shows a compact live panel; other moments and replay modes
keep their existing HUD. Untracked play uses its original HUD methods.

The panel reads actual level statistics, flags, references and player state at
up to four samples per second. It shows time elapsed, the time target and time left,
people unmade, or the level-specific objective. Pause stops the actual timer.
Retry and Resume retain the original checkpoint's carried statistics. Recoverable
conditions, such as coherence or City Heat, remain provisional until completion.

The optional panel yields to dialogue, captions, cutscenes, flashes, interaction
prompts and the original HUD. Pause shows all three challenge definitions and
current attempt snapshots. Returning from that screen leaves the game paused.

The existing completion hook remains authoritative. Live checks never award
fragments. Challenge Details, available with H or its result-screen button,
explains new fragments, previously recovered fragments and missed conditions.
Those reasons are captured at completion; later state changes cannot rewrite them.
An already recovered fragment cannot be earned again.

## Persistence and compatibility

The palace slot gains an optional `tracking` selection. Missing selections load
as null. The three original progression slots and their formats remain unchanged.
Palace backups include the selection, accept older backups without it, and keep
their preview, explicit confirmation and storage-first restore behavior.
Blocked or protected storage keeps session selection and the existing warning;
no protected or newer slot is overwritten.

## Verification

Verification is in progress. The final report will record all twenty-one suites
on source and standalone, additional browser checks, live captures and any
qualification. Existing audio-test randomness is not hidden by changing its
threshold or original sound recipe.

Run `npm run test:palace-refinements` for the twenty-one sequential suites, or
`node tools/verify-palace-refinements.mjs dist/dr-manhattan.html` for the same
suites against the downloadable file. `npm run test:palace-tracking` runs the
focused suite; `npm run test:palace-tracking-capture` records the two live views.
