# Review entry point — 26 October 2026

The newer [Part A review response](AFTER-MIDNIGHT-PART-A.md) supersedes the
guard-only check below. It records A1–A5, per-build suite exits and live evidence.
Part B has not been started.

Review `codex/watchmen-stories` in [draft PR #6](https://github.com/Ezrolith/Demo/pull/6),
targeting `codex/bonus-three`. Keep it in draft: no merge or deployment.

## Latest correction

Silk Spectre's intended 28% guard movement penalty was bypassed because movement
was calculated before the guard ability refreshed its state. Movement now reads
live eligible F input. Damage reduction and parry timing retain their existing
path. The original code failed the new movement regression before the fix.

Five added checks cover first-frame/held slowdown, immediate release and speed
recovery, insufficient stamina, and unchanged Nite Owl/Rorschach focus movement.
The actor suite now has 42 checks, including the existing guard damage checks.

## Fresh local checks

- All JavaScript syntax checks and the reproducible 63-script standalone build.
- Chromium: all five expansion suites on source and standalone, 186 checks per build.
- WebKit: the 42 actor/gear checks on both builds.
- Full ordinary-input Undertow and Rescue Clock routes as Silk Spectre on both
  builds: 16 and 12 checks respectively. All four civilians physically reach safety.
- Independent bounded code review of save/menu/case/mode integration and the fix;
  no further concrete blocker found. Main handover/guide links resolve.

These focused results supplement the earlier full CI baseline. The baseline
revision is `e6f6b5f`, whose four workflows passed, including 43 regression
commands, the three-engine matrix, native Safari and slowdown/audio probes.
New CI is triggered by the guard-fix branch update; use the PR's current checks
for its outcome. Do not attribute the older full run to the new code revision.

## Further reading

- [Player guide](AFTER-MIDNIGHT.md) and [expansion technical handover](AFTER-MIDNIGHT-HANDOVER.md).
- [Results](after-midnight-results.json): historical full baseline plus the guard follow-up's source/build digests and focused verification.
- [Earlier QA corrections](QA-POLISH-HANDOVER.md), [Summer review](SUMMER-REVIEW-HANDOVER.md), and [platform QA](PLATFORM-QA-HANDOVER.md).

Review first-time discovery/pacing and later-wave balance critically. Guided
automated routes, synthetic slowdown and loopback Safari checks have the limits
recorded in the handover. Subjective listening, physical devices, assistive
technology and Safari direct-file opening remain unverified; touch is unsupported.
