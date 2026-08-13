# ADR 0009: Cloudflare DNS and cache integration boundary

- Status: Accepted
- Date: 2026-08-13

## Context

BooLink needs a second official integration that exercises infrastructure APIs without weakening
the local-first credential boundary. Cloudflare exposes a large platform spanning zones, DNS,
cache, compute, storage, security, account administration, and billing. Exposing the whole API
would produce an unreviewable permission surface and encourage overly broad tokens.

## Decision

The first Cloudflare package is an independent local stdio integration named
`@boolink-dev/cloudflare` at version 0.1.0. It reads one locally configured
`CLOUDFLARE_API_TOKEN` and talks directly to `https://api.cloudflare.com/client/v4`.

The supported surface is limited to:

- token verification;
- zone listing and lookup;
- DNS record listing and lookup;
- DNS record creation, partial update, and deletion;
- cache purge by exact URL and explicit full-zone purge.

All DNS mutations are administrative. Updates and deletes are destructive. Cache purges are
destructive because they alter production cache state and can increase origin load. Full-zone
purging requires a literal `confirmPurgeEverything: true` input. Provider responses are validated,
provider error payloads are discarded, and raw path/query fragments are never accepted.

The integration does not implement hosted OAuth, remote MCP, credential storage, or a BooLink API
proxy. Workers, Pages, storage products, WAF, Zero Trust, account membership, token administration,
billing, and other Cloudflare products require later evidence and separate contract decisions.

## Consequences

- Users can complete common zone/DNS/cache workflows with a narrowly scoped local token.
- The permission model stays comprehensible: Zone Read, DNS Read/Write, and Cache Purge.
- The package provides a real second integration without prematurely abstracting every provider.
- Broader Cloudflare coverage will arrive through deliberate versioned additions rather than a
  generic arbitrary-request tool.
