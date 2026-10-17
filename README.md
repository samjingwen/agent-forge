# Agent Toolkit

One Git repository for reusable agent skills, OpenCode plugins, Claude Code plugins, MCP servers, and the code they share. This is an **empty starter**: add your existing assets, then build and configure the integrations you need.

Keep the reusable instructions in one place, retain each runtime's native plugin format, and produce installable bundles from those sources.

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
| `tooling/` | Repository checks, packaging, and configuration helpers |
| `distribution/claude-code/<bundle>/` | Generated, self-contained Claude plugins |
| `.claude-plugin/marketplace.json` | Generated Claude marketplace catalog |

Use one `.git` at the repository root. Package directories are ordinary folders, not nested Git repositories. `pnpm-workspace.yaml` supports JavaScript and TypeScript packages; individual modules can retain Gradle or uv projects when appropriate. The helper itself needs **Node.js 22 or later and no dependencies**.

## Start here

Run these commands from the extracted repository directory:

```bash
node tooling/agent-toolkit.mjs check
node tooling/agent-toolkit.mjs config:opencode
node tooling/agent-toolkit.mjs build:claude
```

Equivalent package scripts are `npm run check`, `npm run config:opencode`, and `npm run build:claude`. You can use `pnpm run` for the same scripts.

`check` performs basic layout, JSON, catalog, and path checks, including checking that discovered skill folders contain `SKILL.md`. It does not validate the complete skill specification, YAML, runtime APIs, or plugin behavior. Passing on this empty starter does not establish compatibility for plugins you add later.

`config:opencode` prints JSON containing absolute paths to the canonical skills directory and the OpenCode package directories it discovers one level under `plugins/opencode/`. Review the output and merge the relevant settings into your OpenCode configuration. The command does not install plugins or change global settings.

`build:claude` creates bundles only when the catalog contains bundle entries. With the initial empty catalog, it creates nothing.

## Add a skill and a Claude bundle

1. Put a skill and its supporting files in `skills/spring-boot-performance-review/`, including `SKILL.md`.
2. Create the wrapper at `plugins/claude-code/backend-review/`, with `.claude-plugin/plugin.json` whose `name` is `backend-review`. Add any Claude-specific agents, hooks, or MCP configuration there. Do not add a `skills/` directory to the wrapper: the builder supplies it.
3. Replace the placeholder owner and add the bundle to `catalog/claude-bundles.json`:

```json
{
  "schemaVersion": 1,
  "marketplace": {
    "name": "agent-toolkit",
    "owner": { "name": "Your Name" }
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

4. Run `check`, then `build:claude`. Validate and try the resulting plugin in Claude Code:

```bash
claude plugin validate ./distribution/claude-code/backend-review
claude --plugin-dir ./distribution/claude-code/backend-review
```

The builder copies the wrapper and selected skills into `distribution/claude-code/backend-review/`. It generates the root marketplace entry with `source: "./distribution/claude-code/backend-review"`. `CHANGE_ME` is rejected as the marketplace owner when bundles are present.

**Commit generated distributions and the generated marketplace before publishing the repository as a marketplace.** Consumers need those files in the repository they fetch. Edit canonical sources and rebuild; do not edit generated files by hand.

## Put the starter under version control

When you are ready, initialize Git from this directory:

```bash
git init -b main
git add .
git commit -m "Initialize agent toolkit"
```

Choose and add your remote separately. See [architecture](docs/architecture.md) for packaging constraints and [official references](docs/sources.md) for the runtime contracts.
