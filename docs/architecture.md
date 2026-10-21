# Architecture and packaging decisions

## Shared source, native integrations

The monorepo is a development boundary.
Each installed plugin or running MCP server has its own runtime boundary.
Shared source belongs in `skills/` and `packages/`; integration code belongs in the corresponding plugin or server directory.

Canonical skills should follow the [Agent Skills specification](https://agentskills.io/specification).
Keep runtime-specific features in adapters when their behavior differs.
An OpenCode plugin and a Claude Code plugin are separate formats even when they expose the same underlying capability.

Hardlook is a self-contained skill, not a native plugin.
Its runtime helpers and harness adapters stay in `skills/hardlook/` so a skill-only install remains complete.
Its maintainer documentation, tests, and evaluations live in `docs/hardlook/`, `tests/hardlook/`, and `evals/hardlook/`.

The OpenCode helper targets [OpenCode v2](https://opencode.ai/v2/docs/plugins/): `plugins` is an array, and relative plugin paths resolve against the configuration file.
[Skill source paths](https://opencode.ai/v2/docs/skills/) resolve relative to the active working directory instead.
The helper prints absolute paths to avoid that ambiguity.
Its discovered directories must still contain valid plugins.
OpenCode v2's native SDK uses `@opencode/plugin`; consult the [migration guide](https://opencode.ai/v2/docs/build/plugins/migrate-v1) before importing v1 code.

## Claude distribution boundary

`catalog/claude-bundles.json` is a custom build manifest, not a Claude configuration format.
Each entry selects a wrapper source plus canonical skills.
The build produces complete plugin directories and Claude's actual marketplace catalog.

Claude [component paths](https://code.claude.com/docs/en/plugins-reference) resolve within the plugin root.
Cached installations normally include only that plugin directory.
The builder therefore copies selected skills and rejects all symlinks in bundled sources and skills.
This is a deliberate rule of this utility; Claude itself supports [some marketplace symlink arrangements](https://code.claude.com/docs/en/plugins/host-marketplace#share-files-within-a-marketplace-with-symlinks).
Existing complete plugins can also be used directly without registering them in this generated workflow.

The builder marks the distribution it owns and refuses to replace an existing unmarked `distribution/claude-code/`.
It also protects an unrelated root marketplace catalog.
Generated files must be reviewed and committed with source changes before marketplace publication.

Agent Forge retains `tooling/agent-toolkit.mjs` as its existing CLI entrypoint.
The generated-output marker `.agent-toolkit-generated.json` and its `generator: "agent-toolkit"` value are stable legacy ownership contracts, not current product branding.
Do not rename them when updating repository, package, marketplace, or install identities: existing owned distributions must remain recognizable, while unowned output must still be refused.
Generate distribution and marketplace changes through the builder rather than editing their serialized output by hand.

If the final bundle is removed from the catalog while publication files remain, the build fails and requires explicit cleanup; it will not silently retain a stale release as a successful build.
During replacement it keeps the previous distribution until the new catalog is installed and restores it on a caught installation error.
Run one build at a time.
An interrupted process may leave staging or backup directories for manual recovery.

For executable components, bundle shared code or declare independently installable dependencies.
Do not assume root `node_modules`, `workspace:` links, or sibling packages exist after installation.
Claude's [dependency installer](https://code.claude.com/docs/en/plugins/loading) supports specific npm/Bun lockfiles and excludes workspace dependencies; the repository's pnpm workspace does not change that runtime rule.

## Verification and releases

Repository checks establish structural consistency only.
Validate generated plugins with the target runtime, test a clean installation, and add behavior cases to `evals/` as real assets arrive.
MCP implementations need their own transport and tool checks.

Choose explicit per-plugin versions for releases and bump them when contents change.
Claude uses the [computed plugin version](https://code.claude.com/docs/en/plugins/loading) to decide whether cached files need replacing.
A source commit alone does not update a plugin with an unchanged explicit version.

`catalog/external-tools.json` records upstream tools; it does not install, vendor, or update them.
Runtime configuration templates should reference credentials supplied separately.
Hardlook is the first migrated skill; its original Git history is retained in the migration merge.
This repository does not install skills globally or change user configuration.
