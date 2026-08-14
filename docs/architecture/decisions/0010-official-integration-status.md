# ADR 0010: Official integration status describes stewardship, not API completeness

## Status

Accepted — 2026-08-13

## Context

The registry supports `official`, `verified`, `community`, `experimental`, and `deprecated`
verification values. GitHub and Cloudflare remained marked `experimental` after their scoped MVPs
were published, tested across supported operating systems, documented, and checked against their
live provider APIs. Meanwhile, the public website described the same packages as available. This
made the registry and website disagree and made “experimental” carry both ownership and maturity
meanings.

## Decision

Use `official` for an integration that:

- is maintained and released by the BooLink project;
- has a published, versioned package in the BooLink npm organization;
- satisfies the repository's schema, MCP, provider-contract, error-normalization, capability, and
  credential-leakage tests;
- documents tools, provider permissions, authentication, installation, security, limitations, and
  troubleshooting; and
- has completed the applicable packed-install, cross-platform, and read-only live verification
  gates.

`official` does not mean that every provider API is supported, that every mutating tool was invoked
against a maintainer account, or that a pre-1.0 package has a stable 1.0 API. Package versions and
the documented tool surface communicate maturity and scope separately.

Reserve `experimental` for BooLink work that has not met those release gates. Reserve `verified`
and `community` for a future third-party process; they do not authorize a community marketplace
today. `deprecated` identifies a package users should migrate away from.

The public website must derive registry-owned fields—including status, version, tools,
capabilities, scopes, authentication requirements, and package/source URLs—from the registry. It
may add presentation copy and artwork but must not maintain a second technical catalog.

## Consequences

GitHub and Cloudflare become official integrations while remaining deliberately scoped, pre-1.0
packages. Their patch releases carry the updated manifest status. The website can present one
consistent status and will automatically follow future catalog releases.
