import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const requested = new Set(process.argv.slice(2));
const selected =
  requested.size === 0
    ? ['github', 'cloudflare']
    : ['github', 'cloudflare'].filter((provider) => requested.has(`--${provider}`));

if (selected.length === 0) {
  throw new Error('Select --github, --cloudflare, or omit arguments to verify both.');
}

const configurations = {
  github: {
    packageDirectory: 'integrations/github',
    credential: 'GITHUB_TOKEN',
    checks: [{ name: 'github.get_authenticated_user', arguments: {} }],
  },
  cloudflare: {
    packageDirectory: 'integrations/cloudflare',
    credential: 'CLOUDFLARE_API_TOKEN',
    checks: [
      { name: 'cloudflare.verify_token', arguments: {} },
      {
        name: 'cloudflare.list_zones',
        arguments: { name: 'boolink.dev', page: 1, perPage: 5 },
      },
    ],
  },
};

const outputDirectory = path.join(repositoryRoot, 'work', 'live-verification');
await mkdir(outputDirectory, { recursive: true });

function runtimeEnvironment(credential, token) {
  const environment = { [credential]: token };
  for (const variable of [
    'PATH',
    'Path',
    'SystemRoot',
    'ComSpec',
    'PATHEXT',
    'TEMP',
    'TMP',
    'HOME',
    'USERPROFILE',
  ]) {
    if (process.env[variable]) environment[variable] = process.env[variable];
  }
  return environment;
}

function normalizedErrorSummary(result) {
  let error = result.structuredContent?.error;
  if ((typeof error !== 'object' || error === null) && Array.isArray(result.content)) {
    for (const item of result.content) {
      if (item?.type !== 'text' || typeof item.text !== 'string') continue;
      try {
        const parsed = JSON.parse(item.text);
        if (typeof parsed?.error === 'object' && parsed.error !== null) {
          error = parsed.error;
          break;
        }
      } catch {
        // Only the integration's normalized JSON error envelope is eligible for reporting.
      }
    }
  }
  if (
    typeof error !== 'object' ||
    error === null ||
    typeof error.code !== 'string' ||
    typeof error.message !== 'string'
  ) {
    return 'normalized MCP error';
  }

  return `${error.code}: ${error.message}`;
}

for (const provider of selected) {
  const configuration = configurations[provider];
  const token = process.env[configuration.credential];
  if (!token) {
    throw new Error(`${configuration.credential} is not present in this process environment.`);
  }

  const packageDirectory = path.join(repositoryRoot, configuration.packageDirectory);
  const packageManifest = JSON.parse(
    await readFile(path.join(packageDirectory, 'package.json'), 'utf8'),
  );
  const server = path.join(packageDirectory, 'dist', 'server.js');
  const client = new Client({ name: 'boolink-live-verification', version: '0.1.0' });
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [server],
    env: runtimeEnvironment(configuration.credential, token),
    stderr: 'pipe',
  });

  try {
    await client.connect(transport);
    const listed = await client.listTools();
    if (listed.tools.length !== 10) {
      throw new Error(`${provider} did not expose the expected 10-tool contract.`);
    }

    for (const check of configuration.checks) {
      const result = await client.callTool(check);
      if (result.isError === true) {
        throw new Error(`${check.name} returned ${normalizedErrorSummary(result)}.`);
      }
    }

    const verifiedAt = new Date().toISOString();
    const record = {
      schemaVersion: 1,
      provider,
      package: packageManifest.name,
      version: packageManifest.version,
      verifiedAt,
      transport: 'stdio',
      toolCount: listed.tools.length,
      readOnlyChecks: configuration.checks.map(({ name }) => name),
      passed: true,
      note: 'No provider response bodies, account identifiers, resource names, or credential values are recorded.',
    };
    const fileName = `${provider}-${verifiedAt.replaceAll(':', '-')}.json`;
    await writeFile(
      path.join(outputDirectory, fileName),
      `${JSON.stringify(record, null, 2)}\n`,
      'utf8',
    );
    process.stdout.write(
      `Verified ${packageManifest.name}@${packageManifest.version} against the live ${provider} API; wrote sanitized record ${fileName}.\n`,
    );
  } finally {
    await client.close();
  }
}
