# Pi

Load the complete skill with `pi --skill <installed-directory>` or put it in
Pi's configured skill discovery directory. The source repository also exposes
the directory through its package.json `pi.skills` field.

Pi has no built-in subagent requirement. The bundled runner provides independent
CLI sessions: JSON mode, no persisted session, explicit read/search tools,
disabled discovered extensions/skills/context files, and no MCP connection.
The packet supplies project instructions and the selected bundled rubric.

The adapter targets the documented Pi interface with `--no-mcp`. Older versions
may not support it; failed invocation is reported incomplete rather than silently
retrying with broader tool access. Select an actual provider/model from Pi.

Reference: https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/cli.md
