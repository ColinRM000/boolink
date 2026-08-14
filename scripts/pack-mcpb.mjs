import { spawnSync } from 'node:child_process';
import { mkdtemp, copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { packExtension, unpackExtension, validateManifest } from '@anthropic-ai/mcpb';

import { createMcpbManifest, MCPB_DEFINITIONS } from './mcpb.mjs';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputDirectory = path.resolve(repositoryRoot, process.argv[2] ?? 'release');
const allowedPrefix = `${repositoryRoot}${path.sep}`;

if (!outputDirectory.startsWith(allowedPrefix) || outputDirectory === repositoryRoot) {
  throw new Error('MCPB output must be a dedicated directory inside the repository.');
}

const registry = JSON.parse(
  await readFile(path.join(repositoryRoot, 'packages/registry/src/catalog.json'), 'utf8'),
);

function runPnpm(args) {
  const command = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
  const result = spawnSync(command, ['--config.manage-package-manager-versions=false', ...args], {
    cwd: repositoryRoot,
    encoding: 'utf8',
    stdio: 'inherit',
    env: { ...process.env, CI: 'true' },
    ...(process.platform === 'win32' ? { shell: true } : {}),
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`pnpm ${args.join(' ')} failed with exit code ${result.status ?? 'unknown'}.`);
  }
}

async function verifyBundle(bundlePath, integration, manifest, temporaryRoot) {
  const extractionDirectory = path.join(temporaryRoot, `${integration.id}-extracted`);
  const unpacked = await unpackExtension({
    mcpbPath: bundlePath,
    outputDir: extractionDirectory,
    silent: true,
  });
  if (!unpacked) throw new Error(`Unable to unpack ${path.basename(bundlePath)}.`);

  const extractedManifest = JSON.parse(
    await readFile(path.join(extractionDirectory, 'manifest.json'), 'utf8'),
  );
  if (JSON.stringify(extractedManifest) !== JSON.stringify(manifest)) {
    throw new Error(`${integration.id} MCPB manifest changed during packing.`);
  }

  const environmentName = integration.authentication.requirements[0].environmentVariables[0];
  const serverPath = path.join(extractionDirectory, manifest.server.entry_point);
  const client = new Client(
    { name: 'boolink-mcpb-release-smoke', version: '0.0.0' },
    { versionNegotiation: { mode: 'auto' } },
  );
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [serverPath],
    env: { ...process.env, [environmentName]: `${integration.id}_mcpb_discovery_only` },
    stderr: 'pipe',
  });

  try {
    await client.connect(transport);
    const listed = await client.listTools();
    const actual = listed.tools.map(({ name }) => name).sort();
    const expected = integration.tools.map(({ name }) => name).sort();
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      throw new Error(`${integration.id} MCPB did not expose the registry tool surface.`);
    }
  } finally {
    await client.close();
  }
}

await mkdir(outputDirectory, { recursive: true });
const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), 'boolink-mcpb-'));

try {
  for (const integration of registry.integrations) {
    const definition = MCPB_DEFINITIONS[integration.id];
    if (!definition) throw new Error(`Missing MCPB definition for ${integration.id}.`);

    const stagingDirectory = path.join(temporaryRoot, `${integration.id}-staging`);
    runPnpm([
      '--config.node-linker=hoisted',
      '--filter',
      integration.packageName,
      'deploy',
      '--prod',
      '--legacy',
      stagingDirectory,
    ]);

    const manifest = createMcpbManifest(integration);
    await writeFile(
      path.join(stagingDirectory, 'manifest.json'),
      `${JSON.stringify(manifest, null, 2)}\n`,
      'utf8',
    );
    await writeFile(
      path.join(stagingDirectory, '.mcpbignore'),
      ['node_modules/.pnpm', 'node_modules/.modules.yaml', 'node_modules/.package-map.json'].join(
        '\n',
      ) + '\n',
      'utf8',
    );
    await copyFile(
      path.join(repositoryRoot, definition.icon),
      path.join(stagingDirectory, 'icon.png'),
    );

    if (!validateManifest(path.join(stagingDirectory, 'manifest.json'))) {
      throw new Error(`Generated ${integration.id} MCPB manifest is invalid.`);
    }

    const bundlePath = path.join(
      outputDirectory,
      `${definition.bundleName}-${integration.version}.mcpb`,
    );
    const packed = await packExtension({
      extensionPath: stagingDirectory,
      outputPath: bundlePath,
      silent: true,
    });
    if (!packed) throw new Error(`Unable to pack ${path.basename(bundlePath)}.`);

    await verifyBundle(bundlePath, integration, manifest, temporaryRoot);
    process.stdout.write(`Validated Claude Desktop bundle: ${path.basename(bundlePath)}\n`);
  }
} finally {
  await rm(temporaryRoot, { recursive: true, force: true });
}
