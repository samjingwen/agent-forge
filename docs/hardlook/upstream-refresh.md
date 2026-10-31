# Upstream review refresh

The 31 October 2026 refresh compared Hardlook's pinned review sources with current upstream files and licenses.
It updates the self-contained skill to 0.2.0 without introducing upstream runtime dependencies.

| Source | Compared revision | Review-relevant result |
| --- | --- | --- |
| Ponytail | `96608e078b2d5ea607c5c3b8b5a54d1c1fba6846`, version 5.3.3 | Review and audit skills and MIT license are unchanged from Hardlook's `9b58c1ffb790c075ca32e70a89cf1d80588f4abf` pin. |
| pstack | `4dd1d05818d19792e7cd6e818f1667f95f7e1dbe`, version 0.15.36 | The 27 October interrogate update at `ab1f702ce8e8b6557edb56b09f52cde8bfb83f17` adds mandatory reproduction evidence and lead reruns; the MIT license is unchanged. |
| Cursor Team Kit | `4dd1d05818d19792e7cd6e818f1667f95f7e1dbe` | The thermonuclear review skill, reviewer agent, and MIT license are unchanged from Hardlook's `9d76bcab133aefcccb16121d7be874e6aa823729` pin. |

Hardlook selectively adapts [pstack's reproduction-evidence update](https://github.com/cursor/plugins/commit/ab1f702ce8e8b6557edb56b09f52cde8bfb83f17).
Findings may now retain proposed commands, expected results, and explicitly unverified reported output.
The deep lead cannot introduce or alter structured reported observations absent from peer findings.
The no-mistakes bridge preserves this evidence in its existing description field.

Hardlook does not adopt mandatory execution, blanket rejection of static findings, automatic model fallbacks, or omission of failed reviewers.
Read-only peers and leads hand independent confirmation needs back to the caller or pipeline.
Ponytail's hooks and telemetry, and Cursor-specific installation or orchestration, remain outside this skill.
Unchanged review sources keep their original pins; historical pstack attribution remains alongside the newer adaptation pin in the bundled manifest and notices.
