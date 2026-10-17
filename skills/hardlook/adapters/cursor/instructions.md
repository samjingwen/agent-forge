# Cursor

Install the complete skill into `.cursor/skills/hardlook/` or the user skill
directory supported by the installed Cursor version. Ask for Hardlook review.

The bundled external adapter defaults to the `agent` CLI. Override its executable
with `--binary cursor=<path>` for installations using `cursor-agent` instead.
It uses print/JSON output and plan mode, with an explicit workspace and optional
model selector. Plan-mode restrictions are the host's review boundary; do not
use force, yolo, automatic MCP approval, or sandbox-disable flags.

The prompt is a positional argument because the documented CLI interface accepts
prompt arguments. This has the ordinary process-list visibility of argv; use the
in-host skill when the source packet should not travel through process arguments.

Native Cursor Task-based panels may apply the same bundled templates when the
actual model and read-only Task options are available. Use actual model IDs,
not pstack's default slugs copied from another environment.

Reference: https://cursor.com/docs/cli/reference/parameters
