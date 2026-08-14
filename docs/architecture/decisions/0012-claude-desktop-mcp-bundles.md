# ADR 0012: Distribute Claude Desktop integrations as MCP Bundles

- Status: Accepted
- Date: 2026-08-13

## Context

Claude Code can launch BooLink through a user-scoped JSON configuration, but Claude Desktop also
supports one-click local extensions. Anthropic originally called the archive format Desktop
Extensions (`.dxt`) and has renamed it MCP Bundles (`.mcpb`). The current official tooling supports
manifest version `0.4`, sensitive user configuration, bundled Node.js dependencies, static tool
declarations, and Windows and macOS compatibility metadata.

A Desktop bundle must not introduce a hosted BooLink runtime or move provider credentials into
BooLink infrastructure. It also must not depend on an unpinned package download when Claude starts
the local server.

## Decision

1. BooLink publishes one `.mcpb` release asset per official integration. GitHub and Cloudflare are
   separate bundles because their credentials, permission guidance, privacy policies, versions,
   and tool surfaces differ.
2. Each bundle contains the integration's built local stdio server and production dependencies.
   Claude launches `dist/server.js` with its bundled Node.js runtime.
3. The MCPB manifest is generated from the versioned BooLink registry. It declares the exact tool
   names and descriptions, provider documentation, provider privacy policy, supported platforms,
   and integration version.
4. Provider tokens are required `sensitive` user-configuration strings. Claude Desktop substitutes
   the value into the owning server's environment at runtime. No token value is written into the
   archive, website, registry, release manifest, checksum file, or MCP tool contract.
5. The official `@anthropic-ai/mcpb` implementation validates, packs, unpacks, and inspects every
   archive. Release verification launches the unpacked server and compares MCP discovery with the
   registry before the asset can be published.
6. The release workflow publishes `.mcpb` files beside npm tarballs and covers every artifact with
   `SHA256SUMS.txt`. Signing is deferred until BooLink has an approved code-signing identity and key
   custody procedure; private signing material will never be committed to the repository.
7. The existing CLI remains the install path for Codex, Claude Code, and neutral stdio clients.
   Claude Desktop installation is file-based and does not add a fake CLI adapter.

## Consequences

- Claude Desktop users can install an integration without Node.js, npm, or manual JSON editing.
- Release artifacts are larger because each bundle is self-contained.
- Tool declarations cannot silently drift from the registry because packing fails on a mismatch.
- Updating an integration requires a new versioned bundle asset.
- Unsigned bundles may receive additional client warnings until the signing follow-up is complete.

## Alternatives rejected

- **Keep publishing `.dxt` files:** the upstream format and tooling have moved to `.mcpb`.
- **Install an npm package at extension startup:** this adds network and supply-chain behavior at
  runtime and makes a reviewed release non-self-contained.
- **Put both providers in one bundle:** this combines unrelated credentials and permissions and
  weakens least-privilege installation.
- **Store tokens in a BooLink credential service:** this violates the local-first product boundary.

## References

- [MCP Bundles overview](https://github.com/modelcontextprotocol/mcpb/blob/main/README.md)
- [MCPB manifest specification](https://github.com/modelcontextprotocol/mcpb/blob/main/MANIFEST.md)
- [MCPB packaging CLI](https://github.com/modelcontextprotocol/mcpb/blob/main/CLI.md)
