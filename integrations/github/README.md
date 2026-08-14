# `@boolink-dev/github`

Local-first GitHub MCP integration for BooLink. It runs in the user's environment and communicates
directly with GitHub's REST API. BooLink infrastructure does not receive, proxy, persist, or log the
configured credential.

Version 0.2.2 is BooLink's official GitHub MVP: six bounded read tools and four deliberately scoped
issue and pull-request write tools. “Complete” means the supported surface below is implemented,
packaged, tested, and documented; it does not imply coverage of every GitHub API.

## Tools

| Tool                            | Purpose                                      | Capability                | Side effects                    |
| ------------------------------- | -------------------------------------------- | ------------------------- | ------------------------------- |
| `github.get_authenticated_user` | Confirm the token's GitHub identity          | `read`                    | None                            |
| `github.search_issues`          | Search issues visible to the token           | `read`                    | None                            |
| `github.get_issue`              | Retrieve one issue                           | `read`                    | None                            |
| `github.list_issue_comments`    | Read issue or pull-request comments          | `read`                    | None                            |
| `github.list_pull_requests`     | List repository pull requests                | `read`                    | None                            |
| `github.get_pull_request`       | Retrieve one pull request                    | `read`                    | None                            |
| `github.create_issue`           | Publish a repository issue                   | `create`, `communication` | Creates content; notifies users |
| `github.update_issue`           | Change issue fields, labels, assignees/state | `modify`, `communication` | Can close or replace fields     |
| `github.add_issue_comment`      | Publish an issue or pull-request comment     | `create`, `communication` | Creates content; notifies users |
| `github.create_pull_request`    | Publish a pull request between branches      | `create`, `communication` | Creates content; notifies users |

MCP clients receive matching `readOnlyHint`, `destructiveHint`, and `idempotentHint` annotations.
`github.update_issue` is deliberately marked destructive because it can close an issue or replace
its complete label and assignee sets. Repeated create/comment calls are not idempotent.

## Permissions

Use a fine-grained personal access token limited to the repositories BooLink should access. Grant
only the permissions needed for the tools you intend to use:

- Authenticated-user lookup requires no repository permission.
- Issue reads require **Issues: read** for private repositories.
- Issue creation and updates require **Issues: write**.
- Pull-request reads require **Pull requests: read** for private repositories.
- Pull-request creation requires **Pull requests: write**.
- Comment access uses **Issues** or **Pull requests** permission according to the target.

