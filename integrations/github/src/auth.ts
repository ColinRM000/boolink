import { BooLinkError } from '@boolink/core';
import * as z from 'zod/v4';

const githubTokenSchema = z
  .string()
  .min(1)
  .max(1_024)
  .regex(/^\S+$/u)
  .refine((value) =>
    Array.from(value).every((character) => {
      const codePoint = character.codePointAt(0);
      return codePoint !== undefined && codePoint > 31 && codePoint !== 127;
    }),
  );

export function loadGitHubToken(environment: NodeJS.ProcessEnv = process.env): string {
  const token = environment.GITHUB_TOKEN;

  if (token === undefined || token.length === 0) {
    throw new BooLinkError({
      code: 'github_auth_missing',
      safeMessage: 'GitHub authentication is not configured. Set GITHUB_TOKEN locally.',
    });
  }

  const parsed = githubTokenSchema.safeParse(token);
  if (!parsed.success) {
    throw new BooLinkError({
      code: 'github_auth_invalid',
      safeMessage: 'GITHUB_TOKEN is not a valid single-line token.',
    });
  }

  return parsed.data;
}
