# Plainspoken

Plainspoken rewrites dense or ambiguous English using ASD-STE100-inspired sentence discipline.
It is intended for tool descriptions, error messages, prompts, status reports, and inter-agent instructions.
It preserves meaning, uncertainty, conditions, literal identifiers, and requirement strength.
It is not a certified STE authoring tool and does not contain the official approved-word dictionary.

## Installation

```sh
npx skills add samjingwen/agent-forge --skill plainspoken
```

Choose the agent in the installer and start a new session.
From a local checkout, replace `samjingwen/agent-forge` with the checkout's absolute path.
No global configuration change is required.

Example requests:

- "Use Plainspoken to disambiguate this tool description."
- "Rewrite this error message so another agent cannot misread it."
- "Apply Simplified Technical English to this instruction and show the before/after table."

## Behavior

**Strict** mode applies to procedures, error messages, tool descriptions, and inter-agent instructions.
**STE-flavored** mode applies to READMEs, PR descriptions, and explanatory prose, with more freedom in vocabulary.
The agent infers the mode unless the user specifies it.

By default, the skill returns only the rewritten text.
If a phrase must remain unsimplified to preserve precision, one `Kept as-is:` line explains why.
Ask for a diff, before/after comparison, or explanation to receive a rule table instead.
Already-compliant text is returned unchanged.

The skill must not turn "may have failed" into "failed", "should" into "must", or an attempted operation into a promised result.
It must not add causes, implementation details, or new corrective actions absent from the source.
The [worked examples](../../skills/plainspoken/examples/before-after.md) illustrate those boundaries.

## Optional Linter

In-host rewriting needs no Python runtime.
The bundled deterministic linter requires Python 3.11 or later and no third-party packages.
It reads files or stdin and does not rewrite them.
Resolve its path from the installed skill directory, not the directory being linted.

```sh
python3 <skill-dir>/scripts/ste-lint.py --json description.md
python3 <skill-dir>/scripts/ste-lint.py --baseline 2 description.md
python3 <skill-dir>/scripts/ste-lint.py --disable passive-voice,present-perfect description.md
python3 <skill-dir>/scripts/ste-lint.py --selftest
```

From this repository, `npm run lint:plainspoken -- --json description.md` runs the same helper.

| Exit code | Meaning |
| --- | --- |
| 0 | Hard findings do not exceed the baseline; advisory findings may remain. |
| 1 | Hard findings exceed the baseline. |
| 2 | Arguments are invalid or an input file cannot be read. |

The helper checks semicolons, selected phrasal verbs, nominalization, selected marketing adjectives, long sentences, synonym rotation, and incomplete list items.
Passive voice and compound-tense findings are advisory.
The helper never flags hedges or modality.
Its sentence-length limit is 25 words because it cannot infer whether text is a procedure.
It does not check the official dictionary, all phrasal verbs, noun-cluster length, or whether a rewrite preserved meaning.
Treat findings as heuristics, not proof of a defect or permission to remove uncertainty.

Do not make this a blanket repository-writing gate.
The skill's own documentation quotes intentionally invalid text, and the edge-case example deliberately produces two hard findings.

## Development and Verification

The complete installed bundle lives in `skills/plainspoken/`.
Maintainer documentation and tests live outside that directory.
Keep the bundle self-contained so a skill-only installation does not depend on root packages, docs, or test files.

```sh
npm ci --ignore-scripts
npm run quality
npm run check
npm run test:plainspoken
npm test
```

The tests invoke real Python subprocesses for stdin/file input, JSON output, exit codes, baselines, disabled rules, code masking, modal phrases, and relocation.
They also run upstream's self-test, parse the bundle's metadata, and verify the linter, license, and invalid fixture against independently pinned upstream SHA-256 values and the manifest.
These hashes were checked against GitHub's blobs at the recorded source revision before landing the port.
Root quality checks cover maintained JavaScript tests, not the immutable upstream Python source.
The private repository's Node 22.13+ development minimum and pinned ESLint/Prettier setup remain unchanged.
Tests default to `python3`; set `PYTHON` to another Python executable path when needed.
CI configures Python 3.11 on Linux and macOS.
The tests make no live model calls and do not establish rewrite accuracy or native-agent compatibility.

For manual or opt-in model evaluation, use the inputs and fidelity criteria in [`evals/plainspoken/cases.json`](../../evals/plainspoken/cases.json).
Read the rewritten output against every criterion, not only the linter result.
The fixtures do not run a model or produce an automated fidelity verdict.

## Provenance and Updates

Plainspoken adapts [danyuchn/asd-ste100-skill](https://github.com/danyuchn/asd-ste100-skill), upstream version `0.4.0`, at revision `3944283c183eea13fe5bd902b572da3b4de8bf44`.
The upstream MIT license and copyright are preserved in [`skills/plainspoken/LICENSE`](../../skills/plainspoken/LICENSE).
The [bundled notices](../../skills/plainspoken/THIRD_PARTY_NOTICES.md) describe local adaptations.
Plainspoken's release version is independent of the upstream version.

The Python linter and invalid-list fixture are copied unchanged.
The instructions and examples are adapted for the new name, installed-relative paths, portable metadata, and explicit meaning-preservation boundaries.
Unlike the upstream examples, the rewrites do not add an artifact-completeness check, claim that cache data stays local, or strengthen recommendations into commands.

When updating upstream assets, review the pinned revision, retain the license, and update `manifest.json` and `catalog/external-tools.json` together.
Update the recorded linter hash only after reviewing the script changes.
Run all tests and verify a clean skill installation in a disposable project, including relocation and access to every bundled resource.
Do not add the official ASD dictionary or fetch it at runtime.
