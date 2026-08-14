import {
  defineIntegration,
  defineTool,
  type IntegrationManifest,
  type ToolMetadata,
  type ToolResult,
} from '@boolink-dev/core';
import * as z from 'zod/v4';

import type { CloudflareClient, DnsRecordWrite } from './client.js';

export { createCloudflareClient } from './client.js';
export { loadCloudflareToken } from './auth.js';
export type {
  CloudflareClient,
  CloudflareDnsRecord,
  CloudflareFetch,
  CloudflarePage,
  CloudflarePagination,
  CloudflareTokenVerification,
  CloudflareZone,
} from './client.js';

const resourceIdSchema = z
  .string()
  .trim()
  .regex(/^[A-Fa-f0-9]{32}$/u, 'Cloudflare resource IDs must be 32 hexadecimal characters.');
const zoneIdSchema = resourceIdSchema;
const recordIdSchema = resourceIdSchema;
const pageSchema = z.number().int().positive().max(10_000).default(1);
const zonePerPageSchema = z.number().int().min(5).max(50).default(20);
const dnsPerPageSchema = z.number().int().min(5).max(100).default(50);
const dnsNameSchema = z.string().trim().min(1).max(255);
const dnsContentSchema = z.string().trim().min(1).max(4_096);
const dnsTypeSchema = z.enum([
  'A',
  'AAAA',
  'CAA',
  'CERT',
  'CNAME',
  'DNSKEY',
  'DS',
  'HTTPS',
  'LOC',
  'MX',
  'NAPTR',
  'NS',
  'PTR',
  'SMIMEA',
  'SRV',
  'SSHFP',
  'SVCB',
  'TLSA',
  'TXT',
  'URI',
]);
const ttlSchema = z.union([z.literal(1), z.number().int().min(30).max(86_400)]);
const tagsSchema = z.array(z.string().trim().min(1).max(100)).max(20);

const dnsWriteSchema = {
  type: dnsTypeSchema,
  name: dnsNameSchema,
  content: dnsContentSchema,
  ttl: ttlSchema.optional(),
  proxied: z.boolean().optional(),
  priority: z.number().int().min(0).max(65_535).optional(),
  comment: z.string().trim().max(100).optional(),
  tags: tagsSchema.optional(),
} as const;

const verifyTokenMetadata: ToolMetadata = {
  name: 'cloudflare.verify_token',
  title: 'Verify Cloudflare API token',
  description:
    'Verifies the locally configured Cloudflare API token and returns only its identifier, status, and validity dates. Use it before other operations to confirm authentication. It accepts no inputs and has no side effects.',
  capabilities: ['read'],
  destructive: false,
  idempotent: true,
  requiredScopes: [],
};

const listZonesMetadata: ToolMetadata = {
  name: 'cloudflare.list_zones',
  title: 'List Cloudflare zones',
  description:
    'Lists zones visible to the local token with optional name, status, account, and pagination filters. Use it to discover the exact zone ID needed by DNS and cache tools. It has no side effects.',
  capabilities: ['read'],
  destructive: false,
  idempotent: true,
  requiredScopes: ['Zone: Read'],
};

const getZoneMetadata: ToolMetadata = {
  name: 'cloudflare.get_zone',
  title: 'Get Cloudflare zone',
  description:
    'Returns one Cloudflare zone by its exact 32-character ID, including status, type, nameservers, account summary, and timestamps. Use it to inspect a known zone. It has no side effects.',
  capabilities: ['read'],
  destructive: false,
  idempotent: true,
  requiredScopes: ['Zone: Read'],
};

const listDnsRecordsMetadata: ToolMetadata = {
  name: 'cloudflare.list_dns_records',
  title: 'List Cloudflare DNS records',
  description:
    'Lists DNS records in one zone with bounded type, name, content, proxy, and pagination filters. Use it to inspect existing records and obtain exact record IDs before any change. It has no side effects.',
  capabilities: ['read'],
  destructive: false,
  idempotent: true,
  requiredScopes: ['DNS: Read'],
};

const getDnsRecordMetadata: ToolMetadata = {
  name: 'cloudflare.get_dns_record',
  title: 'Get Cloudflare DNS record',
  description:
    'Returns one DNS record by exact zone and record IDs. Use it to review the current name, value, TTL, proxy state, comment, and tags before changing or deleting a record. It has no side effects.',
  capabilities: ['read'],
  destructive: false,
  idempotent: true,
  requiredScopes: ['DNS: Read'],
};

