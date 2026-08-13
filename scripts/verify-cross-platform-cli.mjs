import { spawnSync } from 'node:child_process';
import { Buffer } from 'node:buffer';
import { access, mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cliDirectory = path.join(repositoryRoot, 'packages', 'cli');
const pnpmCommand = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const fakeSecrets = {
  GITHUB_TOKEN: 'github_pat_cross_platform_secret_marker',
  CLOUDFLARE_API_TOKEN: 'cloudflare_cross_platform_secret_marker',
};

function redact(value) {
  return Object.values(fakeSecrets).reduce(
    (text, secret) => text.replaceAll(secret, '[redacted test credential]'),
    value,
  );
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? repositoryRoot,
    encoding: 'utf8',
    env: options.env ?? process.env,
    stdio: 'pipe',
    ...(process.platform === 'win32' && command.endsWith('.cmd') ? { shell: true } : {}),
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(
      `${command} ${args.join(' ')} failed with exit code ${result.status ?? 'unknown'}.\n${redact(result.stderr || result.stdout)}`,
    );
  }
  return result.stdout ?? '';
}

function expectIncludes(value, expected, label) {
  if (!value.includes(expected)) throw new Error(`${label} did not include ${expected}.`);
}

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function assertSecretsAbsent(rootPaths) {
  const pending = [...rootPaths];
  const secretBuffers = Object.values(fakeSecrets).map((secret) => Buffer.from(secret));
  while (pending.length > 0) {
    const current = pending.pop();
    if (!current || !(await exists(current))) continue;
    const entries = await readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const entryPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        pending.push(entryPath);
        continue;
      }
      if (!entry.isFile()) continue;
      const content = await readFile(entryPath);
      if (secretBuffers.some((secret) => content.includes(secret))) {
        throw new Error(`A generated file contained a test credential value: ${entryPath}`);
      }
    }
  }
}

const smokeDirectory = await mkdtemp(path.join(os.tmpdir(), 'boolink-cross-platform-'));
const packDirectory = path.join(smokeDirectory, 'pack');
const consumerDirectory = path.join(smokeDirectory, 'consumer');
const boolinkHome = path.join(smokeDirectory, 'boolink-home');
const outputDirectory = path.join(smokeDirectory, 'client-config');

try {
  await mkdir(packDirectory, { recursive: true });
  await mkdir(consumerDirectory, { recursive: true });
  await mkdir(outputDirectory, { recursive: true });

  run(pnpmCommand, ['pack', '--pack-destination', packDirectory], { cwd: cliDirectory });
  const tarballs = (await readdir(packDirectory)).filter((name) => name.endsWith('.tgz'));
  if (tarballs.length !== 1) throw new Error(`Expected one CLI tarball; found ${tarballs.length}.`);
  const cliTarball = path.join(packDirectory, tarballs[0]);

  await writeFile(
    path.join(consumerDirectory, 'package.json'),
    `${JSON.stringify({ name: 'boolink-cross-platform-smoke', version: '0.0.0', private: true }, null, 2)}\n`,
    'utf8',
  );
  run(pnpmCommand, ['add', '--ignore-scripts', '--save-exact', cliTarball], {
    cwd: consumerDirectory,
  });

  const cli = path.join(consumerDirectory, 'node_modules', '@boolink-dev', 'cli', 'dist', 'bin.js');
  const cliEnvironment = {
    ...process.env,
    ...fakeSecrets,
    BOOLINK_HOME: boolinkHome,
    CI: 'true',
  };
  for (const variable of [
    'npm_execpath',
    'npm_node_execpath',
    'NODE_AUTH_TOKEN',
    'NPM_TOKEN',
    'NPM_CONFIG_USERCONFIG',
  ]) {
    delete cliEnvironment[variable];
  }

  function boo(args) {
    return run(process.execPath, [cli, ...args], {
      cwd: consumerDirectory,
      env: cliEnvironment,
    });
  }

  for (const integrationId of ['github', 'cloudflare']) {
    const search = boo(['search', integrationId]);
    expectIncludes(search, integrationId, `${integrationId} search`);
    expectIncludes(search, '10 tools', `${integrationId} search`);
  }

  const configPaths = {
    github: path.join(outputDirectory, 'github.json'),
    cloudflare: path.join(outputDirectory, 'cloudflare.json'),
  };

  const preview = boo(['add', 'github', '--client', 'custom-json', '--output', configPaths.github]);
  expectIncludes(preview, 'Preview only. No files were changed.', 'GitHub install preview');
  if ((await exists(boolinkHome)) || (await exists(configPaths.github))) {
    throw new Error('The install preview changed the filesystem.');
  }

  for (const integrationId of ['github', 'cloudflare']) {
    const installed = boo([
      'add',
      integrationId,
      '--client',
      'custom-json',
      '--output',
      configPaths[integrationId],
      '--yes',
    ]);
    expectIncludes(installed, 'installed locally.', `${integrationId} install`);

    const config = await readFile(configPaths[integrationId], 'utf8');
    const variableName = integrationId === 'github' ? 'GITHUB_TOKEN' : 'CLOUDFLARE_API_TOKEN';
    expectIncludes(config, variableName, `${integrationId} client configuration`);
  }

  const list = boo(['list']);
  expectIncludes(list, 'github', 'installed integration list');
  expectIncludes(list, 'cloudflare', 'installed integration list');

  const doctor = boo(['doctor']);
  expectIncludes(doctor, 'PASS github server launcher', 'doctor');
  expectIncludes(doctor, 'PASS cloudflare server launcher', 'doctor');
  expectIncludes(doctor, 'BooLink doctor found no blocking problems.', 'doctor');

  const repairPreview = boo(['repair', 'github']);
  expectIncludes(repairPreview, 'Preview only. No files were changed.', 'repair preview');
  expectIncludes(boo(['repair', 'github', '--yes']), 'github repaired', 'repair');
  expectIncludes(boo(['upgrade', 'github']), 'already current', 'current-version upgrade');

  await assertSecretsAbsent([boolinkHome, outputDirectory]);

  const removePreview = boo(['remove', 'cloudflare']);
  expectIncludes(removePreview, 'Preview only. No files were changed.', 'remove preview');
  for (const integrationId of ['cloudflare', 'github']) {
    expectIncludes(boo(['remove', integrationId, '--yes']), 'removed.', `${integrationId} remove`);
    if (await exists(configPaths[integrationId])) {
      throw new Error(`${integrationId} client configuration remained after removal.`);
    }
    if (await exists(path.join(boolinkHome, 'integrations', integrationId))) {
      throw new Error(`${integrationId} managed package remained after removal.`);
    }
  }

  expectIncludes(boo(['list']), 'No BooLink integrations are installed.', 'empty list');
  expectIncludes(boo(['doctor']), 'BooLink doctor found no blocking problems.', 'empty doctor');
  const finalState = JSON.parse(
    await readFile(path.join(boolinkHome, 'installations.json'), 'utf8'),
  );
  if (finalState.schemaVersion !== 2 || finalState.integrations?.length !== 0) {
    throw new Error('Removal did not leave an empty schema-v2 installation state.');
  }

  process.stdout.write(
    `Verified the packed BooLink CLI install lifecycle on ${process.platform} ${process.arch} with Node ${process.versions.node}.\n`,
  );
} finally {
  await rm(smokeDirectory, { recursive: true, force: true });
}
