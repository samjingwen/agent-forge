# Reports and verdicts

For a human, start with the intent and what the change does. List the findings
by severity and lead judgment. Every issue identifies file/line, evidence,
concrete scenario or structural cost, consequence, and smallest effective fix.
Finish with reviewed paths, unchecked areas, and incomplete capabilities.

For the bundled runner, return only JSON matching `schemas/report.json`:

- `summary`, `risk_level` (low/medium/high), `risk_rationale`.
- `reviewed_paths`: exact changed paths actually examined, including deletions
  judged from the diff. Partial coverage must be stated.
- `findings`: `file`, positive `line` or null, `severity` (error/warning/info),
  `judgment` (act-on/consider/noted/dismissed), `evidence`, `consequence`,
  `suggestion`, and `action` (auto-fix/ask-user/no-op).

Actions recommend the decision category, not permission to perform changes.
Use ask-user for remedies challenging intent or adding an unauthorized subsystem.
Only source-relevant issues belong here; absent outputs of later pipeline steps
are not source defects.

The runner validates report fields and coverage, records the immutable packet
identity, and distinguishes complete, partial, and incomplete execution. Pipeline
format is emitted only for a complete report and uses the bundled no-mistakes
bridge. Within an actual pipeline, its supplied schema takes precedence.
