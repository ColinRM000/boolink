# ADR 0006: Scoped CLI package

- Status: Accepted
- Date: 2026-08-12

## Context

The first release successfully published BooLink's four scoped implementation packages. npm then
rejected the proposed unscoped `boolink` CLI name because its similarity protection considered it
too close to the existing `comlink` package. The registry explicitly recommended publishing under
an owned scope instead.

## Decision

Publish the CLI package as `@boolink-dev/cli`. Keep `boolink` and `boo` as executable aliases, so a
global installation still provides the product-branded short commands. The zero-install entry point
is `npx @boolink-dev/cli`.

Do not attempt spelling variants intended to bypass npm's similarity protection. All five public
packages remain controlled by the `boolink-dev` organization.

## Consequences

The first public package graph is `@boolink-dev/core`, `@boolink-dev/sdk`,
`@boolink-dev/registry`, `@boolink-dev/github`, and `@boolink-dev/cli`. The `npx` command is longer
than originally planned, but package ownership is unambiguous and npm's anti-typosquatting policy is
respected. ADRs 0004 and 0005 are superseded only where they specify the unscoped CLI package.
