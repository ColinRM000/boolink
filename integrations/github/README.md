# `@boolink/github`

Experimental, local-first GitHub integration for BooLink. It runs as an MCP server in the user's
environment and communicates directly with GitHub's REST API. BooLink infrastructure does not
receive, proxy, persist, or log the configured credential.

## Tools

| Tool                            | Purpose                                     | Capability | Side effects |
| ------------------------------- | ------------------------------------------- | ---------- | ------------ |
| `github.get_authenticated_user` | Confirm the token's GitHub identity         | `read`     | None         |
| `github.search_issues`          | Search issues visible to the token          | `read`     | None         |
| `github.get_issue`              | Retrieve one issue by repository and number | `read`     | None         |
| `github.list_pull_requests`     | List repository pull requests               | `read`     | None         |

This first slice is deliberately read-only. Write tools are not yet implemented or implied.

## Permissions

Use a fine-grained personal access token limited to the repositories BooLink should access.

- Authenticated-user lookup requires no fine-grained permission.
- Private issue search and issue lookup require **Issues: read**.
- Private pull-request listing requires **Pull requests: read**.
- Public resources may be available with fewer permissions, but this integration still requires a
  token so its identity and behavior stay explicit.

GitHub documents current endpoint permissions in its
[REST API documentation](https://docs.github.com/en/rest). The client pins the
`X-GitHub-Api-Version` header to `2026-03-10`.

## Authentication

Create a fine-grained personal access token in GitHub, then expose it only to the local integration
process:

```powershell
$env:GITHUB_TOKEN = "your-token"
```

```bash
export GITHUB_TOKEN="your-token"
```

The value is read from `GITHUB_TOKEN`. It is not accepted through MCP tool inputs, written to a
file, included in the manifest, or returned to the model.

## Build and run

The package is not published yet. From this repository:

```bash
pnpm install
pnpm --filter @boolink/github build
node integrations/github/dist/server.js
```

The server uses stdio. `stdout` is reserved for MCP frames; startup failures write only a safe error
class to `stderr`.

## Client configuration

The source-based BooLink CLI can generate Codex or neutral JSON configuration. To configure another
MCP-compatible client manually, point it at Node.js and the built server entry:

```json
{
  "command": "node",
  "args": ["/absolute/path/to/boolink/integrations/github/dist/server.js"],
  "env": {
    "GITHUB_TOKEN": "configure-this-through-your-client-secret-mechanism"
  }
}
```

Prefer the client's secret/environment mechanism instead of storing the token directly in a JSON
file. Exact configuration syntax varies by client and is not yet verified as part of this package.

## Example calls

```json
{
  "name": "github.search_issues",
  "arguments": {
    "query": "repo:boolink/boolink label:security",
    "sort": "updated",
    "perPage": 20
  }
}
```

```json
{
  "name": "github.get_issue",
  "arguments": {
    "owner": "boolink",
    "repository": "boolink",
    "issueNumber": 42
  }
}
```

## Security behavior

- Inputs are validated before request construction.
- Provider responses are runtime-validated and treated as untrusted.
- Error responses are normalized by status without returning GitHub payloads.
- Rate-limit errors include a safe retry delay derived from response headers.
- Pagination is explicit and bounded to 100 items per page.
- No telemetry or remote BooLink service is used.

## Limitations

- GitHub.com REST API only; GitHub Enterprise Server base URLs are not exposed yet.
- Read-only tools only.
- Search is limited to issues; pull requests are intentionally excluded from search results.
- Live API compatibility has not yet been recorded. Tests use mocked contracts grounded in GitHub's
  current official documentation.
- Client-specific configuration has not yet been manually verified.

## Troubleshooting

- `github_auth_missing`: set `GITHUB_TOKEN` in the integration process environment.
- `github_unauthorized`: replace or re-authorize the token.
- `github_forbidden`: grant the narrow repository permission required by the tool.
- `github_not_found`: verify the owner, repository, number, and token visibility.
- `github_rate_limited`: wait for the retry interval returned in the safe error.
- `github_invalid_response`: GitHub returned data outside the tested contract; update the integration
  before relying on the result.
