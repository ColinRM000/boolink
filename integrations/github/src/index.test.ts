import { Client, InMemoryTransport } from '@modelcontextprotocol/client';
import { afterEach, describe, expect, it } from 'vitest';

import { createBooLinkServer } from '@boolink/sdk';
import { createGitHubClient, type GitHubFetch } from './client.js';
import { createGitHubIntegration, githubManifest } from './index.js';

const closeables: Array<{ close: () => Promise<void> }> = [];

afterEach(async () => {
  await Promise.allSettled(closeables.splice(0).map((closeable) => closeable.close()));
});

describe('GitHub integration', () => {
  it('publishes the manifest tool set with read-only capability classification', () => {
    expect(githubManifest.tools.map(({ name }) => name)).toEqual([
      'github.get_authenticated_user',
      'github.search_issues',
      'github.get_issue',
      'github.list_pull_requests',
    ]);
    expect(githubManifest.tools.every((tool) => tool.capabilities.includes('read'))).toBe(true);
    expect(githubManifest.tools.every((tool) => !tool.destructive)).toBe(true);
  });

  it('supports MCP discovery and execution through the official in-memory client', async () => {
    const fetchImpl: GitHubFetch = async () =>
      new Response(
        JSON.stringify({
          login: 'octocat',
          id: 1,
          name: 'The Octocat',
          company: null,
          blog: '',
          location: null,
          email: null,
          bio: null,
          html_url: 'https://github.com/octocat',
          public_repos: 8,
          followers: 100,
          following: 2,
          created_at: '2026-08-12T12:00:00Z',
          updated_at: '2026-08-12T12:00:00Z',
        }),
        { headers: { 'content-type': 'application/json' } },
      );
    const definition = createGitHubIntegration(
      createGitHubClient({ token: 'github_pat_mcp_test_token', fetchImpl }),
    );
    const server = createBooLinkServer(definition);
    const client = new Client({ name: 'boolink-github-test', version: '0.0.0' });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    closeables.push(client, server);

    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    const listed = await client.listTools();
    expect(listed.tools).toHaveLength(4);
    expect(listed.tools.every((tool) => tool.annotations?.readOnlyHint === true)).toBe(true);
    expect(listed.tools.find((tool) => tool.name === 'github.get_issue')?._meta).toMatchObject({
      'io.boolink/tool': {
        capabilities: ['read'],
        requiredScopes: ['Issues: read for private repositories'],
      },
    });

    const result = await client.callTool({
      name: 'github.get_authenticated_user',
      arguments: {},
    });
    expect(result.isError).not.toBe(true);
    expect(result.structuredContent).toMatchObject({ user: { login: 'octocat', id: 1 } });
  });

  it('does not expose a token or provider error payload through MCP', async () => {
    const secret = 'github_pat_never_return_this_secret';
    const definition = createGitHubIntegration(
      createGitHubClient({
        token: secret,
        fetchImpl: async () =>
          new Response(JSON.stringify({ message: `Bad credentials: ${secret}` }), {
            status: 401,
            headers: { 'content-type': 'application/json' },
          }),
      }),
    );
    const server = createBooLinkServer(definition);
    const client = new Client({ name: 'boolink-github-leak-test', version: '0.0.0' });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    closeables.push(client, server);
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    const result = await client.callTool({
      name: 'github.get_authenticated_user',
      arguments: {},
    });
    const serialized = JSON.stringify(result);

    expect(result.isError).toBe(true);
    expect(serialized).toContain('github_unauthorized');
    expect(serialized).not.toContain(secret);
    expect(serialized).not.toContain('Bad credentials');
  });
});
