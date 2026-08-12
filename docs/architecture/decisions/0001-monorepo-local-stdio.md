# ADR 0001: Monorepo with local stdio as the default runtime

- Status: Accepted
- Date: 2026-08-12

## Context

BooLink needs independently installable integrations with shared contracts, consistent tooling,
and a strict local credential boundary. MCP supports both local stdio and remote HTTP transports.

## Decision

Use a pnpm TypeScript monorepo. Keep protocol-neutral contracts in `@boolink-dev/core`, MCP adaptation
in `@boolink-dev/sdk`, and catalog data in `@boolink-dev/registry`. Official integrations are independent
workspace packages. Their default executable transport is stdio, served through the official MCP
SDK v2 `serveStdio` entry so modern and supported legacy protocol eras can negotiate correctly.

## Alternatives considered

- Separate repositories immediately: rejected because coordinated contract work and early refactors
  would be slower before package boundaries have been validated.
- Remote HTTP first: rejected because it puts deployment and authentication infrastructure ahead of
  the local-first MVP.
- One shared integration runtime: rejected because it would widen credential access and couple
  releases.
- Direct MCP implementation: rejected because it duplicates security-sensitive protocol work
  maintained by the official SDK.

## Consequences

Integrations can publish independently while sharing one development toolchain. Local clients can
spawn a single-purpose process whose environment contains only that integration's credentials.
Remote transport and OAuth need later ADRs. A fresh server factory is required for each negotiated
stdio connection.
