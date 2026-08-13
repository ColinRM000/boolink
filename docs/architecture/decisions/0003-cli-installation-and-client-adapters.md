# ADR 0003: Previewable CLI installation and client adapters

- Status: Accepted
- Date: 2026-08-12

## Context

BooLink needs a CLI that can discover integrations, record local installations, and configure MCP
clients without silently changing user configuration or capturing provider credentials. Client
configuration formats differ, and direct edits can damage existing settings.

## Decision

Implement `boolink` as a registry-backed package with `search`, `info`, `add`, `list`, and
`doctor` commands. Treat every `add` as a write plan: preview the state and client configuration
targets by default, then require an explicit `--yes` flag before writing.

Store installation metadata in `~/.boolink/installations.json`. Store launch commands, package
versions, client configuration paths, and required environment variable names. Never store
credential values.

Use client adapters. The first adapter appends a dedicated stdio table to Codex `config.toml` and
uses `env_vars` to forward credential names from the user's environment. A second adapter emits a
neutral JSON document at a new user-selected path. Refuse duplicate Codex tables and refuse to
overwrite custom JSON output.

## Alternatives considered

- Write directly to every supported client's default configuration: rejected because broad format
  support would be premature and increases corruption risk.
- Put credential values into generated configuration: rejected because it widens secret exposure
  and conflicts with the local credential boundary.
- Make installation interactive-only: rejected because deterministic preview and approval flags are
  easier to test, automate, and audit.
- Download packages during the first CLI slice: deferred until packages, integrity metadata, and
  release channels exist. ADR 0007 adopts durable downloads after the first publication.

## Consequences

The CLI can exercise the source-based install and configuration workflow in an isolated home
without touching a developer's real settings. ADR 0007 extends this to durable package installation,
removal, repair, and upgrades. Additional client adapters remain explicit later work. The public
`add` contract must continue to preview writes and must not accept secrets as arguments.
