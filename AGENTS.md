# Working in Agent Forge

This repository contains reusable agent tooling with separately installable components.

- Read README.md and the relevant component's documentation before changing it.
- For Hardlook work, read docs/hardlook/development.md and preserve its self-contained skill boundary.
- Author portable skill content in skills/<name>/SKILL.md and keep its supporting files beside it.
- Put OpenCode integrations in plugins/opencode and Claude integrations in plugins/claude-code.
- Keep custom MCP implementations in mcp-servers and shared executable code in packages.
- Treat catalog/claude-bundles.json as input to the Claude packaging utility.
- Regenerate distribution/claude-code and .claude-plugin/marketplace.json with npm run build:claude. Generated distribution files are committed for marketplace installation.
- Keep native agent settings, hooks, tool names, and permission syntax in the appropriate integration.
- Keep credentials, machine state, session logs, and profiling recordings outside this repository.
- Prefer focused changes. Use separate worktrees for concurrent agents changing overlapping files.
- Run npm run check after structural changes. Validate native packages using their runtime's tools.
- Test a packaged install when changing distribution: a working local source checkout is insufficient evidence.
- The root check is a structural check, not a complete skill specification validator or runtime integration test.
