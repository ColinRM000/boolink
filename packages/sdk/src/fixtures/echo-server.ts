import { serveIntegrationStdio } from '../index.js';
import { echoIntegration } from './echo-integration.js';

serveIntegrationStdio(echoIntegration).catch((error: unknown) => {
  const message = error instanceof Error ? error.name : 'UnknownError';
  process.stderr.write(`BooLink echo fixture failed: ${message}\n`);
  process.exitCode = 1;
});
