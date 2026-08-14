import { BooLinkError } from '@boolink-dev/core';
import { describe, expect, it } from 'vitest';

import { createGitHubClient, GITHUB_API_VERSION, type GitHubFetch } from './client.js';

const fakeToken = 'github_pat_distinctive_test_secret';
const timestamp = '2026-08-12T12:00:00Z';

const viewerResponse = {
  login: 'octocat',
  id: 1,
  name: 'The Octocat',
  company: '@github',
  blog: 'https://github.blog',
  location: 'San Francisco',
  email: null,
  bio: 'GitHub mascot',
  html_url: 'https://github.com/octocat',
  public_repos: 8,
  followers: 100,
  following: 2,
  created_at: timestamp,
  updated_at: timestamp,
};

const issueResponse = {
  number: 42,
  title: 'Keep credentials local',
  state: 'open',
  state_reason: null,
  locked: false,
  html_url: 'https://github.com/boolink/boolink/issues/42',
  repository_url: 'https://api.github.com/repos/boolink/boolink',
  body: 'Document the security boundary.',
  user: {
    login: 'octocat',
    id: 1,
    html_url: 'https://github.com/octocat',
  },
  labels: [{ name: 'security' }, 'documentation'],
  assignees: [],
  comments: 3,
  created_at: timestamp,
  updated_at: timestamp,
  closed_at: null,
};

const pullRequestResponse = {
  number: 7,
  title: 'Add GitHub integration',
  state: 'open',
  locked: false,
  draft: false,
  html_url: 'https://github.com/boolink/boolink/pull/7',
  body: 'Reference implementation.',
  user: {
    login: 'octocat',
    id: 1,
    html_url: 'https://github.com/octocat',
  },
  head: { label: 'octocat:github', ref: 'github' },
  base: { label: 'boolink:main', ref: 'main' },
  created_at: timestamp,
  updated_at: timestamp,
  closed_at: null,
  merged_at: null,
};

const commentResponse = {
  id: 99,
  html_url: 'https://github.com/boolink/boolink/issues/42#issuecomment-99',
  body: 'A safe public comment.',
  user: {
    login: 'octocat',
    id: 1,
    html_url: 'https://github.com/octocat',
  },
  created_at: timestamp,
  updated_at: timestamp,
  author_association: 'OWNER',
};

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    ...init,
    headers: { 'content-type': 'application/json', ...init.headers },
  });
}

