import { Client, InMemoryTransport } from '@modelcontextprotocol/client';
import { afterEach, describe, expect, it } from 'vitest';

import { createBooLinkServer } from '@boolink-dev/sdk';
import { createGitHubClient, type GitHubFetch } from './client.js';
import { createGitHubIntegration, githubManifest } from './index.js';

const closeables: Array<{ close: () => Promise<void> }> = [];

afterEach(async () => {
  await Promise.allSettled(closeables.splice(0).map((closeable) => closeable.close()));
});

describe('GitHub integration', () => {
  it('publishes the complete MVP manifest with explicit read and write classification', () => {
    expect(githubManifest.tools.map(({ name }) => name)).toEqual([
      'github.get_authenticated_user',
      'github.search_issues',
      'github.get_issue',
      'github.list_issue_comments',
      'github.create_issue',
      'github.update_issue',
      'github.add_issue_comment',
      'github.list_pull_requests',
      'github.get_pull_request',
      'github.create_pull_request',
    ]);
    expect(githubManifest.version).toBe('0.2.1');
    expect(githubManifest.verification).toBe('official');
    expect(githubManifest.tools.find(({ name }) => name === 'github.update_issue')).toMatchObject({
      capabilities: ['modify', 'communication'],
      destructive: true,
      idempotent: true,
      requiredScopes: ['Issues: write'],
    });
    expect(
      githubManifest.tools.find(({ name }) => name === 'github.add_issue_comment'),
    ).toMatchObject({
      capabilities: ['create', 'communication'],
      destructive: false,
      idempotent: false,
    });
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
    expect(listed.tools).toHaveLength(10);
    expect(
      listed.tools.find((tool) => tool.name === 'github.update_issue')?.annotations,
    ).toMatchObject({
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
    });
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

  it('rejects empty or inconsistent issue updates before contacting GitHub', async () => {
    let requests = 0;
    const definition = createGitHubIntegration(
      createGitHubClient({
        token: 'github_pat_validation_test',
        fetchImpl: async () => {
          requests += 1;
          return new Response('{}');
        },
      }),
    );
    const updateIssue = definition.tools.find(
      ({ metadata }) => metadata.name === 'github.update_issue',
    );
    expect(updateIssue).toBeDefined();

    await expect(
      updateIssue?.execute({ owner: 'boolink', repository: 'boolink', issueNumber: 1 }, {}),
    ).rejects.toThrow('At least one issue field must be supplied.');
    await expect(
      updateIssue?.execute(
        {
          owner: 'boolink',
          repository: 'boolink',
          issueNumber: 1,
          state: 'open',
          stateReason: 'completed',
        },
        {},
      ),
    ).rejects.toThrow('completed or not_planned reason requires state to be closed');
    expect(requests).toBe(0);
  });

  it('executes a classified issue mutation through MCP without exposing the token', async () => {
    const secret = 'github_pat_mcp_write_test';
    let request: { url: string; init?: RequestInit } | undefined;
    const definition = createGitHubIntegration(
      createGitHubClient({
        token: secret,
        fetchImpl: async (input, init) => {
          request = { url: String(input), ...(init === undefined ? {} : { init }) };
          return new Response(
            JSON.stringify({
              number: 42,
              title: 'Finish the GitHub MCP',
              state: 'open',
              state_reason: null,
              locked: false,
              html_url: 'https://github.com/boolink/boolink/issues/42',
              repository_url: 'https://api.github.com/repos/boolink/boolink',
              body: 'Ship the complete MVP tool surface.',
              user: null,
              labels: [],
              assignees: [],
              comments: 0,
              created_at: '2026-08-13T12:00:00Z',
              updated_at: '2026-08-13T12:00:00Z',
              closed_at: null,
            }),
            { status: 201, headers: { 'content-type': 'application/json' } },
          );
        },
      }),
    );
    const server = createBooLinkServer(definition);
    const client = new Client({ name: 'boolink-github-write-test', version: '0.0.0' });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    closeables.push(client, server);
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    const result = await client.callTool({
      name: 'github.create_issue',
      arguments: {
        owner: 'boolink',
        repository: 'boolink',
        title: 'Finish the GitHub MCP',
        body: 'Ship the complete MVP tool surface.',
      },
    });

    expect(result.isError).not.toBe(true);
    expect(result.structuredContent).toMatchObject({ issue: { number: 42, state: 'open' } });
    expect(request?.url).toBe('https://api.github.com/repos/boolink/boolink/issues');
    expect(request?.init?.method).toBe('POST');
    expect(String(request?.init?.body)).not.toContain(secret);
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
