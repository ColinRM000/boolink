import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const requestedOutput = process.argv[2] ?? 'release';
const outputDirectory = path.resolve(repositoryRoot, requestedOutput);
const allowedPrefix = `${repositoryRoot}${path.sep}`;

if (!outputDirectory.startsWith(allowedPrefix) || outputDirectory === repositoryRoot) {
  throw new Error('Release output must be a dedicated directory inside the repository.');
}

const packages = [
  {
    directory: 'packages/core',
    name: '@boolink-dev/core',
    version: '0.1.0',
    required: ['package/dist/index.js'],
  },
  {
    directory: 'packages/sdk',
    name: '@boolink-dev/sdk',
    version: '0.1.0',
    required: ['package/dist/index.js'],
  },
  {
    directory: 'packages/registry',
    name: '@boolink-dev/registry',
    version: '0.3.1',
    required: ['package/dist/index.js', 'package/src/catalog.json'],
  },
  {
    directory: 'integrations/cloudflare',
    name: '@boolink-dev/cloudflare',
    version: '0.1.1',
    required: ['package/dist/index.js', 'package/dist/server.js'],
  },
  {
    directory: 'integrations/github',
    name: '@boolink-dev/github',
    version: '0.2.1',
    required: ['package/dist/index.js', 'package/dist/server.js'],
  },
  {
    directory: 'packages/cli',
    name: '@boolink-dev/cli',
    version: '0.5.0',
    required: ['package/dist/index.js', 'package/dist/bin.js'],
  },
];

function run(command, args, options = {}) {
  const { capture = false, ...spawnOptions } = options;
  const result = spawnSync(command, args, {
    cwd: repositoryRoot,
    encoding: 'utf8',
    stdio: capture ? 'pipe' : 'inherit',
    ...spawnOptions,
  });

  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(
      `${command} ${args.join(' ')} failed with exit code ${result.status ?? 'unknown'}.`,
    );
  }
  return result.stdout ?? '';
}

function runPnpm(args, options = {}) {
  const command = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
  return run(command, ['--config.manage-package-manager-versions=false', ...args], {
    ...(process.platform === 'win32' ? { shell: true } : {}),
    ...options,
  });
}

async function tarText(tarball, entry) {
  return run(process.platform === 'win32' ? 'tar.exe' : 'tar', ['-xOf', tarball, entry], {
    capture: true,
  });
}

await rm(outputDirectory, { recursive: true, force: true });
await mkdir(outputDirectory, { recursive: true });

for (const releasePackage of packages) {
  runPnpm(['pack', '--pack-destination', outputDirectory], {
    cwd: path.join(repositoryRoot, releasePackage.directory),
  });
}

const tarballs = (await readdir(outputDirectory))
  .filter((fileName) => fileName.endsWith('.tgz'))
  .map((fileName) => path.join(outputDirectory, fileName))
  .sort();

if (tarballs.length !== packages.length) {
  throw new Error(`Expected ${packages.length} tarballs, found ${tarballs.length}.`);
}

const packedByName = new Map();
for (const tarball of tarballs) {
  const manifest = JSON.parse(await tarText(tarball, 'package/package.json'));
  if (manifest.private === true) throw new Error(`${manifest.name} is still private.`);
  const releasePackage = packages.find(({ name }) => name === manifest.name);
  if (!releasePackage) throw new Error(`Unexpected package in release: ${manifest.name}`);
  if (manifest.version !== releasePackage.version) {
    throw new Error(
      `${manifest.name} has version ${manifest.version}; expected ${releasePackage.version}.`,
    );
  }
  const serializedDependencies = JSON.stringify(manifest.dependencies ?? {});
  if (serializedDependencies.includes('workspace:')) {
    throw new Error(`${manifest.name} contains an unpublished workspace dependency.`);
  }

  const listing = run(process.platform === 'win32' ? 'tar.exe' : 'tar', ['-tf', tarball], {
    capture: true,
  });
  for (const commonEntry of ['package/package.json', 'package/README.md', 'package/LICENSE']) {
    if (!listing.includes(commonEntry))
      throw new Error(`${manifest.name} is missing ${commonEntry}.`);
  }
  for (const requiredEntry of releasePackage.required) {
    if (!listing.includes(requiredEntry)) {
      throw new Error(`${manifest.name} is missing ${requiredEntry}.`);
    }
  }
  packedByName.set(manifest.name, tarball);
}

const cliTarball = packedByName.get('@boolink-dev/cli');
if (!cliTarball) throw new Error('The @boolink-dev/cli tarball was not created.');
const cliManifest = JSON.parse(await tarText(cliTarball, 'package/package.json'));
for (const executableName of ['boolink', 'boo']) {
  if (cliManifest.bin?.[executableName] !== './dist/bin.js') {
    throw new Error(`The boolink package is missing its ${executableName} executable alias.`);
  }
}
const cliBin = await tarText(cliTarball, 'package/dist/bin.js');
if (!cliBin.startsWith('#!/usr/bin/env node')) {
  throw new Error('The boolink executable is missing its portable Node.js shebang.');
}

