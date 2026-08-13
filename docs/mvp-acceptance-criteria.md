# MVP acceptance criteria

The first meaningful BooLink release is accepted only when all criteria below are demonstrated.

## Foundation

- The monorepo installs reproducibly from a committed lockfile on Node.js 22+.
- Formatting, linting, type checking, unit tests, builds, and CI pass.
- Public manifests and registry documents are runtime-validated.
- A reference server is discoverable and callable through an official MCP client test.
- Security, architecture, contributor, and integration-author documentation exist.

## Integrations

- GitHub is installable as an independent package and includes useful read and write tools.
- At least one additional official integration validates a meaningfully different API shape.
- Every released tool has validated inputs, clear side-effect metadata, normalized errors, mocked API
  coverage, and credential-leakage tests.
- Each integration documents required provider scopes and exactly where credentials are read/stored.

## Registry and CLI

- The registry is machine-readable, deterministic, schema-versioned, and contains only released
  entries.
- `boo search`, `boo info`, `boo add`, `boo remove`, `boo repair`, `boo upgrade`, `boo list`, and
  `boo doctor` work for the supported install and client paths.
- Installation and client configuration require explicit user action; an agent cannot silently
  grant itself software or credentials.

## Website and documentation

- A visitor can understand BooLink, find an integration, inspect tools/permissions/authentication,
  and copy an install command without signing in.
- The site states that BooLink is open source, MCP-compatible, and local-first.
- GitHub's complete install-to-invocation path is documented for at least one supported client.

## Security release gate

- No credential traverses BooLink infrastructure in the default flow.
- Automated tests prove secrets are absent from MCP results, errors, logs, and snapshots for each
  official integration.
- Dependency and secret scanning run in CI.
- Destructive, financial, communication, and administrative actions are identifiable before tool
  execution.
