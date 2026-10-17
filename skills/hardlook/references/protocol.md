# Evidence-first review protocol

1. State the user's intent, acceptance criteria, and known deliberate tradeoffs.
   Identify the reviewed base, commit, and dirty/staged scope. Read relevant
   project rules before proposing changes to ownership or compatibility.
2. Read each changed path, then relevant callers, callees, types, and tests.
   Follow data from input through decisions, persistence, and observable output.
   Record the exact changed paths you actually examined.
3. Trace candidate problems through reachable calls or concrete states. Confirm
   upstream validation and equivalent controls before declaring them missing.
   A missing function name or unfamiliar pattern is not proof of a defect.
4. Look for correctness, trust-boundary failures, data loss, concurrency,
   idempotency, retry/partial-failure behavior, performance at expected load,
   test gaps, and avoidable complexity. Apply only relevant lenses.
5. Re-read the relevant code before reporting. Explain location, concrete
   scenario or structural evidence, consequence, and the smallest effective fix.
   Distinguish new regressions from pre-existing issues.
6. Filter through the user's goals and contracts. Required compatibility,
   historical replay paths, transactions, security boundaries, and deliberate
   containment must not be removed merely because they look like scaffolding.
7. Return a useful verdict and coverage. Separate accepted issues, tradeoffs,
   and dismissed suggestions. Never present an interrupted or partial pass as
   clean. A clean review is not evidence of executed tests or passing builds.

Run meaningful focused checks only if the caller permits them. Pipeline-specific
instructions own the division of review, test, and lint work. For a review step
that forbids test execution, inspect test behavior and hand verification needs
back to the pipeline rather than executing another full suite.
