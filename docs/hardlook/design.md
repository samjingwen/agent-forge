# Design

## Fat distribution, modular internals

The installed directory owns every runtime asset:

| Directory | Responsibility |
| --- | --- |
| `SKILL.md` | Trigger, mode selection, and role boundaries |
| `references/` | Common evidence protocol and selected review lenses |
| `agents/` | Independent reviewer and contextual lead templates |
| `adapters/` | Host launch/configuration recipes and workflow integration |
| `scripts/` | Git context, bounded processes, normalization, and orchestration |
| `schemas/` | Structured report contract |
| `manifest.json`, notices | Release identity and provenance |

Skill installers often copy only the selected skill directory. Keeping runtime
helpers at the repository root would break that contract. Root docs, tests, and
CI are maintainer assets; no installed helper imports them.

## Evidence and calibration

The routine rubric follows Ponytail 5's correctness-first pragmatism. Independent
review and noise filtering draw on pstack. Structural mode draws on Cursor's
thermonuclear lens, with arbitrary file-size heuristics treated as advisory.

Reviewers must substantiate reachable defects or concrete structural cost. A
lead's job is to inspect and contextualize, not count votes. A justified single
implementation, required compatibility path, or framework/security boundary is
not automatically complexity to delete.

## Frozen input and honest output

The packet pins scope, base, HEAD, intended behavior, selected source, and project
rules. Bounded capture fails instead of silently truncating. A hash binds the
packet and checkout status; changing that context invalidates the review result.
This detects relevant drift, not every possible mutation of an excluded private
or ignored file. Native read/search restrictions remain the first boundary.

Each reviewer records its examined changed paths. The lead synthesizes only
successful independent reports. Missing peers, invalid reports, missing
coverage, and exclusions are visible. Structured validation is implemented
against the exact bundled schema subset using Node standard libraries.

The helper never invents served-model identity from the requested selector.
Model availability, authentication, and reasoning behavior are host concerns.
No fallback converts a failed explicit peer into a successful diversity claim.

## Process ownership

Review processes have wall-clock and output-size bounds. POSIX process groups
are reaped after exit and on cancellation/time limits. Helpers currently target
Linux and macOS; Windows skill usage is possible through its host, but external
runner process-tree behavior is not advertised as verified on Windows.

Use Hardlook inside an existing delivery gate through its instruction adapter.
The gate owns branch custody, fixes, approvals, validation, and publication.
Hardlook itself does not create a second delivery orchestrator.
