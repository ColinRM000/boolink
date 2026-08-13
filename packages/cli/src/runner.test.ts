import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { getManagedInstallPaths, type ManagedPackageInstaller } from './installer.js';
import { runCli, type CliContext } from './runner.js';

type Harness = {
  context: CliContext;
  directory: string;
  stdout: string[];
  stderr: string[];
};

async function fakeInstall(request: Parameters<ManagedPackageInstaller>[0]) {
  const paths = getManagedInstallPaths(request.boolinkHome, request.integrationId, request.version);
  await mkdir(paths.versionDirectory, { recursive: true });
  await writeFile(paths.launcherPath, '// managed test launcher\n', 'utf8');
  return paths;
}

async function harness(environment: NodeJS.ProcessEnv = {}): Promise<Harness> {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'boolink-cli-'));
  const stdout: string[] = [];
  const stderr: string[] = [];

  return {
    directory,
    stdout,
    stderr,
    context: {
      environment,
      userHome: directory,
      boolinkHome: path.join(directory, '.boolink'),
      currentDirectory: directory,
      nodeExecutable: 'node',
      now: () => new Date('2026-08-12T12:00:00.000Z'),
      installPackage: fakeInstall,
      stdout: (text) => stdout.push(text),
      stderr: (text) => stderr.push(text),
    },
  };
}

