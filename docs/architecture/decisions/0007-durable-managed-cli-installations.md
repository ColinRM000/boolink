# ADR 0007: Durable managed CLI installations

- Status: Accepted
- Date: 2026-08-12

## Context

The first public CLI resolved the GitHub server from its own dependency graph. This works while an
`npx` cache entry exists, but the generated MCP client configuration then points into npm's
temporary execution cache. Cache cleanup can break an otherwise recorded installation. BooLink
also needs removal and repair without deleting user-owned configuration.

## Decision

Install only packages named by the validated bundled registry, at the exact catalog version, under
`~/.boolink/integrations/<id>/<version>`. Run npm with lifecycle scripts disabled, no audit/funding
network calls, no development dependencies, and without provider credential environment variables.
After installation, verify the package name, version, and safe published `./server` export.

Point clients at `~/.boolink/integrations/<id>/server.mjs`, a generated stable launcher importing
the verified versioned server. Store the managed installation directory in state schema version 2.
Read schema version 1 as a legacy installation so `repair` can migrate existing users.

Add preview-and-approval contracts for `remove`, `repair`, and `upgrade`. Configuration removal and
replacement must match the exact BooLink-generated content. Refuse mutation when the managed block
has been edited. Write state and configurations atomically and retain rollback data until the
operation commits.

## Alternatives considered

- Keep relying on the CLI's `npx` cache: rejected because cache location and lifetime are not an
  installation contract.
- Install globally with `npm --global`: rejected because it needs broader permissions and makes
  version ownership less explicit.
- Execute package lifecycle scripts: rejected because official stdio integrations do not require
  them and disabling them reduces installation-time code execution.
- Accept arbitrary npm package names: rejected because BooLink is not a third-party executable
  marketplace. The validated official registry remains the trust boundary.
- Delete client configuration by table name: rejected because it could erase user-edited content.

## Consequences

An installation survives npm cache cleanup and can be repaired, upgraded, diagnosed, or removed
from an isolated BooLink home. Exact versions consume one directory each until an upgrade commits.
Registry updates require a newer CLI release while the registry remains bundled. Packages can still
execute with the provider credentials explicitly forwarded by the MCP client at runtime; those
credentials are not available to the installer subprocess.
