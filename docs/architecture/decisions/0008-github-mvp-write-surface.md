# ADR 0008: GitHub MVP write surface

- Status: Accepted
- Date: 2026-08-13

## Context

ADR 0002 deliberately began the GitHub reference integration with four read-only tools. That path
has since been validated through the official MCP client, packaged as an independently runnable
stdio server, installed through the durable BooLink CLI, and exercised by the release smoke test.

A useful GitHub integration also needs a small write surface. Broad repository administration,
merging, release management, Actions, secret management, and arbitrary API access would increase
permission and side-effect risk without being necessary for the MVP.

## Decision

- Define GitHub MVP completion as 10 stable tools: six reads plus issue creation/update, issue or
  pull-request comments, and pull-request creation.
- Treat comments and create operations as external communication and non-idempotent.
- Treat issue updates as destructive because closing an issue and replacing label or assignee sets
  can remove or materially change existing state.
- Require strict runtime validation, bounded text and collection sizes, and at least one field on
  issue updates.
- Keep credentials local in `GITHUB_TOKEN` and require fine-grained repository permissions.
- Continue using the versioned REST client and error-normalization boundary established in ADR 0002.
- Exclude branch pushes, merges, reviews, releases, repository administration, Actions, secrets,
  deletion, and arbitrary endpoint passthrough from this MVP.

## Consequences

The integration is useful for routine issue and pull-request collaboration while preserving a
small, inspectable permission surface. Agents and clients can distinguish reads, public
communications, repeated creates, and state-changing updates before execution.

This is a product boundary, not a claim that every GitHub workflow is supported. Future tool groups
must be justified by real demand, document narrower permissions and side effects, add contract and
credential-leakage tests, and use a new ADR when they materially expand the security boundary.

## Sources

- [GitHub issue endpoints](https://docs.github.com/en/rest/issues/issues)
- [GitHub issue comment endpoints](https://docs.github.com/en/rest/issues/comments)
- [GitHub pull-request endpoints](https://docs.github.com/en/rest/pulls/pulls)
- [GitHub fine-grained token permissions](https://docs.github.com/en/rest/authentication/permissions-required-for-fine-grained-personal-access-tokens)
