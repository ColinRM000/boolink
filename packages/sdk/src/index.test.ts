import { fileURLToPath } from 'node:url';

import { Client, InMemoryTransport } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { afterEach, describe, expect, it } from 'vitest';
import * as z from 'zod/v4';

import { createBooLinkServer } from './index.js';
import { echoIntegration } from './fixtures/echo-integration.js';
import {
  defineIntegration,
  defineTool,
  type IntegrationManifest,
  type ToolMetadata,
} from '@boolink/core';

const closeables: Array<{ close: () => Promise<void> }> = [];

afterEach(async () => {
  await Promise.allSettled(closeables.splice(0).map((closeable) => closeable.close()));
});

describe('BooLink MCP adapter', () => {
  it('advertises annotations and executes a validated tool in process', async () => {
    const server = createBooLinkServer(echoIntegration);
    const client = new Client({ name: 'boolink-test', version: '0.0.0' });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    closeables.push(client, server);

    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    const listed = await client.listTools();
    expect(listed.tools).toHaveLength(1);
    expect(listed.tools[0]?.name).toBe('echo.repeat_text');
    expect(listed.tools[0]?.annotations).toMatchObject({
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    });
    expect(listed.tools[0]?._meta?.['io.boolink/tool']).toEqual({
      capabilities: ['read'],
      requiredScopes: [],
    });

    const result = await client.callTool({
      name: 'echo.repeat_text',
      arguments: { text: 'Happy haunting.' },
    });
    expect(result.isError).not.toBe(true);
    expect(result.structuredContent).toEqual({ text: 'Happy haunting.' });
  });

  it('negotiates the modern MCP era over a spawned stdio server', async () => {
    const serverEntry = fileURLToPath(new URL('../dist/fixtures/echo-server.js', import.meta.url));
    const client = new Client(
      { name: 'boolink-stdio-test', version: '0.0.0' },
      { versionNegotiation: { mode: 'auto' } },
    );
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [serverEntry],
      stderr: 'pipe',
    });
    closeables.push(client);

    await client.connect(transport);

    expect(client.getDiscoverResult()).toBeDefined();
    const listed = await client.listTools();
    expect(listed.tools.map(({ name }) => name)).toContain('echo.repeat_text');

    const result = await client.callTool({
      name: 'echo.repeat_text',
      arguments: { text: 'Modern MCP' },
    });
    expect(result.structuredContent).toEqual({ text: 'Modern MCP' });
  }, 15_000);

  it('does not expose unexpected provider errors to the client', async () => {
    const errorMetadata: ToolMetadata = {
      name: 'failure.trigger_error',
      title: 'Trigger test error',
      description: 'Triggers a test-only provider error to verify safe MCP error normalization.',
      capabilities: ['read'],
      destructive: false,
      idempotent: true,
      requiredScopes: [],
    };
    const manifest: IntegrationManifest = {
      ...echoIntegration.manifest,
      id: 'failure',
      name: 'Failure fixture',
      packageName: '@boolink/failure',
      tools: [errorMetadata],
    };
    const integration = defineIntegration({
      manifest,
      tools: [
        defineTool({
          metadata: errorMetadata,
          inputSchema: z.object({}),
          async execute() {
            throw new Error('Provider rejected Bearer unmistakable-test-secret');
          },
        }),
      ],
    });
    const server = createBooLinkServer(integration);
    const client = new Client({ name: 'boolink-error-test', version: '0.0.0' });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    closeables.push(client, server);
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    const result = await client.callTool({ name: 'failure.trigger_error', arguments: {} });
    const serialized = JSON.stringify(result);

    expect(result.isError).toBe(true);
    expect(serialized).toContain('internal_error');
    expect(serialized).not.toContain('unmistakable-test-secret');
  });
});
