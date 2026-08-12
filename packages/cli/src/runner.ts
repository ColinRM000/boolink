import { access } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { redactSensitiveText, type IntegrationManifest } from '@boolink/core';
import { bundledRegistry, searchRegistry, type RegistryDocument } from '@boolink/registry';

import {
  planClientConfiguration,
  writeClientConfiguration,
  type ClientAdapter,
  type ServerLaunch,
} from './adapters.js';
import {
  getStatePath,
  readInstallationState,
  writeInstallationState,
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
  resolveServer?: (integrationId: string) => Promise<string>;
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

const HELP = `BooLink CLI

Usage:
  boo search [query]
  boo info <integration>
  boo add <integration> [--client codex|custom-json] [--output <path>] [--yes]
  boo list
  boo doctor

Writes are previewed by default. Repeat an add command with --yes to approve it.
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

async function defaultServerResolver(integrationId: string): Promise<string> {
  if (integrationId !== 'github') throw new Error('No local server package is available.');
  return fileURLToPath(import.meta.resolve('@boolink/github/server'));
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
  const resolveServer = context.resolveServer ?? defaultServerResolver;
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
        throw new Error(`${integration.name} is already installed.`);
      }

      const launch: ServerLaunch = {
        id: integration.id,
        command: nodeExecutable,
        args: [await resolveServer(integration.id)],
        requiredEnvironment: requiredEnvironment(integration),
      };
      const outputPath = resolveOutputPath(options, currentDirectory, userHome);
      const configuration =
        options.client && outputPath
          ? await planClientConfiguration(options.client, outputPath, launch)
          : undefined;

      line(stdout, `Install ${integration.name} v${integration.version}`);
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

      if (configuration) await writeClientConfiguration(configuration);
      const installed: InstalledIntegration = {
        id: integration.id,
        packageName: integration.packageName,
        version: integration.version,
        installedAt: now().toISOString(),
        command: launch.command,
        args: launch.args,
        requiredEnvironment: launch.requiredEnvironment,
        clientConfigurations: configuration
          ? [{ adapter: configuration.adapter, path: configuration.outputPath }]
          : [],
      };
      await writeInstallationState(statePath, {
        schemaVersion: 1,
        integrations: [...state.integrations, installed].sort((left, right) =>
          left.id.localeCompare(right.id),
        ),
      });
      line(stdout, `${integration.name} installed locally.`);
      return 0;
    }

    if (command === 'list') {
      const state = await readInstallationState(statePath);
      if (state.integrations.length === 0) {
        line(stdout, 'No BooLink integrations are installed.');
        return 0;
      }
      for (const integration of state.integrations) {
        line(stdout, `${integration.id.padEnd(12)} v${integration.version}  local`);
      }
      return 0;
    }

    if (command === 'doctor') {
      const state = await readInstallationState(statePath);
      const nodeMajor = Number(process.versions.node.split('.')[0]);
      let failures = 0;
      line(stdout, `${nodeMajor >= 22 ? 'PASS' : 'FAIL'} Node.js ${process.versions.node}`);
      if (nodeMajor < 22) failures += 1;
      line(stdout, `PASS Installation state (${state.integrations.length} installed)`);

      for (const integration of state.integrations) {
        const serverExists = await pathExists(integration.args[0] ?? '');
        line(stdout, `${serverExists ? 'PASS' : 'FAIL'} ${integration.id} server package`);
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