describe('BooLink CLI', () => {
  it('searches and inspects the bundled GitHub catalog entry', async () => {
    const test = await harness();
    expect(await runCli(['search', 'github'], test.context)).toBe(0);
    expect(test.stdout.join('')).toContain('github');
    expect(test.stdout.join('')).toContain('10 tools');

    test.stdout.length = 0;
    expect(await runCli(['info', 'github'], test.context)).toBe(0);
    expect(test.stdout.join('')).toContain('github.get_issue [read]');
    expect(test.stdout.join('')).toContain('github.create_issue [create, communication]');
    expect(test.stdout.join('')).toContain('Required environment: GITHUB_TOKEN');
  });

  it('previews an add without downloading or writing any files', async () => {
    const test = await harness({ GITHUB_TOKEN: 'github_pat_preview_secret' });
    let installs = 0;
    test.context.installPackage = async (request) => {
      installs += 1;
      return fakeInstall(request);
    };
    const output = path.join(test.directory, 'codex.toml');
    expect(
      await runCli(['add', 'github', '--client', 'codex', '--output', output], test.context),
    ).toBe(0);
    expect(test.stdout.join('')).toContain('Preview only. No files were changed.');
    expect(installs).toBe(0);
    await expect(readFile(output, 'utf8')).rejects.toMatchObject({ code: 'ENOENT' });
    await expect(
      readFile(path.join(test.directory, '.boolink', 'installations.json'), 'utf8'),
    ).rejects.toMatchObject({ code: 'ENOENT' });
    expect(test.stdout.join('')).not.toContain('github_pat_preview_secret');
  });

  it('installs into a durable managed home only after explicit approval', async () => {
    const secret = 'github_pat_never_store_this';
    const test = await harness({ GITHUB_TOKEN: secret });
    const codexConfig = path.join(test.directory, '.codex', 'config.toml');
    await mkdir(path.dirname(codexConfig), { recursive: true });
    await writeFile(codexConfig, 'model = "gpt-5"\n', 'utf8');

    expect(
      await runCli(
        ['add', 'github', '--client', 'codex', '--output', codexConfig, '--yes'],
        test.context,
      ),
    ).toBe(0);

    const configuration = await readFile(codexConfig, 'utf8');
    const state = await readFile(
      path.join(test.directory, '.boolink', 'installations.json'),
      'utf8',
    );
    expect(configuration).toContain('model = "gpt-5"');
    expect(configuration).toContain('[mcp_servers.boolink_github]');
    expect(configuration).toContain('env_vars = ["GITHUB_TOKEN"]');
    expect(configuration).toContain(
      JSON.stringify(
        path.join(test.directory, '.boolink', 'integrations', 'github', 'server.mjs'),
      ).slice(1, -1),
    );
    expect(state).toContain('"schemaVersion": 2');
    expect(state).toContain('"installationDirectory"');
    expect(`${configuration}${state}`).not.toContain(secret);

    test.stdout.length = 0;
    expect(await runCli(['list'], test.context)).toBe(0);
    expect(test.stdout.join('')).toContain('managed');

    test.stdout.length = 0;
    expect(await runCli(['doctor'], test.context)).toBe(0);
    expect(test.stdout.join('')).toContain('PASS github credential GITHUB_TOKEN');
    expect(test.stdout.join('')).toContain('no blocking problems');
  });

  it('previews and safely removes only its managed client block and package', async () => {
    const test = await harness();
    const codexConfig = path.join(test.directory, '.codex', 'config.toml');
    await mkdir(path.dirname(codexConfig), { recursive: true });
    await writeFile(codexConfig, 'model = "gpt-5"\n', 'utf8');
    await runCli(
      ['add', 'github', '--client', 'codex', '--output', codexConfig, '--yes'],
      test.context,
    );
    const before = await readFile(codexConfig, 'utf8');

    test.stdout.length = 0;
    expect(await runCli(['remove', 'github'], test.context)).toBe(0);
    expect(await readFile(codexConfig, 'utf8')).toBe(before);
    expect(test.stdout.join('')).toContain('Preview only');

    test.stdout.length = 0;
    expect(await runCli(['remove', 'github', '--yes'], test.context)).toBe(0);
    expect(await readFile(codexConfig, 'utf8')).toBe('model = "gpt-5"\n');
    const state = await readFile(
      path.join(test.directory, '.boolink', 'installations.json'),
      'utf8',
    );
    expect(state).not.toContain('"id": "github"');
    await expect(
      readFile(path.join(test.directory, '.boolink', 'integrations', 'github', 'server.mjs')),
    ).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('refuses removal when the managed client block was edited', async () => {
    const test = await harness();
    const codexConfig = path.join(test.directory, 'codex.toml');
    await runCli(
      ['add', 'github', '--client', 'codex', '--output', codexConfig, '--yes'],
      test.context,
    );
    const changed = (await readFile(codexConfig, 'utf8')).replace(
      'default_tools_approval_mode = "writes"',
      'default_tools_approval_mode = "untrusted"',
    );
    await writeFile(codexConfig, changed, 'utf8');

    expect(await runCli(['remove', 'github', '--yes'], test.context)).toBe(1);
    expect(test.stderr.join('')).toContain('cannot be updated safely');
    expect(await readFile(codexConfig, 'utf8')).toBe(changed);
    expect(
      await readFile(
        path.join(test.directory, '.boolink', 'integrations', 'github', 'server.mjs'),
        'utf8',
      ),
    ).toContain('managed test launcher');
  });

  it('repairs a legacy v1 installation and updates its exact managed block', async () => {
    const test = await harness();
    const statePath = path.join(test.directory, '.boolink', 'installations.json');
    const configPath = path.join(test.directory, 'codex.toml');
    await mkdir(path.dirname(statePath), { recursive: true });
    const legacyServer = path.join(test.directory, 'npm-cache', 'server.js');
    const legacyBlock = [
      '# BooLink managed integration: github',
      '[mcp_servers.boolink_github]',
      'command = "node"',
      `args = [${JSON.stringify(legacyServer)}]`,
      'env_vars = ["GITHUB_TOKEN"]',
      'default_tools_approval_mode = "writes"',
      '',
    ].join('\n');
    await writeFile(configPath, legacyBlock, 'utf8');
    await writeFile(
      statePath,
      `${JSON.stringify({
        schemaVersion: 1,
        integrations: [
          {
            id: 'github',
            packageName: '@boolink-dev/github',
            version: '0.1.0',
            installedAt: '2026-08-12T10:00:00.000Z',
            command: 'node',
            args: [legacyServer],
            requiredEnvironment: ['GITHUB_TOKEN'],
            clientConfigurations: [{ adapter: 'codex', path: configPath }],
          },
        ],
      })}\n`,
      'utf8',
    );

    expect(await runCli(['doctor'], test.context)).toBe(1);
    expect(test.stdout.join('')).toContain('legacy package path');
    test.stdout.length = 0;
    expect(await runCli(['repair', 'github', '--yes'], test.context)).toBe(0);
    expect(await readFile(configPath, 'utf8')).toContain(
      JSON.stringify(
        path.join(test.directory, '.boolink', 'integrations', 'github', 'server.mjs'),
      ).slice(1, -1),
    );
    expect(await readFile(statePath, 'utf8')).toContain('"schemaVersion": 2');
  });

  it('generates and removes a neutral client document without credential values', async () => {
    const test = await harness();
    const output = path.join(test.directory, 'client', 'github.json');
    expect(
      await runCli(
        ['add', 'github', '--client', 'custom-json', '--output', output, '--yes'],
        test.context,
      ),
    ).toBe(0);
    const configuration = await readFile(output, 'utf8');
    expect(configuration).toContain('"GITHUB_TOKEN"');
    test.stdout.length = 0;
    expect(await runCli(['doctor'], test.context)).toBe(0);
    expect(test.stdout.join('')).toContain('WARN github credential GITHUB_TOKEN');
    expect(await runCli(['remove', 'github', '--yes'], test.context)).toBe(0);
    await expect(readFile(output, 'utf8')).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('redacts a provider-style secret from installer failures', async () => {
    const test = await harness();
    test.context.installPackage = async () => {
      throw new Error('failed with github_pat_accidental_secret');
    };
    expect(await runCli(['add', 'github', '--yes'], test.context)).toBe(1);
    expect(test.stderr.join('')).toContain('[REDACTED]');
    expect(test.stderr.join('')).not.toContain('github_pat_accidental_secret');
  });
});