const createDnsRecordMetadata: ToolMetadata = {
  name: 'cloudflare.create_dns_record',
  title: 'Create Cloudflare DNS record',
  description:
    'Creates a DNS record and can immediately change how a hostname resolves or is proxied. Use it only after the user reviews the exact zone, type, name, content, TTL, and proxy state. Repeated calls can create conflicting records.',
  capabilities: ['create', 'administrative'],
  destructive: false,
  idempotent: false,
  requiredScopes: ['DNS: Write'],
};

const updateDnsRecordMetadata: ToolMetadata = {
  name: 'cloudflare.update_dns_record',
  title: 'Update Cloudflare DNS record',
  description:
    'Updates supplied fields on one exact DNS record and can redirect traffic or change proxy behavior. Use it only after reading the current record and reviewing every change. At least one field is required; this is destructive and administrative.',
  capabilities: ['modify', 'administrative'],
  destructive: true,
  idempotent: true,
  requiredScopes: ['DNS: Write'],
};

const deleteDnsRecordMetadata: ToolMetadata = {
  name: 'cloudflare.delete_dns_record',
  title: 'Delete Cloudflare DNS record',
  description:
    'Permanently deletes one DNS record by exact zone and record IDs, which can make services unreachable. Use it only after the user reviews the current record and explicitly intends its removal. This action is destructive.',
  capabilities: ['delete', 'administrative'],
  destructive: true,
  idempotent: true,
  requiredScopes: ['DNS: Write'],
};

const purgeCacheUrlsMetadata: ToolMetadata = {
  name: 'cloudflare.purge_cache_urls',
  title: 'Purge Cloudflare cache URLs',
  description:
    'Purges up to 30 exact HTTP or HTTPS URLs from one zone cache so following requests fetch fresh content. Prefer this bounded tool over a full purge. It changes production cache state, may increase origin load, and is destructive.',
  capabilities: ['modify', 'administrative'],
  destructive: true,
  idempotent: true,
  requiredScopes: ['Cache Purge'],
};

const purgeEverythingMetadata: ToolMetadata = {
  name: 'cloudflare.purge_everything',
  title: 'Purge all Cloudflare zone cache',
  description:
    'Purges every cached object for one zone and can cause a substantial temporary increase in origin traffic. Use it only when a targeted URL purge cannot solve the problem and the user explicitly confirms the full-zone effect. This action is destructive.',
  capabilities: ['modify', 'administrative'],
  destructive: true,
  idempotent: true,
  requiredScopes: ['Cache Purge'],
};

const toolMetadata = [
  verifyTokenMetadata,
  listZonesMetadata,
  getZoneMetadata,
  listDnsRecordsMetadata,
  getDnsRecordMetadata,
  createDnsRecordMetadata,
  updateDnsRecordMetadata,
  deleteDnsRecordMetadata,
  purgeCacheUrlsMetadata,
  purgeEverythingMetadata,
];

export const cloudflareManifest: IntegrationManifest = {
  schemaVersion: 1,
  id: 'cloudflare',
  name: 'Cloudflare',
  description:
    'Connect AI agents to Cloudflare zones, DNS records, and cache operations through a local MCP server.',
  version: '0.1.1',
  provider: 'Cloudflare',
  category: 'infrastructure',
  packageName: '@boolink-dev/cloudflare',
  repositoryUrl: 'https://github.com/ColinRM000/boolink',
  documentationUrl: 'https://boolink.dev/integrations/cloudflare',
  verification: 'official',
  authentication: {
    type: 'bearer-token',
    instructionsUrl: 'https://developers.cloudflare.com/fundamentals/api/get-started/create-token/',
    requirements: [
      {
        id: 'token',
        label: 'Cloudflare API token',
        description:
          'An API token restricted to the zones and Zone Read, DNS Read or Write, and Cache Purge permissions the user explicitly intends to expose.',
        source: 'environment',
        environmentVariables: ['CLOUDFLARE_API_TOKEN'],
        required: true,
      },
    ],
  },
  transports: ['stdio'],
  tools: toolMetadata,
};

function result(structuredContent: Record<string, unknown>): ToolResult {
  return {
    content: [{ type: 'text', text: JSON.stringify(structuredContent) }],
    structuredContent,
  };
}

function signal<T extends object>(
  input: T,
  requestSignal?: AbortSignal,
): T & { signal?: AbortSignal } {
  return { ...input, ...(requestSignal === undefined ? {} : { signal: requestSignal }) };
}

