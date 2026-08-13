import { mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { getManagedInstallPaths, installManagedPackage } from './installer.js';

async function fakeNpm(directory: string, fail = false): Promise<string> {
  const script = path.join(directory, fail ? 'fake-npm-fail.mjs' : 'fake-npm.mjs');
  const body = fail
    ? 'process.exit(7);\n'
    : `
      import { mkdir, readFile, writeFile } from 'node:fs/promises';
      import path from 'node:path';
      if (process.env.GITHUB_TOKEN) process.exit(9);
      const root = JSON.parse(await readFile(path.join(process.cwd(), 'package.json'), 'utf8'));
      const [name, version] = Object.entries(root.dependencies)[0];
      const packageDirectory = path.join(process.cwd(), 'node_modules', ...name.split('/'));
      await mkdir(path.join(packageDirectory, 'dist'), { recursive: true });
      await writeFile(path.join(packageDirectory, 'package.json'), JSON.stringify({
        name,
        version,
        exports: { './server': './dist/server.js' }
      }));
      await writeFile(path.join(packageDirectory, 'dist', 'server.js'), '// server');
    `;
  await writeFile(script, body, 'utf8');
  return script;
}

describe('managed package installer', () => {
  it('installs an exact package into a versioned directory and writes a stable launcher', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'boolink-installer-'));
    const boolinkHome = path.join(directory, '.boolink');
    const npmCli = await fakeNpm(directory);
    const result = await installManagedPackage({
      boolinkHome,
      integrationId: 'github',
      packageName: '@boolink-dev/github',
      version: '0.1.0',
      nodeExecutable: process.execPath,
      environment: { ...process.env, npm_execpath: npmCli, GITHUB_TOKEN: 'must_not_be_inherited' },
      credentialEnvironment: ['GITHUB_TOKEN'],
    });

    const managedPackage = JSON.parse(
      await readFile(path.join(result.versionDirectory, 'package.json'), 'utf8'),
    ) as { dependencies: Record<string, string> };
    expect(managedPackage.dependencies).toEqual({ '@boolink-dev/github': '0.1.0' });
    expect(await readFile(result.launcherPath, 'utf8')).toContain(
      './0.1.0/node_modules/@boolink-dev/github/dist/server.js',
    );
    await result.commit?.();
  });

  it('cleans staging data when npm fails and never creates a launcher', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'boolink-installer-fail-'));
    const boolinkHome = path.join(directory, '.boolink');
    const npmCli = await fakeNpm(directory, true);
    await expect(
      installManagedPackage({
        boolinkHome,
        integrationId: 'github',
        packageName: '@boolink-dev/github',
        version: '0.1.0',
        nodeExecutable: process.execPath,
        environment: { ...process.env, npm_execpath: npmCli },
        credentialEnvironment: ['GITHUB_TOKEN'],
      }),
    ).rejects.toThrow('exit code 7');
    const paths = getManagedInstallPaths(boolinkHome, 'github', '0.1.0');
    await expect(readFile(paths.launcherPath, 'utf8')).rejects.toMatchObject({ code: 'ENOENT' });
    expect(await readdir(paths.installationDirectory)).toEqual([]);
  });

  it('rejects path traversal in registry-controlled directory segments', () => {
    expect(() => getManagedInstallPaths('C:\\safe', '../github', '0.1.0')).toThrow(/Unsafe/u);
    expect(() => getManagedInstallPaths('C:\\safe', 'github', '../0.1.0')).toThrow(/Unsafe/u);
  });
});
