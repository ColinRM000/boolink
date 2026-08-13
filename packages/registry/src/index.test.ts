import { describe, expect, it } from 'vitest';

import { cloudflareManifest } from '@boolink-dev/cloudflare';
import { githubManifest } from '@boolink-dev/github';
import { bundledRegistry, createRegistry, parseRegistry, searchRegistry } from './index.js';
import type { IntegrationManifest } from '@boolink-dev/core';

function manifest(id: string, name: string, category: string): IntegrationManifest {
  return {
    schemaVersion: 1,
    id,
    name,
    description: `${name} integration used to validate deterministic registry discovery.`,
    version: '0.1.0',
    provider: name,
    category,
    packageName: `@boolink-dev/${id}`,
    repositoryUrl: `https://github.com/boolink/${id}`,
    documentationUrl: `https://boolink.dev/integrations/${id}`,
    verification: 'experimental',
    authentication: { type: 'none', requirements: [] },
    transports: ['stdio'],
    tools: [],
  };
}

describe('registry', () => {
  it('publishes integration-owned manifests without metadata drift', () => {
    expect(bundledRegistry.integrations).toEqual([cloudflareManifest, githubManifest]);
  });

  it('sorts integrations deterministically and supports multi-term search', () => {
    const registry = createRegistry(
      [manifest('notion', 'Notion', 'productivity'), manifest('github', 'GitHub', 'development')],
      new Date('2026-08-12T00:00:00.000Z'),
    );

    expect(registry.integrations.map(({ id }) => id)).toEqual(['github', 'notion']);
    expect(searchRegistry(registry, 'github development').map(({ id }) => id)).toEqual(['github']);
  });

  it('rejects duplicate integration IDs', () => {
    const github = manifest('github', 'GitHub', 'development');
    expect(() =>
      parseRegistry({
        schemaVersion: 1,
        generatedAt: '2026-08-12T00:00:00.000Z',
        integrations: [github, github],
      }),
    ).toThrow();
  });
});