const smokeDirectory = await mkdtemp(path.join(os.tmpdir(), 'boolink-release-'));
try {
  const pnpmStoreDirectory = runPnpm(['store', 'path'], { capture: true }).trim();
  const smokeDependencies = Object.fromEntries(
    [...packedByName.entries()].map(([name, tarball]) => [
      name,
      `file:${tarball.replaceAll('\\', '/')}`,
    ]),
  );
  await writeFile(
    path.join(smokeDirectory, 'package.json'),
    `${JSON.stringify(
      {
        name: 'boolink-release-smoke',
        version: '0.0.0',
        private: true,
        dependencies: smokeDependencies,
      },
      null,
      2,
    )}\n`,
    'utf8',
  );
  const overrideLines = Object.entries(smokeDependencies).map(
    ([name, dependency]) => `  ${JSON.stringify(name)}: ${JSON.stringify(dependency)}`,
  );
  await writeFile(
    path.join(smokeDirectory, 'pnpm-workspace.yaml'),
    `packages:\n  - '.'\noverrides:\n${overrideLines.join('\n')}\n`,
    'utf8',
  );
  runPnpm(
    [
      'install',
      '--dir',
      smokeDirectory,
      '--ignore-scripts',
      '--store-dir',
      path.dirname(pnpmStoreDirectory),
    ],
    {
      env: { ...process.env, CI: 'true' },
    },
  );

  for (const executableName of ['boolink', 'boo']) {
    for (const integrationId of ['cloudflare', 'github']) {
      const searchOutput = runPnpm(
        ['--dir', smokeDirectory, 'exec', executableName, 'search', integrationId],
        { capture: true },
      );
      if (!searchOutput.includes(integrationId) || !searchOutput.includes('10 tools')) {
        throw new Error(
          `The installed ${executableName} command could not discover the packaged ${integrationId} integration.`,
        );
      }
    }
  }

  const integrationSmokes = [
    {
      id: 'cloudflare',
      env: { CLOUDFLARE_API_TOKEN: 'packaged_discovery_only' },
      expectedToolNames: [
        'cloudflare.create_dns_record',
        'cloudflare.delete_dns_record',
        'cloudflare.get_dns_record',
        'cloudflare.get_zone',
        'cloudflare.list_dns_records',
        'cloudflare.list_zones',
        'cloudflare.purge_cache_urls',
        'cloudflare.purge_everything',
        'cloudflare.update_dns_record',
        'cloudflare.verify_token',
      ],
    },
    {
      id: 'github',
      env: { GITHUB_TOKEN: 'github_pat_packaged_discovery_only' },
      expectedToolNames: [
        'github.add_issue_comment',
        'github.create_issue',
        'github.create_pull_request',
        'github.get_authenticated_user',
        'github.get_issue',
        'github.get_pull_request',
        'github.list_issue_comments',
        'github.list_pull_requests',
        'github.search_issues',
        'github.update_issue',
      ],
    },
  ];

  for (const integrationSmoke of integrationSmokes) {
    const server = path.join(
      smokeDirectory,
      'node_modules',
      '@boolink-dev',
      integrationSmoke.id,
      'dist',
      'server.js',
    );
    const client = new Client(
      { name: 'boolink-packed-release-smoke', version: '0.0.0' },
      { versionNegotiation: { mode: 'auto' } },
    );
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [server],
      env: { ...process.env, ...integrationSmoke.env },
      stderr: 'pipe',
    });
    try {
      await client.connect(transport);
      const listed = await client.listTools();
      const toolNames = listed.tools.map(({ name }) => name).sort();
      if (JSON.stringify(toolNames) !== JSON.stringify(integrationSmoke.expectedToolNames)) {
        throw new Error(
          `The packed ${integrationSmoke.id} stdio server did not expose the expected 10-tool MVP.`,
        );
      }
    } finally {
      await client.close();
    }
  }
} finally {
  await rm(smokeDirectory, { recursive: true, force: true });
}

const checksumLines = [];
for (const tarball of tarballs) {
  const digest = createHash('sha256')
    .update(await readFile(tarball))
    .digest('hex');
  checksumLines.push(`${digest}  ${path.basename(tarball)}`);
}
await writeFile(
  path.join(outputDirectory, 'SHA256SUMS.txt'),
  `${checksumLines.join('\n')}\n`,
  'utf8',
);

const releaseManifest = {
  schemaVersion: 1,
  packages: Object.fromEntries(
    packages.map(({ name, version }) => [
      name,
      { version, tarball: path.basename(packedByName.get(name)) },
    ]),
  ),
};
await writeFile(
  path.join(outputDirectory, 'release-manifest.json'),
  `${JSON.stringify(releaseManifest, null, 2)}\n`,
  'utf8',
);

process.stdout.write(
  `Validated ${tarballs.length} publishable packages in ${outputDirectory}\n${tarballs.map((file) => `- ${path.basename(file)}`).join('\n')}\n`,
);
