# Integration authoring guide

This guide describes the minimum shape of an official BooLink integration. No integration package
is ready for third-party publication yet; use this while building the first reference packages.

## Package boundary

Create one package under `integrations/<id>`. It owns its manifest, local configuration loader,
provider client, tools, entry point, tests, and documentation. It may depend on `@boolink/core` and
`@boolink/sdk`, but never on another integration.

Keep the provider client transport-independent and accept an injectable `fetch` implementation so
request construction, pagination, and failure behavior can be verified without live credentials.

## Credentials

- Declare credential locations as metadata; never put credential values in a manifest.
- Prefer documented environment variables for token-based MVP integrations.
- Load credentials at process startup or tool execution, outside MCP arguments.
- Request the narrowest provider scopes required by the enabled tools.
- Do not log request headers or provider response bodies before sanitization.
- Test with a distinctive fake secret and assert that it appears nowhere in tool results or errors.

## Tools

Name tools `<provider>.<verb>_<object>`. A tool is a deliberate agent capability, not a mechanical
wrapper around an HTTP endpoint. Its description must tell the model what it does, when to use it,
important limitations, required inputs, and side effects.

Each tool declares capability classes, destructive behavior, idempotency, and provider scopes.
`@boolink/sdk` maps common behavior to MCP annotations and preserves BooLink-specific metadata under
`io.boolink/tool`.

Use `defineTool` with a strict Zod input schema. Return concise text for model consumption and
`structuredContent` when callers benefit from machine-readable data. Throw `BooLinkError` only with
an intentionally safe message; unexpected errors are converted to a generic result.

## Required tests

- Manifest and tool-schema validation
- Missing/invalid authentication configuration
- Exact HTTP method, URL, headers (with redacted values), and body construction
- Pagination and rate-limit behavior where applicable
- Provider error normalization
- Read/write/destructive capability classification
- MCP tool discovery and successful invocation
- Credential absence from results, errors, diagnostics, fixtures, and snapshots

## Required documentation

Document purpose, available tools, provider scopes, authentication setup, installation, supported
client configuration, security behavior, examples, limitations, and troubleshooting. State exactly
where credentials are read and whether anything is stored locally.
