# ADR 0002: GitHub REST reference integration

- Status: Accepted
- Date: 2026-08-12

## Context

GitHub is BooLink's first real integration and must validate local authentication, request
construction, pagination, provider error handling, capability metadata, and MCP execution without
forcing provider details into `@boolink/core` or `@boolink/sdk`.

GitHub exposes REST and GraphQL APIs. Its REST API is versioned and the current official version is
`2026-03-10`. The first useful tool set maps naturally to stable REST resources and needs only
bounded page-based access.

## Decision

- Implement an integration-owned REST client under `integrations/github`.
- Pin `X-GitHub-Api-Version` to `2026-03-10` and send GitHub's recommended JSON media type.
- Read `GITHUB_TOKEN` only from the local integration process environment.
- Use Node's built-in `fetch` with dependency injection for tests rather than adopting Octokit.
- Start with four read-only tools: authenticated user, issue search, issue lookup, and pull-request
  listing.
- Runtime-validate the minimal provider response fields BooLink returns.
- Normalize errors from status and rate-limit headers without returning provider response bodies.
- Expose page controls rather than automatically walking every page, keeping agent calls bounded.

## Consequences

The package stays small, transport-independent, and testable without credentials. It also owns some
request and response mapping code that Octokit could otherwise provide. We will revisit a provider
SDK only if real integrations demonstrate that maintenance or compatibility costs outweigh the
dependency and abstraction cost.

Write operations remain deferred until the read-only path is verified through a supported client.
This ADR does not establish a universal provider-client abstraction.

## Sources

- [GitHub REST API versions](https://docs.github.com/en/rest/about-the-rest-api/api-versions)
- [Getting started with the REST API](https://docs.github.com/en/rest/using-the-rest-api/getting-started-with-the-rest-api)
- [REST pagination](https://docs.github.com/en/rest/using-the-rest-api/using-pagination-in-the-rest-api)
- [REST rate limits](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api)
- [Issue endpoints](https://docs.github.com/en/rest/issues/issues)
- [Pull-request endpoints](https://docs.github.com/en/rest/pulls/pulls)
