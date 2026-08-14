import { BooLinkError } from '@boolink-dev/core';
import type * as z from 'zod/v4';

import {
  deleteDnsRecordEnvelopeSchema,
  dnsRecordEnvelopeSchema,
  dnsRecordListEnvelopeSchema,
  purgeCacheEnvelopeSchema,
  tokenVerificationEnvelopeSchema,
  zoneEnvelopeSchema,
  zoneListEnvelopeSchema,
  type CloudflareEnvelope,
  type DnsRecordResponse,
  type ZoneResponse,
} from './schemas.js';

const DEFAULT_BASE_URL = 'https://api.cloudflare.com/client/v4/';
const USER_AGENT = 'BooLink-Cloudflare/0.1.2';

export type CloudflareFetch = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

export type CloudflarePagination = {
  page: number;
  perPage: number;
  count: number;
  totalCount: number;
  totalPages: number;
  hasNextPage: boolean;
  nextPage?: number;
};

export type CloudflarePage<T> = {
  items: T[];
  pagination: CloudflarePagination;
};

export type CloudflareTokenVerification = {
  id: string;
  status: 'active' | 'disabled' | 'expired';
  expiresOn?: string;
  notBefore?: string;
};

export type CloudflareZone = {
  id: string;
  name: string;
  status: 'initializing' | 'pending' | 'active' | 'moved';
  paused: boolean;
  type: 'full' | 'partial' | 'secondary' | 'internal';
  developmentMode: number;
  nameServers: string[];
  account: { id?: string; name?: string };
  createdOn: string;
  modifiedOn: string;
  activatedOn?: string | null;
};

export type CloudflareDnsRecord = {
  id: string;
  zoneId: string;
  zoneName: string;
  name: string;
  type: string;
  content: string;
  proxiable?: boolean;
  proxied?: boolean;
  ttl: number;
  priority?: number;
  comment?: string | null;
  tags?: string[];
  createdOn: string;
  modifiedOn: string;
};

export type ListZonesOptions = {
  name?: string | undefined;
  status?: 'initializing' | 'pending' | 'active' | 'moved' | undefined;
  accountId?: string | undefined;
  page: number;
  perPage: number;
  signal?: AbortSignal;
};

export type ListDnsRecordsOptions = {
  zoneId: string;
  type?: string | undefined;
  name?: string | undefined;
  content?: string | undefined;
  proxied?: boolean | undefined;
  page: number;
  perPage: number;
  signal?: AbortSignal;
};

export type GetDnsRecordOptions = {
  zoneId: string;
  recordId: string;
  signal?: AbortSignal;
};

export type DnsRecordWrite = {
  type: string;
  name: string;
  content: string;
  ttl?: number | undefined;
  proxied?: boolean | undefined;
  priority?: number | undefined;
  comment?: string | undefined;
  tags?: string[] | undefined;
};

export type CreateDnsRecordOptions = { zoneId: string; signal?: AbortSignal } & DnsRecordWrite;
export type UpdateDnsRecordOptions = GetDnsRecordOptions & {
  type?: string | undefined;
  name?: string | undefined;
  content?: string | undefined;
  ttl?: number | undefined;
  proxied?: boolean | undefined;
  priority?: number | undefined;
  comment?: string | undefined;
  tags?: string[] | undefined;
};

export type DeleteDnsRecordOptions = GetDnsRecordOptions;

export type PurgeCacheOptions = {
  zoneId: string;
  files?: string[] | undefined;
  purgeEverything?: boolean | undefined;
  signal?: AbortSignal;
};

export type CloudflareClient = {
  verifyToken: (signal?: AbortSignal) => Promise<CloudflareTokenVerification>;
  listZones: (options: ListZonesOptions) => Promise<CloudflarePage<CloudflareZone>>;
  getZone: (zoneId: string, signal?: AbortSignal) => Promise<CloudflareZone>;
  listDnsRecords: (options: ListDnsRecordsOptions) => Promise<CloudflarePage<CloudflareDnsRecord>>;
  getDnsRecord: (options: GetDnsRecordOptions) => Promise<CloudflareDnsRecord>;
  createDnsRecord: (options: CreateDnsRecordOptions) => Promise<CloudflareDnsRecord>;
  updateDnsRecord: (options: UpdateDnsRecordOptions) => Promise<CloudflareDnsRecord>;
  deleteDnsRecord: (options: DeleteDnsRecordOptions) => Promise<{ id: string }>;
  purgeCache: (options: PurgeCacheOptions) => Promise<{ id: string }>;
};

