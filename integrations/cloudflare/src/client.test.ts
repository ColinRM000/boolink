import { BooLinkError } from '@boolink-dev/core';
import { describe, expect, it } from 'vitest';

import { createCloudflareClient, type CloudflareFetch } from './client.js';

const fakeToken = 'cloudflare_test_token_never_expose';
const zoneId = '023e105f4ecef8ad9ca31a8372d0c353';
const recordId = '372e67954025e0ba6aaa6d586b9e0b59';
const timestamp = '2026-08-13T12:00:00Z';

const zone = {
  id: zoneId,
  name: 'boolink.dev',
  status: 'active',
  paused: false,
  type: 'full',
  development_mode: 0,
  name_servers: ['dana.ns.cloudflare.com', 'hugh.ns.cloudflare.com'],
  created_on: timestamp,
  modified_on: timestamp,
  activated_on: timestamp,
  account: { id: '11111111111111111111111111111111', name: 'BooLink' },
};

const dnsRecord = {
  id: recordId,
  zone_id: zoneId,
  zone_name: 'boolink.dev',
  name: 'www.boolink.dev',
  type: 'CNAME',
  content: 'boolink.pages.dev',
  proxiable: true,
  proxied: true,
  ttl: 1,
  comment: 'Managed by BooLink',
  tags: ['owner:boolink'],
  created_on: timestamp,
  modified_on: timestamp,
};

function envelope(result: unknown, resultInfo?: Record<string, number>) {
  return {
    success: true,
    errors: [],
    messages: [],
    result,
    ...(resultInfo === undefined ? {} : { result_info: resultInfo }),
  };
}

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    ...init,
    headers: { 'content-type': 'application/json', ...init.headers },
  });
}

