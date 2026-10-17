# Agent Toolkit

One Git repository for reusable agent skills, OpenCode plugins, Claude Code plugins, MCP servers, and the code they share.

Keep the reusable instructions in one place, retain each runtime's native plugin format, and produce installable bundles from those sources.

## Install Hardlook

[Hardlook](docs/hardlook/README.md) is a self-contained, evidence-first code review skill for OpenCode, Cursor, Pi, Claude Code, and Codex.
It supports routine review, independent deep review, and structural audits.

```sh
npx skills add samjingwen/agent-toolkit --skill hardlook
```

Choose your harness, start a new session, and ask for "Hardlook review this change", "Hardlook deep", or "Hardlook structure".
For OpenCode's slash-menu command, follow the [Hardlook setup instructions](docs/hardlook/README.md#opencode-slash-menu).
Existing Hardlook installations continue to work; use this repository for future installs and updates.

Hardlook was migrated from [samjingwen/hardlook](https://github.com/samjingwen/hardlook), with its Git history, tests, and license notices preserved.

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
The repository helper and Hardlook need **Node.js 22 or later and no npm dependencies**.
Hardlook's CLI also requires Git.

## Development

Run these commands from the repository root:

```bash
npm run check
npm test
npm run config:opencode
npm run build:claude
```

No dependency installation is required.
You can use `pnpm run` for the same scripts.
Run `npm run test:hardlook` for Hardlook alone, or `npm run doctor:hardlook` for metadata-only harness availability checks.

`check` performs basic layout, JSON, catalog, and path checks, including checking that discovered skill folders contain `SKILL.md`.
It does not validate the complete skill specification, YAML, runtime APIs, or plugin behavior.
`test` exercises Hardlook's behavior, adapter contracts, installation, and relocation without live model calls.

`config:opencode` prints JSON containing absolute paths to the canonical skills directory and the OpenCode package directories it discovers one level under `plugins/opencode/`.
Review the output and merge the relevant settings into your OpenCode configuration.
The command does not install plugins or change global settings.

`build:claude` creates bundles only when the catalog contains bundle entries.
No Claude bundles are currently configured; Hardlook is installed directly as a skill.

Read [Hardlook development](docs/hardlook/development.md), [architecture](docs/architecture.md), and [official references](docs/sources.md) before changing the relevant component.

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
    "name": "agent-toolkit",
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