type ClientOptions = {
  token: string;
  fetchImpl?: CloudflareFetch;
  baseUrl?: string;
  now?: () => number;
};

type RequestOptions<TSchema extends z.ZodType> = {
  path: string;
  schema: TSchema;
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: Record<string, unknown>;
  query?: Record<string, string | number | boolean | undefined>;
  signal?: AbortSignal;
};

function retryDelaySeconds(headers: Headers, now: number): number | undefined {
  const retryAfter = headers.get('retry-after');
  if (retryAfter === null) return undefined;
  if (/^\d+$/u.test(retryAfter)) return Number(retryAfter);
  const retryAt = Date.parse(retryAfter);
  return Number.isFinite(retryAt) ? Math.max(0, Math.ceil((retryAt - now) / 1_000)) : undefined;
}

function errorForResponse(response: Response, now: number): BooLinkError {
  const retryDelay = retryDelaySeconds(response.headers, now);
  if (response.status === 429) {
    return new BooLinkError({
      code: 'cloudflare_rate_limited',
      safeMessage:
        retryDelay === undefined
          ? 'Cloudflare rate limit exceeded. Retry later.'
          : `Cloudflare rate limit exceeded. Retry after ${retryDelay} seconds.`,
      retryable: true,
    });
  }
  if (response.status === 401) {
    return new BooLinkError({
      code: 'cloudflare_unauthorized',
      safeMessage: 'Cloudflare rejected the locally configured API token.',
    });
  }
  if (response.status === 403) {
    return new BooLinkError({
      code: 'cloudflare_forbidden',
      safeMessage: 'The Cloudflare API token does not have permission for this resource.',
    });
  }
  if (response.status === 404) {
    return new BooLinkError({
      code: 'cloudflare_not_found',
      safeMessage:
        'The requested Cloudflare resource was not found or is not visible to this token.',
    });
  }
  if (response.status === 400 || response.status === 409 || response.status === 422) {
    return new BooLinkError({
      code: 'cloudflare_invalid_request',
      safeMessage: 'Cloudflare could not process the validated request.',
    });
  }
  return new BooLinkError({
    code: 'cloudflare_unavailable',
    safeMessage: 'Cloudflare is temporarily unavailable.',
    retryable: response.status >= 500,
  });
}

function mapZone(zone: ZoneResponse): CloudflareZone {
  return {
    id: zone.id,
    name: zone.name,
    status: zone.status,
    paused: zone.paused,
    type: zone.type,
    developmentMode: zone.development_mode,
    nameServers: zone.name_servers,
    account: {
      ...(zone.account.id === undefined ? {} : { id: zone.account.id }),
      ...(zone.account.name === undefined ? {} : { name: zone.account.name }),
    },
    createdOn: zone.created_on,
    modifiedOn: zone.modified_on,
    ...(zone.activated_on === undefined ? {} : { activatedOn: zone.activated_on }),
  };
}

function mapDnsRecord(record: DnsRecordResponse): CloudflareDnsRecord {
  return {
    id: record.id,
    zoneId: record.zone_id,
    zoneName: record.zone_name,
    name: record.name,
    type: record.type,
    content: record.content,
    ttl: record.ttl,
    createdOn: record.created_on,
    modifiedOn: record.modified_on,
    ...(record.proxiable === undefined ? {} : { proxiable: record.proxiable }),
    ...(record.proxied === undefined ? {} : { proxied: record.proxied }),
    ...(record.priority === undefined ? {} : { priority: record.priority }),
    ...(record.comment === undefined ? {} : { comment: record.comment }),
    ...(record.tags === undefined ? {} : { tags: record.tags }),
  };
}

