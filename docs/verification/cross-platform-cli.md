# Cross-platform CLI journey

The cross-platform journey test installs the packed CLI into a temporary consumer and exercises the
same local lifecycle a new user follows. GitHub Actions runs it on Windows, macOS, and Linux with
the minimum supported Node.js major version.

The test verifies:

- registry search for GitHub and Cloudflare;
- preview-only installation without filesystem changes;
- managed installation of both public integration packages;
- custom JSON client configuration without credential values;
- `list`, `doctor`, `repair`, and current-version `upgrade` behavior;
- previewed and approved removal, including managed files and client configuration; and
- an empty, valid installation state after cleanup.

Provider credentials are dummy markers and no provider API is called. The test removes npm
launcher hints from the child environment so each operating system must locate its own bundled npm
installation. All files are isolated beneath an operating-system temporary directory and deleted at
the end of the run.

Run the journey locally after building the workspace:

```bash
pnpm build
pnpm verify:cross-platform
```

This complements the release verifier, which installs the latest CLI from the public npm registry,
and the optional read-only live provider checks.
