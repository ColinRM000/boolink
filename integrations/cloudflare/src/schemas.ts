import * as z from 'zod/v4';

const dateTime = z.iso.datetime({ offset: true });

const responseInfoSchema = z
  .object({
    code: z.number().int(),
    message: z.string(),
  })
  .loose();

const resultInfoSchema = z
  .object({
    page: z.number().int().positive().optional(),
    per_page: z.number().int().positive().optional(),
    count: z.number().int().nonnegative().optional(),
    total_count: z.number().int().nonnegative().optional(),
    total_pages: z.number().int().nonnegative().optional(),
  })
  .loose();

function envelope<T extends z.ZodType>(result: T) {
  return z
    .object({
      success: z.boolean(),
      errors: z.array(responseInfoSchema).default([]),
      messages: z.array(responseInfoSchema).default([]),
      result,
      result_info: resultInfoSchema.optional(),
    })
    .loose();
}

export const tokenVerificationEnvelopeSchema = envelope(
  z
    .object({
      id: z.string().max(32),
      status: z.enum(['active', 'disabled', 'expired']),
      expires_on: dateTime.optional(),
      not_before: dateTime.optional(),
    })
    .loose(),
);

export const zoneSchema = z
  .object({
    id: z.string().max(32),
    name: z.string().min(1).max(253),
    status: z.enum(['initializing', 'pending', 'active', 'moved']),
    paused: z.boolean(),
    type: z.enum(['full', 'partial', 'secondary', 'internal']),
    development_mode: z.number().int(),
    name_servers: z.array(z.string()),
    created_on: dateTime,
    modified_on: dateTime,
    activated_on: dateTime.nullable().optional(),
    account: z
      .object({
        id: z.string().max(32).optional(),
        name: z.string().optional(),
      })
      .loose(),
  })
  .loose();

export const zoneEnvelopeSchema = envelope(zoneSchema);
export const zoneListEnvelopeSchema = envelope(z.array(zoneSchema));

export const dnsRecordSchema = z
  .object({
    id: z.string().max(32),
    zone_id: z.string().max(32),
    zone_name: z.string().min(1).max(253),
    name: z.string().min(1).max(255),
    type: z.string().min(1).max(20),
    content: z.string(),
    proxiable: z.boolean().optional(),
    proxied: z.boolean().optional(),
    ttl: z.number().int().positive(),
    priority: z.number().int().optional(),
    comment: z.string().nullable().optional(),
    tags: z.array(z.string()).optional(),
    created_on: dateTime,
    modified_on: dateTime,
  })
  .loose();

export const dnsRecordEnvelopeSchema = envelope(dnsRecordSchema);
export const dnsRecordListEnvelopeSchema = envelope(z.array(dnsRecordSchema));

export const deleteDnsRecordEnvelopeSchema = envelope(z.object({ id: z.string().max(32) }).loose());
export const purgeCacheEnvelopeSchema = envelope(z.object({ id: z.string().max(32) }).loose());

export type CloudflareEnvelope<T> = {
  success: boolean;
  errors: Array<{ code: number; message: string }>;
  messages: Array<{ code: number; message: string }>;
  result: T;
  result_info?:
    | {
        page?: number | undefined;
        per_page?: number | undefined;
        count?: number | undefined;
        total_count?: number | undefined;
        total_pages?: number | undefined;
      }
    | undefined;
};

export type ZoneResponse = z.infer<typeof zoneSchema>;
export type DnsRecordResponse = z.infer<typeof dnsRecordSchema>;