function page<T>(
  envelope: CloudflareEnvelope<unknown>,
  items: T[],
  requestedPage: number,
  requestedPerPage: number,
): CloudflarePage<T> {
  const info = envelope.result_info;
  const currentPage = info?.page ?? requestedPage;
  const perPage = info?.per_page ?? requestedPerPage;
  const count = info?.count ?? items.length;
  const totalCount = info?.total_count ?? count;
  const totalPages = info?.total_pages ?? Math.ceil(totalCount / perPage);
  const hasNextPage = currentPage < totalPages;
  return {
    items,
    pagination: {
      page: currentPage,
      perPage,
      count,
      totalCount,
      totalPages,
      hasNextPage,
      ...(hasNextPage ? { nextPage: currentPage + 1 } : {}),
    },
  };
}

export function createCloudflareClient(options: ClientOptions): CloudflareClient {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
  const now = options.now ?? Date.now;

  async function request<TSchema extends z.ZodType<{ success: boolean }>>(
    requestOptions: RequestOptions<TSchema>,
  ): Promise<z.output<TSchema>> {
    const url = new URL(requestOptions.path.replace(/^\//u, ''), baseUrl);
    for (const [name, value] of Object.entries(requestOptions.query ?? {})) {
      if (value !== undefined) url.searchParams.set(name, String(value));
    }

    let response: Response;
    try {
      response = await fetchImpl(url, {
        method: requestOptions.method ?? 'GET',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${options.token}`,
          'User-Agent': USER_AGENT,
          ...(requestOptions.body === undefined ? {} : { 'Content-Type': 'application/json' }),
        },
        ...(requestOptions.body === undefined ? {} : { body: JSON.stringify(requestOptions.body) }),
        ...(requestOptions.signal === undefined ? {} : { signal: requestOptions.signal }),
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new BooLinkError({
          code: 'cloudflare_request_cancelled',
          safeMessage: 'The Cloudflare request was cancelled.',
          cause: error,
        });
      }
      throw new BooLinkError({
        code: 'cloudflare_unavailable',
        safeMessage: 'Cloudflare could not be reached.',
        retryable: true,
        cause: error,
      });
    }

    if (!response.ok) throw errorForResponse(response, now());

    let body: unknown;
    try {
      body = await response.json();
    } catch (error) {
      throw new BooLinkError({
        code: 'cloudflare_invalid_response',
        safeMessage: 'Cloudflare returned an unreadable response.',
        retryable: true,
        cause: error,
      });
    }

    const parsed = requestOptions.schema.safeParse(body);
    if (!parsed.success || parsed.data.success !== true) {
      throw new BooLinkError({
        code: 'cloudflare_invalid_response',
        safeMessage: 'Cloudflare returned an unexpected response.',
        retryable: true,
        cause: parsed.success ? undefined : parsed.error,
      });
    }
    return parsed.data;
  }

  return {
    async verifyToken(signal) {
      const response = await request({
        path: '/user/tokens/verify',
        schema: tokenVerificationEnvelopeSchema,
        ...(signal === undefined ? {} : { signal }),
      });
      return {
        id: response.result.id,
        status: response.result.status,
        ...(response.result.expires_on === undefined
          ? {}
          : { expiresOn: response.result.expires_on }),
        ...(response.result.not_before === undefined
          ? {}
          : { notBefore: response.result.not_before }),
      };
    },

    async listZones(listOptions) {
      const response = await request({
        path: '/zones',
        schema: zoneListEnvelopeSchema,
        query: {
          name: listOptions.name,
          status: listOptions.status,
          'account.id': listOptions.accountId,
          page: listOptions.page,
          per_page: listOptions.perPage,
        },
        ...(listOptions.signal === undefined ? {} : { signal: listOptions.signal }),
      });
      return page(response, response.result.map(mapZone), listOptions.page, listOptions.perPage);
    },

    async getZone(zoneId, signal) {
      const response = await request({
        path: `/zones/${encodeURIComponent(zoneId)}`,
        schema: zoneEnvelopeSchema,
        ...(signal === undefined ? {} : { signal }),
      });
      return mapZone(response.result);
    },

    async listDnsRecords(listOptions) {
      const response = await request({
        path: `/zones/${encodeURIComponent(listOptions.zoneId)}/dns_records`,
        schema: dnsRecordListEnvelopeSchema,
        query: {
          type: listOptions.type,
          name: listOptions.name,
          content: listOptions.content,
          proxied: listOptions.proxied,
          page: listOptions.page,
          per_page: listOptions.perPage,
        },
        ...(listOptions.signal === undefined ? {} : { signal: listOptions.signal }),
      });
      return page(
        response,
        response.result.map(mapDnsRecord),
        listOptions.page,
        listOptions.perPage,
      );
    },

    async getDnsRecord(recordOptions) {
      const response = await request({
        path: `/zones/${encodeURIComponent(recordOptions.zoneId)}/dns_records/${encodeURIComponent(recordOptions.recordId)}`,
        schema: dnsRecordEnvelopeSchema,
        ...(recordOptions.signal === undefined ? {} : { signal: recordOptions.signal }),
      });
      return mapDnsRecord(response.result);
    },

    async createDnsRecord(recordOptions) {
      const response = await request({
        path: `/zones/${encodeURIComponent(recordOptions.zoneId)}/dns_records`,
        method: 'POST',
        schema: dnsRecordEnvelopeSchema,
        body: {
          type: recordOptions.type,
          name: recordOptions.name,
          content: recordOptions.content,
          ...(recordOptions.ttl === undefined ? {} : { ttl: recordOptions.ttl }),
          ...(recordOptions.proxied === undefined ? {} : { proxied: recordOptions.proxied }),
          ...(recordOptions.priority === undefined ? {} : { priority: recordOptions.priority }),
          ...(recordOptions.comment === undefined ? {} : { comment: recordOptions.comment }),
          ...(recordOptions.tags === undefined ? {} : { tags: recordOptions.tags }),
        },
        ...(recordOptions.signal === undefined ? {} : { signal: recordOptions.signal }),
      });
      return mapDnsRecord(response.result);
    },

    async updateDnsRecord(recordOptions) {
      const response = await request({
        path: `/zones/${encodeURIComponent(recordOptions.zoneId)}/dns_records/${encodeURIComponent(recordOptions.recordId)}`,
        method: 'PATCH',
        schema: dnsRecordEnvelopeSchema,
        body: {
          ...(recordOptions.type === undefined ? {} : { type: recordOptions.type }),
          ...(recordOptions.name === undefined ? {} : { name: recordOptions.name }),
          ...(recordOptions.content === undefined ? {} : { content: recordOptions.content }),
          ...(recordOptions.ttl === undefined ? {} : { ttl: recordOptions.ttl }),
          ...(recordOptions.proxied === undefined ? {} : { proxied: recordOptions.proxied }),
          ...(recordOptions.priority === undefined ? {} : { priority: recordOptions.priority }),
          ...(recordOptions.comment === undefined ? {} : { comment: recordOptions.comment }),
          ...(recordOptions.tags === undefined ? {} : { tags: recordOptions.tags }),
        },
        ...(recordOptions.signal === undefined ? {} : { signal: recordOptions.signal }),
      });
      return mapDnsRecord(response.result);
    },

    async deleteDnsRecord(recordOptions) {
      const response = await request({
        path: `/zones/${encodeURIComponent(recordOptions.zoneId)}/dns_records/${encodeURIComponent(recordOptions.recordId)}`,
        method: 'DELETE',
        schema: deleteDnsRecordEnvelopeSchema,
        ...(recordOptions.signal === undefined ? {} : { signal: recordOptions.signal }),
      });
      return response.result;
    },

    async purgeCache(purgeOptions) {
      const response = await request({
        path: `/zones/${encodeURIComponent(purgeOptions.zoneId)}/purge_cache`,
        method: 'POST',
        schema: purgeCacheEnvelopeSchema,
        body: {
          ...(purgeOptions.files === undefined ? {} : { files: purgeOptions.files }),
          ...(purgeOptions.purgeEverything === undefined
            ? {}
            : { purge_everything: purgeOptions.purgeEverything }),
        },
        ...(purgeOptions.signal === undefined ? {} : { signal: purgeOptions.signal }),
      });
      return response.result;
    },
  };
}