export function createCloudflareIntegration(client: CloudflareClient) {
  return defineIntegration({
    manifest: cloudflareManifest,
    tools: [
      defineTool({
        metadata: verifyTokenMetadata,
        inputSchema: z.object({}).strict(),
        async execute(_input, context) {
          return result({ token: await client.verifyToken(context.signal) });
        },
      }),
      defineTool({
        metadata: listZonesMetadata,
        inputSchema: z
          .object({
            name: z.string().trim().min(1).max(253).optional(),
            status: z.enum(['initializing', 'pending', 'active', 'moved']).optional(),
            accountId: resourceIdSchema.optional(),
            page: pageSchema,
            perPage: zonePerPageSchema,
          })
          .strict(),
        async execute(input, context) {
          return result(await client.listZones(signal(input, context.signal)));
        },
      }),
      defineTool({
        metadata: getZoneMetadata,
        inputSchema: z.object({ zoneId: zoneIdSchema }).strict(),
        async execute(input, context) {
          return result({ zone: await client.getZone(input.zoneId, context.signal) });
        },
      }),
      defineTool({
        metadata: listDnsRecordsMetadata,
        inputSchema: z
          .object({
            zoneId: zoneIdSchema,
            type: dnsTypeSchema.optional(),
            name: dnsNameSchema.optional(),
            content: dnsContentSchema.optional(),
            proxied: z.boolean().optional(),
            page: pageSchema,
            perPage: dnsPerPageSchema,
          })
          .strict(),
        async execute(input, context) {
          return result(await client.listDnsRecords(signal(input, context.signal)));
        },
      }),
      defineTool({
        metadata: getDnsRecordMetadata,
        inputSchema: z.object({ zoneId: zoneIdSchema, recordId: recordIdSchema }).strict(),
        async execute(input, context) {
          return result({ record: await client.getDnsRecord(signal(input, context.signal)) });
        },
      }),
      defineTool({
        metadata: createDnsRecordMetadata,
        inputSchema: z.object({ zoneId: zoneIdSchema, ...dnsWriteSchema }).strict(),
        async execute(input, context) {
          return result({ record: await client.createDnsRecord(signal(input, context.signal)) });
        },
      }),
      defineTool({
        metadata: updateDnsRecordMetadata,
        inputSchema: z
          .object({
            zoneId: zoneIdSchema,
            recordId: recordIdSchema,
            type: dnsTypeSchema.optional(),
            name: dnsNameSchema.optional(),
            content: dnsContentSchema.optional(),
            ttl: ttlSchema.optional(),
            proxied: z.boolean().optional(),
            priority: z.number().int().min(0).max(65_535).optional(),
            comment: z.string().trim().max(100).optional(),
            tags: tagsSchema.optional(),
          })
          .strict()
          .superRefine((input, context) => {
            const writeKeys: Array<keyof DnsRecordWrite> = [
              'type',
              'name',
              'content',
              'ttl',
              'proxied',
              'priority',
              'comment',
              'tags',
            ];
            if (writeKeys.every((key) => input[key] === undefined)) {
              context.addIssue({
                code: 'custom',
                message: 'At least one DNS record field must be supplied.',
              });
            }
          }),
        async execute(input, context) {
          return result({ record: await client.updateDnsRecord(signal(input, context.signal)) });
        },
      }),
      defineTool({
        metadata: deleteDnsRecordMetadata,
        inputSchema: z.object({ zoneId: zoneIdSchema, recordId: recordIdSchema }).strict(),
        async execute(input, context) {
          return result({ deleted: await client.deleteDnsRecord(signal(input, context.signal)) });
        },
      }),
      defineTool({
        metadata: purgeCacheUrlsMetadata,
        inputSchema: z
          .object({
            zoneId: zoneIdSchema,
            urls: z
              .array(z.url({ protocol: /^https?$/u }))
              .min(1)
              .max(30),
          })
          .strict(),
        async execute(input, context) {
          return result({
            purge: await client.purgeCache(
              signal({ zoneId: input.zoneId, files: input.urls }, context.signal),
            ),
          });
        },
      }),
      defineTool({
        metadata: purgeEverythingMetadata,
        inputSchema: z
          .object({
            zoneId: zoneIdSchema,
            confirmPurgeEverything: z.literal(true),
          })
          .strict(),
        async execute(input, context) {
          return result({
            purge: await client.purgeCache(
              signal({ zoneId: input.zoneId, purgeEverything: true }, context.signal),
            ),
          });
        },
      }),
    ],
  });
}
