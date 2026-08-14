import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

import * as z from 'zod/v4';

const clientConfigurationSchema = z
  .object({
    adapter: z.enum(['claude-code', 'codex', 'custom-json']),
    path: z.string().min(1),
  })
  .strict();

const legacyInstallationSchema = z
  .object({
    id: z.string().min(1),
    packageName: z.string().min(1),
    version: z.string().min(1),
    installedAt: z.iso.datetime({ offset: true }),
    command: z.string().min(1),
    args: z.array(z.string()),
    requiredEnvironment: z.array(z.string()),
    clientConfigurations: z.array(clientConfigurationSchema),
  })
  .strict();

const legacyInstallationStateSchema = z
  .object({
    schemaVersion: z.literal(1),
    integrations: z.array(legacyInstallationSchema),
  })
  .strict();

const installationSchema = legacyInstallationSchema.extend({
  installationDirectory: z.string().min(1).optional(),
});

export const installationStateSchema = z
  .object({
    schemaVersion: z.literal(2),
    integrations: z.array(installationSchema),
  })
  .strict();

export type InstallationState = z.infer<typeof installationStateSchema>;
export type InstalledIntegration = z.infer<typeof installationSchema>;

export function createEmptyState(): InstallationState {
  return { schemaVersion: 2, integrations: [] };
}

export function getStatePath(boolinkHome: string): string {
  return path.join(boolinkHome, 'installations.json');
}

export async function readInstallationState(filePath: string): Promise<InstallationState> {
  let text: string;
  try {
    text = await readFile(filePath, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return createEmptyState();
    throw error;
  }

  const input = JSON.parse(text) as unknown;
  const current = installationStateSchema.safeParse(input);
  if (current.success) return current.data;

  const legacy = legacyInstallationStateSchema.parse(input);
  return {
    schemaVersion: 2,
    integrations: legacy.integrations,
  };
}

export async function writeInstallationState(
  filePath: string,
  state: InstallationState,
): Promise<void> {
  const validated = installationStateSchema.parse(state);
  await mkdir(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.${randomUUID()}.tmp`;
  await writeFile(temporary, `${JSON.stringify(validated, null, 2)}\n`, {
    encoding: 'utf8',
    mode: 0o600,
  });
  await rename(temporary, filePath);
}
