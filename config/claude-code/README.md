# Claude Code configuration

Shared skills are assembled into plugin bundles described by
catalog/claude-bundles.json. Claude-specific agents, hooks, and MCP configuration
belong in the source plugin directory under plugins/claude-code/<bundle>.

Build with npm run build:claude, then validate each built directory with
claude plugin validate ./distribution/claude-code/<bundle>.

Load a built plugin for local development with:

    claude --plugin-dir ./distribution/claude-code/<bundle>

For a Git-hosted marketplace, commit both distribution/claude-code/ and
.claude-plugin/marketplace.json before adding the repository as a marketplace.
Local development and a clean marketplace installation exercise different
loading paths. Check both before declaring a release ready.

This starter does not change settings, register a marketplace, or install tools.

Official references:

- https://code.claude.com/docs/en/plugins-reference
- https://code.claude.com/docs/en/plugins/host-marketplace
