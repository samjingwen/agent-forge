# Evaluation

Run deterministic checks with `npm test`. They exercise temporary Git repos,
actual subprocesses, independent sessions, identical packets, report contracts,
bad/partial output, mutations, output caps, timeouts, private-path exclusion,
installation and relocation. They do not test prompts by looking for words.

Real model review is development-only and opt-in:

```sh
node evals/smoke.mjs --peer opencode
node evals/smoke.mjs --peer claude-code:sonnet
```

The evaluator creates disposable Git repositories with an introduced subtraction
defect and a clean equivalent implementation. It executes the installed reviewer
adapter through the same public helper CLI and reports status, coverage, findings,
elapsed time, and whether the known defect is reported. No live product data,
employer submissions, payments, or production services are used.

This is an initial calibration fixture, not proof of general correctness.
Expand with labeled authorization, concurrency, persistent-data compatibility,
required abstraction, and historical replay cases. Include clean controls so
adversarial nit inflation is visible. Record served model identity only when
observed, preserve failures, and compare quality against elapsed time and usage
when the harness provides that evidence. Do not put live model calls in CI.
