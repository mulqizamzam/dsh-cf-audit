# Contributing

Keep changes focused on defensive source review, bounded local validation, or accurate reporting. Preserve the explicit authorization boundary and do not add automatic live-target probing, credential handling, hidden telemetry, or target-controlled execution without an independently reviewed design.

Before opening a contribution:

1. Run `npm test` (Node's built-in test runner; no install is needed for the existing checks).
2. Run `node scripts/validate-package.mjs`.
3. Validate sample and changed data with the relevant script in `scripts/`.
4. Build the deterministic release ZIP twice and compare the archives byte-for-byte.
5. Inspect the final archive for accidental secrets, generated state, and unrelated files.

Do not claim a DSH runtime smoke test unless it has been run against the exact declared DSH version. Report the version and command used, along with any skipped checks.
