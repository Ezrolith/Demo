# Gameplay audit follow-up - 25 October 2026

Branch: `codex/bonus-three`; draft PR #4. No merge or deployment.

## Corrections

- Reset the Summer camera target and clear old markers/transient objectives when a new map is built. The previous street target otherwise pulled Jon off-screen throughout the next briefing; the BALCONY ROUTE marker also leaked into the tenement.
- Bind lethal cab targeting to the actual pending Disintegrate pulse instead of a 0.35-second wall-clock deadline. The legitimate 0.2-second impact freeze could expire a deliberately aimed cast. Wheel splash remains nonlethal; an expired cast cannot authorise later damage.

## Verification

The preceding full run 40139580928 completed successfully. This follow-up separately reruns all twelve source suites, rebuilds, and runs all three standalone suites.

The new `tests/play-audit-followup.mjs` uses real RAF and Playwright keyboard/mouse actions from the original avenue spawn through six rescues to the truck briefing, then reloads the file and selects RESUME. No actor relocation, health/energy refill, godMode, injected quest flags or stage skips are used after first-spawn setup. It follows a known route, not a first-time human playthrough.

| Command | Final output | Recorded exit |
| --- | --- | --- |
| live-journey (attempt 1) | `LIVE JOURNEY PASSED: 15 checks; minimum coherence 92.00.` | 0 |
| smoke (attempt 1) | `Smoke test passed.` | 0 |
| visual (attempt 1) | `All atmosphere checks passed.` | 0 |
| audio (attempt 1) | `All audio checks passed.` | 0 |
| powers (attempt 1) | `All mechanics checks passed.` | 0 |
| saves (attempt 1) | `All save & robustness checks passed.` | 0 |
| settings (attempt 1) | `All settings & accessibility checks passed.` | 0 |
| ledger (attempt 1) | `All ledger & combat-feel checks passed.` | 0 |
| encounters (attempt 1) | `All encounter checks passed.` | 0 |
| flows (attempt 1) | `All story flow checks passed.` | 0 |
| bonus (attempt 1) | `BONUS ACCEPTANCE PASSED: 42 checks (normal file loading).` | 0 |
| ninth-minute (attempt 1) | `NINTH MINUTE PASSED: 75 checks (normal file loading).` | 0 |
| long-summer (attempt 1) | `LONG SUMMER PASSED: 80 checks (normal file loading).` | 0 |
| dist-bonus (attempt 1) | `BONUS ACCEPTANCE PASSED: 42 checks (normal file loading).` | 0 |
| dist-ninth-minute (attempt 1) | `NINTH MINUTE PASSED: 75 checks (normal file loading).` | 0 |
| dist-long-summer (attempt 1) | `LONG SUMMER PASSED: 80 checks (normal file loading).` | 0 |

Live journey checks: 15; minimum coherence: 92.00; page errors: 0.

Two initial hosted live-journey attempts exposed test assumptions, not additional game failures: checking the roof before its next input frame, and requiring the saved play-time counter to remain exactly frozen during reload. The runner now waits for actual vent state with a bounded timeout and compares all quest/moral data exactly while separately bounding time advancement by the real elapsed world time. No old suite assertion was weakened.

## Evidence and successor

- `docs/screenshots/audit-followup/tenement-arrival-live.png`: actual new-area briefing and camera.
- `six-rescued-live.png`: all six residents saved on the actual input route.
- `truck-arrival-live.png`: actual transition to the boss area.
- `truck-resumed-live.png`: real file reload and menu resume.
- `journey.json`: methods, trace, checks and health telemetry.

Local development used inlined scripts/memory storage because local file navigation is blocked; the authoritative GitHub run uses normal file navigation and real browser storage. The frozen-impact reproduction is a controlled mechanics test, not a claimed naturally occurring live capture.

Still unverified: a complete first-time human playthrough through the truck ending, subjective soundtrack quality, Safari/Firefox, low-end hardware, cross-file save migration and mobile gameplay. The live journey stops at the truck checkpoint; existing focused suites cover boss outcomes. Keep PR #4 draft and preserve all Claude branches.
