# Lead judgment

Adapted from pstack's contextual filtering framework.

- **Act on:** substantiated defects or concrete maintainability regressions
  affecting the agreed goals and contracts.
- **Consider:** meaningful improvements whose benefit may not justify the
  current scope or cost. State that tradeoff.
- **Noted:** valid context that needs no change now.
- **Dismissed:** wrong, unreachable, missing context, stylistic preference, or
  speculative abstraction. Explain the reason so the user can challenge it.

Adversarial reviewers can inflate nits when there are no defects. An empty pass
is legitimate. Do not cap genuine defects to fit a fashionable short report.

"I prefer another design" becomes actionable only with a concrete cost or
violated agreed contract. Check callers and equivalent controls yourself.
Required legacy paths are not obsolete just because a new path exists. Evaluate
the whole intended transition, including persistent-data and replay obligations.

Determine severity independently of agreement. Substantial changes to user intent
or remedies extending the authorized work require an intent decision; they are
not automatic mechanical fixes. Report evidence and recommend; the caller or
outer pipeline owns what is actually changed.