Public resources may be available with fewer permissions, but this integration still requires a
token so its identity and behavior remain explicit. GitHub documents endpoint permissions in its
[REST API documentation](https://docs.github.com/en/rest). The client pins
`X-GitHub-Api-Version` to `2026-03-10`.

## Install with Codex or Claude Code

Requires Node.js 22 or newer. Set `GITHUB_TOKEN` in the environment that launches the selected
client, then run the BooLink shop:

```powershell
$env:GITHUB_TOKEN = "your-fine-grained-token"
npx @boolink-dev/cli
```

```bash
export GITHUB_TOKEN="your-fine-grained-token"
npx @boolink-dev/cli
```

Choose **GitHub**, **Install**, and either **Codex** or **Claude Code**, review the proposed changes,
then approve them. The equivalent non-interactive commands are:

```bash
npx @boolink-dev/cli add github --client codex --yes
npx @boolink-dev/cli add github --client claude-code --yes
```

Restart the selected client after installation so it reloads the MCP configuration. Confirm the
local package, launcher, configuration, and credential presence with:

```bash
npx @boolink-dev/cli doctor
```

The CLI installs the exact catalog version beneath `~/.boolink`, writes a managed
`[mcp_servers.boolink_github]` block to `~/.codex/config.toml`, and references only the environment
variable name. It never writes the token value. If Codex was launched outside the shell where the
token was set, configure `GITHUB_TOKEN` through your normal local environment/secret mechanism and
restart the selected client.

## Install with Claude Desktop

Download the versioned
[`boolink-github-0.2.2.mcpb`](https://github.com/ColinRM000/boolink/releases/latest/download/boolink-github-0.2.2.mcpb)
release asset and open it with the current Claude Desktop app on Windows or macOS. Review the ten
declared tools, approve the local extension, and enter the fine-grained token in Claude's masked
credential field. Claude supplies it only to the local server process; the archive contains no
credential value. The release's `SHA256SUMS.txt` covers the bundle.

## Other MCP clients

Generate a neutral JSON launch document at a new path:

```bash
npx @boolink-dev/cli add github --client custom-json --output ./boolink-github.json --yes
```

Or run the server package directly:

```bash
npx @boolink-dev/github
```

The server uses stdio. `stdout` is reserved for MCP frames; safe startup failures are written to
`stderr`. Prefer the client's secret/environment mechanism instead of placing a token directly in
configuration.

## Example calls

Read one issue:

```json
{
  "name": "github.get_issue",
  "arguments": { "owner": "ColinRM000", "repository": "boolink", "issueNumber": 42 }
}
```

Create an issue after the user reviews the public content:

```json
{
  "name": "github.create_issue",
  "arguments": {
    "owner": "ColinRM000",
    "repository": "boolink",
    "title": "Document a new integration",
    "body": "Describe the proposed provider, permissions, and tool surface.",
    "labels": ["documentation"]
  }
}
```

Create a draft pull request after its commits have already been pushed:

```json
{
  "name": "github.create_pull_request",
  "arguments": {
    "owner": "ColinRM000",
    "repository": "boolink",
    "title": "Add provider integration",
    "head": "feature/provider",
    "base": "main",
    "draft": true
  }
}
```

## Security behavior

- Model-provided inputs are strict, bounded, and validated before request construction.
- Provider responses are runtime-validated and treated as untrusted.
- Provider error bodies, headers, tokens, and cookies are never returned through MCP.
- Rate-limit errors include only a safe retry delay derived from response headers.
- Pagination is explicit and bounded to 100 items per page.
- Write tools state their external communication effects and required scopes in machine-readable
  metadata before execution.
- No telemetry or remote BooLink service is used.

## Verification and limitations

- GitHub.com REST API only; GitHub Enterprise Server base URLs are not exposed yet.
- The supported write surface is intentionally limited to issues, comments, and pull-request
  creation. Branch pushes, merges, reviews, releases, repository administration, Actions, secrets,
  and deletion are outside this MVP.
- Search is limited to issues; pull requests are deliberately excluded from search results.
- Request/response contracts are mock-verified against GitHub's versioned official REST
  documentation. The release smoke test installs the packed package and negotiates all 10 tools
  through the official MCP stdio client without contacting GitHub.
- `github.get_authenticated_user` was additionally verified against the live GitHub API with
  `@boolink-dev/github@0.2.0` on 2026-08-13. The other nine tools remain contract-tested rather than
  live-account tested. Version 0.2.2 adds Claude Desktop bundle distribution metadata and updates
  the package user-agent only; the verified provider request and response implementation is
  unchanged.
- Codex and Claude Code use the CLI adapters. Claude Desktop uses the versioned MCP Bundle. Other
  local stdio clients can consume the neutral JSON launch document.

## Troubleshooting

- `github_auth_missing`: set `GITHUB_TOKEN` in the MCP client process environment.
- `github_unauthorized`: replace or re-authorize the token.
- `github_forbidden`: grant the narrow repository permission required by the tool.
- `github_not_found`: verify the owner, repository, number, and token visibility.
- `github_feature_disabled`: enable the requested repository feature or choose another repository.
- `github_rate_limited`: wait for the retry interval returned in the safe error.
- `github_invalid_request`: verify repository settings, branch names, labels, and assignees.
- `github_invalid_response`: GitHub returned data outside the tested contract; update the
  integration before relying on the result.
