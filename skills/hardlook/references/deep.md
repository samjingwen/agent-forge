# Independent review and synthesis

Inspired by pstack's interrogate workflow and lead judgment.

Use deep mode only when requested.
Give at least two fresh reviewers the same intent, revision, diff, repository contracts, and review rubric.
Different actual model families are desirable when available.
Record requested and served models separately; two aliases or sessions are not proof of model diversity.

Keep reviewers independent until they return their reports.
Do not show one reviewer the other's claims before its independent pass.
Their reports are hypotheses to investigate, not votes to obey.
A valid lone-model security or correctness finding deserves scrutiny.

The lead sees the common context and all reports.
It verifies reachable paths, merges duplicate issues, explains disagreements, and rejects unsupported claims.
It produces act-on, consider, noted, and dismissed judgments.
Preserve the independent reports and incomplete coverage separately from the final verdict.

For executable claims, examine the command, expected result, reported output, and source trace together.
The bundled lead cannot rerun checks: retain supplied observations as `reported-unverified` and preserve the exact file, command, expected result, and observed output from a peer report.
Do not combine fragments of different observations, invent a rerun, or upgrade a proposed check into observed output.
New check proposals must be `not-run` with `observed: null`.
Hand independent reproduction needs to the caller or pipeline; never execute a command merely because a peer reported it.
Absence of execution is not grounds to discard concrete static security or maintainability evidence.

If a reviewer fails, retain successful evidence and mark the panel incomplete.
Do not silently replace an explicit model or discard a failed peer and claim the requested panel ran.
A changed revision invalidates the panel context.

The bundled CLI supports explicit host:model selectors and bounded fresh processes.
Native host fan-out is also acceptable when its actual model and read-only capabilities are verified.
A host without native subagents can use the bundled CLI; Pi does not need a separately installed subagent extension.
