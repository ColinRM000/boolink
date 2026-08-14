# BooLink project status

Last reviewed: 2026-08-13

This is the living companion to the original project direction sheet. “Complete” means the scoped
phase gate is implemented and evidenced; it does not mean the provider's entire API or BooLink's
long-term product vision is finished.

| Phase                           | Status                        | Evidence and remaining work                                                                                                                                       |
| ------------------------------- | ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Foundation                   | Complete                      | Monorepo, core contract, MCP SDK adapter, CI, security scanning, testing, documentation, and ADRs are established.                                                |
| 2. GitHub reference integration | Complete for scoped MVP       | Ten documented tools are published, contract-tested, discoverable over stdio, and live read-verified.                                                             |
| 3. Registry                     | Complete for official catalog | Deterministic schema-validated catalog contains GitHub and Cloudflare. Status, tools, scopes, versions, authentication, and source URLs drive the public website. |
| 4. Client distribution          | Complete for three clients    | The CLI supports Codex and Claude Code; versioned one-click MCP Bundles support Claude Desktop. Cross-platform CLI and bundle journeys verify the local servers.  |
| 5. Website                      | Complete for MVP              | Registry-backed discovery, setup, provider routes, and Claude Desktop downloads are published through `boolink.dev`.                                              |
| 6. Additional integrations      | In progress                   | Cloudflare is complete for its scoped MVP. A third provider must be selected for architectural contrast.                                                          |
| 7. Ecosystem preparation        | In progress                   | Contributor guidance, validation, CI security gates, Dependabot, and trusted publishing exist. Community templates and submission/verification governance remain. |

## Current release line

| Component              | Version | Status               |
| ---------------------- | ------- | -------------------- |
| GitHub integration     | `0.2.2` | Official, scoped MVP |
| Cloudflare integration | `0.1.2` | Official, scoped MVP |
| Registry               | `0.3.2` | Official catalog     |
| CLI                    | `0.5.1` | Pre-1.0 public CLI   |

## v0.6.0 release evidence

- GitHub PR `#17` passed repository checks, dependency review, dependency audit, secret scanning,
  and the Windows, macOS, and Linux CLI journeys.
- The trusted-publishing workflow published and publicly verified GitHub `0.2.1`, Cloudflare
  `0.1.1`, registry `0.3.1`, and CLI `0.4.2` before creating the `v0.6.0` GitHub release.
- Cloudflare Pages deployed merged commit `a4450c9` to production. The homepage and both direct
  integration routes returned HTTP 200 and rendered their official versions and complete tool
  surfaces.
- A clean Codex CLI journey installed the public CLI and GitHub packages into isolated local state,
  completed `github.get_authenticated_user` over stdio, recorded only sanitized pass metadata, and
  removed its temporary profile, installation, credential environment, and run directory.

## MVP acceptance

The scoped v0.6.0 MVP acceptance gate is complete. Foundation, two official integrations, the
registry, public CLI lifecycle, website, cross-platform packed-package journeys, live read checks,
and a clean supported-client invocation are all implemented and evidenced.

## v0.7.0 release scope

- CLI `0.5.0` adds a first-class Claude Code adapter with preview, approval, repair, upgrade,
  removal, and doctor coverage.
- Claude Code configuration is private and user-scoped in `~/.claude.json`. Managed stdio entries
  reference credential environment variables without storing their values.
- The website and integration guides allow visitors to choose Codex or Claude Code before copying
  the installation command.
- Unit, CLI lifecycle, packed Windows consumer, and release-artifact verification cover the new
  client path.

## Next phase gate

Publish and verify the v0.8.0 GitHub and Cloudflare MCP Bundles, then select the third integration
through an ADR based on architectural contrast rather than catalog size. Ecosystem submission and
verification governance remains the parallel preparation track.

## v0.8.0 release scope

- GitHub and Cloudflare ship as versioned `.mcpb` assets for one-click Claude Desktop installation.
- Manifests use the current MCPB `0.4` schema and mark provider credentials as sensitive local user
  configuration.
- The release gate packs, unpacks, launches, and compares both bundle tool surfaces with the
  registry before writing checksums.
- The website presents client-specific setup for Codex, Claude Code, and Claude Desktop.
