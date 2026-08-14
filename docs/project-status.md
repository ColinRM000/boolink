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
| 4. CLI                          | Complete for MVP              | Search, info, add, list, doctor, repair, upgrade, and remove are implemented. The packed public journey runs on Windows, macOS, and Linux.                        |
| 5. Website                      | MVP closure in progress       | Discovery and setup are live. Registry-backed provider routes are implemented; deployment and a clean published-client journey remain release gates.              |
| 6. Additional integrations      | In progress                   | Cloudflare is complete for its scoped MVP. A third provider must be selected for architectural contrast.                                                          |
| 7. Ecosystem preparation        | In progress                   | Contributor guidance, validation, CI security gates, Dependabot, and trusted publishing exist. Community templates and submission/verification governance remain. |

## Current release line

| Component              | Version | Status               |
| ---------------------- | ------- | -------------------- |
| GitHub integration     | `0.2.1` | Official, scoped MVP |
| Cloudflare integration | `0.1.1` | Official, scoped MVP |
| Registry               | `0.3.1` | Official catalog     |
| CLI                    | `0.4.2` | Pre-1.0 public CLI   |

## Next release gate

1. Pass `pnpm check` and the packed cross-platform CLI journey.
2. Verify the registry-backed website at desktop and mobile sizes, including both integration URLs.
3. Install through the public CLI into a clean supported client configuration and invoke a
   read-only provider tool through that client.
4. Publish the patch package set, deploy the website, and record the release evidence.
5. Select the third integration through an ADR based on architectural contrast rather than catalog
   size.
