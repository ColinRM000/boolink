import { spawn } from 'node:child_process';
import { access, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

export type ManagedInstallRequest = {
  boolinkHome: string;
  integrationId: string;
  packageName: string;
  version: string;
  nodeExecutable: string;
  environment: NodeJS.ProcessEnv;
  credentialEnvironment: string[];
  /** Local release artifact used by verification; normal CLI installs always use `version`. */
  packageSpec?: string;
};

export type ManagedInstallResult = {
  installationDirectory: string;
  versionDirectory: string;
  launcherPath: string;
  commit?: () => Promise<void>;
  rollback?: () => Promise<void>;
};

export type ManagedPackageInstaller = (
  request: ManagedInstallRequest,
) => Promise<ManagedInstallResult>;

function assertSafeSegment(value: string, label: string): void {
  if (!/^[a-z0-9][a-z0-9._+-]*$/u.test(value)) {
    throw new Error(`Unsafe ${label} in integration metadata.`);
  }
}

export function getManagedInstallPaths(
  boolinkHome: string,
  integrationId: string,
  version: string,
): ManagedInstallResult {
  assertSafeSegment(integrationId, 'integration ID');
  assertSafeSegment(version, 'version');
  const integrationsDirectory = path.resolve(boolinkHome, 'integrations');
  const installationDirectory = path.resolve(integrationsDirectory, integrationId);
  if (!installationDirectory.startsWith(`${integrationsDirectory}${path.sep}`)) {
    throw new Error('Integration directory escaped the BooLink installation root.');
  }
  return {
    installationDirectory,
    versionDirectory: path.join(installationDirectory, version),
    launcherPath: path.join(installationDirectory, 'server.mjs'),
  };
}

function packageDirectory(versionDirectory: string, packageName: string): string {
  const segments = packageName.split('/');
  if (
    segments.length < 1 ||
    segments.length > 2 ||
    segments.some((segment) => !/^@?[a-z0-9][a-z0-9._-]*$/u.test(segment))
  ) {
    throw new Error('Unsafe package name in integration metadata.');
  }
  return path.join(versionDirectory, 'node_modules', ...segments);
}

function serverExportPath(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object') {
    const conditions = value as Record<string, unknown>;
    for (const condition of ['import', 'node', 'default']) {
      if (typeof conditions[condition] === 'string') return conditions[condition];
    }
  }
  return undefined;
}

async function resolveInstalledServer(
  versionDirectory: string,
  packageName: string,
  expectedVersion: string,
): Promise<string> {
  const directory = packageDirectory(versionDirectory, packageName);
  const packageJsonPath = path.join(directory, 'package.json');
  const parsed = JSON.parse(await readFile(packageJsonPath, 'utf8')) as {
    name?: unknown;
    version?: unknown;
    exports?: unknown;
  };
  if (parsed.name !== packageName || parsed.version !== expectedVersion) {
    throw new Error('npm installed package metadata that did not match the requested integration.');
  }

  const exports = parsed.exports as Record<string, unknown> | undefined;
  const entry = serverExportPath(exports?.['./server']);
  if (!entry || !entry.startsWith('./') || entry.includes('..')) {
    throw new Error('The integration package does not expose a safe ./server entry point.');
  }
  const serverPath = path.resolve(directory, entry);
  if (!serverPath.startsWith(`${directory}${path.sep}`)) {
    throw new Error('The integration server entry point escaped its package directory.');
  }
  await access(serverPath);
  return serverPath;
}

export async function locateNpmCli(
  nodeExecutable: string,
  environment: NodeJS.ProcessEnv,
): Promise<string> {
  const candidates = [
    environment.npm_execpath,
    path.join(path.dirname(nodeExecutable), 'node_modules', 'npm', 'bin', 'npm-cli.js'),
    path.join(
      path.dirname(nodeExecutable),
      '..',
      'lib',
      'node_modules',
      'npm',
      'bin',
      'npm-cli.js',
    ),
  ].filter((candidate): candidate is string => Boolean(candidate));

  for (const candidate of candidates) {
    try {
      const absolute = path.resolve(candidate);
      await access(absolute);
      return absolute;
    } catch {
      // Try the next known npm CLI location.
    }
  }
  throw new Error(
    'Unable to locate npm. Run BooLink through npm/npx or reinstall Node.js with npm.',
  );
}

