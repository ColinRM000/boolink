import { access, rename, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

import { redactSensitiveText, type IntegrationManifest } from '@boolink-dev/core';
import { bundledRegistry, searchRegistry, type RegistryDocument } from '@boolink-dev/registry';

import {
  planClientConfiguration,
  planClientConfigurationRemoval,
  planClientConfigurationReplacement,
  restoreClientConfiguration,
  writeClientConfiguration,
  type ClientAdapter,
  type ClientConfigurationPlan,
  type ServerLaunch,
} from './adapters.js';
import {
  getManagedInstallPaths,
  installManagedPackage,
  type ManagedPackageInstaller,
} from './installer.js';
import {
  getStatePath,
  readInstallationState,
  writeInstallationState,
  type InstallationState,
  type InstalledIntegration,
} from './state.js';

type Writer = (text: string) => void;

export type CliContext = {
  registry?: RegistryDocument;
  environment?: NodeJS.ProcessEnv;
  boolinkHome?: string;
  userHome?: string;
  currentDirectory?: string;
  now?: () => Date;
  nodeExecutable?: string;
  installPackage?: ManagedPackageInstaller;
  pathExists?: (filePath: string) => Promise<boolean>;
  stdout?: Writer;
  stderr?: Writer;
};

type AddOptions = {
  id: string;
  approve: boolean;
  client?: ClientAdapter;
  output?: string;
};

type LifecycleOptions = {
  id: string;
  approve: boolean;
};

const HELP = `BooLink CLI

Usage:
  boo search [query]
  boo info <integration>
  boo add <integration> [--client codex|custom-json] [--output <path>] [--yes]
  boo remove <integration> [--yes]
  boo repair <integration> [--yes]
  boo upgrade <integration> [--yes]
  boo list
  boo doctor

Writes are previewed by default. Repeat a lifecycle command with --yes to approve it.
Credentials are read from the integration process environment, never CLI arguments.`;

function line(writer: Writer, text = ''): void {
  writer(`${text}\n`);
}

function findIntegration(registry: RegistryDocument, id: string): IntegrationManifest | undefined {
  const normalized = id.toLocaleLowerCase('en-US');
  return registry.integrations.find(
    (integration) =>
      integration.id === normalized || integration.name.toLocaleLowerCase('en-US') === normalized,
  );
}

function requiredEnvironment(manifest: IntegrationManifest): string[] {
  return manifest.authentication.requirements.flatMap(
    (requirement) => requirement.environmentVariables ?? [],
  );
}

function parseAddOptions(args: string[]): AddOptions {
  const id = args[0];
  if (!id || id.startsWith('-')) throw new Error('add requires an integration ID.');

  let approve = false;
  let client: ClientAdapter | undefined;
  let output: string | undefined;

  for (let index = 1; index < args.length; index += 1) {
    const option = args[index];
    if (option === '--yes') {
      approve = true;
      continue;
    }
    if (option === '--client') {
      const value = args[index + 1];
      if (value !== 'codex' && value !== 'custom-json') {
        throw new Error('--client must be codex or custom-json.');
      }
      client = value;
      index += 1;
      continue;
    }
    if (option === '--output') {
      const value = args[index + 1];
      if (!value || value.startsWith('-')) throw new Error('--output requires a file path.');
      output = value;
      index += 1;
      continue;
    }
    throw new Error(`Unknown add option: ${option ?? ''}`);
  }

  if (output && !client) throw new Error('--output requires --client.');
  return {
    id,
    approve,
    ...(client === undefined ? {} : { client }),
    ...(output === undefined ? {} : { output }),
  };
}

function parseLifecycleOptions(command: string, args: string[]): LifecycleOptions {
  const id = args[0];
  if (!id || id.startsWith('-')) throw new Error(`${command} requires an integration ID.`);
  let approve = false;
  for (const option of args.slice(1)) {
    if (option === '--yes') approve = true;
    else throw new Error(`Unknown ${command} option: ${option}`);
  }
  return { id, approve };
}

function resolveOutputPath(
  options: AddOptions,
  currentDirectory: string,
  userHome: string,
): string | undefined {
  if (!options.client) return undefined;
  if (options.output) return path.resolve(currentDirectory, options.output);
  if (options.client === 'codex') return path.join(userHome, '.codex', 'config.toml');
  throw new Error('--output is required for custom-json.');
}

function formatCapabilities(manifest: IntegrationManifest): string {
  return [...new Set(manifest.tools.flatMap((tool) => tool.capabilities))].join(', ');
}

function launchFor(installed: InstalledIntegration): ServerLaunch {
  return {
    id: installed.id,
    command: installed.command,
    args: installed.args,
    requiredEnvironment: installed.requiredEnvironment,
  };
}

async function applyConfigurationPlans(plans: readonly ClientConfigurationPlan[]): Promise<void> {
  for (const plan of plans) await writeClientConfiguration(plan);
}

async function restoreConfigurationPlans(plans: readonly ClientConfigurationPlan[]): Promise<void> {
  for (const plan of [...plans].reverse()) await restoreClientConfiguration(plan);
}

function updatedState(
  state: InstallationState,
  installed: InstalledIntegration,
): InstallationState {
  return {
    schemaVersion: 2,
    integrations: [...state.integrations.filter(({ id }) => id !== installed.id), installed].sort(
      (left, right) => left.id.localeCompare(right.id),
    ),
  };
}

export async function runCli(args: readonly string[], context: CliContext = {}): Promise<number> {
  const stdout = context.stdout ?? ((text) => process.stdout.write(text));
  const stderr = context.stderr ?? ((text) => process.stderr.write(text));
  const registry = context.registry ?? bundledRegistry;
  const environment = context.environment ?? process.env;
  const userHome = context.userHome ?? os.homedir();
  const currentDirectory = context.currentDirectory ?? process.cwd();
  const boolinkHome =
    context.boolinkHome ?? environment.BOOLINK_HOME ?? path.join(userHome, '.boolink');
  const statePath = getStatePath(boolinkHome);
  const now = context.now ?? (() => new Date());
  const nodeExecutable = context.nodeExecutable ?? process.execPath;
  const installPackage = context.installPackage ?? installManagedPackage;
  const pathExists =
    context.pathExists ??
    (async (filePath: string) => {
      try {
        await access(filePath);
        return true;
      } catch {
        return false;
      }
    });

  try {
    const [command = 'help', ...commandArgs] = args;

    if (command === 'help' || command === '--help' || command === '-h') {
      line(stdout, HELP);
      return 0;
    }

    if (command === 'search') {
      const matches = searchRegistry(registry, commandArgs.join(' '));
      if (matches.length === 0) {
        line(stdout, 'No integrations matched.');
        return 0;
      }
      for (const integration of matches) {
        line(
          stdout,
          `${integration.id.padEnd(12)} ${integration.verification.padEnd(12)} ${integration.tools.length} tools  ${integration.description}`,
        );
      }
      return 0;
    }

    if (command === 'info') {
      const id = commandArgs[0];
      if (!id) throw new Error('info requires an integration ID.');
      const integration = findIntegration(registry, id);
      if (!integration) throw new Error(`Integration not found: ${id}`);
      line(stdout, `${integration.name} (${integration.id}) v${integration.version}`);
      line(stdout, `${integration.verification} · ${integration.transports.join(', ')}`);
      line(stdout, integration.description);
      line(stdout, `Authentication: ${integration.authentication.type}`);
      line(
        stdout,
        `Required environment: ${requiredEnvironment(integration).join(', ') || 'none'}`,
      );
      line(stdout, `Capabilities: ${formatCapabilities(integration)}`);
      line(stdout, 'Tools:');
      for (const tool of integration.tools) {
        line(
          stdout,
          `  ${tool.name} [${tool.capabilities.join(', ')}${tool.destructive ? ', destructive' : ''}]`,
        );
      }
      return 0;
    }

    if (command === 'add') {
      const options = parseAddOptions(commandArgs);
      const integration = findIntegration(registry, options.id);
      if (!integration) throw new Error(`Integration not found: ${options.id}`);
      const state = await readInstallationState(statePath);
      if (state.integrations.some((installed) => installed.id === integration.id)) {
        throw new Error(
          `${integration.name} is already installed. Run boo repair ${integration.id} if needed.`,
        );
      }

      const managed = getManagedInstallPaths(boolinkHome, integration.id, integration.version);
      const launch: ServerLaunch = {
        id: integration.id,
        command: nodeExecutable,
        args: [managed.launcherPath],
        requiredEnvironment: requiredEnvironment(integration),
      };
      const outputPath = resolveOutputPath(options, currentDirectory, userHome);
      const configuration =
        options.client && outputPath
          ? await planClientConfiguration(options.client, outputPath, launch)
          : undefined;

      line(stdout, `Install ${integration.name} v${integration.version}`);
      line(stdout, `Package: ${integration.packageName}@${integration.version}`);
      line(stdout, `Install directory: ${managed.versionDirectory}`);
      line(stdout, `State file: ${statePath}`);
      line(stdout, `Server: ${launch.command} ${launch.args.join(' ')}`);
      line(stdout, `Credential names: ${launch.requiredEnvironment.join(', ') || 'none'}`);
      if (configuration) {
        line(
          stdout,
          `Client configuration: ${configuration.adapter} → ${configuration.outputPath}`,
        );
      }
      if (!options.approve) {
        line(stdout, 'Preview only. No files were changed. Repeat with --yes to approve.');
        return 0;
      }

      const result = await installPackage({
        boolinkHome,
        integrationId: integration.id,
        packageName: integration.packageName,
        version: integration.version,
        nodeExecutable,
        environment,
        credentialEnvironment: launch.requiredEnvironment,
      });
      const plans = configuration ? [configuration] : [];
      try {
        await applyConfigurationPlans(plans);
        const installed: InstalledIntegration = {
          id: integration.id,
          packageName: integration.packageName,
          version: integration.version,
          installedAt: now().toISOString(),
          command: launch.command,
          args: [result.launcherPath],
          requiredEnvironment: launch.requiredEnvironment,
          clientConfigurations: configuration
            ? [{ adapter: configuration.adapter, path: configuration.outputPath }]
            : [],
          installationDirectory: result.installationDirectory,
        };
        await writeInstallationState(statePath, updatedState(state, installed));
        await result.commit?.();
      } catch (error) {
        await restoreConfigurationPlans(plans);
        if (result.rollback) await result.rollback();
        else await rm(result.installationDirectory, { recursive: true, force: true });
        throw error;
      }
      line(stdout, `${integration.name} installed locally.`);
      return 0;
    }

    if (command === 'remove') {
      const options = parseLifecycleOptions(command, commandArgs);
      const state = await readInstallationState(statePath);
      const installed = state.integrations.find(({ id }) => id === options.id);
      if (!installed) throw new Error(`Integration is not installed: ${options.id}`);
      const launch = launchFor(installed);
      const plans = await Promise.all(
        installed.clientConfigurations.map((client) =>
          planClientConfigurationRemoval(client.adapter, client.path, launch),
        ),
      );
      line(stdout, `Remove ${installed.id} v${installed.version}`);
      for (const plan of plans)
        line(stdout, `Client configuration: remove from ${plan.outputPath}`);
      if (installed.installationDirectory) {
        line(stdout, `Install directory: ${installed.installationDirectory}`);
      } else {
        line(stdout, 'Legacy installation: no managed package directory will be deleted.');
      }
      if (!options.approve) {
        line(stdout, 'Preview only. No files were changed. Repeat with --yes to approve.');
        return 0;
      }

      let quarantine: string | undefined;
      if (installed.installationDirectory) {
        const expected = getManagedInstallPaths(boolinkHome, installed.id, installed.version);
        if (path.resolve(installed.installationDirectory) !== expected.installationDirectory) {
          throw new Error('Recorded installation directory is outside the expected BooLink path.');
        }
        quarantine = `${expected.installationDirectory}.removed-${randomUUID()}`;
        await rename(expected.installationDirectory, quarantine);
      }
      try {
        await applyConfigurationPlans(plans);
        await writeInstallationState(statePath, {
          schemaVersion: 2,
          integrations: state.integrations.filter(({ id }) => id !== installed.id),
        });
      } catch (error) {
        await restoreConfigurationPlans(plans);
        if (quarantine) await rename(quarantine, installed.installationDirectory!);
        throw error;
      }
      if (quarantine) await rm(quarantine, { recursive: true, force: true });
      line(stdout, `${installed.id} removed.`);
      return 0;
    }

    if (command === 'repair' || command === 'upgrade') {
      const options = parseLifecycleOptions(command, commandArgs);
      const state = await readInstallationState(statePath);
      const previous = state.integrations.find(({ id }) => id === options.id);
      if (!previous) throw new Error(`Integration is not installed: ${options.id}`);
      const catalog = findIntegration(registry, options.id);
      if (!catalog)
        throw new Error(`Integration is no longer present in the catalog: ${options.id}`);
      const version = command === 'upgrade' ? catalog.version : previous.version;
      const packageName = command === 'upgrade' ? catalog.packageName : previous.packageName;
      if (command === 'upgrade' && version === previous.version && previous.installationDirectory) {
        line(stdout, `${previous.id} is already current at v${previous.version}.`);
        return 0;
      }
      const managed = getManagedInstallPaths(boolinkHome, previous.id, version);
      const required =
        command === 'upgrade' ? requiredEnvironment(catalog) : previous.requiredEnvironment;
      const nextLaunch: ServerLaunch = {
        id: previous.id,
        command: nodeExecutable,
        args: [managed.launcherPath],
        requiredEnvironment: required,
      };
      const plans = await Promise.all(
        previous.clientConfigurations.map((client) =>
          planClientConfigurationReplacement(
            client.adapter,
            client.path,
            launchFor(previous),
            nextLaunch,
          ),
        ),
      );
      line(stdout, `${command === 'repair' ? 'Repair' : 'Upgrade'} ${previous.id} v${version}`);
      line(stdout, `Package: ${packageName}@${version}`);
      line(stdout, `Install directory: ${managed.versionDirectory}`);
      for (const plan of plans) line(stdout, `Client configuration: update ${plan.outputPath}`);
      if (!options.approve) {
        line(stdout, 'Preview only. No files were changed. Repeat with --yes to approve.');
        return 0;
      }

      const result = await installPackage({
        boolinkHome,
        integrationId: previous.id,
        packageName,
        version,
        nodeExecutable,
        environment,
        credentialEnvironment: required,
      });
      try {
        await applyConfigurationPlans(plans);
        const repaired: InstalledIntegration = {
          ...previous,
          packageName,
          version,
          installedAt: now().toISOString(),
          command: nodeExecutable,
          args: [result.launcherPath],
          requiredEnvironment: required,
          installationDirectory: result.installationDirectory,
        };
        await writeInstallationState(statePath, updatedState(state, repaired));
        await result.commit?.();
      } catch (error) {
        await restoreConfigurationPlans(plans);
        await result.rollback?.();
        throw error;
      }
      if (command === 'upgrade' && previous.installationDirectory && previous.version !== version) {
        const previousPath = getManagedInstallPaths(boolinkHome, previous.id, previous.version);
        await rm(previousPath.versionDirectory, { recursive: true, force: true });
      }
      line(
        stdout,
        `${previous.id} ${command === 'repair' ? 'repaired' : `upgraded to v${version}`}.`,
      );
      return 0;
    }

    if (command === 'list') {
      const state = await readInstallationState(statePath);
      if (state.integrations.length === 0) {
        line(stdout, 'No BooLink integrations are installed.');
        return 0;
      }
      for (const integration of state.integrations) {
        line(
          stdout,
          `${integration.id.padEnd(12)} v${integration.version}  ${integration.installationDirectory ? 'managed' : 'legacy'}`,
        );
      }
      return 0;
    }

    if (command === 'doctor') {
      const state = await readInstallationState(statePath);
      const nodeMajor = Number(process.versions.node.split('.')[0]);
      let failures = 0;
      line(stdout, `${nodeMajor >= 22 ? 'PASS' : 'FAIL'} Node.js ${process.versions.node}`);
      if (nodeMajor < 22) failures += 1;
      line(
        stdout,
        `PASS Installation state v${state.schemaVersion} (${state.integrations.length} installed)`,
      );

      for (const integration of state.integrations) {
        if (!integration.installationDirectory) {
          line(
            stdout,
            `FAIL ${integration.id} legacy package path (run boo repair ${integration.id} --yes)`,
          );
          failures += 1;
        }
        const serverExists = await pathExists(integration.args[0] ?? '');
        line(stdout, `${serverExists ? 'PASS' : 'FAIL'} ${integration.id} server launcher`);
        if (!serverExists) failures += 1;
        for (const variable of integration.requiredEnvironment) {
          const configured = Boolean(environment[variable]);
          line(stdout, `${configured ? 'PASS' : 'WARN'} ${integration.id} credential ${variable}`);
        }
        for (const client of integration.clientConfigurations) {
          const configured = await pathExists(client.path);
          line(stdout, `${configured ? 'PASS' : 'FAIL'} ${client.adapter} configuration`);
          if (!configured) failures += 1;
        }
        const catalog = findIntegration(registry, integration.id);
        if (catalog && catalog.version !== integration.version) {
          line(stdout, `WARN ${integration.id} update available: v${catalog.version}`);
        }
      }

      line(
        stdout,
        failures === 0
          ? 'BooLink doctor found no blocking problems.'
          : `${failures} blocking problem(s) found.`,
      );
      return failures === 0 ? 0 : 1;
    }

    throw new Error(`Unknown command: ${command}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown CLI failure.';
    line(stderr, `BooLink error: ${redactSensitiveText(message)}`);
    return 1;
  }
}
