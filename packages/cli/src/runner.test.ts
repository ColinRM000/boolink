import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { runCli, type CliContext } from './runner.js';

type Harness = {
  context: CliContext;
  directory: string;
  stdout: string[];
  stderr: string[];
};

async function harness(environment: NodeJS.ProcessEnv = {}): Promise<Harness> {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'boolink-cli-'));
  const server = path.join(directory, 'github-server.js');
  await writeFile(server, '// test server\n', 'utf8');
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
      resolveServer: async () => server,
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
    expect(test.stdout.join('')).toContain('4 tools');

    test.stdout.length = 0;
    expect(await runCli(['info', 'github'], test.context)).toBe(0);
    expect(test.stdout.join('')).toContain('github.get_issue [read]');
    expect(test.stdout.join('')).toContain('Required environment: GITHUB_TOKEN');
  });

  it('previews an add without writing any files', async () => {
    const test = await harness({ GITHUB_TOKEN: 'github_pat_preview_secret' });
    const output = path.join(test.directory, 'codex.toml');
    expect(
      await runCli(['add', 'github', '--client', 'codex', '--output', output], test.context),
    ).toBe(0);
    expect(test.stdout.join('')).toContain('Preview only. No files were changed.');
    await expect(readFile(output, 'utf8')).rejects.toMatchObject({ code: 'ENOENT' });
    await expect(
      readFile(path.join(test.directory, '.boolink', 'installations.json'), 'utf8'),
    ).rejects.toMatchObject({ code: 'ENOENT' });
    expect(test.stdout.join('')).not.toContain('github_pat_preview_secret');
  });

  it('installs into an isolated home only after explicit approval', async () => {
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
    expect(state).toContain('"id": "github"');
    expect(`${configuration}${state}`).not.toContain(secret);

    test.stdout.length = 0;
    expect(await runCli(['list'], test.context)).toBe(0);
    expect(test.stdout.join('')).toContain('github');

    test.stdout.length = 0;
    expect(await runCli(['doctor'], test.context)).toBe(0);
    expect(test.stdout.join('')).toContain('PASS github credential GITHUB_TOKEN');
    expect(test.stdout.join('')).toContain('no blocking problems');
  });

  it('generates a neutral client document and reports missing credentials without revealing data', async () => {
    const test = await harness();
    const output = path.join(test.directory, 'client', 'github.json');
    expect(
      await runCli(
        ['add', 'github', '--client', 'custom-json', '--output', output, '--yes'],
        test.context,
      ),
    ).toBe(0);
    const configuration = await readFile(output, 'utf8');
    expect(configuration).toContain('"requiredEnvironment": [');
    expect(configuration).toContain('"GITHUB_TOKEN"');

    test.stdout.length = 0;
    expect(await runCli(['doctor'], test.context)).toBe(0);
    expect(test.stdout.join('')).toContain('WARN github credential GITHUB_TOKEN');
  });

  it('redacts a provider-style secret from failures', async () => {
    const test = await harness();
    test.context.resolveServer = async () => {
      throw new Error('failed with github_pat_accidental_secret');
    };
    expect(await runCli(['add', 'github'], test.context)).toBe(1);
    expect(test.stderr.join('')).toContain('[REDACTED]');
    expect(test.stderr.join('')).not.toContain('github_pat_accidental_secret');
  });
});
