# Implementation plan

Each phase ends in a runnable repository and has an explicit verification gate.
Current completion and release evidence are tracked in [project status](project-status.md).

## Phase 1 — Foundation

1. Establish workspace, formatting, linting, TypeScript, tests, CI, security policy, and ADRs.
2. Implement the protocol-independent integration and registry contracts.
3. Implement a thin official-SDK server adapter with secret-safe error normalization.
4. Prove discovery and execution with unit and stdio client/server smoke tests.
5. Gate: `pnpm check` passes from a clean install.

## Phase 2 — GitHub reference integration

1. Document the minimal GitHub token scopes and API behaviors from primary documentation.
2. Implement a small API client with injectable fetch, pagination, rate-limit parsing, and sanitized
   errors.
3. Start with `get_authenticated_user`, `search_issues`, `get_issue`, and `list_pull_requests`.
4. Add one non-destructive write (`create_issue`) behind explicit capability metadata.
5. Add contract, mocked request, MCP discovery/call, and secret-leakage tests.
6. Gate: connect a supported client locally and invoke a read tool; record the manual verification.

## Phase 3 — Registry

1. Publish the validated GitHub entry from integration-owned metadata.
2. Add deterministic search, filters, version/schema compatibility, and generated catalog checks.
3. Gate: registry generation fails on drift, duplicate IDs/tools, invalid URLs, or unreleased entries.

## Phase 4 — CLI

1. Implement `search`, `info`, `add`, `list`, and `doctor` against the registry.
2. Introduce client configuration adapters, beginning with one client and a custom JSON output path.
3. Make every write previewable and user-approved; never capture credentials in CLI arguments.
4. Gate: an isolated temporary home can install, diagnose, and remove GitHub without touching the
   developer's real client configuration.

## Phase 5 — Website

1. Build the public discovery experience from registry data.
2. Add integration detail, tool capability, authentication, install, source, and version views.
3. Use the supplied BooLink brand assets while meeting contrast, responsive, and reduced-motion
   requirements.
4. Gate: accessibility, production build, broken-link, and representative mobile/desktop visual
   checks pass.

## Phase 6 — Additional integrations

1. Build Cloudflare after documenting token scope and account/zone boundaries.
2. Select the third provider for architectural contrast after reviewing GitHub and Cloudflare
   duplication; do not choose on popularity alone.
3. Refactor only abstractions proven by at least two real integrations.
4. Gate: each package meets the same release and security bar as GitHub.

## Phase 7 — Ecosystem preparation

Define contributor templates, validation tooling, publishing automation, verification policy, and a
community submission process only after the official packages are stable.
