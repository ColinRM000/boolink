import {
  defineIntegration,
  defineTool,
  type IntegrationManifest,
  type ToolMetadata,
  type ToolResult,
} from '@boolink-dev/core';
import * as z from 'zod/v4';

import type { GitHubClient } from './client.js';

export { createGitHubClient, GITHUB_API_VERSION } from './client.js';
export { loadGitHubToken } from './auth.js';
export type {
  GitHubClient,
  GitHubIssue,
  GitHubPage,
  GitHubPagination,
  GitHubPullRequest,
  GitHubRateLimit,
  GitHubViewer,
} from './client.js';

const repositoryNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(100)
  .regex(/^[A-Za-z0-9_.-]+$/u);
const ownerSchema = z
  .string()
  .trim()
  .min(1)
  .max(39)
  .regex(/^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?$/u);
const pageSchema = z.number().int().positive().max(1_000).default(1);
const perPageSchema = z.number().int().min(1).max(100).default(30);

const getAuthenticatedUserMetadata: ToolMetadata = {
  name: 'github.get_authenticated_user',
  title: 'Get authenticated GitHub user',
  description:
    'Returns the GitHub account associated with the locally configured token. Use it to confirm which identity BooLink will act as. It has no side effects and accepts no inputs.',
  capabilities: ['read'],
  destructive: false,
  idempotent: true,
  requiredScopes: [],
};

const searchIssuesMetadata: ToolMetadata = {
  name: 'github.search_issues',
  title: 'Search GitHub issues',
  description:
    'Searches GitHub issues using GitHub search syntax. Use it to find issues across repositories visible to the configured token. Results exclude pull requests, are paginated, and this tool has no side effects. The query is required.',
  capabilities: ['read'],
  destructive: false,
  idempotent: true,
  requiredScopes: ['Issues: read for private repositories'],
};

const getIssueMetadata: ToolMetadata = {
  name: 'github.get_issue',
  title: 'Get a GitHub issue',
  description:
    'Returns one issue by repository and number. Use it when an exact issue is known and full issue details are needed. GitHub may identify a pull request through this endpoint; the result marks that case. It has no side effects.',
  capabilities: ['read'],
  destructive: false,
  idempotent: true,
  requiredScopes: ['Issues: read for private repositories'],
};

const listPullRequestsMetadata: ToolMetadata = {
  name: 'github.list_pull_requests',
  title: 'List GitHub pull requests',
  description:
    'Lists pull requests in one repository with state, branch, sort, and pagination filters. Use it to inspect repository collaboration activity. It has no side effects; owner and repository are required.',
  capabilities: ['read'],
  destructive: false,
  idempotent: true,
  requiredScopes: ['Pull requests: read for private repositories'],
};

const toolMetadata = [
  getAuthenticatedUserMetadata,
  searchIssuesMetadata,
  getIssueMetadata,
  listPullRequestsMetadata,
];

export const githubManifest: IntegrationManifest = {
  schemaVersion: 1,
  id: 'github',
  name: 'GitHub',
  description:
    'Connect AI agents to GitHub repositories, issues, and pull requests through a local MCP server.',
  version: '0.1.0',
  provider: 'GitHub',
  category: 'development',
  packageName: '@boolink-dev/github',
  repositoryUrl: 'https://github.com/ColinRM000/boolink',
  documentationUrl: 'https://boolink.dev/integrations/github',
  verification: 'experimental',
  authentication: {
    type: 'bearer-token',
    instructionsUrl:
      'https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens',
    requirements: [
      {
        id: 'token',
        label: 'GitHub token',
        description:
          'A fine-grained personal access token with read access only to the repositories and capabilities you intend to expose.',
        source: 'environment',
        environmentVariables: ['GITHUB_TOKEN'],
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

export function createGitHubIntegration(client: GitHubClient) {
  return defineIntegration({
    manifest: githubManifest,
    tools: [
      defineTool({
        metadata: getAuthenticatedUserMetadata,
        inputSchema: z.object({}).strict(),
        async execute(_input, context) {
          return result({ user: await client.getAuthenticatedUser(context.signal) });
        },
      }),
      defineTool({
        metadata: searchIssuesMetadata,
        inputSchema: z
          .object({
            query: z.string().trim().min(1).max(240),
            sort: z.enum(['comments', 'created', 'updated']).optional(),
            order: z.enum(['asc', 'desc']).optional(),
            page: pageSchema,
            perPage: perPageSchema,
          })
          .strict(),
        async execute(input, context) {
          const search = await client.searchIssues({
            query: input.query,
            page: input.page,
            perPage: input.perPage,
            ...(input.sort === undefined ? {} : { sort: input.sort }),
            ...(input.order === undefined ? {} : { order: input.order }),
            ...(context.signal === undefined ? {} : { signal: context.signal }),
          });
          return result({
            totalCount: search.totalCount,
            incompleteResults: search.incompleteResults,
            ...search.page,
          });
        },
      }),
      defineTool({
        metadata: getIssueMetadata,
        inputSchema: z
          .object({
            owner: ownerSchema,
            repository: repositoryNameSchema,
            issueNumber: z.number().int().positive(),
          })
          .strict(),
        async execute(input, context) {
          return result({
            issue: await client.getIssue({
              ...input,
              ...(context.signal === undefined ? {} : { signal: context.signal }),
            }),
          });
        },
      }),
      defineTool({
        metadata: listPullRequestsMetadata,
        inputSchema: z
          .object({
            owner: ownerSchema,
            repository: repositoryNameSchema,
            state: z.enum(['open', 'closed', 'all']).default('open'),
            head: z.string().trim().min(1).max(200).optional(),
            base: z.string().trim().min(1).max(200).optional(),
            sort: z.enum(['created', 'updated', 'popularity', 'long-running']).default('created'),
            direction: z.enum(['asc', 'desc']).optional(),
            page: pageSchema,
            perPage: perPageSchema,
          })
          .strict(),
        async execute(input, context) {
          return result({
            ...(await client.listPullRequests({
              owner: input.owner,
              repository: input.repository,
              state: input.state,
              sort: input.sort,
              page: input.page,
              perPage: input.perPage,
              ...(input.head === undefined ? {} : { head: input.head }),
              ...(input.base === undefined ? {} : { base: input.base }),
              ...(input.direction === undefined ? {} : { direction: input.direction }),
              ...(context.signal === undefined ? {} : { signal: context.signal }),
            })),
          });
        },
      }),
    ],
  });
}
