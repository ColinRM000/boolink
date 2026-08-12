# ADR 0004: npm package topology and validated release artifacts

- Status: Superseded by ADR 0006
- Date: 2026-08-12

## Context

BooLink needs a short user-facing command while preserving independently versioned core, protocol,
registry, and integration packages. Publication must not be the first time the package graph or
installed CLI is tested. Package ownership, a public source repository, and provenance also need to
exist before a trustworthy public release.

## Decision

Publish the user-facing CLI as the unscoped `boolink` package with the `boo` executable. This makes
`npx boolink` the zero-install path into the interactive integration shop. Publish implementation
packages under the `@boolink-dev` scope: `@boolink-dev/core`, `@boolink-dev/sdk`,
`@boolink-dev/registry`, and independently versioned integration packages such as
`@boolink-dev/github`.

Begin the public package line at `0.1.0`. Use exact workspace relationships while developing, then
have the package manager rewrite them to compatible published ranges during packing. Before any
publication, create all package tarballs, reject leaked workspace references or private packages,
verify required files and the executable shebang, install the tarballs into an isolated project,
run the packaged CLI against the packaged catalog and integration, and generate SHA-256 checksums.

Do not publish until the source has a public repository, package ownership is confirmed, and the
release identity can produce provenance. Local artifact creation does not grant permission to claim
names or publish externally.

## Alternatives considered

- Keep the CLI named `@boolink-dev/cli`: rejected because it makes the first-run command longer and less
  memorable without adding a meaningful trust boundary.
- Bundle every integration into one package: rejected because integrations must remain independently
  versioned and users should not download providers they do not use.
- Publish directly from workspace directories: rejected because it would skip validation of the
  actual archive users install.
- Add a custom binary downloader: deferred because npm already provides portable package resolution,
  integrity metadata, and executable shims for the current Node.js runtime.

## Consequences

Users eventually enter BooLink with `npx boolink` and then browse integrations interactively. The
CLI still installs separate integration packages and can evolve without coupling provider release
cadence. Maintainers have reproducible, ignored local artifacts and checksums, but public release
remains a deliberate, separately authorized operation.
