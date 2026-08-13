# Getting started with BooLink

BooLink installs local MCP servers beside an AI client. Provider credentials remain in the local
environment; the CLI records credential variable names, never credential values.

## Choose an integration

- [GitHub](github.md) — issues, conversations, and pull requests.
- [Cloudflare](cloudflare.md) — zones, DNS records, and cache purging.

Both guides use Codex as the first supported client. For other clients, generate a neutral launch
document with `--client custom-json --output <path>`.

## Safety model

1. Scope each provider token to the smallest useful set of resources and permissions.
2. Keep the token in the operating-system or client environment that launches the MCP server.
3. Run an installation preview without `--yes` before allowing BooLink to modify configuration.
4. Begin with the guide's read-only verification call.
5. Review every mutating tool call in the client before approval.

BooLink does not provide hosted OAuth, a credential vault, or a remote proxy. If a token appears in
CLI output, logs, generated configuration, or an MCP result, treat it as a security defect and follow
[SECURITY.md](../../SECURITY.md).
