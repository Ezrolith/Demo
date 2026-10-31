# A clearer path through The Glass Palace

This follow-up starts from finished Part B on `codex/glass-palace`.
The original six campaign files, original music and engine presentation remain
protected. No merge or deployment is part of this work.

## Implemented

**Moment atlas and walking guide.** H, the visible atlas button and the palace
pause menu open an overview. It shows only unlocked moment names, their earned
fragments and whether a checkpoint is available. Missing-fragment and checkpoint
filters help choose a next replay. Selecting a destination draws a collision-aware
walking trail and an edge pointer. Jon remains under the player's control;
arriving does not start a level. The ledger and unlocked Earth scene have routes
too. Selection is session-local and does not change any save slot.

**Palace progress backups.** The pause menu offers a palace-only JSON export and
restore. Choosing a file previews its fragment and reflection counts; an explicit
Restore action replaces only palace progress. Browser storage is committed before
session data is replaced. Invalid, oversized, incompatible or protected saves
cannot overwrite current progress. Campaign, bonus, After Midnight and settings
remain outside this backup. Session progress can still be exported when saving
is blocked. Closing the modal refreshes the palace structure.

## Recommended next enhancements

| Priority | Enhancement | What it adds | Bounded first version |
| --- | --- | --- | --- |
| 1 | Challenge tracking | Keep the chosen objective understandable during a replay | One pinned challenge, provisional progress and a clear completion breakdown |
| 2 | Natural challenge balance | Establish how the targets feel in actual play | Twelve normal-input completions recording time, deaths and missed objectives |
| 3 | Branching detective case | Let the player interpret evidence and choose a conclusion | One district, three hypotheses, two evidence-supported resolutions |
| 4 | Paired-hero mission | Make complementary equipment matter | Two selected heroes, simple companion instructions, two cooperative obstacles |
| 5 | Neighbourhood aftermath | Show consequences beyond a score | One revisitable street with three authored outcome states |

The existing game already has rescues, looping time, City Heat, waves, equipment
upgrades, twelve replay moments and thirty-six challenges. Another badge economy
or another wave mode would add less than these changes. Rebinding and gamepad
support remain a separate, broader input project under the current engine rules.

## Verification

Verification is in progress. Final results will identify actual suite exits and
the tested source/build hashes. No claim of natural completion of all thirty-six
challenges is made. The earlier Part B independent validation passed; its results
do not stand in for this follow-up's tests.
