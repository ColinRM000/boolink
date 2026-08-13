# Connect GitHub to Codex with BooLink

This guide installs `@boolink-dev/github` as a local stdio MCP server. It covers the complete
install-to-first-read path without sending a GitHub token to BooLink infrastructure.

## 1. Check the local runtime

Install Node.js 22 or newer, then confirm it is available:

```bash
node --version
```

## 2. Create a narrowly scoped token

Create a [fine-grained personal access token](https://github.com/settings/personal-access-tokens/new)
and limit repository access to only the repositories the agent should use.

Grant only the permissions required by the tools you intend to enable:

- **Issues: read** for issue inspection, or **Issues: write** for creation, updates, and comments.
- **Pull requests: read** for pull-request inspection, or **Pull requests: write** for creation.

Do not use an account-wide classic token when a fine-grained token can meet the requirement.

## 3. Set `GITHUB_TOKEN` locally

PowerShell can collect the secret without placing it in command history and store it as a Windows
user environment variable:

```powershell
$secret = Read-Host "GITHUB_TOKEN" -AsSecureString
$token = [System.Net.NetworkCredential]::new("", $secret).Password
[Environment]::SetEnvironmentVariable("GITHUB_TOKEN", $token, "User")
Remove-Variable secret, token
```

For a single macOS or Linux shell session:

```bash
read -rsp "GITHUB_TOKEN: " GITHUB_TOKEN; echo
export GITHUB_TOKEN
```

Restart Codex after changing a persistent environment variable. For a session-only variable, launch
the client from the same environment or use its documented local secret mechanism.

## 4. Preview and install

First inspect the exact write plan:

```bash
npx @boolink-dev/cli add github --client codex
```

After reviewing the package version, launcher, credential-variable name, and target configuration,
apply that same plan:

```bash
npx @boolink-dev/cli add github --client codex --yes
```

The CLI installs the catalog-pinned package under `~/.boolink` and writes a managed
`[mcp_servers.boolink_github]` block to `~/.codex/config.toml`. It does not write the token value.

## 5. Diagnose and verify read-only behavior

```bash
npx @boolink-dev/cli doctor
```

Restart Codex, then use this first prompt:

> Use `github.get_authenticated_user` to confirm the connected identity. Do not create or modify
> anything.

Only after confirming the expected identity should you try repository reads. Review every issue,
comment, or pull-request write before approval.

## Remove or repair

```bash
npx @boolink-dev/cli repair github
npx @boolink-dev/cli remove github
```

Both commands preview changes by default. Add `--yes` only after reviewing the plan. See the
[complete integration reference](../../integrations/github/README.md) for tools, limitations, error
codes, and direct-server configuration.
