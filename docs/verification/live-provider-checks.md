# Live provider verification

Unit and contract tests remain the reproducible release gate. A maintainer may additionally run the
read-only live verification script before a public milestone to detect provider behavior that has
drifted from current official documentation.

## Safety rules

- Use narrowly scoped maintainer-owned test credentials.
- The script calls read-only tools only.
- GitHub verification calls `github.get_authenticated_user`.
- Cloudflare verification calls `cloudflare.verify_token` and requests at most one visible zone.
- Provider response bodies, identities, account IDs, zone names, and credential values are never
  written to the verification record.
- Sanitized records are written beneath ignored `work/live-verification/`; inspect them before
  copying a summary into release notes.

## Run

Build the integrations, set the relevant credential in the current process environment, and select
one or both providers:

```bash
pnpm build
node scripts/verify-live-integrations.mjs --github
node scripts/verify-live-integrations.mjs --cloudflare
```

Omit the flags to verify both. Missing credentials stop the script without printing their values.
Provider failures are returned only as a generic failed check; the normal integration error
normalization remains responsible for preventing sensitive response data from traversing MCP.

Live verification does not authorize mutating test calls and is not a substitute for mocked request,
schema, pagination, error-normalization, capability, and credential-leakage coverage.
