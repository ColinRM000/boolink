# Initial architecture

## Objective

Establish a small, secure foundation that can be tested against real integrations before the CLI
and website harden around it.

## Package boundaries

```text
Provider API client (integration-owned)
              |
              v
Integration definition + handlers
              |
      @boolink-dev/core contracts
              |
              v
       @boolink-dev/sdk adapter
              |
              v
 Official MCP SDK / local stdio
```

- `@boolink-dev/core` owns manifest, authentication, capability, tool, and normalized-error contracts.
  It knows nothing about MCP transports.
- `@boolink-dev/sdk` adapts a validated BooLink integration definition to an MCP server and owns safe
  error conversion. It does not call provider APIs.
- `@boolink-dev/registry` validates registry documents and provides deterministic discovery helpers. It
  contains metadata, never executable integration code.
- Each package under `integrations/` will own provider authentication loading, the API client,
  mapping, tools, tests, and documentation.
- `packages/cli` and `apps/web` are later consumers of the registry and must not become runtime
  dependencies of integrations.

## Runtime path

```text
AI client -> MCP over stdio -> installed BooLink integration -> provider API
```

Credentials are read by the installed integration process. The registry, website, and CLI do not
sit between the integration and its provider.

## Initial public model

- Integration IDs and tool names are lowercase, stable identifiers.
- Authentication metadata documents local requirements without containing credential values.
- Capability classes are explicit and additive: `read`, `create`, `modify`, `delete`, `financial`,
  `communication`, and `administrative`.
- Destructive behavior is a separate boolean because not every dangerous action maps cleanly to a
  single class.
- Registry entries describe released packages. Planned integrations stay in planning documents,
  not the default machine-readable catalog.

## Assumptions and decisions to validate

- MIT is the initial license; the project owner may choose another OSI license before the
  first public release.
- Node.js 22 is the minimum runtime to reduce compatibility code and align with maintained LTS.
- npm is the first package distribution channel; other runtimes may execute the packages later.
- Environment variables are sufficient for the GitHub reference integration. Local OAuth storage
  remains provider-specific and deferred.
- `github` is the first reference integration. Cloudflare and a third provider will be selected only
  after GitHub exposes concrete abstraction gaps.
- The first CLI will configure a small adapter set rather than editing every MCP client format.
- Verification status is assigned through repository-owned release policy, not self-asserted by
  third-party metadata.

## Out of scope for the foundation

Provider API calls, remote MCP hosting, hosted OAuth, telemetry, the public website, arbitrary
third-party execution, package publishing, and automatic client configuration.
