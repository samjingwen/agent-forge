# Agent Forge

One Git repository for reusable agent skills, OpenCode plugins, Claude Code plugins, MCP servers, and the code they share.

Keep the reusable instructions in one place, retain each runtime's native plugin format, and produce installable bundles from those sources.

## Install Hardlook

[Hardlook](docs/hardlook/README.md) is a self-contained, evidence-first code review skill for OpenCode, Cursor, Pi, Claude Code, and Codex.
It supports routine review, independent deep review, and structural audits.

```sh
npx skills add samjingwen/agent-forge --skill hardlook
```

Choose your harness, start a new session, and ask for "Hardlook review this change", "Hardlook deep", or "Hardlook structure".
For OpenCode's slash-menu command, follow the [Hardlook setup instructions](docs/hardlook/README.md#opencode-slash-menu).
Existing Hardlook installations continue to work; use this repository for future installs and updates.

Hardlook was migrated from [samjingwen/hardlook](https://github.com/samjingwen/hardlook), with its Git history, tests, and license notices preserved.
The repository and private package are named `agent-forge`; former `samjingwen/agent-toolkit` GitHub URLs redirect to the current repository.

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
It adapts [danyuchn/asd-ste100-skill](https://github.com/danyuchn/asd-ste100-skill), with the upstream MIT license and attribution preserved.

## Repository layout

| Path | Purpose |
| --- | --- |
| `skills/<name>/SKILL.md` | Canonical skill instructions and supporting files |
| `plugins/opencode/<package>/` | Native OpenCode plugin packages |
| `plugins/claude-code/<bundle>/` | Claude wrapper sources for generated bundles |
| `mcp-servers/<package>/` | Independently runnable MCP server implementations |
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
`pnpm-workspace.yaml` supports JavaScript and TypeScript packages; individual modules can retain Gradle or uv projects when appropriate.
Installed Hardlook helpers need **Node.js 22 or later and no npm runtime dependencies**.
Private repository development requires **Node.js 22.13 or later** for the supported ESLint toolchain.
Hardlook's CLI also requires Git.
Plainspoken's optional linter and its tests require **Python 3.11 or later**, with no third-party Python packages.
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

Development dependencies are exact-pinned and installed from `package-lock.json`.
They are not dependencies of the installed skill.
You can use `pnpm run` for the same scripts.
Run `npm run test:hardlook` for Hardlook alone, or `npm run doctor:hardlook` for metadata-only harness availability checks.
Run `npm run test:quality` for executable quality-tool and hook-consumer tests.
Run `npm run test:plainspoken` for Plainspoken's helper and bundle tests.
Use `npm run lint:plainspoken -- --json <file>` to check a selected text file without changing it.
`npm run quality` checks without changing files; `npm run format` is the separate formatting fix.
See [code quality](docs/quality.md) for language coverage, ownership exclusions, CI, and the trusted-default-branch no-mistakes hook boundary.

`check` performs basic layout, JSON, catalog, and path checks, including checking that discovered skill folders contain `SKILL.md`.
It does not validate the complete skill specification, YAML, runtime APIs, or plugin behavior.
`test` exercises Hardlook's behavior and adapters, Plainspoken's structural linter, both skills' installation/relocation boundaries, and the quality tools' real passing/failing consumers.
It makes no live model calls and does not prove model-review accuracy or rewrite fidelity.

`config:opencode` prints JSON containing absolute paths to the canonical skills directory and the OpenCode package directories it discovers one level under `plugins/opencode/`.
Review the output and merge the relevant settings into your OpenCode configuration.
The command does not install plugins or change global settings.

`build:claude` creates bundles only when the catalog contains bundle entries.
No Claude bundles are currently configured; Hardlook and Plainspoken are installed directly as skills.

Read [Hardlook development](docs/hardlook/development.md), [architecture](docs/architecture.md), and [official references](docs/sources.md) before changing the relevant component.
For Plainspoken, read its [usage and development notes](docs/plainspoken/README.md).

## Add a skill and a Claude bundle

1. Put a skill and its supporting files in `skills/spring-boot-performance-review/`, including `SKILL.md`.
2. Create the wrapper at `plugins/claude-code/backend-review/`, with `.claude-plugin/plugin.json` whose `name` is `backend-review`.
   Add any Claude-specific agents, hooks, or MCP configuration there.
   Do not add a `skills/` directory to the wrapper: the builder supplies it.
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
      "name": "backend-review",
      "source": "plugins/claude-code/backend-review",
      "skills": ["spring-boot-performance-review"]
    }
  ]
}
```

4. Run `check`, then `build:claude`.
   Validate and try the resulting plugin in Claude Code:

```bash
claude plugin validate ./distribution/claude-code/backend-review
claude --plugin-dir ./distribution/claude-code/backend-review
```

The builder copies the wrapper and selected skills into `distribution/claude-code/backend-review/`.
It generates the root marketplace entry with `source: "./distribution/claude-code/backend-review"`.

**Commit generated distributions and the generated marketplace before publishing the repository as a marketplace.**
Consumers need those files in the repository they fetch.
Edit canonical sources and rebuild; do not edit generated files by hand.

## License

MIT.
Hardlook's adapted review techniques retain their [bundled attribution and license notices](skills/hardlook/THIRD_PARTY_NOTICES.md).
Plainspoken preserves its [upstream MIT license](skills/plainspoken/LICENSE) and [attribution notices](skills/plainspoken/THIRD_PARTY_NOTICES.md).
