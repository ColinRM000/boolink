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

`release:pack` runs the full repository checks, builds five npm tarballs in `release/`, validates
their manifests and required files, installs the packed graph in a temporary project, exercises the
installed CLI, negotiates the packed GitHub server over MCP stdio, and writes
`release/SHA256SUMS.txt` plus `release/release-manifest.json`. Package versions are independent and
are recorded beside each tarball in the manifest.

## Publication order

Publish packages only from the validated tarballs, in dependency order:

1. `@boolink-dev/core`
2. `@boolink-dev/sdk`
3. `@boolink-dev/registry`
4. `@boolink-dev/github`
5. `@boolink-dev/cli`

Use the `tarball` fields recorded in `release/release-manifest.json`; scoped package tarball names do
not preserve the scope text. Never select an artifact by a loose filename pattern. Packages already
published at the recorded version do not need to be republished.

After publication, verify `npx @boolink-dev/cli` in a clean environment, attach checksums to the matching
source release, and update the website only after the install path succeeds publicly.

## Failure handling

Do not overwrite an existing version. Fix the issue, repeat all checks, and publish a new version.
Revoke a compromised publisher immediately and use npm's supported deprecation or unpublishing
process according to the package's exposure and registry policy.
