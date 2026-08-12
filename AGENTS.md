# BooLink Engineering Rules

These rules apply to every contributor and coding agent working in this repository.

## Product boundaries

- BooLink is an independent, open-source integration ecosystem for AI agents.
- The default runtime is a local MCP server launched in the user's environment.
- BooLink infrastructure must not receive, proxy, persist, or log user service credentials.
- Do not add hosted OAuth, remote MCP hosting, a credential vault, an agent runtime, or a
  third-party executable marketplace without an explicit architecture decision and project-owner
  approval.
- Keep core contracts host-neutral. OnwardOS and individual AI clients are adapters, not core
  assumptions.

## Engineering priorities

Apply this order when tradeoffs conflict: security, correctness, interoperability, developer
experience, maintainability, performance, then feature count.

## Protocol and packages

- Use TypeScript, Node.js, pnpm workspaces, the official MCP SDK, and runtime validation.
- Keep `packages/core` independent of the MCP SDK. Protocol adaptation belongs in `packages/sdk`.
- Integrations are independently versioned packages and must not import one another.
- Prefer stdio for local integrations. New remote work uses Streamable HTTP; never add legacy
  HTTP+SSE to new code.
- Do not adopt deprecated MCP features (roots, sampling, or protocol logging) in new designs.
- Treat the MCP SDK as a boundary dependency and keep provider API logic transport-independent.
- Do not create abstractions for hypothetical integrations. Change the contract only with evidence
  from real integrations and document consequential changes in an ADR.

## Tool contracts

- Tool names use `<provider>.<verb>_<object>` and remain stable after publication.
- Each tool description states purpose, appropriate use, important limitations, side effects, and
  required inputs.
- Every tool declares machine-readable capability classes and whether it is destructive.
- Validate all model-provided inputs at runtime. Treat provider responses as untrusted.
- Mutating tools require narrower scopes and stronger tests than read-only tools.

## Credentials and errors

- Read credentials only from the owning integration's documented local configuration source.
- Never place secrets in tool inputs, tool outputs, resources, prompts, logs, telemetry, thrown
  errors, snapshots, fixtures, or test output.
- Normalize provider errors before returning them through MCP. Preserve actionable status and
  retry information while removing request headers, tokens, cookies, and provider payload fields
  that may contain secrets.
- Any diagnostic output from a stdio server goes to `stderr`; `stdout` is reserved for MCP frames.

## Quality gates

- Keep the repository runnable after each coherent change.
- Add tests for schemas, auth configuration, request construction, error normalization, pagination,
  MCP discovery/execution, capability classification, and credential leakage as relevant.
- Run `pnpm check` before claiming completion.
- Never claim external API compatibility without either a mocked contract test grounded in current
  provider documentation or a recorded live verification.
- Do not commit generated build output, credentials, or local environment files.

## Documentation

- Every official integration documents purpose, tools, permissions, authentication, installation,
  client configuration, security considerations, examples, limitations, and troubleshooting.
- Create an ADR for consequential choices affecting security, interoperability, public schemas,
  transports, packaging, or versioning.
- Mark planned, experimental, and unverified behavior plainly.
