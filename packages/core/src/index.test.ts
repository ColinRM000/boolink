import { describe, expect, it } from 'vitest';
import * as z from 'zod/v4';

import {
  defineIntegration,
  defineTool,
  integrationManifestSchema,
  redactSensitiveText,
  type IntegrationManifest,
  type ToolMetadata,
} from './index.js';

const metadata: ToolMetadata = {
  name: 'github.get_viewer',
  title: 'Get authenticated GitHub user',
  description: 'Returns the GitHub account associated with the locally configured token.',
  capabilities: ['read'],
  destructive: false,
  idempotent: true,
  requiredScopes: ['read:user'],
};

const manifest: IntegrationManifest = {
  schemaVersion: 1,
  id: 'github',
  name: 'GitHub',
  description: 'Connect AI agents to GitHub repositories, issues, and pull requests.',
  version: '0.1.0',
  provider: 'GitHub',
  category: 'development',
  packageName: '@boolink-dev/github',
  repositoryUrl: 'https://github.com/boolink/boolink',
  documentationUrl: 'https://boolink.dev/integrations/github',
  verification: 'experimental',
  authentication: {
    type: 'bearer-token',
    requirements: [
      {
        id: 'token',
        label: 'GitHub token',
        description: 'A fine-grained token with only the permissions needed by enabled tools.',
        source: 'environment',
        environmentVariables: ['GITHUB_TOKEN'],
        required: true,
      },
    ],
  },
  transports: ['stdio'],
  tools: [metadata],
};

describe('integration contracts', () => {
  it('accepts a valid manifest and rejects credential values', () => {
    expect(integrationManifestSchema.parse(manifest)).toEqual(manifest);

    expect(() =>
      integrationManifestSchema.parse({ ...manifest, packageName: '@boolink/github' }),
    ).toThrow(/boolink-dev/);

    const withSecretValue = structuredClone(manifest) as unknown as Record<string, unknown>;
    const authentication = withSecretValue.authentication as Record<string, unknown>;
    const requirements = authentication.requirements as Record<string, unknown>[];
    requirements[0] = { ...requirements[0], value: 'do-not-store-me' };

    expect(() => integrationManifestSchema.parse(withSecretValue)).toThrow();
  });

  it('requires manifest tools and implementations to match', () => {
    expect(() => defineIntegration({ manifest, tools: [] })).toThrow(/exactly match/);
  });

  it('validates inputs before invoking a typed tool', async () => {
    const tool = defineTool({
      metadata,
      inputSchema: z.object({ login: z.string().min(1) }),
      async execute({ login }) {
        return { content: [{ type: 'text', text: login }] };
      },
    });

    await expect(tool.execute({ login: '' }, {})).rejects.toThrow();
    await expect(tool.execute({ login: 'octocat' }, {})).resolves.toEqual({
      content: [{ type: 'text', text: 'octocat' }],
    });
  });
});

describe('secret redaction', () => {
  it('removes explicit and recognizable credentials', () => {
    const secret = 'ghp_superSecret123';
    const value = `Authorization: Bearer ${secret}; token=${secret}; raw=${secret}`;
    const redacted = redactSensitiveText(value, [secret]);

    expect(redacted).not.toContain(secret);
    expect(redacted).toContain('[REDACTED]');
  });

  it('redacts recognizable credentials without an explicit secret list', () => {
    const value =
      'Authorization: Bearer abc.def-123 and https://example.test?access_token=top-secret';
    const redacted = redactSensitiveText(value);

    expect(redacted).toBe(
      'Authorization: Bearer [REDACTED] and https://example.test?access_token=[REDACTED]',
    );
  });
});
