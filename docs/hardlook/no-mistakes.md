# no-mistakes integration

The bundled integration targets **no-mistakes v1.84.0**, source revision
`4822244e763fd4c3d7f48be6433f92df10bb5b33`.

No no-mistakes source change is required for the initial method integration.
Its existing `review.path_instructions` adds trusted review guidance; global
`review_agents` selects reviewer/fixer roles, not a parallel panel.

1. Install a pinned complete Hardlook skill for the selected pipeline reviewer.
2. Merge the bundled `adapters/no-mistakes/review-config.yaml` block into the
   consumer's **trusted default-branch** `.no-mistakes.yaml` through its normal
   delivery process. A branch cannot configure its own review gate.
3. The assigned reviewer loads Hardlook's protocol and pipeline adapter. It
   performs its normal review with better evidence/filtering instructions.
4. It returns the **pipeline-supplied JSON schema**, risk assessment, and exact
   `reviewed_paths`. Evidence, consequence, and remedy remain in the description.
5. The existing findings gate and fix/re-review loop handle the result.

Optional reproduction details stay in the finding description: proposed versus reported status, command, expected result, observed output, and verification limits.
No new fields are added to the pinned pipeline schema.
Reported output is not independently confirmed by Hardlook, and a reproduction command does not authorize the reviewer to execute checks or take over another duty.
Concrete static findings remain valid without reproduction data.

The core CLI can emit compatible standalone fields with `--format no-mistakes`.
That output is not an external-result import API and does not drive AXI or
replace a core pipeline step. A partial report cannot emit a pipeline verdict.

Source and recipe compatibility are checked separately from a live gate round.
See [compatibility](compatibility.md) for the evidence actually collected. The
active pipeline's required schema always wins over the bundled version target.

References:

- [Trusted review instructions](https://github.com/kunchenguid/no-mistakes/blob/4822244e763fd4c3d7f48be6433f92df10bb5b33/docs/src/content/docs/reference/repo-config.md#reviewpath_instructions)
- [Reviewer/fixer profiles](https://github.com/kunchenguid/no-mistakes/blob/4822244e763fd4c3d7f48be6433f92df10bb5b33/docs/src/content/docs/reference/global-config.md#review_agents)
- [Current review implementation](https://github.com/kunchenguid/no-mistakes/blob/4822244e763fd4c3d7f48be6433f92df10bb5b33/internal/pipeline/steps/review.go)
