# Live provider verification

Unit and contract tests remain the reproducible release gate. A maintainer may additionally run the
read-only live verification script before a public milestone to detect provider behavior that has
drifted from current official documentation.

## Safety rules

- Use narrowly scoped maintainer-owned test credentials.
- The script calls read-only tools only.
- GitHub verification calls `github.get_authenticated_user`.
- Cloudflare verification calls `cloudflare.verify_token` and requests the exact `boolink.dev` zone
  with Cloudflare's documented minimum page size.
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
Provider failures report only BooLink's normalized error code and safe message when available; the
normal integration error normalization remains responsible for preventing sensitive response data
from traversing MCP.

## Recorded verification

The ignored local records were inspected and contain no credentials, provider response bodies,
identities, account identifiers, or resource names.

| Provider   | Package                         | Verified (UTC)      | Live read-only checks                              |
| ---------- | ------------------------------- | ------------------- | -------------------------------------------------- |
| GitHub     | `@boolink-dev/github@0.2.0`     | 2026-08-13 21:27:18 | `github.get_authenticated_user`                    |
| Cloudflare | `@boolink-dev/cloudflare@0.1.0` | 2026-08-13 23:14:57 | `cloudflare.verify_token`, `cloudflare.list_zones` |

These records establish live compatibility only for the named read-only checks. All other tool
contracts remain covered by mocked request, response, schema, pagination, MCP, error-normalization,
capability, and credential-leakage tests; they have not been exercised against a maintainer's live
provider account.

## Supported-client journey

The public release was also exercised from a clean, isolated Codex CLI configuration. The journey
installed GitHub through `@boolink-dev/cli@0.4.2`, launched the installed
`@boolink-dev/github@0.2.1` stdio server, and completed
`github.get_authenticated_user` through Codex CLI on 2026-08-14 at 01:17:57 UTC.

The inspected record contains only package versions, client and transport names, the read-only tool
name and capability, isolation flags, and the pass result. It contains no credential value, provider
response, account identity, or provider resource data. The temporary client profile, integration
installation, credential environment, and run directory were removed after the check.

Live verification does not authorize mutating test calls and is not a substitute for mocked request,
schema, pagination, error-normalization, capability, and credential-leakage coverage.
