# `boolink`

Experimental local-first CLI for discovering, inspecting, installing, configuring, and diagnosing
BooLink integrations.

## Commands

```text
boo search [query]
boo info <integration>
boo add <integration> [--client codex|custom-json] [--output <path>] [--yes]
boo list
boo doctor
```

Run `boo` with no arguments in an interactive terminal to open the integration shop. Use the arrow
keys to browse, `/` to search, and Enter to inspect an integration. The install flow shows tools,
capabilities, credential presence, affected files, and client choice before accepting `Y` as final
approval. It never displays credential values.

After the first npm release, users will be able to launch the shop without a global install:

```bash
npx boolink
```

The package is not published yet. Until then, build and run it from this repository:

```bash
pnpm --filter boolink build
node packages/cli/dist/bin.js search github
```

## Safe installation flow

`boo add` previews its complete write plan by default. It changes files only when `--yes` is
present.

```bash
node packages/cli/dist/bin.js add github --client codex
node packages/cli/dist/bin.js add github --client codex --yes
```

Codex configuration defaults to `~/.codex/config.toml`. Use `--output` to target a project-scoped
configuration instead:

```bash
node packages/cli/dist/bin.js add github --client codex --output .codex/config.toml --yes
```

For another MCP client, generate a neutral JSON document at a new path:

```bash
node packages/cli/dist/bin.js add github --client custom-json --output ./boolink-github.json --yes
```

The CLI records installation metadata in `~/.boolink/installations.json`. It records credential
variable names such as `GITHUB_TOKEN`, never credential values. Set the variable in the environment
that launches the MCP client. Set `BOOLINK_HOME` to use a different installation-state directory,
including for isolated tests.

## Current limitations

- npm publication is prepared and locally validated, but has not happened yet.
- GitHub is the only catalog entry and server package.
- The Codex adapter and neutral JSON output are the first supported client paths.
- `doctor` performs local diagnostics only. It does not call GitHub or send telemetry.
- Removal, authentication helpers, live API tests, package downloading, and upgrades are planned.
