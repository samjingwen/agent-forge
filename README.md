# Agent Forge

Agent Forge keeps reusable agent skills, OpenCode plugins, Claude Code plugins, MCP servers, and their shared code in one Git repository.

Keep reusable instructions in one place.
Retain each runtime's native plugin format.
Produce installable bundles from those sources.

## Install Hardlook

[Hardlook](docs/hardlook/README.md) is a self-contained, evidence-first code review skill for OpenCode, Cursor, Pi, Claude Code, and Codex.
It supports routine review, independent deep review, and structural audits.
OpenCode support targets the latest stable V1 and V2 releases only.

```sh
npx skills add samjingwen/agent-forge --skill hardlook
```

Choose your harness.
Start a new session.
Ask for "Hardlook review this change", "Hardlook deep", or "Hardlook structure".
For OpenCode's slash-menu command, follow the [Hardlook setup instructions](docs/hardlook/README.md#opencode-slash-menu).
Existing Hardlook installations continue to work.
Use this repository for future installs and updates.

Hardlook was migrated from [samjingwen/hardlook](https://github.com/samjingwen/hardlook).
The migration preserved its Git history, tests, and license notices.
The repository and private package use the name `agent-forge`.
Former `samjingwen/agent-toolkit` GitHub URLs redirect to this repository.

## Install Plainspoken

[Plainspoken](docs/plainspoken/README.md) rewrites dense or ambiguous English using ASD-STE100-inspired rules.
It is intended for tool descriptions, error messages, prompts, status reports, and inter-agent instructions.
It preserves meaning, uncertainty, conditions, and requirement strength rather than merely shortening text.

```sh
npx skills add samjingwen/agent-forge --skill plainspoken
```

Ask your agent to "Use Plainspoken to disambiguate this text" or "Apply Simplified Technical English and show the before/after table".
The skill returns rewritten text alone by default.
Its optional Python linter checks structural patterns, not semantic fidelity or certified STE compliance.
Plainspoken adapts [danyuchn/asd-ste100-skill](https://github.com/danyuchn/asd-ste100-skill).
It preserves the upstream MIT license and attribution.

## Repository layout

| Path | Purpose |
| --- | --- |
| `skills/<name>/SKILL.md` | Canonical skill instructions and supporting files |
| `plugins/opencode/<package>/` | Native OpenCode plugin packages |
| `plugins/claude-code/<bundle>/` | Claude wrapper sources for generated bundles |
| `mcp-servers/<package>/` | MCP server implementations that can run independently |
| `packages/<package>/` | Shared libraries used by plugins and servers |
| `config/<runtime>/` | Runtime configuration examples and templates |
| `catalog/claude-bundles.json` | This repository's Claude bundle declarations |
| `catalog/external-tools.json` | Inventory of third-party tools and upstream sources |
| `evals/` | Behavior cases and evaluation fixtures |
| `tests/<name>/` | Component behavior and installation tests |
| `docs/<name>/` | Component usage and maintainer documentation |
| `tooling/` | Repository checks, packaging, and configuration helpers |
| `distribution/claude-code/<bundle>/` | Generated, self-contained Claude plugins |
| `.claude-plugin/marketplace.json` | Generated Claude marketplace catalog |

Use one `.git` at the repository root.
Package directories are ordinary folders, not nested Git repositories.
`pnpm-workspace.yaml` supports JavaScript and TypeScript packages.
Individual modules can retain Gradle or uv projects when appropriate.

### Requirements

Installed Hardlook helpers require **Node.js 22 or later**.
They have **no npm runtime dependencies**.
Private repository development requires **Node.js 22.13 or later** for the supported ESLint toolchain.
Hardlook's CLI also requires Git.

Plainspoken's optional linter and its tests require **Python 3.11 or later**.
Neither requires third-party Python packages.
Using Plainspoken's rewrite instructions in an agent does not require Python.

## Development

Run these commands from the repository root:

```bash
npm ci --ignore-scripts
npm run quality
npm run check
npm test
npm run config:opencode
npm run build:claude
```

Development dependencies use exact version pins and come from `package-lock.json`.
The installed skill does not depend on them.
You can use `pnpm run` for the same scripts.

For Hardlook alone, run `npm run test:hardlook`.
For metadata-only harness availability checks, run `npm run doctor:hardlook`.
Run `npm run test:quality` for executable quality-tool and hook-consumer tests.
Run `npm run test:plainspoken` for Plainspoken's helper and bundle tests.
Use `npm run lint:plainspoken -- --json <file>` to check a selected text file without changing it.

`npm run quality` checks without changing files.
`npm run format` is the separate formatting fix.
See [code quality](docs/quality.md) for language coverage, ownership exclusions, CI, and the trusted-default-branch no-mistakes hook boundary.

`check` performs basic layout, JSON, catalog, and path checks.
It also checks that each discovered skill folder contains `SKILL.md`.
It does not validate the complete skill specification, YAML, runtime APIs, or plugin behavior.

`test` exercises:

- Hardlook's behavior and adapters.
- Plainspoken's structural linter.
- Both skills' installation and relocation boundaries.
- Real passing and failing consumers of the quality tools.

These tests make no live model calls.
They do not prove model-review accuracy or rewrite fidelity.

`config:opencode` prints JSON with absolute paths to the canonical skills directory.
The JSON also contains absolute paths to the OpenCode package directories it discovers one level under `plugins/opencode/`.
This configuration output uses native V2 syntax; use the bundled Hardlook adapter instructions for V1 setup.
Review the output.
Merge the relevant settings into your OpenCode configuration.
The command does not install plugins or change global settings.

`build:claude` creates bundles only when the catalog contains bundle entries.
No Claude bundles are currently configured.
Hardlook and Plainspoken are installed directly as skills.

Read [Hardlook development](docs/hardlook/development.md), [architecture](docs/architecture.md), and [official references](docs/sources.md) before changing the relevant component.
For Plainspoken, read its [usage and development notes](docs/plainspoken/README.md).

## Optional Claude bundle example

This example packages the existing Hardlook skill as a hypothetical `hardlook-review` Claude plugin.
The wrapper and catalog entry below are not currently configured.
Use the direct skill installation above unless you want to add a bundle.

1. Reuse the canonical skill and its supporting files in `skills/hardlook/`, including `SKILL.md`.
2. Create `plugins/claude-code/hardlook-review/.claude-plugin/plugin.json`:

   ```json
   {
     "name": "hardlook-review",
     "version": "0.1.0",
     "description": "Hardlook code review skill for Claude Code.",
     "author": { "name": "Sam Jing Wen" }
   }
   ```

   Add any Claude-specific agents, hooks, or MCP configuration under `plugins/claude-code/hardlook-review/`.
   Do not add a `skills/` directory to the wrapper.
   The builder supplies it.
3. Add the bundle to `catalog/claude-bundles.json`:

```json
{
  "schemaVersion": 1,
  "marketplace": {
    "name": "agent-forge",
    "owner": { "name": "Sam Jing Wen" }
  },
  "bundles": [
    {
      "name": "hardlook-review",
      "source": "plugins/claude-code/hardlook-review",
      "skills": ["hardlook"]
    }
  ]
}
```

4. Run `npm run check`.
   Then run `npm run build:claude`.
   Validate the resulting plugin in Claude Code.
   Try the plugin in Claude Code:

```bash
claude plugin validate ./distribution/claude-code/hardlook-review
claude --plugin-dir ./distribution/claude-code/hardlook-review
```

The builder copies the wrapper and selected skills into `distribution/claude-code/hardlook-review/`.
It generates the root marketplace entry with `source: "./distribution/claude-code/hardlook-review"`.

**Before publishing the repository as a marketplace, commit generated distributions and the generated marketplace.**
Consumers need those files in the repository they fetch.
Edit canonical sources.
Rebuild the generated files.
Do not edit generated files by hand.

## License

MIT.
Hardlook's adapted review techniques retain their [bundled attribution and license notices](skills/hardlook/THIRD_PARTY_NOTICES.md).
Plainspoken preserves its [upstream MIT license](skills/plainspoken/LICENSE) and [attribution notices](skills/plainspoken/THIRD_PARTY_NOTICES.md).
