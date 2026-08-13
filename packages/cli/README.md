# `@boolink-dev/cli`

Experimental local-first CLI for discovering, inspecting, installing, configuring, and diagnosing
BooLink integrations.

## Commands

```text
boo search [query]
boo info <integration>
boo add <integration> [--client codex|custom-json] [--output <path>] [--yes]
boo remove <integration> [--yes]
boo repair <integration> [--yes]
boo upgrade <integration> [--yes]
boo list
boo doctor
```

Run `boo` with no arguments in an interactive terminal to open the integration shop. Use the arrow
keys to browse, `/` to search, and Enter to inspect an integration. The install flow shows tools,
capabilities, credential presence, affected files, and client choice before accepting `Y` as final
approval. It never displays credential values.

Launch the shop without a global install:

```bash
npx @boolink-dev/cli
```

To build and run it from this repository instead:

```bash
pnpm --filter @boolink-dev/cli build
node packages/cli/dist/bin.js search github
```

## Safe installation flow

`boo add`, `boo remove`, `boo repair`, and `boo upgrade` preview their complete write plan by
default. They change files only when `--yes` is present.

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

The CLI downloads the exact catalog version with npm lifecycle scripts disabled, verifies its
published `./server` export, and stores it beneath
`~/.boolink/integrations/<integration>/<version>`. Client configuration points to a stable local
launcher instead of npm's temporary `npx` cache.

Installation metadata lives in `~/.boolink/installations.json`. It records credential variable
names such as `GITHUB_TOKEN`, never credential values. Provider credentials are removed from the
environment inherited by the npm subprocess. Set the variable in the environment that launches
the MCP client. Set `BOOLINK_HOME` to use a different installation-state directory, including for
isolated tests.

```bash
boo doctor
boo repair github
boo repair github --yes
boo upgrade github --yes
boo remove github --yes
```

Removal deletes only an exact BooLink-managed configuration block. If the block was manually
edited, BooLink stops and asks you to reconcile it instead of guessing. State and client files are
written atomically, with rollback around installation and configuration failures.

## Current limitations

- The CLI is experimental and its public API may change before 1.0.
- GitHub is the only catalog entry and server package.
- The Codex adapter and neutral JSON output are the first supported client paths.
- `doctor` performs local diagnostics only. It does not call GitHub or send telemetry.
- `upgrade` follows the version in the bundled registry; refresh the CLI to receive a newer catalog.
- The CLI references credential variable names but does not create provider tokens or store their
  values; provider-side token setup remains explicit.
- Packaged integration discovery is verified over stdio; `doctor` intentionally performs no live
  provider call.
