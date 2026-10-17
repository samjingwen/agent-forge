# Codex

Install the whole skill into a Codex-discovered `.agents/skills/hardlook/`
directory (or the configured skill directory for the installed version).
Invoke the skill explicitly; skill naming in the UI varies by Codex surface.

The bundled runner uses `codex exec --json --sandbox read-only` and the bundled
JSON output schema. It feeds the prompt over stdin, starts a fresh invocation,
and never passes approval/sandbox bypass flags. Codex's existing authentication
and model configuration remain the host's responsibility.

Choose an actual model accepted by the installed CLI. Validate the adapter
against its exact CLI version before advertising native acceptance. The core
skill also works directly in Codex without launching another CLI process.

Reference: https://developers.openai.com/codex/developer-commands
