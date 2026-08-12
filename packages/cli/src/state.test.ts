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
      schemaVersion: 1,
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
        },
      ],
    });

    expect(await readInstallationState(filePath)).toMatchObject({
      integrations: [{ id: 'github', requiredEnvironment: ['GITHUB_TOKEN'] }],
    });
    expect(await readFile(filePath, 'utf8')).not.toContain('github_pat_');
  });
});
