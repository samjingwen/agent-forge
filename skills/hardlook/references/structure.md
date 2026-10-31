# Structural review

Adapted from Cursor's thermonuclear review lens; explicitly selected audit mode.

Look for a reframing that removes concepts, states, branches, or parallel rules,
rather than distributing the same complexity across more files. Ask whether
ownership matches the capability, types express the invariant, and orchestration
can be simpler and more atomic.

Investigate scattered feature checks, mixed responsibilities, repeated condition
chains, pass-through layers, cast-heavy contracts, unnecessary optionality,
duplicated canonical helpers, and partial-update semantics.

For every proposed restructure, explain:

1. The concrete maintenance problem or contract violation.
2. What responsibilities, states, or concepts become simpler.
3. What behavior and boundaries must remain intact.
4. The focused verification that would demonstrate preservation.

Structural findings can be substantiated by ownership, state, or invariant evidence without an executable reproduction.
Keep proposed behavior-preservation checks separate from results; do not invent observed output to make a restructuring recommendation appear confirmed.

Crossing 1,000 lines is a prompt to investigate cohesion, not an automatic merge
blocker. Exclude generated outputs from authoring-quality judgments. Prefer
responsibility-based decomposition to arbitrary helper extraction. A plausible
redesign alone does not authorize changing the caller's scope.
