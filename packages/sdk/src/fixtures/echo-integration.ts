import {
  defineIntegration,
  defineTool,
  type IntegrationManifest,
  type ToolMetadata,
} from '@boolink/core';
import * as z from 'zod/v4';

const echoMetadata: ToolMetadata = {
  name: 'echo.repeat_text',
  title: 'Repeat text',
  description: 'Returns the supplied text for BooLink MCP transport verification only.',
  capabilities: ['read'],
  destructive: false,
  idempotent: true,
  requiredScopes: [],
};

const manifest: IntegrationManifest = {
  schemaVersion: 1,
  id: 'echo',
  name: 'Echo fixture',
  description: 'A test-only integration used to verify the BooLink MCP server adapter.',
  version: '0.0.0',
  provider: 'BooLink',
  category: 'development',
  packageName: '@boolink/echo',
  repositoryUrl: 'https://github.com/boolink/boolink',
  documentationUrl: 'https://boolink.dev/docs/testing',
  verification: 'experimental',
  authentication: { type: 'none', requirements: [] },
  transports: ['stdio'],
  tools: [echoMetadata],
};

export const echoIntegration = defineIntegration({
  manifest,
  tools: [
    defineTool({
      metadata: echoMetadata,
      inputSchema: z.object({ text: z.string().min(1).max(200) }),
      async execute({ text }) {
        return {
          content: [{ type: 'text', text }],
          structuredContent: { text },
        };
      },
    }),
  ],
});
