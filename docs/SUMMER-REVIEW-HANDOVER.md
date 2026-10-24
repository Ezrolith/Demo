# Long Summer independent-review corrections — handover

This report supersedes the pacing and hint-overlap caveats in the first Long Summer handover. Work remains on `codex/bonus-three`, draft PR #4 into `codex/bonus-polish`. Nothing is merged or deployed. Other branches and PRs remain untouched.

## Version and evidence

- Comparison baseline: `90a9595eb063b58d9eb8bf6ae6f43cc372a94459`.
- Tested source: `1f6959531bf03b1e513b45fe8d61d2b0b80dca10`.
- Verified rebuilt HTML and screenshot commit: `747aabab43961208fe06d1ba192eeae8cb79b75d`.
- [Authoritative run 40096235586](https://github.com/Ezrolith/Demo/actions/runs/40096235586): SUCCESS.
- The subsequent delivery commit adds documentation and removes temporary write-capable workflows only. It changes no game script or HTML. PR #4 records its final SHA.
- Standalone: 918,431 bytes; SHA-256 `3b3b7b66d5a161c398c0f6c1411f11132b27d251e177cf0e4e2e5488f70d4fc1`.

All fifteen test commands passed on their first attempt, with normal Chromium file navigation and browser storage. The modified source/test files were also compared byte-for-byte with the locally reviewed files. The downloadable HTML was copied from the verified artifact.

## Item-by-item delivery

| Item | Status | Result |
| --- | --- | --- |
| 1.1 Comedian fairness | DONE | Thirty playable-world seconds before aiming; then a 2.2-second raised-gun/emissive-line warning, bark and unique sound. C cancels it. A central gate enforces thirty seconds between casualties. Autonomous shot/casualty Heat is rate-limited. |
| 1.2 Fire and rescue | DONE | First propagation at sixteen active world seconds, five-second beats, six-second cell maturity and at most one new frontier cell per beat. Fire Heat <=0.5/second. Added an actual-room, input-only rescue with normal damage and no invulnerability. |
| 1.3 Hint and exit clearance | DONE | Camera-only bottom padding, moved spawns/exits, Summer-local framing reserving 190 pixels, and repositioned SAFE PASSAGE caption. Geometry/route assertions and untouched-camera live views verify clearance. |
| 2.1 Avenue | DONE | Strong warm fire lights, steady under reduced flashing; hostile spill/rim lighting; broken shops/shutters/awnings/fire escapes, dead lamps, parked/overturned cars, shelter/news boxes/debris and reflective hydrant spray. Spatial probes check 400-square regions on a 25-pixel sampling grid. |
| 2.2 Fire artwork | DONE | Varied layered gradient flames, glow, rising smoke and embers using existing procedural drawing/particles. Scorches remain after extinguishing. Effects settings are respected. |
| 2.3 Truck arena | DONE | Barricades, sandbags, burnt vehicles, looted frontage and drifting illuminated gas. Central driving and targeting space stays open. |
| 2.4 Comedian portrait | DONE | Broader jaw, neck and shoulders; grey temples/wrinkles; worn leather, black mask, smiley badge and visible cigar/smoke. Uses the existing character-local mask hook. |
| 3.1 Relay floor | DONE | Seeded scuffs, worn ribbed operator mat and cable runs from actual rack bases to the operator area. |
| 3.2 Preserve the other adventures | DONE | Only the relay floor bake changes in bonus-broadcast-atmosphere.js. Both older chapter scripts, Ninth Minute atmosphere and shared bonus logic are unchanged. |
| Tests and live evidence | DONE | Twelve source suites, rebuild, three standalone suites, 38 inspected PNGs and this handover. No staged actor/attack screenshots are presented as gameplay. |

## Interpretation and balance

The protected opening is thirty seconds rather than the minimum twenty because the requested acceptance also requires no casualties during the first thirty seconds with Jon idle. The first possible shot follows the additional 2.2-second warning. These are active-world timers: dialogue pauses them and Temporal Sight gives more real response time.

Autonomous Heat is capped at 0.4/second in the first thirty seconds and 1.5/second thereafter. Fire contributes at most 0.5/second within that budget. Shot pressure and the Comedian's casualty pressure are queued, so a death cannot bypass the cap with an instant jump. The casualty ledger and reaction update immediately. Jon's deliberate unmakings still add 18 immediately; player restraint, rescues, water and nonlethal outcomes retain their reductions. The cap limits passive escalation, not the consequences of deliberate player actions.

Fire propagation is linear, not a separate expansion from every active cell. Cells need six seconds of maturity. The three-second Sight preview copies the same deterministic propagation rule. Ventilation stops future spread, not existing flames. The successful vulnerable rescue uses ventilation before the room-by-room escort route.

Extra world height is camera padding outside the original collision room, not additional playable street. No shared camera/HUD, lighting engine or BonusKit behaviour is replaced.

## Acceptance measurements

Normal-file source-suite results:

- Idle avenue for 30 seconds: maximum Heat **48.04525**, zero Comedian shots/casualties, minimum coherence **92**, Jon alive.
- Idle tenement: **5** initial cells, **5** before 15 seconds, **6** at 20.1167 seconds.
- Real-room, vulnerable rescue: **6/6** safe, minimum coherence **92**, about **64.53 simulated seconds**. Minimum body-to-hint exclusion clearance **37.82 pixels**.
- Warning cancellation, casualty spacing, actual Heat deltas, cell maturity and SAFE PASSAGE caption clearance passed explicit checks.

The separate live ten-second avenue capture reproduced the review: before, Heat **74.35** and one Comedian casualty; after, Heat **41.5154** and no casualty. These are observations from particular live runs, not deterministic balance guarantees.

The suite now has 73 checks, previously 58. Original checks remain. Only intended timing/coordinate expectations were updated: the casualty check waits through the protected opening and carried residents use the relocated safePoint. No original campaign test or tolerance was weakened.

The new rescue uses normal challenge, actual room positions and normal damage. WASD movement, C on the beam, G/E ventilation, E escorts and R are the only interventions. It does not relocate Jon/residents, refill health/energy, suppress the looter or freeze fire. Protection settings are checked each frame. It is a deterministic input-driven route, not an unassisted human playthrough. Older focused mechanics tests still use setup shortcuts where documented.

An additional local check used the normal RAF loop and Playwright keyboard/mouse, without manual simulation advancement, and also rescued all six in 67.725 wall seconds with minimum health 92 and no page errors. That supplementary check used inlined source/memory storage because local file navigation is blocked; it does not replace the normal-file CI evidence.

## Exact test output and exits

All twelve source commands ran sequentially. The build followed them, then the three standalone commands. All passed first attempt; no retry was needed.

| Suite | Exact final output | Exit |
| --- | --- | --- |
| smoke | `Smoke test passed.` | 0 |
| visual | `All atmosphere checks passed.` | 0 |
| audio | `All audio checks passed.` | 0 |
| powers | `All mechanics checks passed.` | 0 |
| saves | `All save & robustness checks passed.` | 0 |
| settings | `All settings & accessibility checks passed.` | 0 |
| ledger | `All ledger & combat-feel checks passed.` | 0 |
| encounters | `All encounter checks passed.` | 0 |
| flows | `All story flow checks passed.` | 0 |
| bonus | `BONUS ACCEPTANCE PASSED: 42 checks (normal file loading).` | 0 |
| ninth-minute | `NINTH MINUTE PASSED: 75 checks (normal file loading).` | 0 |
| long-summer | `LONG SUMMER PASSED: 73 checks (normal file loading).` | 0 |
| bonus / standalone | `BONUS ACCEPTANCE PASSED: 42 checks (normal file loading).` | 0 |
| ninth-minute / standalone | `NINTH MINUTE PASSED: 75 checks (normal file loading).` | 0 |
| long-summer / standalone | `LONG SUMMER PASSED: 73 checks (normal file loading).` | 0 |

Source/build, logs, recorded exits and capture metadata are in artifact `summer-review-40096235586`. Two earlier runs were intentionally superseded/cancelled after the casualty-Heat and caption edge cases were found; they are not the final verification result.

## Live capture method and screenshots

`tests/capture-summer-review.mjs` loads a stage with normal damage, clears the initial dialogue and lets real requestAnimationFrame simulation/rendering run for ten wall-clock seconds. It does not place actors, refill health, enable invulnerability, force attack states or pause simulation. Normal challenge and reduced flashing are consistent. Both final metadata files report normal file loading and zero page errors. Encoding adds a small delay; recorded normal-view times are about 10.28–10.41 seconds.

Two complementary image sets are provided:

1. `*-before-live.png` / `*-after-live.png`: **untouched gameplay camera**. Use these for the hint/marker-clearance comparison. Camera framing changes intentionally because that behaviour was fixed.
2. `*-before.png` / `*-after.png`: the same live state re-rendered synchronously at **identical camera coordinates/zoom** for artwork comparison. Only the rendering camera changes, and it is restored before the next simulation frame. No actor or attack is posed. These are not the untouched camera views.

Sight counterparts hold F for 350 ms after the ten-second normal view; they are not ten-second runs entirely spent under Sight. Metadata records wall/world time, player position/health, Heat, casualties, camera and hints. Actors can differ naturally between runs. The pier enters its normal captain briefing; that dialogue was not hidden. Portrait sheets are artwork evidence, not gameplay. All 38 images were inspected, including both camera sets, Sight, relay, portraits and pier.

| Area | Matched normal before / after | Matched Sight before / after | Untouched camera before / after |
| --- | --- | --- | --- |
| Avenue | [before](screenshots/summer-review/avenue-before.png) / [after](screenshots/summer-review/avenue-after.png) | [before](screenshots/summer-review/avenue-before-sight.png) / [after](screenshots/summer-review/avenue-after-sight.png) | [before](screenshots/summer-review/avenue-before-live.png) / [after](screenshots/summer-review/avenue-after-live.png) |
| Tenement | [before](screenshots/summer-review/tenement-before.png) / [after](screenshots/summer-review/tenement-after.png) | [before](screenshots/summer-review/tenement-before-sight.png) / [after](screenshots/summer-review/tenement-after-sight.png) | [before](screenshots/summer-review/tenement-before-live.png) / [after](screenshots/summer-review/tenement-after-live.png) |
| Truck | [before](screenshots/summer-review/truck-before.png) / [after](screenshots/summer-review/truck-after.png) | [before](screenshots/summer-review/truck-before-sight.png) / [after](screenshots/summer-review/truck-after-sight.png) | [before](screenshots/summer-review/truck-before-live.png) / [after](screenshots/summer-review/truck-after-live.png) |
| Relay | [before](screenshots/summer-review/relay-before.png) / [after](screenshots/summer-review/relay-after.png) | [before](screenshots/summer-review/relay-before-sight.png) / [after](screenshots/summer-review/relay-after-sight.png) | [before](screenshots/summer-review/relay-before-live.png) / [after](screenshots/summer-review/relay-after-live.png) |

Each untouched-camera view has a `-live-sight.png` counterpart. [Original pier](screenshots/summer-review/pier-reference-after-live.png). [Portrait before](screenshots/summer-review/portrait-before.png) / [after](screenshots/summer-review/portrait-after.png). [Before metadata](screenshots/summer-review/capture-before.json) / [after metadata](screenshots/summer-review/capture-after.json).

## Files, safety and successor

Production edits: `long-summer-kit.js`, `long-summer-truck.js`, `long-summer.js`, `bonus-summer-atmosphere.js`, and only the relay bake in `bonus-broadcast-atmosphere.js`. Tests: `long-summer.mjs` and the new capture script. Campaign chapters, all core files, original music/ambience, physics, powers, save format, shared BonusKit, older chapter scripts and Ninth Minute atmosphere are identical to baseline. No new runtime dependency or asset is introduced.

Temporary transfer/publication workflows are removed in the final documentation commit; existing read-only regression CI remains. The HTML and source are not modified by that cleanup. Rebuild with `node tools/build.mjs`; run the twelve suites sequentially, rebuild, then retest all three standalone adventures after any future source change. Keep PR #4 draft. No merge/deployment is authorised.

No failing assertion or unresolved reproduction of the reported fairness/hint issues remains in this candidate. That is not proof of no bugs. Still outstanding: an unassisted human full playthrough, careful listening, Safari/Firefox, low-end hardware and cross-file save migration. Mobile gameplay remains absent. Numerical loudness and screenshots do not establish artistic parity.

The next human pass should focus on warning visibility in crowded fights, late-stage Heat pacing, fire-forecast readability and driver extraction. The artwork/scenery target is supported by spatial probes and inspected renders, not a claim that every possible view is perfect.
