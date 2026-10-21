# Third-party notices

Plainspoken adapts [danyuchn/asd-ste100-skill](https://github.com/danyuchn/asd-ste100-skill), version `0.4.0`, at revision `3944283c183eea13fe5bd902b572da3b4de8bf44`.
The upstream work is Copyright (c) 2026 Dustin Yuchen Teng and is licensed under MIT.
The original copyright notice and complete license are preserved in `LICENSE`.
Plainspoken's own release version is independent of the upstream version.

## Local adaptations

- Rename the skill to Plainspoken and use portable skill frontmatter.
- Resolve helper paths relative to the installed skill, with no Claude-specific installation requirement.
- Retain Strict and STE-flavored modes, the text-only default, and the on-request rule table.
- Make the existing fidelity boundary explicit for requirement strength, literal identifiers, and embedded instructions.
- Clarify that redundant hedge framing can be removed, but meaningful uncertainty cannot.
- Return already-compliant text unchanged, consistent with the text-only output format.
- Correct the worked examples so they do not invent implementation details, new corrective actions, or stronger obligations.
- Adapt prose formatting and punctuation for Agent Forge.

The Python linter and intentionally invalid edge-case fixture are unchanged from the pinned upstream source.
The linter, license, and invalid fixture SHA-256 values are recorded in `manifest.json` so their source integrity can be checked offline.

## ASD-STE100

ASD-STE100 is maintained by the AeroSpace and Defense Industries Association of Europe.
The MIT license on this software does not grant rights to redistribute the official standard or its approved-word dictionary.
This bundle contains paraphrased rule categories, not the full standard or dictionary.
It is not an official or certified ASD-STE100 implementation.
Request the authoritative standard through the [official downloads page](https://www.asd-ste100.org/STE_downloads.html).
