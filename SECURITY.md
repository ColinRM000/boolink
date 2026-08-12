# Security Policy

## Current status

BooLink is pre-release. No package in this repository should yet be treated as production-ready.

## Reporting a vulnerability

Please do not open a public issue containing exploit details or credentials. Until a private
security contact is configured for the project, contact the repository owner privately and include
the affected package/version, impact, reproduction steps, and any suggested mitigation.

## Credential model

BooLink's default architecture is local-first:

- Integration credentials remain in the user's execution environment.
- BooLink services are not in the installed integration's runtime path.
- Credentials must never be accepted as MCP tool arguments or returned to the model.
- Each integration may read only its own documented environment variables or local credential
  store entries.
- Secrets must be redacted from errors and diagnostic output.

## Integration requirements

Official integrations must validate tool input, minimize provider scopes, classify side effects,
mock external calls in automated tests, and include explicit credential-leakage tests before a
release is approved.
