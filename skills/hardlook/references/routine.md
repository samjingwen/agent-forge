# Routine review

Adapted from Ponytail 5's pragmatic ordering: correct, safe, holds under real
load, tested, fast, lean. Use the common protocol for evidence and scope.

## Correct and safe

Check boundary values, missing data, encoding, rounding, time zones, stale state,
and broken callers. Trace identity and authorization to the protected operation;
check tenant/ownership scope, serialization, logs, and fail-open paths using the
repository's stated access policy. Trace writes and error propagation for data
loss, duplicate charging, partial updates, and swallowed failures.

## Real load and failure

State the expected load from deployment or product evidence. Check shared-state
check-then-write races, process-local assumptions, retry after partial failure,
unbounded accumulation, query-per-item behavior, and genuinely costly hot paths.
Avoid speculative scalability demands for loads the product does not claim.

## Tested

Inspect tests of risky logic and bug fixes. Prefer a behavior test that fails for
the concrete defect. Source-string assertions, snapshots of implementation
shape, and coverage percentages alone do not prove behavior. Identify the
specific missing scenario, not generic "add more tests" advice.

For an executable defect, describe the smallest input/state and expected result that expose it.
Propose a focused check as `not-run` when execution is prohibited or unavailable.
Only record observed output when actually obtained or supplied, with its origin and verification limits.
Do not treat a reproduction command as permission to run it, or require an executable test for a statically substantiated security or maintenance problem.

## Lean

Question dead code, options with no intended use, near-copies that must change
together, avoidable dependencies, and helpers the standard library or repository
already supplies. Split by responsibility, not line count. One implementation
or caller is a question to investigate, not sufficient evidence to delete an
isolation, framework, transaction, or security boundary.

Recommend the smallest correct change. Keep behavior-changing removals separate
from non-functional simplification, and surface genuine intent decisions.
