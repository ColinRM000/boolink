import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { setTimeout } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const requestedDirectory = process.argv[2] ?? 'release';
const releaseDirectory = path.resolve(repositoryRoot, requestedDirectory);
const manifest = JSON.parse(
  await readFile(path.join(releaseDirectory, 'release-manifest.json'), 'utf8'),
);
const cliVersion = manifest.packages?.['@boolink-dev/cli']?.version;

if (manifest.schemaVersion !== 1 || typeof cliVersion !== 'string') {
  throw new Error('Release manifest does not contain a supported CLI version.');
}

const cleanEnvironment = { ...process.env, CI: 'true' };
for (const variable of ['GITHUB_TOKEN', 'CLOUDFLARE_API_TOKEN', 'NODE_AUTH_TOKEN', 'NPM_TOKEN']) {
  delete cleanEnvironment[variable];
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    env: cleanEnvironment,
    stdio: options.capture ? 'pipe' : 'inherit',
    ...options,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const detail = options.capture ? `\n${result.stderr || result.stdout}` : '';
    throw new Error(
      `${command} ${args.join(' ')} failed with exit code ${result.status ?? 'unknown'}.${detail}`,
    );
  }
  return result.stdout ?? '';
}

const smokeDirectory = await mkdtemp(path.join(os.tmpdir(), 'boolink-public-release-'));
const boolinkHome = path.join(smokeDirectory, 'boolink-home');
const projectDirectory = path.join(smokeDirectory, 'consumer');
const fakeSecrets = {
  GITHUB_TOKEN: 'github_pat_public_release_secret_marker',
  CLOUDFLARE_API_TOKEN: 'cloudflare_public_release_secret_marker',
};

try {
  await mkdir(projectDirectory, { recursive: true });
  await writeFile(
    path.join(projectDirectory, 'package.json'),
    `${JSON.stringify({ name: 'boolink-public-release-smoke', version: '0.0.0', private: true }, null, 2)}\n`,
    'utf8',
  );

  let installed = false;
  for (let attempt = 1; attempt <= 6; attempt += 1) {
    const result = spawnSync(
      process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm',
      ['add', '--ignore-scripts', `@boolink-dev/cli@${cliVersion}`],
      {
        cwd: projectDirectory,
        encoding: 'utf8',
        env: cleanEnvironment,
        stdio: 'pipe',
        ...(process.platform === 'win32' ? { shell: true } : {}),
      },
    );
    if (result.status === 0) {
      installed = true;
      break;
    }
    if (attempt === 6) {
      throw new Error(`Public CLI install failed after registry retries.\n${result.stderr}`);
    }
    await setTimeout(10_000);
  }

  if (!installed) throw new Error('Public CLI installation did not complete.');

  const cli = path.join(projectDirectory, 'node_modules', '@boolink-dev', 'cli', 'dist', 'bin.js');
  const cliEnvironment = { ...cleanEnvironment, ...fakeSecrets, BOOLINK_HOME: boolinkHome };

  for (const integrationId of ['github', 'cloudflare']) {
    const searchOutput = run(process.execPath, [cli, 'search', integrationId], {
      cwd: projectDirectory,
      env: cliEnvironment,
      capture: true,
    });
    if (!searchOutput.includes(integrationId) || !searchOutput.includes('10 tools')) {
      throw new Error(`Public CLI did not discover the ${integrationId} 10-tool integration.`);
    }

    const outputPath = path.join(
      projectDirectory,
      integrationId === 'github' ? '.claude.json' : `boolink-${integrationId}.json`,
    );
    const client = integrationId === 'github' ? 'claude-code' : 'custom-json';
    run(
      process.execPath,
      [cli, 'add', integrationId, '--client', client, '--output', outputPath, '--yes'],
      { cwd: projectDirectory, env: cliEnvironment },
    );

    const generated = await readFile(outputPath, 'utf8');
    if (
      !generated.includes(
        fakeSecrets[integrationId === 'github' ? 'GITHUB_TOKEN' : 'CLOUDFLARE_API_TOKEN'],
      )
    ) {
      const variableName = integrationId === 'github' ? 'GITHUB_TOKEN' : 'CLOUDFLARE_API_TOKEN';
      if (!generated.includes(variableName)) {
        throw new Error(`Generated ${integrationId} config is missing ${variableName}.`);
      }
      if (client === 'claude-code' && !generated.includes(`\${${variableName}}`)) {
        throw new Error(
          `Generated ${integrationId} Claude config is missing its environment reference.`,
        );
      }
    } else {
      throw new Error(`Generated ${integrationId} config leaked a credential value.`);
    }
  }

  const doctorOutput = run(process.execPath, [cli, 'doctor'], {
    cwd: projectDirectory,
    env: cliEnvironment,
    capture: true,
  });
  if (
    !doctorOutput.includes('PASS github server launcher') ||
    !doctorOutput.includes('PASS cloudflare server launcher')
  ) {
    throw new Error('Public CLI doctor did not report both installed integrations.');
  }

  process.stdout.write(
    `Verified @boolink-dev/cli@${cliVersion} from public npm through clean install, discovery, configuration, and diagnostics.\n`,
  );
} finally {
  await rm(smokeDirectory, { recursive: true, force: true });
}
