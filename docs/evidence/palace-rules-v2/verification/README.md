# Verification evidence

Raw files here are byte-identical copies of the recorded local evidence. The
manifest supplies relative paths, SHA-256 values, byte sizes and origins.
Extracted diagnostic files are explicitly marked as JSON extractions; their
complete representative source results are included beside them.

## Reload verification

- [Final rules-v2 summary](reload/final-v2-reload.json): ten complete tracking-suite
  runs per build, 86 checks per run, all twenty process exits zero. The exact
  [tested script bytes](reload/final-v2-tracking-test.mjs.txt) match the summary's
  `testSha256`. Both source and standalone representative runs include the full
  assertion list, log and before/after reload diagnostics.
- [Initial instrumentation summary](reload/initial-instrumented-39e3b23.json): ten
  full runs per build against the earlier rules-v1 runtime, 85 checks per run,
  all twenty exits zero. Representative result files retain its original raw
  packet, model cache, storage flags and document nonces. Its script hash is
  recorded in the summary; a separate exact copy of that intermediate test
  source was not retained.
- [Exact original control](reload/original-39e3b23-control.json): ten runs per
  build of the unmodified committed test, 82 checks per run, all twenty exits
  zero. The [original script](reload/original-tracking-test.mjs.txt) is copied
  unchanged from the isolated `39e3b23` checkout and matches the summary hash.

These are full tracking-suite sequences, including the storage-fault cases
before reload, rather than clean-profile pin-only probes. The independent
reviewer's intermittent failure was not reproduced here, even with the exact
original test. Strengthening diagnostics and reaching 10/10 per build does not
establish the original cause or prove that a persistence defect was fixed.
The representative diagnostics show distinct document nonces, identical stored
palace bytes across reload, and correct lazy restoration of the selected pin.

## Performance investigation

The [summary](performance/summary.json),
[raw controlled diagnostic matrix](performance/advance-matrix.json),
[original acceptance matrix](performance/original-acceptance-matrix.json), and
three acceptance logs cover the frozen earlier reviewed revision `39e3b23`
(71 scripts) and baseline `ed65bbf` (57 scripts). They do **not** claim to profile
the final 73-script rules-v2 runtime. Use the main rules-v2 report for final-build
suite results and hashes.

The three logs are separate source/standalone/baseline acceptance cases, not
three repeated acceptance runs of the final build. The original visual test is
included unchanged. Its threshold was not loosened. The seeded, stopped-RAF
three-trial diagnostics are performance measurements, not live captures, and do
not replace the original acceptance test. No production graphics optimization
was made: the reported narrow regression was not reproduced in this bounded
investigation, and its cause remains unproven.

No screenshots are included in this verification package. Natural-play images
and their manifests belong to the separate natural-play evidence package.
