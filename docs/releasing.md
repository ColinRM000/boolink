# BooLink release runbook

This runbook separates reproducible package validation from the external actions that make a
release public.

## Prerequisites

1. Create the public BooLink source repository and push a reviewed commit.
2. Confirm ownership of the `@boolink-dev` npm organization and all intended scoped names.
3. Configure npm trusted publishing from the release repository so packages carry provenance.
4. Keep npm credentials in the publisher or CI secret store; never place them in this repository.
5. Ensure the release commit passes `pnpm check`.

## Build and validate

From a clean checkout with Node.js 22+ and pnpm 11:

```bash
pnpm install --frozen-lockfile
pnpm release:pack
```

`release:pack` runs the full repository checks, builds six npm tarballs and two Claude Desktop MCP
Bundles in `release/`, validates their manifests and required files, installs the packed graph in a
temporary project, exercises the installed CLI, and negotiates every packed GitHub and Cloudflare
server over MCP stdio. It writes `release/SHA256SUMS.txt` plus
`release/release-manifest.json`. Package and bundle versions are independent and recorded beside
each artifact in the manifest.

## Publication order

Publish packages only from the validated tarballs, in dependency order:

1. `@boolink-dev/core`
2. `@boolink-dev/sdk`
3. `@boolink-dev/registry`
4. `@boolink-dev/github` and `@boolink-dev/cloudflare` in either order
5. `@boolink-dev/cli`

Use the `tarball` fields recorded in `release/release-manifest.json`; scoped package tarball names do
not preserve the scope text. Never select an artifact by a loose filename pattern. Packages already
published at the recorded version do not need to be republished.

After publication, verify `npx @boolink-dev/cli` in a clean environment, attach the validated
`.mcpb` files and checksums to the matching source release, and update the website only after the
install and download paths succeed publicly.

## Trusted publishing configuration

The repository-owned `.github/workflows/release.yml` workflow publishes through npm's GitHub Actions
OIDC integration. It does not require or accept a long-lived npm write token.

On npmjs.com, configure the same trusted publisher for each of the six packages:

- Organization or user: `ColinRM000`
- Repository: `boolink`
- Workflow filename: `release.yml`
- Environment: leave blank
- Allowed action: `npm publish`

Configure `@boolink-dev/core`, `@boolink-dev/sdk`, `@boolink-dev/registry`,
`@boolink-dev/github`, `@boolink-dev/cloudflare`, and `@boolink-dev/cli`. Each package accepts only
one trusted publisher, and every field is case-sensitive.

The workflow requires npm 11.5.1+ and Node.js 22.14+ for trusted publishing; its GitHub-hosted runner
uses Node.js 24 and grants only `contents: write` plus the required `id-token: write`. npm creates
provenance attestations automatically for these public packages and this public repository.

## Automated release

1. Merge reviewed version and changelog changes to `main`.
2. Create and push a semantic tag such as `v0.5.0` from that exact commit.
3. Tag protection should restrict that operation to maintainers.
4. The release workflow rebuilds and validates all tarballs and MCP Bundles, skips package versions
   that already exist on npm, publishes only missing versions in dependency order, verifies the
   public install path in an isolated temporary environment, then creates the GitHub release and
   uploads every artifact plus checksums.

The workflow is safe to rerun: npm versions already present in the registry are never republished.
The `workflow_dispatch` path accepts an existing semantic tag when a failed run needs to be retried.

Before activating OIDC, validate the release decision locally without publishing:

```bash
pnpm release:pack
pnpm release:publish:dry-run
```

When narrow maintainer test tokens are available, follow the optional read-only
[live provider verification procedure](verification/live-provider-checks.md) and include only its
sanitized pass/fail summary in the release notes.

## Failure handling

Do not overwrite an existing version. Fix the issue, repeat all checks, and publish a new version.
Revoke a compromised publisher immediately and use npm's supported deprecation or unpublishing
process according to the package's exposure and registry policy.
