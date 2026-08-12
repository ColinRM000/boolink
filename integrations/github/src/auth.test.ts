import { describe, expect, it } from 'vitest';

import { loadGitHubToken } from './auth.js';

describe('GitHub authentication', () => {
  it('loads the token only from the owning environment variable', () => {
    expect(loadGitHubToken({ GITHUB_TOKEN: 'github_pat_test_token' })).toBe(
      'github_pat_test_token',
    );
  });

  it('rejects missing, empty, and multiline credentials with safe errors', () => {
    expect(() => loadGitHubToken({})).toThrow(/Set GITHUB_TOKEN locally/);
    expect(() => loadGitHubToken({ GITHUB_TOKEN: '' })).toThrow(/Set GITHUB_TOKEN locally/);
    expect(() => loadGitHubToken({ GITHUB_TOKEN: 'github_pat_first\nsecond' })).toThrow(
      /valid single-line token/,
    );
  });
});
