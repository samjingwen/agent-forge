# Claude Code

Install the complete directory into `.claude/skills/hardlook/` or the user's
skill directory. Invoke `/hardlook`, or ask for Hardlook review in a new session.

The bundled runner uses print mode, JSON output, the bundled report schema,
read/search tools only, no session persistence, and an empty strict MCP
configuration. It loads user settings for model access and does not load project
settings; the packet supplies project review instructions as context. No
permission-bypass flags are used. Select a model accepted by this Claude CLI.

Deep review may use two different available harnesses through the bundled
runner. Claude model aliases alone do not demonstrate cross-family diversity.
Native Agent delegation is also possible when explicitly authorized, but the
external runner requires no extra installed agents or plugins.

Reference: installed CLI help and https://code.claude.com/docs/en/cli-reference
