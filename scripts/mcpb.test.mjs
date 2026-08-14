import { describe, expect, it } from 'vitest';

import registry from '../packages/registry/src/catalog.json' with { type: 'json' };
import {
  createMcpbManifest,
  createMcpbReleaseMetadata,
  MCPB_DEFINITIONS,
  MCPB_MANIFEST_VERSION,
} from './mcpb.mjs';

describe('Claude Desktop MCP bundles', () => {
  for (const integration of registry.integrations) {
    it(`creates a current, local-first manifest for ${integration.id}`, () => {
      const manifest = createMcpbManifest(integration);
      const definition = MCPB_DEFINITIONS[integration.id];
      const environmentName = integration.authentication.requirements[0].environmentVariables[0];

      expect(manifest.manifest_version).toBe(MCPB_MANIFEST_VERSION);
      expect(manifest.version).toBe(integration.version);
      expect(manifest.server.entry_point).toBe('dist/server.js');
      expect(manifest.server.mcp_config.command).toBe('node');
      expect(manifest.server.mcp_config.env).toEqual({
        [environmentName]: `\${user_config.${definition.credentialKey}}`,
      });
      expect(manifest.user_config[definition.credentialKey]).toMatchObject({
        type: 'string',
        sensitive: true,
        required: true,
      });
      expect(manifest.tools).toEqual(
        integration.tools.map(({ name, description }) => ({ name, description })),
      );
      expect(manifest.tools_generated).toBe(false);
      expect(manifest.privacy_policies).toHaveLength(1);
      expect(JSON.stringify(manifest)).not.toContain('secret_marker');
    });
  }

  it('records exact, versioned release filenames', () => {
    expect(createMcpbReleaseMetadata(registry)).toEqual({
      cloudflare: {
        version: '0.1.2',
        file: 'boolink-cloudflare-0.1.2.mcpb',
      },
      github: {
        version: '0.2.2',
        file: 'boolink-github-0.2.2.mcpb',
      },
    });
  });
});
