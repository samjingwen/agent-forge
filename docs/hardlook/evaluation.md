# Evaluation

Run deterministic checks from the repository root with `npm run test:hardlook` (or `npm test` for all components).
They exercise temporary Git repos, actual subprocesses, independent sessions, identical packets, report contracts, bad/partial output, mutations, output caps, timeouts, private-path exclusion, installation and relocation.
They do not test prompts by looking for words.

Reproduction contract tests exercise all five native-shaped adapter outputs, optional fields, proposed commands remaining unexecuted, invalid confirmation/status claims, empty observed output, and source-only findings in routine, structural, and deep review.
Deep synthesis tests retain a lone peer's unverified observation but reject invented output, changed commands/expectations, and unrun checks promoted to observed results.
Pipeline conversion preserves exact reported strings and status in the existing description field, and installed/relocated bundle tests exercise the new report contract.
These deterministic fixtures prove helper enforcement, not that real models reliably follow the evidence rubric.

Real model review is development-only and opt-in:

```sh
node evals/hardlook/smoke.mjs --peer opencode
node evals/hardlook/smoke.mjs --peer claude-code:sonnet
```

The evaluator creates disposable Git repositories with an introduced subtraction defect and a clean equivalent implementation.
It executes the installed reviewer adapter through the same public helper CLI and reports status, coverage, findings, elapsed time, and whether the known defect is reported.
No live product data, employer submissions, payments, or production services are used.

This is an initial calibration fixture, not proof of general correctness.
Expand with labeled authorization, concurrency, persistent-data compatibility, required abstraction, and historical replay cases.
Include clean controls so adversarial nit inflation is visible.
For evidence-rubric calibration, include execution-prohibited reviews under pressure to claim a reproduction, supplied-output claims that require verification, static authorization flaws without executable checks, and structural findings with proposed preservation tests.
An appropriate response distinguishes source evidence from unrun checks and unverified output rather than inventing test receipts or suppressing valid static findings.
Record served model identity only when observed, preserve failures, and compare quality against elapsed time and usage when the harness provides that evidence.
Do not put live model calls in CI.
