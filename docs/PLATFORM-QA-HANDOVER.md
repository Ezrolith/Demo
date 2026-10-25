# Bonus adventures — browser compatibility, backup and performance handover
**Date:** 25 October 2026  
**Review branch:** `codex/bonus-three` / [draft PR #4](https://github.com/Ezrolith/Demo/pull/4) (base: `codex/bonus-polish`).  
**Production source and HTML verified:** `0fb0f85a023f050bb5015dd32d1c813ac35f9da4`.  
**Original game, Claude branches, deployed site:** unchanged; no merge or deployment.

## Check-in and actual outcomes

The previous QA conversation ended after validating bonus-only save backups, testing Chromium/Firefox/WebKit, exercising native Apple Safari and measuring 4× CPU slowdown. The complete four-job [release-gate run 40194011569](https://github.com/Ezrolith/Demo/actions/runs/40194011569) **succeeded**: browsers, native Safari, original-and-bonus regressions, and guarded publication. The new standalone is `dist/dr-manhattan.html`, 932,161 bytes at the tested release-gate commit; rebuild with `node tools/build.mjs` and confirm `git diff --exit-code -- dist/dr-manhattan.html`.

### Player-visible improvements already committed

- **BACK UP / RESTORE BONUS SAVES** in the Bonus Levels menu. Export saves a JSON file; choosing an input only previews it; a separate Restore button commits the chosen records. Existing records not present in the backup are preserved. Export the current records before importing another file.
- The backup covers **bonus progress only**, not campaign progress or settings. It validates version, size, chapters, checkpoint bounds, numerical limits and unsafe JSON property names; a failed storage write cannot silently update the in-memory state. It ignores superseded asynchronous file reads. Keyboard focus/Tab/Escape were checked.
- A truck-encounter camera bug that made the arena shrink too far out was corrected **locally to The Long Summer**. Verified movement left the player/boss readable without changing the original camera.
- The bonus menu now explicitly says keyboard and mouse are required. Menu usability on a phone is not playable touchscreen movement/combat.

### Test matrix — exact observed results

| Platform | Test | Result |
| --- | --- | --- |
| Chromium, Firefox, WebKit | Source `index.html` and standalone `dist/dr-manhattan.html` | **64 controlled platform checks per file/browser; exit 0**, nine maps each |
| Chromium, Firefox, WebKit | Backup export, invalid/stale-file rejection, fresh-profile restoration, reload | **17 checks per file/browser; exit 0** |
| Chromium, Firefox, WebKit | Real keyboard/mouse avenue → tenement → truck checkpoint and reload/resume | **15 checks per browser; exit 0**; normal damage |
| Native Apple Safari, macOS runner | Both representations over localhost via safaridriver | **90 checks; exit 0** |
| Source regression | Original nine + Last Broadcast + Ninth Minute + Long Summer | **All 12 suites exit 0**, Long Summer 82 checks |
| Standalone regression | All three bonus suites plus portability | **All four exit 0**, portability 17 checks |

The WebKit automation engine is not branded native Safari; the macOS safaridriver check is independent. Native Safari was loaded over a **private loopback HTTP server**: its WebDriver automation cannot certify opening the file directly through Finder on a personal Mac. The normal-file platform matrix used real file navigation; it did not require the local inlined-script fallback.

Previously detected test-environment problems were corrected before that successful run: delayed scene/fade readiness, the ambience mute fade window, Firefox's headless audio sink, normal Return versus keypad Enter on Safari, backup Tab focus, and a slow-file selection race. The latter two also have production-safe guardrails.

### Performance evidence, not a promise of a physical device

Measured from the [final matrix run 40194011569](https://github.com/Ezrolith/Demo/actions/runs/40194011569), across nine bonus maps in automated Chromium at 1280×720:

| Environment | Median frame gap | Approximate frame rate |
| --- | ---: | ---: |
| Chromium High, unthrottled | 16.7 ms | 60 fps |
| Chromium **4× simulated CPU slowdown**, High | 50.1 ms | 20 fps |
| Chromium **4× simulated CPU slowdown**, Low | 33.3 ms | 30 fps |
| Firefox, unthrottled | 17.1 ms | 58.5 fps |
| Headless WebKit, unthrottled | 30.0 ms | 33 fps |

**No performance optimisation or default quality change was forced**: the player particularly values the original lighting and effects, and synthetic CPU slowdown does not identify a safe visual-preserving renderer fix or represent a particular physical device. On a slower laptop, use **Settings → Render quality → Low** first; the measured scenario improved from about 20 to about 30 fps. A real low-spec machine and long sessions are still needed before promising a consistent minimum.

### Aftercare: remove now-invalid source staging and protect future QA

The previous release used temporary `.github/apply-platform.py`/other mutation scripts and a base64 transfer packet. They asserted that the backup source files did **not** already exist. Running them against the published repository would fail. They have been removed, together with the write-capable publisher.

The permanent workflows now:
- use **the code already committed in Git**, without modifying it before running;
- run with **`contents: read`**, including native macOS Safari;
- support controlled re-testing (Actions → workflow → Run workflow), including synthetic Low-versus-High performance;
- preserve test logs and screenshots as temporary GitHub Actions artifacts;
- keep the original read-only campaign/bonus regression checks.

Workflow files: `.github/workflows/bonus-validation.yml`, `platform-qa.yml`, `native-safari-qa.yml`. The final release-gate passed **before** the cleanup; the new clean workflows must report their own result separately.

## What is still genuinely unresolved

1. **First-time human experience:** no unbiased playthrough for discovery of objectives, pacing, difficulty, aesthetic parity and dialogue comprehension. Known automation routes are not a substitute.
2. **Sound as art:** numerical clipping/mute/loudness tests pass, but nobody has completed a subjective musical comparison of all four stories at a fixed system volume.
3. **Physical slow-device performance:** 4× CPU throttling proves a significant drop, not a device-level benchmark. Low quality is an available workaround, not a definitive cure.
4. **Native Safari downloaded-file opening:** locally hosted Safari works; direct `file://` launch from Finder remains unverified. Neither the macOS WebDriver file sandbox nor users' browser security settings were weakened.
5. **Assistive technology and touch:** focus/keyboard/reduced-flashing/size probes do not demonstrate VoiceOver/NVDA compatibility. Mobile touch gameplay remains unsupported.
6. **Cross-version migration:** backups transfer among compatible versions with the backup feature. Older copies without an export button cannot magically export; retain the original file/profile and avoid deleting data before confirming transfer.

## Successor test recipe

1. Checkout `codex/bonus-three`; confirm `git status` is clean. Run `node tools/build.mjs` and inspect `git diff --exit-code -- dist/dr-manhattan.html`.
2. Run the 12 original-and-bonus suites **one at a time**, logging each exit status; then the three bonus suites and `bonus-portability.mjs` against `dist/dr-manhattan.html`.
3. Use the read-only GitHub Actions **Browser and performance QA** and **Native Safari QA** workflows to collect browser, file transfer, native Safari and CPU-throttle results. Historical release evidence is run 40194011569; distinguish fresh results.
4. Play with the normal menu and normal damage on actual slow hardware, then compare High versus Low. Do not optimise away rain, sound, lighting or atmosphere solely to win a synthetic benchmark.
5. Run the [human playtest checklist](HUMAN-PLAYTEST.md). Photograph or record an actual reproduction before changing gameplay.

**Do not merge or deploy automatically.** Preserve the original campaign and all `claude/*` branches. Work only in the draft PR's review branch and explain any deliberate visual trade-off.