describe('GitHub API client', () => {
  it('constructs the authenticated request and maps an untrusted user response', async () => {
    const requests: Array<{ url: string; init?: RequestInit }> = [];
    const fetchImpl: GitHubFetch = async (input, init) => {
      requests.push({ url: String(input), ...(init === undefined ? {} : { init }) });
      return jsonResponse(viewerResponse);
    };
    const client = createGitHubClient({ token: fakeToken, fetchImpl });

    await expect(client.getAuthenticatedUser()).resolves.toMatchObject({
      login: 'octocat',
      publicRepositories: 8,
      url: 'https://github.com/octocat',
    });

    expect(requests).toHaveLength(1);
    expect(requests[0]?.url).toBe('https://api.github.com/user');
    expect(requests[0]?.init).toMatchObject({
      method: 'GET',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${fakeToken}`,
        'User-Agent': 'BooLink-GitHub/0.2.1',
        'X-GitHub-Api-Version': GITHUB_API_VERSION,
      },
    });
  });

  it('constructs validated issue writes without leaking credentials into request bodies', async () => {
    const requests: Array<{ url: string; init?: RequestInit }> = [];
    const responses = [
      jsonResponse(issueResponse, { status: 201 }),
      jsonResponse({ ...issueResponse, state: 'closed', state_reason: 'completed' }),
      jsonResponse(commentResponse, { status: 201 }),
    ];
    const client = createGitHubClient({
      token: fakeToken,
      fetchImpl: async (input, init) => {
        requests.push({ url: String(input), ...(init === undefined ? {} : { init }) });
        const response = responses.shift();
        if (response === undefined) throw new Error('Unexpected request');
        return response;
      },
    });

    await expect(
      client.createIssue({
        owner: 'boolink',
        repository: 'boolink',
        title: 'Finish the GitHub MCP',
        body: 'Implement the approved write slice.',
        labels: ['enhancement'],
        assignees: ['octocat'],
      }),
    ).resolves.toMatchObject({ number: 42, repository: 'boolink/boolink' });
    await expect(
      client.updateIssue({
        owner: 'boolink',
        repository: 'boolink',
        issueNumber: 42,
        state: 'closed',
        stateReason: 'completed',
        labels: [],
      }),
    ).resolves.toMatchObject({ state: 'closed', stateReason: 'completed' });
    await expect(
      client.addIssueComment({
        owner: 'boolink',
        repository: 'boolink',
        issueNumber: 42,
        body: 'A safe public comment.',
      }),
    ).resolves.toMatchObject({ id: 99, authorAssociation: 'OWNER' });

    expect(requests.map(({ init }) => init?.method)).toEqual(['POST', 'PATCH', 'POST']);
    expect(requests.map(({ url }) => new URL(url).pathname)).toEqual([
      '/repos/boolink/boolink/issues',
      '/repos/boolink/boolink/issues/42',
      '/repos/boolink/boolink/issues/42/comments',
    ]);
    expect(JSON.parse(String(requests[0]?.init?.body))).toEqual({
      title: 'Finish the GitHub MCP',
      body: 'Implement the approved write slice.',
      labels: ['enhancement'],
      assignees: ['octocat'],
    });
    expect(JSON.parse(String(requests[1]?.init?.body))).toEqual({
      state: 'closed',
      state_reason: 'completed',
      labels: [],
    });
    expect(JSON.stringify(requests.map(({ init }) => init?.body))).not.toContain(fakeToken);
  });

  it('lists comments and gets and creates pull requests with bounded contracts', async () => {
    const requests: Array<{ url: string; init?: RequestInit }> = [];
    const responses = [
      jsonResponse([commentResponse], {
        headers: { link: '<https://api.github.com/comments?page=2>; rel="next"' },
      }),
      jsonResponse(pullRequestResponse),
      jsonResponse(pullRequestResponse, { status: 201 }),
    ];
    const client = createGitHubClient({
      token: fakeToken,
      fetchImpl: async (input, init) => {
        requests.push({ url: String(input), ...(init === undefined ? {} : { init }) });
        const response = responses.shift();
        if (response === undefined) throw new Error('Unexpected request');
        return response;
      },
    });

    await expect(
      client.listIssueComments({
        owner: 'boolink',
        repository: 'boolink',
        issueNumber: 42,
        page: 1,
        perPage: 20,
      }),
    ).resolves.toMatchObject({
      items: [{ id: 99 }],
      pagination: { page: 1, perPage: 20, hasNextPage: true, nextPage: 2 },
    });
    await expect(
      client.getPullRequest({
        owner: 'boolink',
        repository: 'boolink',
        pullRequestNumber: 7,
      }),
    ).resolves.toMatchObject({ number: 7, repository: 'boolink/boolink' });
    await expect(
      client.createPullRequest({
        owner: 'boolink',
        repository: 'boolink',
        title: 'Complete GitHub MCP',
        head: 'feature/github',
        base: 'main',
        body: 'Adds the approved MVP tool set.',
        draft: true,
      }),
    ).resolves.toMatchObject({ number: 7, draft: false });

    expect(requests.map(({ url }) => new URL(url).pathname)).toEqual([
      '/repos/boolink/boolink/issues/42/comments',
      '/repos/boolink/boolink/pulls/7',
      '/repos/boolink/boolink/pulls',
    ]);
    expect(JSON.parse(String(requests[2]?.init?.body))).toEqual({
      title: 'Complete GitHub MCP',
      head: 'feature/github',
      base: 'main',
      body: 'Adds the approved MVP tool set.',
      draft: true,
    });
  });

  it('adds the issue-only qualifier and exposes bounded pagination and rate metadata', async () => {
    let requestedUrl = '';
    const fetchImpl: GitHubFetch = async (input) => {
      requestedUrl = String(input);
      return jsonResponse(
        { total_count: 81, incomplete_results: false, items: [issueResponse] },
        {
          headers: {
            link: '<https://api.github.com/search/issues?q=local&page=3>; rel="next"',
            'x-ratelimit-remaining': '29',
            'x-ratelimit-reset': '1786539600',
          },
        },
      );
    };
    const client = createGitHubClient({ token: fakeToken, fetchImpl });

    const result = await client.searchIssues({
      query: 'repo:boolink/boolink local-first',
      sort: 'updated',
      order: 'desc',
      page: 2,
      perPage: 1,
    });

    const url = new URL(requestedUrl);
    expect(url.pathname).toBe('/search/issues');
    expect(url.searchParams.get('q')).toBe('repo:boolink/boolink local-first is:issue');
    expect(url.searchParams.get('sort')).toBe('updated');
    expect(url.searchParams.get('order')).toBe('desc');
    expect(url.searchParams.get('page')).toBe('2');
    expect(url.searchParams.get('per_page')).toBe('1');
    expect(result).toMatchObject({
      totalCount: 81,
      incompleteResults: false,
      page: {
        items: [
          {
            repository: 'boolink/boolink',
            number: 42,
            labels: ['security', 'documentation'],
            isPullRequest: false,
          },
        ],
        pagination: { page: 2, perPage: 1, hasNextPage: true, nextPage: 3 },
        rateLimit: { remaining: 29, resetAt: '2026-08-12T13:00:00.000Z' },
      },
    });
  });

  it('constructs issue and pull-request URLs without accepting raw path fragments', async () => {
    const requestedUrls: string[] = [];
    const responses = [jsonResponse(issueResponse), jsonResponse([pullRequestResponse])];
    const fetchImpl: GitHubFetch = async (input) => {
      requestedUrls.push(String(input));
      const response = responses.shift();
      if (response === undefined) throw new Error('Unexpected request');
      return response;
    };
    const client = createGitHubClient({ token: fakeToken, fetchImpl });

    await expect(
      client.getIssue({ owner: 'boolink', repository: 'boolink', issueNumber: 42 }),
    ).resolves.toMatchObject({ repository: 'boolink/boolink', number: 42 });
    await expect(
      client.listPullRequests({
        owner: 'boolink',
        repository: 'boolink',
        state: 'all',
        head: 'octocat:github',
        base: 'main',
        sort: 'updated',
        direction: 'asc',
        page: 3,
        perPage: 50,
      }),
    ).resolves.toMatchObject({
      items: [{ repository: 'boolink/boolink', number: 7, head: { ref: 'github' } }],
      pagination: { page: 3, perPage: 50, hasNextPage: false },
    });

    expect(requestedUrls[0]).toBe('https://api.github.com/repos/boolink/boolink/issues/42');
    const pullsUrl = new URL(requestedUrls[1] ?? '');
    expect(pullsUrl.pathname).toBe('/repos/boolink/boolink/pulls');
    expect(Object.fromEntries(pullsUrl.searchParams)).toMatchObject({
      state: 'all',
      head: 'octocat:github',
      base: 'main',
      sort: 'updated',
      direction: 'asc',
      page: '3',
      per_page: '50',
    });
  });

  it('normalizes rate limits and removes provider payloads and credentials from errors', async () => {
    const reset = 1_786_539_660;
    const rateLimited = createGitHubClient({
      token: fakeToken,
      now: () => 1_786_539_600_000,
      fetchImpl: async () =>
        jsonResponse(
          { message: `Do not expose ${fakeToken}` },
          {
            status: 403,
            headers: { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': String(reset) },
          },
        ),
    });

    let error: unknown;
    try {
      await rateLimited.getAuthenticatedUser();
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(BooLinkError);
    expect(error).toMatchObject({
      code: 'github_rate_limited',
      message: 'GitHub rate limit exceeded. Retry after 60 seconds.',
      retryable: true,
    });
    expect(JSON.stringify(error)).not.toContain(fakeToken);
  });

  it('normalizes disabled repository features without exposing provider payloads', async () => {
    const client = createGitHubClient({
      token: fakeToken,
      fetchImpl: async () =>
        jsonResponse({ message: `Issues are disabled; diagnostic=${fakeToken}` }, { status: 410 }),
    });

    await expect(
      client.createIssue({ owner: 'boolink', repository: 'boolink', title: 'Unavailable' }),
    ).rejects.toMatchObject({
      code: 'github_feature_disabled',
      message: 'The requested GitHub feature is disabled or no longer available.',
      retryable: false,
    });
  });

  it('rejects malformed provider data with a stable safe error', async () => {
    const client = createGitHubClient({
      token: fakeToken,
      fetchImpl: async () => jsonResponse({ login: fakeToken }),
    });

    await expect(client.getAuthenticatedUser()).rejects.toMatchObject({
      code: 'github_invalid_response',
      message: 'GitHub returned an unexpected response.',
      retryable: true,
    });
  });
});
