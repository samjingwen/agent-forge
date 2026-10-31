# OpenCode V1 and V2

Target the latest stable release of each line only: V1 1.19.5 and V2 2.2.5 were verified on 31 October 2026.
Older releases, prereleases, and other major versions are not compatibility targets.
Install the complete skill into `.opencode/skills/hardlook/` or a configured user skill directory.
V1 and V2 use the same command and configuration locations; do not replace global installations or migrate the user's configuration merely to review code.

Install the bundled standard command to make `/hardlook` visible. For a global
skill installed under `~/.agents/skills/hardlook/`:

```sh
node "$HOME/.agents/skills/hardlook/scripts/hardlook.mjs" install-opencode-command \
  --dest "$HOME/.config/opencode/commands/hardlook.md"
```

For a project-local skill, run its installed helper with
`--dest .opencode/commands/hardlook.md`. The command loads the installed skill
and forwards the request, including `deep` or `structure`. It uses the current
agent and model. Identical command installations are idempotent; different
existing files and symlinks are refused without modification.

V2 watches configuration, skills, and commands; use `/reload` to force a refresh without restarting its service.
For V1, start a fresh session or restart its client after installation or updates.
Invoke `/hardlook`, `/hardlook deep`, or `/hardlook structure`.
Plain-text Hardlook requests also work without installing the menu command.
The standard command avoids reliance on skill-backed slash autocomplete, which older V1 TUI acceptance documented separately.

The helper probes the selected binary with `--version` and chooses a generation-specific invocation-local `OPENCODE_CONFIG_CONTENT` overlay:

| Generation | Config | Launch |
| --- | --- | --- |
| V1 | `config.json`: `agent`, `prompt`, permission map | `opencode run --format json --agent hardlook-peer` |
| V2 | `config-v2.json`: `agents`, `system`, ordered permissions | `opencode run --standalone --format json --agent hardlook-peer` |

V2 requires a private server so the invocation's overlay reaches the reviewer instead of being lost against an existing shared service.
Both overlays deny mutations, shell, delegation, skill loading, network, Code Mode, and MCP actions, while allowing local read/search operations with best-effort literal private-path read masks.
In both generations, read-permission masks do not comprehensively filter native grep results or canonical/symlink read targets, and the literal masks do not cover every path excluded from the packet.
These host limitations remain: the overlays are not a comprehensive private-content authorization boundary.
Packet private-path exclusions remain enforced, and reviewers must not access private environment files, keys, tokens, or authentication caches through any tool or alias.
Native acceptance exercises an allowed literal read and denial of a literal `credentials-fixture.json` read; it does not prove search-result or canonical-target filtering.
V2 may advertise its skill tool even when skill permission is denied; native acceptance verifies the attempted load is rejected.
These are host tool permissions, not an OS sandbox for plugins or extensions.
The helper does not edit global configuration, register persistent agents, restart a service, or replace plugins.
Existing host provider setup supplies credentials without Hardlook reading credential caches.

Keep using `--peer opencode:<provider/model>` for either line.
Use `--binary opencode=/absolute/path/to/opencode` to select a separately retained V1 or V2 executable.
Do not assume both generations are installed side by side; both normally own the `opencode` command.
V2 `provider/model#variant` selectors are passed unchanged.
The selected generation and CLI version are recorded separately from the requested model; served model identity is not inferred.
Unknown versions and prereleases fail closed without a model request or automatic generation/model fallback.
Version probing does not fetch release metadata or promise compatibility with every older patch in a major line.

Use a real `provider/model` selector when choosing a model. Deep panels launch
fresh CLI sessions and load bundled prompts directly, so no separately
installed reviewer agent is required. The packet identifies the reviewed
revision; a change during the run invalidates the result.
Within one review, OpenCode peer sessions run serially to avoid contention while initializing shared native state; they remain independent sessions on the same packet.
Other harnesses remain concurrent, and the lead starts only after all requested peers succeed.

V1 references: https://opencode.ai/docs/cli/, https://opencode.ai/docs/agents/, https://opencode.ai/docs/permissions/.
V2 references: https://opencode.ai/v2/docs/cli/commands, https://opencode.ai/v2/docs/agents, https://opencode.ai/v2/docs/permissions, https://opencode.ai/v2/docs/migrate-v1.
