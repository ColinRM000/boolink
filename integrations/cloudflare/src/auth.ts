import { BooLinkError } from '@boolink-dev/core';
import * as z from 'zod/v4';

const cloudflareTokenSchema = z
  .string()
  .min(1)
  .max(2_048)
  .regex(/^\S+$/u)
  .refine((value) =>
    Array.from(value).every((character) => {
      const codePoint = character.codePointAt(0);
      return codePoint !== undefined && codePoint > 31 && codePoint !== 127;
    }),
  );

export function loadCloudflareToken(environment: NodeJS.ProcessEnv = process.env): string {
  const token = environment.CLOUDFLARE_API_TOKEN;

  if (token === undefined || token.length === 0) {
    throw new BooLinkError({
      code: 'cloudflare_auth_missing',
      safeMessage: 'Cloudflare authentication is not configured. Set CLOUDFLARE_API_TOKEN locally.',
    });
  }

  const parsed = cloudflareTokenSchema.safeParse(token);
  if (!parsed.success) {
    throw new BooLinkError({
      code: 'cloudflare_auth_invalid',
      safeMessage: 'CLOUDFLARE_API_TOKEN is not a valid single-line token.',
    });
  }

  return parsed.data;
}
