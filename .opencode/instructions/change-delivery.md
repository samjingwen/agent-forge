# Agent Forge change delivery

This policy belongs to Agent Forge and applies to this repository and its explicitly assigned implementation worktrees.
Read it together with `AGENTS.md`, the relevant component documentation, and `docs/quality.md`.
Do not depend on an instruction file in a parent workspace.

## Scope and authority

Own the applicable delivery sequence: dedicated Worktrunk worktree -> requirements and implementation -> executable verification and review -> GitHub PR -> protected merge -> safe local primary-branch synchronization.
Continue through an established release procedure only when the task authorizes a release.
Commit intended changes, push the feature branch, open the PR, and merge once required checks and reviews pass.
Explicit Plan, review-only, PR-only, human-review, runtime, publication, and production limits take precedence.
Do not invent a deployment or package-publication target.

The user retired the no-mistakes gate and its configuration.
Do not initialize, install, invoke, or restore that gate for this repository.
Its retirement does not waive quality checks, independent review, GitHub protections, or unresolved acceptance requirements.
Reusable integration assets shipped by a component are not an active repository gate.

## Isolate and implement

- Inspect status, worktrees, the actual default branch, and active ownership before editing.
- Read `wt switch --help` and inspect setup hooks before creating a dedicated implementation worktree with Worktrunk.
- Fetch the intended base or use the base explicitly selected for the task.
- Use the path returned by Worktrunk and verify the actual directory, branch, and base before the first edit.
- Continue related work in its existing implementation worktree without borrowing another task's changes.
- Preserve uncommitted work, private local material, other sessions, retained evidence, and persistent runtime data.
- Follow component ownership and preserve upstream licenses, attribution, pinned byte contracts, and generated-file ownership.
- Regenerate generated output with its owning tool; never hand-edit it or `CHANGELOG.md`.
- Never read private environment files or authentication caches, and never commit credentials or machine-local records.

## Verify and review

- Prepare dependencies with `npm ci --ignore-scripts`.
- Run `npm run quality`, `npm run check`, and `npm test` for the maintained tooling and behavior affected by the change.
- Use `npm run format` separately for safe formatting fixes and review its diff.
- Keep Prettier responsible for formatting and ESLint responsible for conventions, bug detection, and focused design checks.
- Keep compiler checks when a maintained surface has them; do not mistake formatting for behavioral verification.
- Do not reformat upstream-pinned Python or generated distribution output to satisfy maintained-source checks.
- Prove quality enforcement through real consumer commands: conforming fixtures must pass and representative violations must fail.
- Reproduce a reported bug through the user-facing path before fixing it.
- Preserve failing evidence, fix defects rather than weakening checks, and rerun checks invalidated by each fix.
- Review the complete base-to-head diff with the installed Hardlook skill and record coverage, findings, and limitations.
- Use packaged-install verification when changing distribution; structural checks alone do not prove installation or runtime behavior.
- Keep existing Linux/macOS CI and required checks; missing, pending, failed, or incomplete checks are not passing evidence.

## Deliver and synchronize

- Inspect status, all intended commits, and the full diff; stage only this task's files.
- Prefer `gh-axi` for GitHub operations, with `gh` as a fallback.
- Include decisions, verification, limitations, and any release notes in the PR.
- Satisfy required checks on the latest head, required reviews, and conversation resolution without bypassing protections.
- Merge through GitHub, not a local feature merge, and verify the actual merged state and exact merge SHA.
- Discover the worktree that owns the actual default branch and recheck dirty/untracked/ignored collisions plus active ownership.
- Pull that branch with fast-forward-only semantics when safe; never stash, reset, clean, force refs, or rebase local divergence to make synchronization succeed.
- Verify local default HEAD equals the freshly fetched remote tip and contains the merge; retain later remote commits.
- Report any synchronization blocker with the preserved local and remote state.
- Report the PR, merge SHA, checks, primary path/branch/SHA, and any separately authorized release outcome honestly.
