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

## Latest OpenCode native acceptance

Run this opt-in check against explicitly selected latest stable executables:

```sh
node evals/hardlook/opencode-native.mjs --v1-bin /absolute/v1/opencode --v2-bin /absolute/v2/opencode
```

It installs and relocates a complete bundle, creates disposable Git repositories and isolated host homes, and sends both real CLIs to a deterministic loopback OpenAI-compatible provider.
The provider drives an allowed literal `calc.js` read, a forbidden literal `credentials-fixture.json` read, and a synthetic skill load when advertised, then returns a fixed report.
The check validates actual CLI acceptance, effective tool exposure, those specific literal-read/skill denials, version/generation recording, report normalization, and source non-mutation without accessing live provider credentials.
The caller runs in a different directory with a stale `PWD`; the allowed read must still return the reviewed repository's content.
Read-permission masks do not comprehensively filter native grep results or canonical/symlink targets in either generation, and this check does not claim otherwise.
It makes no live LLM calls and does not establish review accuracy.
No binary is installed, upgraded, or downloaded by this evaluator; supply the executables separately.
Keep native acceptance opt-in rather than adding a runtime or CI dependency on two global CLI installations.
