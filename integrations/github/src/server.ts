#!/usr/bin/env node
import { serveIntegrationStdio } from '@boolink-dev/sdk';

import { loadGitHubToken } from './auth.js';
import { createGitHubClient } from './client.js';
import { createGitHubIntegration } from './index.js';

async function main(): Promise<void> {
  const token = loadGitHubToken();
  const client = createGitHubClient({ token });
  await serveIntegrationStdio(createGitHubIntegration(client));
}

main().catch((error: unknown) => {
  const name = error instanceof Error ? error.name : 'UnknownError';
  process.stderr.write(`BooLink GitHub integration failed: ${name}\n`);
  process.exitCode = 1;
});
