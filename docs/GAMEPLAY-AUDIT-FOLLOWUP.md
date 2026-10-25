# Gameplay audit follow-up — 25 October 2026

> This is historical gameplay evidence. Its platform limitations are superseded by [the later platform QA](PLATFORM-QA-HANDOVER.md). For the current review branch and fresh results, see [QA polish](QA-POLISH-HANDOVER.md).

## Version, boundaries and completed outstanding action

Repository `Ezrolith/Demo`, branch `codex/bonus-three`, draft [PR #4](https://github.com/Ezrolith/Demo/pull/4), into `codex/bonus-polish`.

The prior session's pending full regression [40139580928](https://github.com/Ezrolith/Demo/actions/runs/40139580928) completed successfully. The previous candidate was green; this session then found and fixed two additional edge cases instead of treating those results as exhaustive gameplay coverage.

**Tested source, tests, HTML and hosted screenshots:** `d00452cc30e9efadb10e4bb8b5a11abe1d48c08e`.
**Authoritative follow-up run:** [40186326613](https://github.com/Ezrolith/Demo/actions/runs/40186326613), SUCCESS. Later delivery cleanup changes documentation and CI only, not game scripts, test scripts or the playable HTML. The final branch head is recorded in PR #4.

Nothing is merged or deployed. No original campaign, engine, music, artwork, earlier bonus chapter or Claude-branch changes were made in this follow-up. The existing hosted play link is unchanged. Temporary snapshot/publishing workflows and source-transfer files have been removed. Only read-only regression CI remains, now also running the real-input journey.

## Corrections — both DONE

### Arrival camera and previous-area markers

During an actual nonlethal avenue-to-tenement journey, Jon arrived at the tenement spawn while the scene still followed the previous street camera target. He stayed below the screen throughout the briefing. The BALCONY ROUTE marker also leaked into the new area.

`src/data/chapters/long-summer.js` now resets the Summer-local camera target to the new spawn and clears previous markers, transient notices and objectives when constructing a new map. No shared camera/HUD function is patched. Two regression checks keep tenement/truck arrival dialogue open and verify that Jon is in view and no previous-area marker remains.

### Deliberate cab shots during impact freeze

Code review and a controlled mechanics reproduction exposed a problem in the earlier accidental-kill protection: its 0.35-second real-time deadline could expire during the game's legitimate 0.2-second impact freeze, even though the intended Disintegrate pulse had not resolved. A deliberate cab shot could therefore be rejected.

`src/game/long-summer-truck.js` now binds intent to the actual pending pulse object and requires that pulse to be resolving. Wheel-targeted splash remains nonlethal. Old aim data cannot authorise a later unrelated blast. Two additional checks cover a deliberate shot through impact freeze and stale-cast rejection; the earlier wheel/intentional-kill checks remain.

The impact-freeze reproduction is a controlled regression, not a claim that it was seen spontaneously in a live recording.

## Normal-file verification — all commands passed first attempt

The hosted run used normal Chromium file loading and browser storage. All twelve source suites ran sequentially, followed by a rebuild and the three standalone suites. The additional real-input journey also passed. No original test assertion or tolerance was weakened.

| Command | Exact final output | Exit |
| --- | --- | --- |
| Real-input journey | `LIVE JOURNEY PASSED: 15 checks; minimum coherence 92.00.` | 0 |
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
| long-summer | `LONG SUMMER PASSED: 80 checks (normal file loading).` | 0 |
| bonus / standalone | `BONUS ACCEPTANCE PASSED: 42 checks (normal file loading).` | 0 |
| ninth-minute / standalone | `NINTH MINUTE PASSED: 75 checks (normal file loading).` | 0 |
| long-summer / standalone | `LONG SUMMER PASSED: 80 checks (normal file loading).` | 0 |

The Summer suite increased from 76 to 80 checks. Exact logs/exits are retained in the run artifact. The standalone is **920,369 bytes**, SHA-256 **`5b0faf7f1e66ba971000ebb8bf4ca748cf96e6c0241ba75bca2265d68a0ac75f`**. The hosted artifact and locally tested build were compared byte-for-byte; they are identical.

Two initial hosted attempts exposed new runner assumptions, not additional game faults: the roof assertion ran before the frame consuming E, and the resume check required the saved play-time counter to stay frozen while the game naturally advanced a frame. The runner now waits for actual vent state with a bounded timeout and compares all quest/moral data exactly while separately bounding the time increment by real elapsed world time. Only a copied Node-side comparison object is normalised; no browser game state is edited to pass the check.

## What was virtually played

### Hosted journey and cold resume

`tests/play-audit-followup.mjs` uses actual Playwright keyboard/mouse events and uninterrupted requestAnimationFrame timing, from the original avenue spawn through the six-resident rescue to the truck briefing, then reloads the file and selects RESUME. First-spawn/settings setup is explicit; after that there is no actor relocation, health/energy refill by the tester, godMode, invulnerability, injected quest flag or stage skip. The game naturally restores health at area starts.

The route uses C restraint/water/beam interactions, R nonlethal support, normal Space teleport powers, E Nite Owl grapple and escorts, WASD room traversal, and G/E roof ventilation. Six residents physically reach safety. Reload preserves their rescue state, Heat, moral totals and truck checkpoint. **15 checks, minimum coherence 92, zero page errors.** This is a known route using read-only state telemetry, not a first-time human playthrough.

### Supplementary continuous full-adventure run

A separate local run continued through the moving truck fight and physically escorted the driver to safety, reaching the **Mercy ending** in one continuous journey from the original avenue spawn. It used ordinary keyboard/mouse controls with normal damage, six Q casts at mechanical parts, and no actor placement, tester refills, invulnerability or stage skips.

Result: **18 checks, minimum coherence 83, 14 people spared, 0 unmade, 0 Comedian casualties, 6/6 residents rescued, final Heat 0**. The ending screenshot was inspected. Summary: [local-full-run.json](screenshots/audit-followup/local-full-run.json).

This complete local run used the exact scripts inlined into Chromium with in-memory storage because local file navigation was blocked. It is supplementary gameplay evidence, not proof of real persistence. The separate hosted journey above supplies normal-file and reload evidence. It follows a known route and does not establish natural first-time difficulty. Its log, full route script and screenshots are included in the conversation's `Gameplay-Audit-Local-Live-Evidence.zip` download.

## Hosted visual evidence

All four hosted screenshots were inspected; no actors or attack states were posed for them.

| Moment | Actual screenshot |
| --- | --- |
| Tenement briefing after natural transition | [View](screenshots/audit-followup/tenement-arrival-live.png) |
| Six residents safely outside | [View](screenshots/audit-followup/six-rescued-live.png) |
| Truck briefing after natural transition | [View](screenshots/audit-followup/truck-arrival-live.png) |
| Truck restored after real reload and RESUME | [View](screenshots/audit-followup/truck-resumed-live.png) |

The resume image was captured during the normal fade-in and is dark; it is not presented as evidence of final rendering brightness. The adjacent arrival view shows the settled framing, and the resume assertions verify state restoration. [Journey telemetry](screenshots/audit-followup/journey.json) records methods, trace, checks and health.

## Successor / outstanding verification

No reproducible failure of the two corrected issues remains in the tested build. This is not a guarantee of no bugs. A full normal-damage virtual route now reaches the ending, but a **first-time human playthrough** remains outstanding for discoverability, pacing and enjoyment. Subjective soundtrack quality, Safari/Firefox, low-end hardware, cross-file save migration and mobile gameplay remain unverified; mobile controls are not implemented.

Do not redesign the original game or add another level as part of verification. Keep PR #4 draft, preserve all Claude branches and PR #1, and do not merge/deploy without further instruction. For a reproduced issue, add a focused check, make a small branch-local fix, rerun all twelve suites sequentially, rebuild and rerun all three standalone suites plus the real-input journey.

Commands: `npm test` covers the original nine; additionally run `node tests/bonus.mjs`, `node tests/ninth-minute.mjs`, `node tests/long-summer.mjs`, then `node tools/build.mjs`, the three bonus commands with `dist/dr-manhattan.html`, and `node tests/play-audit-followup.mjs`. Do not substitute `--offline` results for normal-file CI.
