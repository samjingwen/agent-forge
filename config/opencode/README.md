# OpenCode v2 configuration

Run from anywhere:

    node /absolute/path/to/agent-forge/tooling/agent-toolkit.mjs config:opencode

The `agent-toolkit.mjs` filename is a retained CLI compatibility entrypoint, not the current repository name.

The command prints a JSON config fragment with an absolute skills source and the
immediate local plugin directories containing package.json, index.ts, or index.js.
Merge the fragment into the desired project or global OpenCode configuration.
Printing the fragment does not install plugins or edit existing configuration.

The tool targets OpenCode v2. Its keys are skills and plugins. OpenCode v1 has a
different plugin API and configuration. Add MCP connections separately using the
target runtime's current schema; v2 places them under mcp.servers.

Official references:

- https://opencode.ai/v2/docs/skills/
- https://opencode.ai/v2/docs/plugins/
- https://opencode.ai/v2/docs/mcp-servers/
