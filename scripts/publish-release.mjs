import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const requestedDirectory =
  process.argv.slice(2).find((argument) => !argument.startsWith('--')) ?? 'release';
const dryRun = process.argv.includes('--dry-run');
const releaseDirectory = path.resolve(repositoryRoot, requestedDirectory);
const manifestPath = path.join(releaseDirectory, 'release-manifest.json');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));

if (manifest.schemaVersion !== 1 || typeof manifest.packages !== 'object') {
  throw new Error('Unsupported or invalid release manifest.');
}

const publicationOrder = [
  '@boolink-dev/core',
  '@boolink-dev/sdk',
  '@boolink-dev/registry',
  '@boolink-dev/cloudflare',
  '@boolink-dev/github',
  '@boolink-dev/cli',
];

async function isPublished(name, version) {
  const response = await globalThis.fetch(
    `https://registry.npmjs.org/${encodeURIComponent(name)}/${encodeURIComponent(version)}`,
    { headers: { accept: 'application/json' } },
  );
  if (response.status === 200) return true;
  if (response.status === 404) return false;
  throw new Error(`npm registry returned HTTP ${response.status} for ${name}@${version}.`);
}

function publish(tarball) {
  const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const result = spawnSync(npmCommand, ['publish', tarball, '--access', 'public'], {
    cwd: repositoryRoot,
    encoding: 'utf8',
    stdio: 'inherit',
    ...(process.platform === 'win32' ? { shell: true } : {}),
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`npm publish failed with exit code ${result.status ?? 'unknown'}.`);
  }
}

for (const packageName of publicationOrder) {
  const releasePackage = manifest.packages[packageName];
  if (!releasePackage) throw new Error(`Release manifest is missing ${packageName}.`);

  const tarball = path.resolve(releaseDirectory, releasePackage.tarball);
  if (path.dirname(tarball) !== releaseDirectory || !tarball.endsWith('.tgz')) {
    throw new Error(`Unsafe tarball path for ${packageName}.`);
  }

  if (await isPublished(packageName, releasePackage.version)) {
    process.stdout.write(`Already published: ${packageName}@${releasePackage.version}\n`);
    continue;
  }

  if (dryRun) {
    process.stdout.write(`Would publish: ${packageName}@${releasePackage.version}\n`);
    continue;
  }

  process.stdout.write(`Publishing ${packageName}@${releasePackage.version} through npm OIDC...\n`);
  publish(tarball);
}
