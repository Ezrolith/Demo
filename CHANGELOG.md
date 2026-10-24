# What's new — Bonus Adventures I & II

## 24 October 2026: both bonus adventures published to GitHub

This is the same playable bonus build supplied in the conversation, now with its editable source, tests, documentation and reproducible standalone HTML in the repository. Publication is on `chatgpt/bonus-adventures`; it is not a deployment of the existing live site or a merge into the default branch.

### A new Bonus Levels section

Choose either adventure straight from the title menu. There is no need to replay the campaign. Both start with all six powers. Each has its own checkpoint/resume and completion record, separate from campaign progress.

### The Last Broadcast

Team up with Nite Owl and Rorschach in rainy 1976 New York. Investigate missing engineers, cross rooftops, rescue three hostages, use telekinesis to ground the radio equipment, and defeat the shielded Carrier. Recover optional evidence and choose whether to broadcast it or shut the transmitter down quietly. Broadcasting changes the final encounter, not just the ending text.

### The Ninth Minute

Join Silk Spectre and Nite Owl in a 1977 subway station trapped in a repeating moment. Change the track route, cross electrical hazards, protect Laurie as she opens three carriages, and escort six passengers to safety. Defeat the Pendulum by learning its nine-second cycle. Choose an immediate release or an extra stabilisation challenge to preserve the records. Three hidden lost moments add optional story detail.

### The same look, sound and feel

The expansion reuses the original graphics, lighting, dialogue, powers, sound effects and synthesizer. Five new musical arrangements complement the existing score. Companions take part in combat; they are not just decorative characters. The six original campaign chapter files, their music data and the original ending scene are unchanged.

### Source and checks

The repository includes both level scripts, shared bonus menu/save integration, 29 Last Broadcast checks, 56 Ninth Minute checks and the regenerated `dist/dr-manhattan.html`. The hash manifest records the exact downloadable version and unchanged campaign chapters. The checks are targeted automated tests with setup shortcuts, not full human playthroughs. The original nine regression commands remain available via `npm test`.

### Earlier story work remains separate

The previous checkpoint-identity fixes, printing-press ending paragraph, story tests and scene preview remain on `chatgpt/story-h-validation` in PR #1. They are not silently merged into the bonus build, which preserves the original campaign content. Unfinished Claude development branches are retained, not overwritten.

### Still not included

Touch/mobile gameplay controls, a full manual playthrough, verified Safari/Firefox support, a merge into the default branch and an update to the external live play link.
