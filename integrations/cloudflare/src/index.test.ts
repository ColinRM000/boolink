import { Client, InMemoryTransport } from '@modelcontextprotocol/client';
import { afterEach, describe, expect, it } from 'vitest';

import { createBooLinkServer } from '@boolink-dev/sdk';
import { createCloudflareClient, type CloudflareFetch } from './client.js';
import { cloudflareManifest, createCloudflareIntegration } from './index.js';

const closeables: Array<{ close: () => Promise<void> }> = [];
const zoneId = '023e105f4ecef8ad9ca31a8372d0c353';

afterEach(async () => {
  await Promise.allSettled(closeables.splice(0).map((closeable) => closeable.close()));
});

describe('Cloudflare integration', () => {
  it('publishes the complete initial manifest with explicit read and administrative writes', () => {
    expect(cloudflareManifest.tools.map(({ name }) => name)).toEqual([
      'cloudflare.verify_token',
      'cloudflare.list_zones',
      'cloudflare.get_zone',
      'cloudflare.list_dns_records',
      'cloudflare.get_dns_record',
      'cloudflare.create_dns_record',
      'cloudflare.update_dns_record',
      'cloudflare.delete_dns_record',
      'cloudflare.purge_cache_urls',
      'cloudflare.purge_everything',
    ]);
    expect(cloudflareManifest.version).toBe('0.1.1');
    expect(cloudflareManifest.verification).toBe('official');
    expect(
      cloudflareManifest.tools.find(({ name }) => name === 'cloudflare.delete_dns_record'),
    ).toMatchObject({
      capabilities: ['delete', 'administrative'],
      destructive: true,
      idempotent: true,
      requiredScopes: ['DNS: Write'],
    });
  });

  it('supports MCP discovery and execution through the official in-memory client', async () => {
    const fetchImpl: CloudflareFetch = async () =>
      new Response(
        JSON.stringify({
          success: true,
          errors: [],
          messages: [],
          result: { id: zoneId, status: 'active' },
        }),
        { headers: { 'content-type': 'application/json' } },
      );
    const server = createBooLinkServer(
      createCloudflareIntegration(
        createCloudflareClient({ token: 'cloudflare_mcp_test_token', fetchImpl }),
      ),
    );
    const client = new Client({ name: 'boolink-cloudflare-test', version: '0.0.0' });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    closeables.push(client, server);
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    const listed = await client.listTools();
    expect(listed.tools).toHaveLength(10);
    expect(
      listed.tools.find((tool) => tool.name === 'cloudflare.delete_dns_record')?.annotations,
    ).toMatchObject({ readOnlyHint: false, destructiveHint: true, idempotentHint: true });
    expect(listed.tools.find((tool) => tool.name === 'cloudflare.list_zones')?._meta).toMatchObject(
      {
        'io.boolink/tool': { capabilities: ['read'], requiredScopes: ['Zone: Read'] },
      },
    );

    const result = await client.callTool({ name: 'cloudflare.verify_token', arguments: {} });
    expect(result.isError).not.toBe(true);
    expect(result.structuredContent).toMatchObject({ token: { id: zoneId, status: 'active' } });
  });

  it('rejects empty updates and unconfirmed full purges before contacting Cloudflare', async () => {
    let requests = 0;
    const definition = createCloudflareIntegration(
      createCloudflareClient({
        token: 'cloudflare_validation_test',
        fetchImpl: async () => {
          requests += 1;
          return new Response('{}');
        },
      }),
    );
    const update = definition.tools.find(
      ({ metadata }) => metadata.name === 'cloudflare.update_dns_record',
    );
    const purge = definition.tools.find(
      ({ metadata }) => metadata.name === 'cloudflare.purge_everything',
    );

    await expect(update?.execute({ zoneId, recordId: zoneId }, {})).rejects.toThrow(
      'At least one DNS record field must be supplied.',
    );
    await expect(purge?.execute({ zoneId, confirmPurgeEverything: false }, {})).rejects.toThrow();
    expect(requests).toBe(0);
  });
});
