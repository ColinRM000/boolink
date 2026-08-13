# BooLink

![BooLink logo](assets/brand/boolink-logo.png)

**Give your AI a ghost in the machine.**

BooLink is an open-source, local-first integration ecosystem for AI agents. It provides
maintained MCP servers that connect compatible AI clients to services such as GitHub and
Cloudflare without routing user credentials through BooLink infrastructure.

> BooLink is in active development. GitHub and Cloudflare integrations are implemented with
> versioned CLI and package releases available on npm.

## Principles

- Credentials stay in the user's environment.
- Integrations expose deliberate, agent-friendly tools rather than raw API endpoints.
- Read, write, destructive, financial, communication, and administrative capabilities are
  machine-readable.
- Protocol code uses the official MCP SDK.
- Every official integration is tested and documented.

## Repository layout

```text
assets/brand/       Supplied BooLink brand assets
apps/web/           Public website deployed to Cloudflare Pages
docs/               Architecture, research, security, and delivery plans
packages/core/      Protocol-independent integration contract
packages/sdk/       Thin adapter from BooLink definitions to the official MCP SDK
packages/registry/  Machine-readable registry schema and query helpers
packages/cli/       Previewable local installation and client configuration CLI
integrations/github/    Experimental GitHub issues and pull-request integration
integrations/cloudflare/ Experimental Cloudflare zones, DNS, and cache integration
```

## Development

Requires Node.js 22+ and pnpm 11.

```bash
pnpm install
pnpm check
pnpm dev:web
```

Launch the experimental CLI from npm:

```bash
npx @boolink-dev/cli
```

Or build it locally to inspect either integration:

```bash
pnpm --filter @boolink-dev/cli build
node packages/cli/dist/bin.js
node packages/cli/dist/bin.js search github
node packages/cli/dist/bin.js search cloudflare
node packages/cli/dist/bin.js add github --client codex
node packages/cli/dist/bin.js add cloudflare --client codex
```

See [the implementation plan](docs/implementation-plan.md) for the delivery sequence and
[the MVP criteria](docs/mvp-acceptance-criteria.md) for the release gates. The public site is
available at [boolink.dev](https://boolink.dev); see the
[Cloudflare Pages runbook](docs/deployment/cloudflare-pages.md) for hosting details.

## Release artifacts

Maintainers can build the exact npm tarballs, install them in
an isolated temporary project, smoke-test the installed CLI, and generate SHA-256 checksums with:

```bash
pnpm release:pack
```

Validated artifacts are written to the ignored `release/` directory. See
[the release runbook](docs/releasing.md) for the publication prerequisites and dependency order.

## Security

Do not report vulnerabilities in a public issue. Follow [SECURITY.md](SECURITY.md). Never place
service credentials in BooLink configuration committed to source control.

## License

Licensed under the [MIT License](LICENSE).
