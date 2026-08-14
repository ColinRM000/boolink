# ADR 0011: Claude Code user-scope client adapter

- Status: Accepted
- Date: 2026-08-13

## Context

BooLink's local stdio integrations are protocol-compatible with Claude Code, but the public CLI
only configures Codex or emits a neutral launch document. Claude Code supports local, project, and
user MCP scopes. Project scope is stored in `.mcp.json` for version control, while private local and
user scopes are stored in `~/.claude.json`.

BooLink's managed launcher contains an absolute machine-local path. Writing it to a project-scoped
file would create a configuration that is unsuitable for teammates and easy to commit accidentally.
Provider credential values must also remain outside BooLink configuration.

## Decision

Add `claude-code` as a first-class CLI client adapter. Default it to Claude Code's private user-scope
file at `~/.claude.json`, matching the cross-project availability of BooLink's Codex adapter.

Merge a stable `boolink_<integration>` stdio entry into the top-level `mcpServers` object. Preserve
unrelated root settings and MCP servers. Set each required environment entry to Claude Code's
`${VARIABLE}` expansion syntax, never to the credential value. Refuse duplicate server names,
invalid JSON, incompatible `mcpServers` values, and replacement or removal when the managed entry no
longer exactly matches BooLink's recorded launch configuration.

Keep preview, explicit approval, atomic writes, rollback, repair, upgrade, removal, and doctor
behavior aligned with the existing adapters. Cover the adapter in unit, CLI lifecycle, packed
cross-platform, and public-release verification.

## Alternatives considered

- Write a project `.mcp.json` by default: rejected because the generated launcher is machine-local
  and the file is designed to be shared through version control.
- Invoke `claude mcp add-json`: rejected for the initial adapter because it adds a runtime dependency
  on the Claude executable and makes BooLink's preview, rollback, and exact ownership checks less
  deterministic.
- Store provider token values in Claude configuration: rejected because it violates BooLink's local
  credential boundary. Environment expansion provides the required forwarding without persistence.
- Package Claude Desktop extensions in the same change: deferred because DXT packaging, client-owned
  secret storage, signing, distribution, and updates require a separate release and security decision.
- Support Claude.ai through remote MCP: rejected under the current local-first architecture because
  Claude.ai cannot launch BooLink's local stdio servers.

## Consequences

Users can install either official integration for Claude Code with the same one-command lifecycle as
Codex. The integration packages and core MCP contracts remain client-neutral. Claude Desktop remains
a separate future client target, and Claude.ai remains outside the current architecture boundary.
