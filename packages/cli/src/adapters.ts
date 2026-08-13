import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

export type ClientAdapter = 'codex' | 'custom-json';

export type ServerLaunch = {
  id: string;
  command: string;
  args: string[];
  requiredEnvironment: string[];
};

export type ClientConfigurationPlan = {
  adapter: ClientAdapter;
  outputPath: string;
  action: 'write' | 'delete';
  content: string;
  previousContent?: string;
};

function tomlString(value: string): string {
  return JSON.stringify(value);
}

function codexServerName(id: string): string {
  return `boolink_${id.replaceAll('-', '_')}`;
}

export function renderCodexBlock(launch: ServerLaunch): string {
  const serverName = codexServerName(launch.id);
  const args = launch.args.map(tomlString).join(', ');
  const environment = launch.requiredEnvironment.map(tomlString).join(', ');

  return [
    `# BooLink managed integration: ${launch.id}`,
    `[mcp_servers.${serverName}]`,
    `command = ${tomlString(launch.command)}`,
    `args = [${args}]`,
    `env_vars = [${environment}]`,
    'default_tools_approval_mode = "writes"',
  ].join('\n');
}

export function mergeCodexConfiguration(existing: string, launch: ServerLaunch): string {
  const header = `[mcp_servers.${codexServerName(launch.id)}]`;
  if (existing.includes(header)) {
    throw new Error('The Codex configuration already contains this BooLink integration.');
  }

  const prefix = existing.length === 0 ? '' : `${existing.trimEnd()}\n\n`;
  return `${prefix}${renderCodexBlock(launch)}\n`;
}

function replaceExactBlock(existing: string, before: string, after: string): string {
  const first = existing.indexOf(before);
  if (first === -1 || existing.indexOf(before, first + before.length) !== -1) {
    throw new Error('The managed client configuration was changed and cannot be updated safely.');
  }
  return `${existing.slice(0, first)}${after}${existing.slice(first + before.length)}`;
}

export function removeCodexConfiguration(existing: string, launch: ServerLaunch): string {
  const block = renderCodexBlock(launch);
  let content = replaceExactBlock(existing, block, '');
  content = content.replace(/\n{3,}/gu, '\n\n');
  if (content.trim().length === 0) return '';
  return `${content.trimEnd()}\n`;
}

export function renderCustomJson(launch: ServerLaunch): string {
  return `${JSON.stringify(
    {
      schemaVersion: 1,
      servers: {
        [`boolink-${launch.id}`]: {
          transport: 'stdio',
          command: launch.command,
          args: launch.args,
          requiredEnvironment: launch.requiredEnvironment,
        },
      },
    },
    null,
    2,
  )}\n`;
}

async function readOptional(filePath: string): Promise<string | undefined> {
  try {
    return await readFile(filePath, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    throw error;
  }
}

export async function planClientConfiguration(
  adapter: ClientAdapter,
  outputPath: string,
  launch: ServerLaunch,
): Promise<ClientConfigurationPlan> {
  const existing = await readOptional(outputPath);

  if (adapter === 'codex') {
    return {
      adapter,
      outputPath,
      action: 'write',
      content: mergeCodexConfiguration(existing ?? '', launch),
      ...(existing === undefined ? {} : { previousContent: existing }),
    };
  }

  if (existing !== undefined) {
    throw new Error('The custom JSON output already exists. Choose a new path.');
  }

  return { adapter, outputPath, action: 'write', content: renderCustomJson(launch) };
}

export async function planClientConfigurationReplacement(
  adapter: ClientAdapter,
  outputPath: string,
  previousLaunch: ServerLaunch,
  nextLaunch: ServerLaunch,
): Promise<ClientConfigurationPlan> {
  const existing = await readOptional(outputPath);
  if (existing === undefined) throw new Error(`Client configuration is missing: ${outputPath}`);
  const previous =
    adapter === 'codex' ? renderCodexBlock(previousLaunch) : renderCustomJson(previousLaunch);
  const next = adapter === 'codex' ? renderCodexBlock(nextLaunch) : renderCustomJson(nextLaunch);
  return {
    adapter,
    outputPath,
    action: 'write',
    content: replaceExactBlock(existing, previous, next),
    previousContent: existing,
  };
}

export async function planClientConfigurationRemoval(
  adapter: ClientAdapter,
  outputPath: string,
  launch: ServerLaunch,
): Promise<ClientConfigurationPlan> {
  const existing = await readOptional(outputPath);
  if (existing === undefined) throw new Error(`Client configuration is missing: ${outputPath}`);
  if (adapter === 'codex') {
    return {
      adapter,
      outputPath,
      action: 'write',
      content: removeCodexConfiguration(existing, launch),
      previousContent: existing,
    };
  }
  if (existing !== renderCustomJson(launch)) {
    throw new Error(
      'The managed custom JSON configuration was changed and cannot be removed safely.',
    );
  }
  return {
    adapter,
    outputPath,
    action: 'delete',
    content: '',
    previousContent: existing,
  };
}

async function writeAtomic(filePath: string, content: string): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.${randomUUID()}.tmp`;
  await writeFile(temporary, content, { encoding: 'utf8', mode: 0o600 });
  await rename(temporary, filePath);
}

export async function writeClientConfiguration(plan: ClientConfigurationPlan): Promise<void> {
  if (plan.action === 'delete') {
    await rm(plan.outputPath, { force: true });
    return;
  }
  await writeAtomic(plan.outputPath, plan.content);
}

export async function restoreClientConfiguration(plan: ClientConfigurationPlan): Promise<void> {
  if (plan.previousContent === undefined) {
    await rm(plan.outputPath, { force: true });
    return;
  }
  await writeAtomic(plan.outputPath, plan.previousContent);
}
