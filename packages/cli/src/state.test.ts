import { mkdtemp, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { createEmptyState, readInstallationState, writeInstallationState } from './state.js';

describe('installation state', () => {
  it('returns an empty state for a missing file and round-trips validated metadata', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'boolink-state-'));
    const filePath = path.join(directory, 'installations.json');
    expect(await readInstallationState(filePath)).toEqual(createEmptyState());

    await writeInstallationState(filePath, {
      schemaVersion: 2,
      integrations: [
        {
          id: 'github',
          packageName: '@boolink-dev/github',
          version: '0.1.0',
          installedAt: '2026-08-12T12:00:00.000Z',
          command: 'node',
          args: ['/tmp/github/server.js'],
          requiredEnvironment: ['GITHUB_TOKEN'],
          clientConfigurations: [],
          installationDirectory: '/tmp/boolink/github',
        },
      ],
    });

    expect(await readInstallationState(filePath)).toMatchObject({
      integrations: [{ id: 'github', requiredEnvironment: ['GITHUB_TOKEN'] }],
    });
    expect(await readFile(filePath, 'utf8')).not.toContain('github_pat_');
  });

  it('reads release 0.1.0 state as a legacy unmanaged installation', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'boolink-state-v1-'));
    const filePath = path.join(directory, 'installations.json');
    await import('node:fs/promises').then(({ writeFile }) =>
      writeFile(
        filePath,
        `${JSON.stringify({
          schemaVersion: 1,
          integrations: [
            {
              id: 'github',
              packageName: '@boolink-dev/github',
              version: '0.1.0',
              installedAt: '2026-08-12T12:00:00.000Z',
              command: 'node',
              args: ['/temporary/npm/cache/server.js'],
              requiredEnvironment: ['GITHUB_TOKEN'],
              clientConfigurations: [],
            },
          ],
        })}\n`,
        'utf8',
      ),
    );

    const migrated = await readInstallationState(filePath);
    expect(migrated).toMatchObject({
      schemaVersion: 2,
      integrations: [{ id: 'github' }],
    });
    expect(migrated.integrations[0]?.installationDirectory).toBeUndefined();
  });
});
