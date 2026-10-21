# Before / After Examples

Adapted from the upstream examples attributed in `../THIRD_PARTY_NOTICES.md`.
These are illustrations, not quotations from the official standard or real product specifications.
The agent-output rewrites preserve the source's claims and do not add new actions.

## Rule Illustrations

| Principle | Before | After | Limit |
| --- | --- | --- | --- |
| One term per action | "Check the connections, then verify the connections again." | "Check the connections, then check the connections again." | Apply this only when the two verbs really describe the same action. |
| One part of speech | "Oil the valve." | "Apply oil to the valve." | The approved part of speech is a dictionary fact, not something this skill verifies. |
| Precise verb meaning | "Follow the safety instructions." | "Obey the safety instructions." | Keep the intended obligation unchanged. |
| Simple tense | "We have received the technical reports." | "We received the technical reports." | Use this only when current relevance is not part of the required meaning. |
| Verb, not noun | "Perform an inspection of the filter." | "Inspect the filter." | Preserve the same action and scope. |
| No phrasal verb | "Take off the access panel." | "Remove the access panel." | The bundled linter does not recognize every phrasal verb. |

## Tool Description

**Before:**

> This tool will attempt to synchronize state across the various backends that have been configured, and if a conflict is detected it may resolve it automatically depending on the strategy that has been set, or otherwise it will surface the conflict for manual review.

**After:**

> The tool tries to synchronize state across the configured backends.
> If it detects a conflict, it may resolve the conflict automatically if the configured strategy allows it.
> If the conflict is not resolved automatically, the tool reports it for manual review.

The rewrite keeps the attempted operation, the conditional automatic resolution, and the fallback.
It does not promise that an allowed automatic resolution succeeds.
It does not invent a separate step in which the tool reads its strategy.

## Error Message

**Before:**

> An error may have occurred while processing your request due to a possible mismatch in the expected data format, which could be caused by an outdated client version.

**After:**

> An error may have occurred while processing your request.
> A mismatch with the expected data format could be the cause.
> An outdated client version could cause this mismatch.

The failure and both causal claims remain uncertain.
The rewrite does not invent a "most common cause" claim or add an instruction to check the client version.
The compound form "may have occurred" stays because uncertainty is content.

## Inter-agent Instruction

**Before:**

> Once the upstream job has completed and assuming no errors were raised, the downstream agent should proceed to consume the output artifact, though it is worth noting that partial artifacts are sometimes produced under timeout conditions.

**After:**

> If the upstream job has completed and no errors were raised, the downstream agent should read the output artifact.
> A timeout can sometimes produce a partial artifact.

"Should" remains a recommendation rather than becoming an imperative.
The prerequisite and partial-artifact warning remain explicit.
The completion status and raised-error condition stay intact; the rewrite does not claim that no hidden error occurred.
The compound tense and passive form are retained where replacing them could lose that distinction.
The source does not require an additional completeness check, so the rewrite does not add one.
If such a check is useful, propose it separately when the user asks for recommendations.

## README Prose: STE-flavored Mode

**Before:**

> Our caching layer is designed to slot seamlessly into your existing stack with minimal friction and no vendor lock-in; it leverages semantic similarity to dramatically reduce the cache misses that traditionally plague LLM workloads.

**After:**

> The cache is designed to work with your current stack without vendor lock-in.
> It uses semantic similarity to reduce cache misses in LLM workloads.

The rewrite removes marketing language and the semicolon.
It preserves the design intent, the vendor-lock-in claim, and the stated mechanism.
It does not claim that data stays local or explain how an ordinary cache works.
Neither assertion appears in the source.

## Literal Identifiers and Conditions

**Before:**

> If `retry_count` is below 3 and `allow_retry` is true, the agent may attempt to run `sync --dry-run` again.

**After:**

> If `retry_count` is below 3 and `allow_retry` is true, the agent may try `sync --dry-run` again.

The condition, literal values, flag, and permission to attempt remain unchanged.
Do not rename identifiers or turn permission into a requirement to save words.
