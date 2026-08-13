# `@boolink-dev/cloudflare`

Local-first Cloudflare MCP integration for BooLink. It runs beside the user's AI client and talks
directly to Cloudflare's API. BooLink infrastructure never receives, proxies, stores, or logs the
configured API token.

Version 0.1.0 is the complete initial Cloudflare integration: five bounded read tools and five
deliberately scoped DNS/cache operations. “Complete” means this supported surface is implemented,
packaged, tested, and documented; it does not imply coverage of every Cloudflare product or API.

## Tools

| Tool                           | Purpose                        | Capability                 | Side effects                     |
| ------------------------------ | ------------------------------ | -------------------------- | -------------------------------- |
| `cloudflare.verify_token`      | Verify the local API token     | `read`                     | None                             |
| `cloudflare.list_zones`        | Discover visible zones         | `read`                     | None                             |
| `cloudflare.get_zone`          | Inspect one zone               | `read`                     | None                             |
| `cloudflare.list_dns_records`  | List and filter DNS records    | `read`                     | None                             |
| `cloudflare.get_dns_record`    | Inspect one DNS record         | `read`                     | None                             |
| `cloudflare.create_dns_record` | Create a DNS record            | `create`, `administrative` | Can change hostname resolution   |
| `cloudflare.update_dns_record` | Update record fields           | `modify`, `administrative` | Can redirect or disrupt traffic  |
| `cloudflare.delete_dns_record` | Delete one DNS record          | `delete`, `administrative` | Can make services unreachable    |
| `cloudflare.purge_cache_urls`  | Purge exact cached URLs        | `modify`, `administrative` | Increases origin requests        |
| `cloudflare.purge_everything`  | Purge every cached zone object | `modify`, `administrative` | Can sharply increase origin load |

MCP clients receive matching `readOnlyHint`, `destructiveHint`, and `idempotentHint` annotations.
Every mutation is classified as administrative. DNS updates/deletes and both cache-purge tools are
marked destructive. A full cache purge additionally requires `confirmPurgeEverything: true`.

## Authentication and permissions

Create a scoped Cloudflare API token and set `CLOUDFLARE_API_TOKEN` in the environment that starts
your MCP client. Do not use a Global API Key. Restrict the token to only the accounts and zones the
agent should access, then grant only the permissions needed for the intended tools:

- **Zone: Read** for zone discovery and inspection.
- **DNS: Read** for DNS inspection.
- **DNS: Write** for DNS creation, updates, and deletion.
- **Cache Purge** for targeted or full cache purges.

Cloudflare documents token creation and resource scoping in its
[API token guide](https://developers.cloudflare.com/fundamentals/api/get-started/create-token/).

## Install and configure Codex

Requires Node.js 22 or newer. Set the token locally, then open the BooLink integration shop:

```powershell
$env:CLOUDFLARE_API_TOKEN = "your-scoped-api-token"
npx @boolink-dev/cli
```

```bash
export CLOUDFLARE_API_TOKEN="your-scoped-api-token"
npx @boolink-dev/cli
```

Choose **Cloudflare**, **Install**, and **Codex**, review the exact changes, then approve them. The
equivalent non-interactive command is:

```bash
npx @boolink-dev/cli add cloudflare --client codex --yes
```

Restart Codex after installation, then verify the managed package, launcher, client configuration,
and credential presence:

```bash
npx @boolink-dev/cli doctor
```

The CLI references only the `CLOUDFLARE_API_TOKEN` variable name in client configuration. It never
writes the token value.

## Other MCP clients

Generate a neutral JSON launch document:

```bash
npx @boolink-dev/cli add cloudflare --client custom-json --output ./boolink-cloudflare.json --yes
```

Or run the stdio server package directly:

```bash
npx @boolink-dev/cloudflare
```

`stdout` is reserved for MCP frames. Safe startup failures go to `stderr` without token values.

## Example calls

Find the zone ID for `boolink.dev`:

```json
{
  "name": "cloudflare.list_zones",
  "arguments": { "name": "boolink.dev", "page": 1, "perPage": 20 }
}
```

Review CNAME records before changing DNS:

```json
{
  "name": "cloudflare.list_dns_records",
  "arguments": {
    "zoneId": "023e105f4ecef8ad9ca31a8372d0c353",
    "type": "CNAME",
    "page": 1,
    "perPage": 50
  }
}
```

Purge one exact asset after a deployment:

```json
{
  "name": "cloudflare.purge_cache_urls",
  "arguments": {
    "zoneId": "023e105f4ecef8ad9ca31a8372d0c353",
    "urls": ["https://boolink.dev/assets/app.js"]
  }
}
```

## Security behavior

- Tool inputs are strict, bounded, and validated before URL/body construction.
- Zone and record IDs must be exact 32-character hexadecimal identifiers.
- Provider responses are runtime-validated and treated as untrusted.
- Provider error bodies, headers, cookies, and token values are never returned through MCP.
- Pagination is explicit and bounded; DNS and zone writes accept only known fields.
- Targeted URL purging is the recommended cache operation and is limited to 30 URLs per call.
- No telemetry, hosted credential service, remote BooLink MCP, or proxy is used.

## Limitations

- The initial package covers zones, DNS records, and cache purging only.
- Workers, Pages, R2, D1, KV, Queues, WAF, Zero Trust, billing, memberships, tokens, and account
  administration are intentionally outside this release.
- DNS record content is bounded but validated by Cloudflare according to its record type.
- Only exact URL and full-zone cache purges are exposed; tag, host, prefix, and custom cache-key
  purges remain outside the initial contract.
- Contracts are mock-verified against Cloudflare's current official REST API documentation. Live
  compatibility depends on the selected token permissions and zone plan.
- `cloudflare.verify_token` and `cloudflare.list_zones` were additionally verified against the live
  Cloudflare API with `@boolink-dev/cloudflare@0.1.0` on 2026-08-13. The other eight tools remain
  contract-tested rather than live-account tested.

## Troubleshooting

- `cloudflare_auth_missing`: set `CLOUDFLARE_API_TOKEN` in the MCP client process environment.
- `cloudflare_unauthorized`: replace or re-authorize the token.
- `cloudflare_forbidden`: grant the narrow permission required by the tool and verify zone scope.
- `cloudflare_not_found`: verify the exact zone/record ID and token visibility.
- `cloudflare_rate_limited`: wait for the safe retry interval when one is provided.
- `cloudflare_invalid_request`: verify record conflicts, values, TTL, plan features, and zone state.
- `cloudflare_invalid_response`: Cloudflare returned data outside the tested contract; update the
  integration before relying on the result.
