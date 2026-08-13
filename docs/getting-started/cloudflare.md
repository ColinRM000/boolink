# Connect Cloudflare to Codex with BooLink

This guide installs `@boolink-dev/cloudflare` as a local stdio MCP server. Start with read-only
permissions; DNS changes and cache purges are administrative operations and should be added only
when they are actually needed.

## 1. Check the local runtime

Install Node.js 22 or newer, then confirm it is available:

```bash
node --version
```

## 2. Create a narrowly scoped token

Create a [Cloudflare API token](https://dash.cloudflare.com/profile/api-tokens). Do not use a Global
API Key. Limit resources to only the accounts and zones the agent should access.

Grant only the permissions required by the tools you intend to enable:

- **Zone: Read** for zone discovery and inspection.
- **DNS: Read** for DNS inspection.
- **DNS: Write** only for record creation, updates, and deletion.
- **Cache Purge** only for exact-URL or full-zone cache operations.

## 3. Set `CLOUDFLARE_API_TOKEN` locally

PowerShell can collect the secret without placing it in command history and store it as a Windows
user environment variable:

```powershell
$secret = Read-Host "CLOUDFLARE_API_TOKEN" -AsSecureString
$token = [System.Net.NetworkCredential]::new("", $secret).Password
[Environment]::SetEnvironmentVariable("CLOUDFLARE_API_TOKEN", $token, "User")
Remove-Variable secret, token
```

For a single macOS or Linux shell session:

```bash
read -rsp "CLOUDFLARE_API_TOKEN: " CLOUDFLARE_API_TOKEN; echo
export CLOUDFLARE_API_TOKEN
```

Restart Codex after changing a persistent environment variable. For a session-only variable, launch
the client from the same environment or use its documented local secret mechanism.

## 4. Preview and install

First inspect the exact write plan:

```bash
npx @boolink-dev/cli add cloudflare --client codex
```

After reviewing the package version, launcher, credential-variable name, and target configuration,
apply that same plan:

```bash
npx @boolink-dev/cli add cloudflare --client codex --yes
```

The CLI installs the catalog-pinned package under `~/.boolink` and writes a managed
`[mcp_servers.boolink_cloudflare]` block to `~/.codex/config.toml`. It does not write the token value.

## 5. Diagnose and verify read-only behavior

```bash
npx @boolink-dev/cli doctor
```

Restart Codex, then use this first prompt:

> Use `cloudflare.verify_token`, then list the zones visible to the token. Do not change DNS or purge
> cache.

Confirm that only the intended account and zones are visible before granting write or purge
permissions. Full cache purging additionally requires an explicit confirmation argument.

## Remove or repair

```bash
npx @boolink-dev/cli repair cloudflare
npx @boolink-dev/cli remove cloudflare
```

Both commands preview changes by default. Add `--yes` only after reviewing the plan. See the
[complete integration reference](../../integrations/cloudflare/README.md) for tools, limitations,
error codes, and direct-server configuration.