describe('Cloudflare API client', () => {
  it('constructs token verification and zone discovery requests with bounded pagination', async () => {
    const requests: Array<{ url: string; init?: RequestInit }> = [];
    const responses = [
      jsonResponse(envelope({ id: zoneId, status: 'active' })),
      jsonResponse(
        envelope([zone], { page: 1, per_page: 20, count: 1, total_count: 1, total_pages: 1 }),
      ),
      jsonResponse(envelope(zone)),
    ];
    const client = createCloudflareClient({
      token: fakeToken,
      fetchImpl: async (input, init) => {
        requests.push({ url: String(input), ...(init === undefined ? {} : { init }) });
        const response = responses.shift();
        if (response === undefined) throw new Error('Unexpected request');
        return response;
      },
    });

    await expect(client.verifyToken()).resolves.toEqual({ id: zoneId, status: 'active' });
    await expect(
      client.listZones({ name: 'boolink.dev', status: 'active', page: 1, perPage: 20 }),
    ).resolves.toMatchObject({
      items: [{ id: zoneId, name: 'boolink.dev', account: { name: 'BooLink' } }],
      pagination: { page: 1, perPage: 20, totalCount: 1, hasNextPage: false },
    });
    await expect(client.getZone(zoneId)).resolves.toMatchObject({ id: zoneId, status: 'active' });

    expect(new URL(requests[0]?.url ?? '').pathname).toBe('/client/v4/user/tokens/verify');
    const zonesUrl = new URL(requests[1]?.url ?? '');
    expect(zonesUrl.pathname).toBe('/client/v4/zones');
    expect(Object.fromEntries(zonesUrl.searchParams)).toMatchObject({
      name: 'boolink.dev',
      status: 'active',
      page: '1',
      per_page: '20',
    });
    expect(requests[0]?.init?.headers).toMatchObject({
      Authorization: `Bearer ${fakeToken}`,
      'User-Agent': 'BooLink-Cloudflare/0.1.0',
    });
  });

  it('lists, gets, creates, updates, and deletes DNS records without leaking credentials', async () => {
    const requests: Array<{ url: string; init?: RequestInit }> = [];
    const responses = [
      jsonResponse(
        envelope([dnsRecord], {
          page: 2,
          per_page: 25,
          count: 1,
          total_count: 26,
          total_pages: 2,
        }),
      ),
      jsonResponse(envelope(dnsRecord)),
      jsonResponse(envelope(dnsRecord), { status: 201 }),
      jsonResponse(envelope({ ...dnsRecord, content: 'new.pages.dev' })),
      jsonResponse(envelope({ id: recordId })),
    ];
    const fetchImpl: CloudflareFetch = async (input, init) => {
      requests.push({ url: String(input), ...(init === undefined ? {} : { init }) });
      const response = responses.shift();
      if (response === undefined) throw new Error('Unexpected request');
      return response;
    };
    const client = createCloudflareClient({ token: fakeToken, fetchImpl });

    await expect(
      client.listDnsRecords({
        zoneId,
        type: 'CNAME',
        name: 'www.boolink.dev',
        proxied: true,
        page: 2,
        perPage: 25,
      }),
    ).resolves.toMatchObject({
      items: [{ id: recordId, content: 'boolink.pages.dev', proxied: true }],
      pagination: { hasNextPage: false, totalCount: 26 },
    });
    await expect(client.getDnsRecord({ zoneId, recordId })).resolves.toMatchObject({
      id: recordId,
    });
    await expect(
      client.createDnsRecord({
        zoneId,
        type: 'CNAME',
        name: 'www.boolink.dev',
        content: 'boolink.pages.dev',
        ttl: 1,
        proxied: true,
        comment: 'Managed by BooLink',
      }),
    ).resolves.toMatchObject({ id: recordId });
    await expect(
      client.updateDnsRecord({ zoneId, recordId, content: 'new.pages.dev', proxied: true }),
    ).resolves.toMatchObject({ content: 'new.pages.dev' });
    await expect(client.deleteDnsRecord({ zoneId, recordId })).resolves.toEqual({ id: recordId });

    expect(requests.map(({ init }) => init?.method)).toEqual([
      'GET',
      'GET',
      'POST',
      'PATCH',
      'DELETE',
    ]);
    expect(JSON.parse(String(requests[2]?.init?.body))).toEqual({
      type: 'CNAME',
      name: 'www.boolink.dev',
      content: 'boolink.pages.dev',
      ttl: 1,
      proxied: true,
      comment: 'Managed by BooLink',
    });
    expect(JSON.parse(String(requests[3]?.init?.body))).toEqual({
      content: 'new.pages.dev',
      proxied: true,
    });
    expect(JSON.stringify(requests.map(({ init }) => init?.body))).not.toContain(fakeToken);
  });

  it('constructs targeted and full cache purge requests', async () => {
    const requests: Array<{ url: string; init?: RequestInit }> = [];
    const client = createCloudflareClient({
      token: fakeToken,
      fetchImpl: async (input, init) => {
        requests.push({ url: String(input), ...(init === undefined ? {} : { init }) });
        return jsonResponse(envelope({ id: zoneId }));
      },
    });

    await client.purgeCache({ zoneId, files: ['https://boolink.dev/app.js'] });
    await client.purgeCache({ zoneId, purgeEverything: true });

    expect(requests.map(({ url }) => new URL(url).pathname)).toEqual([
      `/client/v4/zones/${zoneId}/purge_cache`,
      `/client/v4/zones/${zoneId}/purge_cache`,
    ]);
    expect(requests.map(({ init }) => JSON.parse(String(init?.body)))).toEqual([
      { files: ['https://boolink.dev/app.js'] },
      { purge_everything: true },
    ]);
  });

  it('normalizes provider errors and never returns Cloudflare payloads or credentials', async () => {
    const client = createCloudflareClient({
      token: fakeToken,
      now: () => Date.parse('2026-08-13T12:00:00Z'),
      fetchImpl: async () =>
        jsonResponse(
          { success: false, errors: [{ code: 10000, message: fakeToken }], result: null },
          { status: 429, headers: { 'retry-after': '60' } },
        ),
    });

    let error: unknown;
    try {
      await client.verifyToken();
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(BooLinkError);
    expect(error).toMatchObject({
      code: 'cloudflare_rate_limited',
      message: 'Cloudflare rate limit exceeded. Retry after 60 seconds.',
      retryable: true,
    });
    expect(JSON.stringify(error)).not.toContain(fakeToken);
  });

  it('rejects malformed successful responses with a stable safe error', async () => {
    const client = createCloudflareClient({
      token: fakeToken,
      fetchImpl: async () => jsonResponse({ success: true, errors: [], messages: [], result: {} }),
    });

    await expect(client.verifyToken()).rejects.toMatchObject({
      code: 'cloudflare_invalid_response',
      message: 'Cloudflare returned an unexpected response.',
      retryable: true,
    });
  });
});
