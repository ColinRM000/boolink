# `@boolink-dev/core`

Host-neutral contracts for BooLink integrations. This package defines integration manifests, tool
metadata, capability classes, and normalized errors without depending on the MCP SDK.

Most users should install the `boolink` CLI or an integration package instead of importing this
package directly. Maintainers use it when implementing integrations and registry tooling.

Credentials and provider-specific transport logic do not belong in this package.
