#!/usr/bin/env node
import { serveIntegrationStdio } from '@boolink-dev/sdk';

import { loadCloudflareToken } from './auth.js';
import { createCloudflareClient } from './client.js';
import { createCloudflareIntegration } from './index.js';

async function main(): Promise<void> {
  const token = loadCloudflareToken();
  const client = createCloudflareClient({ token });
  await serveIntegrationStdio(createCloudflareIntegration(client));
}

main().catch((error: unknown) => {
  const name = error instanceof Error ? error.name : 'UnknownError';
  process.stderr.write(`BooLink Cloudflare integration failed: ${name}\n`);
  process.exitCode = 1;
});