async function runNpmInstall(
  directory: string,
  nodeExecutable: string,
  environment: NodeJS.ProcessEnv,
  credentialEnvironment: readonly string[],
): Promise<void> {
  const npmCli = await locateNpmCli(nodeExecutable, environment);
  const npmEnvironment = { ...environment };
  for (const variable of credentialEnvironment) delete npmEnvironment[variable];
  await new Promise<void>((resolve, reject) => {
    const child = spawn(
      nodeExecutable,
      [
        npmCli,
        'install',
        '--ignore-scripts',
        '--no-audit',
        '--no-fund',
        '--omit=dev',
        '--package-lock=false',
      ],
      {
        cwd: directory,
        env: npmEnvironment,
        stdio: ['ignore', 'ignore', 'ignore'],
        windowsHide: true,
      },
    );
    child.once('error', () => reject(new Error('npm could not be started.')));
    child.once('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`npm installation failed with exit code ${code ?? 'unknown'}.`));
    });
  });
}

async function writeLauncher(launcherPath: string, serverPath: string): Promise<void> {
  let relative = path.relative(path.dirname(launcherPath), serverPath).replaceAll(path.sep, '/');
  if (!relative.startsWith('.')) relative = `./${relative}`;
  const temporary = `${launcherPath}.${randomUUID()}.tmp`;
  await writeFile(
    temporary,
    `// Generated by BooLink. Do not add credentials here.\nimport ${JSON.stringify(relative)};\n`,
    { encoding: 'utf8', mode: 0o600 },
  );
  await rename(temporary, launcherPath);
}

export const installManagedPackage: ManagedPackageInstaller = async (
  request,
): Promise<ManagedInstallResult> => {
  const paths = getManagedInstallPaths(request.boolinkHome, request.integrationId, request.version);
  await mkdir(paths.installationDirectory, { recursive: true });
  const staging = path.join(paths.installationDirectory, `.staging-${randomUUID()}`);
  const backup = path.join(paths.installationDirectory, `.backup-${randomUUID()}`);
  const launcherBackup = path.join(paths.installationDirectory, `.launcher-backup-${randomUUID()}`);
  let movedExisting = false;
  let promoted = false;
  let movedLauncher = false;
  const installEnvironment = { ...request.environment };
  if (installEnvironment.npm_execpath) {
    installEnvironment.npm_execpath = path.resolve(installEnvironment.npm_execpath);
  }

  try {
    await mkdir(staging, { recursive: true });
    await writeFile(
      path.join(staging, 'package.json'),
      `${JSON.stringify(
        {
          name: `boolink-managed-${request.integrationId}`,
          private: true,
          version: '0.0.0',
          dependencies: { [request.packageName]: request.packageSpec ?? request.version },
        },
        null,
        2,
      )}\n`,
      { encoding: 'utf8', mode: 0o600 },
    );
    await runNpmInstall(
      staging,
      request.nodeExecutable,
      installEnvironment,
      request.credentialEnvironment,
    );
    const stagedServer = await resolveInstalledServer(
      staging,
      request.packageName,
      request.version,
    );

    try {
      await rename(paths.versionDirectory, backup);
      movedExisting = true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }

    await rename(staging, paths.versionDirectory);
    promoted = true;
    const installedServer = path.join(paths.versionDirectory, path.relative(staging, stagedServer));
    try {
      await rename(paths.launcherPath, launcherBackup);
      movedLauncher = true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
    await writeLauncher(paths.launcherPath, installedServer);
    let settled = false;
    return {
      ...paths,
      commit: async () => {
        if (settled) return;
        settled = true;
        if (movedExisting) await rm(backup, { recursive: true, force: true });
        if (movedLauncher) await rm(launcherBackup, { force: true });
      },
      rollback: async () => {
        if (settled) return;
        settled = true;
        await rm(paths.launcherPath, { force: true });
        if (movedLauncher) await rename(launcherBackup, paths.launcherPath);
        await rm(paths.versionDirectory, { recursive: true, force: true });
        if (movedExisting) await rename(backup, paths.versionDirectory);
      },
    };
  } catch (error) {
    await rm(staging, { recursive: true, force: true });
    await rm(paths.launcherPath, { force: true });
    if (movedLauncher) await rename(launcherBackup, paths.launcherPath);
    if (movedExisting) {
      await rm(paths.versionDirectory, { recursive: true, force: true });
      await rename(backup, paths.versionDirectory);
    } else if (promoted) {
      await rm(paths.versionDirectory, { recursive: true, force: true });
    }
    throw error;
  }
};
