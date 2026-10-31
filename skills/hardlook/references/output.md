# Reports and verdicts

For a human, start with the intent and what the change does.
List the findings by severity and lead judgment.
Every issue identifies file/line, evidence, concrete scenario or structural cost, consequence, and smallest effective fix.
Distinguish static evidence, proposed checks, reported output, and any separately authorized independent confirmation.
Never describe an unrun check or model-supplied output as a verified reproduction.
Finish with reviewed paths, unchecked areas, and incomplete capabilities.

For the bundled runner, return only JSON matching `schemas/report.json`:

- `summary`, `risk_level` (low/medium/high), `risk_rationale`.
- `reviewed_paths`: exact changed paths actually examined, including deletions
  judged from the diff. Partial coverage must be stated.
- `findings`: `file`, positive `line` or null, `severity` (error/warning/info),
  `judgment` (act-on/consider/noted/dismissed), `evidence`, `consequence`,
  `suggestion`, and `action` (auto-fix/ask-user/no-op).
- Optional `reproduction`: `status`, `command`, `expected`, and `observed`.
  Use `not-run` with `observed: null` for a proposed check.
  Use `reported-unverified` with a string `observed` for supplied output that the runner has not independently verified.
  An empty string is valid actual output; it is distinct from a check that did not run.
  `command` must be nonempty; `expected` may be empty if no output is expected.
  Preserve exact command, expected result, and observed output, including whitespace.
  State the supplied output's origin and environment limitations in `evidence`.
  Never add a verified status or confirmation flag.
  Reports without reproduction fields remain valid; source-traced security and structural evidence can be actionable on their own.

Actions recommend the decision category, not permission to perform changes.
Use ask-user for remedies challenging intent or adding an unauthorized subsystem.
Only source-relevant issues belong here; absent outputs of later pipeline steps
are not source defects.

The runner validates report fields, status/output consistency, and coverage, records the immutable packet identity, and distinguishes complete, partial, and incomplete execution.
Deep synthesis can retain a reported observation only when the same file, command, expected result, and observed output appear together in an independent peer report.
The lead may propose a new `not-run` check, but must not manufacture reported output or silently rewrite its context.
This lineage check prevents new structured observations; it does not verify execution, the finding's correctness, or free-text claims.
Pipeline format is emitted only for a complete report and uses the bundled no-mistakes bridge.
Preserve reproduction status, command, expected result, and observed output in the existing finding description, not new pipeline fields.
Within an actual pipeline, its supplied schema takes precedence.
