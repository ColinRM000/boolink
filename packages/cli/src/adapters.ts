import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

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
  content: string;
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
      content: mergeCodexConfiguration(existing ?? '', launch),
    };
  }

  if (existing !== undefined) {
    throw new Error('The custom JSON output already exists. Choose a new path.');
  }

  return { adapter, outputPath, content: renderCustomJson(launch) };
}

export async function writeClientConfiguration(plan: ClientConfigurationPlan): Promise<void> {
  await mkdir(path.dirname(plan.outputPath), { recursive: true });
  await writeFile(plan.outputPath, plan.content, { encoding: 'utf8', mode: 0o600 });
}
