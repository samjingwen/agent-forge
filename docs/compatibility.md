# Compatibility and verification

Three different claims are kept separate:

1. **Bundle/contract tests:** real Git, subprocesses, scope capture, relocation,
   output normalization, failure handling, and native-shaped CLI protocol fixtures.
2. **Native acceptance:** the installed harness accepts the actual invocation
   and returns a validated report.
3. **Model quality:** known defects and clean controls reviewed by real models.
   A few smoke cases are not a comparative precision/recall benchmark.

| Harness | Bundled adapter | Protocol fixture tests | Native evidence |
| --- | --- | --- | --- |
| OpenCode | Yes | Automated | 1.18.35: validated reports on defect and clean-control smoke cases |
| Claude Code | Yes | Automated | 2.0.76: invocation attempted; harness reports credential rejection |
| Codex | Yes | Automated | CLI absent on the development machine |
| Cursor | Yes | Automated | CLI absent on the development machine |
| Pi | Yes | Automated | CLI absent on the development machine |

The development machine has OpenCode 1.18.35 and Claude Code 2.0.76. Missing
CLIs are an availability limit, not evidence of failed authentication.
Each adapter documents its source interface and model/permission assumptions.
New CLI versions must be exercised before extending native claims.

On 2026-10-11, OpenCode reported the introduced subtraction defect with a
concrete input and returned empty findings for the clean equivalent change.
Claude's installed executable rejected credentials before returning a review.
This is not evidence that its credentials expired or that the adapter reviewed
the fixtures. See the [recorded smoke observations](../evals/results/2026-10-11.json).

The no-mistakes recipe is source-targeted at v1.84.0. Standalone field conversion
is executable-tested; end-to-end gate verification is recorded here when run.

Helper runtime: Node.js 22+ and Git, Linux/macOS. The in-host Markdown protocol
does not require a Node helper. No model keys or credentials are bundled.
