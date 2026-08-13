import { describe, expect, it } from 'vitest';

import { loadCloudflareToken } from './auth.js';

describe('Cloudflare authentication', () => {
  it('loads the token only from the owning environment variable', () => {
    expect(loadCloudflareToken({ CLOUDFLARE_API_TOKEN: 'cloudflare_test_token' })).toBe(
      'cloudflare_test_token',
    );
  });

  it('rejects missing, empty, and multiline credentials with safe errors', () => {
    expect(() => loadCloudflareToken({})).toThrow(/Set CLOUDFLARE_API_TOKEN locally/);
    expect(() => loadCloudflareToken({ CLOUDFLARE_API_TOKEN: '' })).toThrow(
      /Set CLOUDFLARE_API_TOKEN locally/,
    );
    expect(() => loadCloudflareToken({ CLOUDFLARE_API_TOKEN: 'first\nsecond' })).toThrow(
      /valid single-line token/,
    );
  });
});
