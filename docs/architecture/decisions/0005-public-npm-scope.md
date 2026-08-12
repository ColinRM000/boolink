# ADR 0005: Public npm scope

- Status: Accepted
- Date: 2026-08-12

## Context

The preferred `@boolink` npm organization name was unavailable when the project owner created the
publishing organization. BooLink still needs an organization-owned namespace for independently
versioned libraries and integrations, while the shortest user entry point should remain stable.

## Decision

Publish internal libraries and integrations under the `@boolink-dev` organization scope. Publish
the user-facing CLI as the unscoped `boolink` package. The commands remain `npx boolink`, `boolink`,
and `boo`; users do not need to type the organization scope to open the integration shop.

Keep the repository, website, product name, executable names, and local configuration paths branded
as BooLink. Treat `-dev` as npm namespace disambiguation, not as a preview or development release
channel.

## Consequences

The first public package graph consists of `@boolink-dev/core`, `@boolink-dev/sdk`,
`@boolink-dev/registry`, `@boolink-dev/github`, and `boolink`. Documentation must distinguish the
npm ownership namespace from package lifecycle status. A future organization rename would require a
new package line and explicit migration plan; it must not be performed as a silent breaking change.
