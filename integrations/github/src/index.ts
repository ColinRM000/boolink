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
  GitHubIssueComment,
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
const issueNumberSchema = z.number().int().positive();
const titleSchema = z.string().trim().min(1).max(256);
const bodySchema = z.string().max(65_536);
const labelsSchema = z.array(z.string().trim().min(1).max(50)).max(100);
const assigneesSchema = z.array(ownerSchema).max(10);

const repositoryTargetSchema = {
  owner: ownerSchema,
  repository: repositoryNameSchema,
} as const;

const issueTargetSchema = {
  ...repositoryTargetSchema,
  issueNumber: issueNumberSchema,
} as const;

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

const listIssueCommentsMetadata: ToolMetadata = {
  name: 'github.list_issue_comments',
  title: 'List GitHub issue or pull request comments',
  description:
    'Lists timeline comments on one GitHub issue or pull request. Use it to read the public conversation before replying or changing the item. Results are paginated, it has no side effects, and owner, repository, and issue number are required.',
  capabilities: ['read'],
  destructive: false,
  idempotent: true,
  requiredScopes: [
    'Issues: read for private issues or Pull requests: read for private pull requests',
  ],
};

const createIssueMetadata: ToolMetadata = {
  name: 'github.create_issue',
  title: 'Create a GitHub issue',
  description:
    'Creates a new issue and triggers GitHub notifications. Use it only when the user intends to publish a new repository issue and has reviewed the title, body, labels, and assignees. This has an external communication side effect, requires owner, repository, and title, and cannot be automatically deduplicated.',
  capabilities: ['create', 'communication'],
  destructive: false,
  idempotent: false,
  requiredScopes: ['Issues: write'],
};

const updateIssueMetadata: ToolMetadata = {
  name: 'github.update_issue',
  title: 'Update a GitHub issue',
  description:
    'Changes fields on an existing GitHub issue, including its title, body, state, labels, or assignees, and may trigger notifications. Use it only when the user intends to modify that exact issue and has reviewed every supplied field. It can close an issue or replace label and assignee sets, so it is classified as destructive and requires at least one change.',
  capabilities: ['modify', 'communication'],
  destructive: true,
  idempotent: true,
  requiredScopes: ['Issues: write'],
};

const addIssueCommentMetadata: ToolMetadata = {
  name: 'github.add_issue_comment',
  title: 'Comment on a GitHub issue or pull request',
  description:
    'Publishes a timeline comment on an existing GitHub issue or pull request and triggers notifications. Use it only when the user intends to communicate the exact supplied text publicly to that repository conversation. Owner, repository, issue number, and a non-empty body are required, and repeated calls create duplicate comments.',
  capabilities: ['create', 'communication'],
  destructive: false,
  idempotent: false,
  requiredScopes: ['Issues: write or Pull requests: write'],
};

const getPullRequestMetadata: ToolMetadata = {
  name: 'github.get_pull_request',
  title: 'Get a GitHub pull request',
  description:
    'Returns one pull request by repository and number, including its state, branches, author, draft status, and timestamps. Use it when an exact pull request is known and detailed metadata is needed. It has no side effects and requires owner, repository, and pull request number.',
  capabilities: ['read'],
  destructive: false,
  idempotent: true,
  requiredScopes: ['Pull requests: read for private repositories'],
};

const createPullRequestMetadata: ToolMetadata = {
  name: 'github.create_pull_request',
  title: 'Create a GitHub pull request',
  description:
    'Creates a pull request between existing branches and triggers GitHub notifications. Use it only when commits are already pushed and the user intends to publish the exact title, body, head, base, and draft status. This has an external communication side effect and repeated calls may fail or create duplicate proposals.',
  capabilities: ['create', 'communication'],
  destructive: false,
  idempotent: false,
  requiredScopes: ['Pull requests: write'],
};

const toolMetadata = [
  getAuthenticatedUserMetadata,
  searchIssuesMetadata,
  getIssueMetadata,
  listIssueCommentsMetadata,
  createIssueMetadata,
  updateIssueMetadata,
  addIssueCommentMetadata,
  listPullRequestsMetadata,
  getPullRequestMetadata,
  createPullRequestMetadata,
];

export const githubManifest: IntegrationManifest = {
  schemaVersion: 1,
  id: 'github',
  name: 'GitHub',
  description:
    'Connect AI agents to GitHub repositories, issues, and pull requests through a local MCP server.',
  version: '0.2.0',
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
          'A fine-grained personal access token limited to the repositories and read or write capabilities you explicitly intend to expose.',
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
            ...issueTargetSchema,
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
        metadata: listIssueCommentsMetadata,
        inputSchema: z
          .object({
            ...issueTargetSchema,
            page: pageSchema,
            perPage: perPageSchema,
          })
          .strict(),
        async execute(input, context) {
          return result({
            ...(await client.listIssueComments({
              ...input,
              ...(context.signal === undefined ? {} : { signal: context.signal }),
            })),
          });
        },
      }),
      defineTool({
        metadata: createIssueMetadata,
        inputSchema: z
          .object({
            ...repositoryTargetSchema,
            title: titleSchema,
            body: bodySchema.optional(),
            labels: labelsSchema.optional(),
            assignees: assigneesSchema.optional(),
          })
          .strict(),
        async execute(input, context) {
          return result({
            issue: await client.createIssue({
              ...input,
              ...(context.signal === undefined ? {} : { signal: context.signal }),
            }),
          });
        },
      }),
      defineTool({
        metadata: updateIssueMetadata,
        inputSchema: z
          .object({
            ...issueTargetSchema,
            title: titleSchema.optional(),
            body: bodySchema.optional(),
            state: z.enum(['open', 'closed']).optional(),
            stateReason: z.enum(['completed', 'not_planned', 'reopened']).optional(),
            labels: labelsSchema.optional(),
            assignees: assigneesSchema.optional(),
          })
          .strict()
          .superRefine((input, context) => {
            const changes = [
              input.title,
              input.body,
              input.state,
              input.stateReason,
              input.labels,
              input.assignees,
            ];
            if (changes.every((value) => value === undefined)) {
              context.addIssue({
                code: 'custom',
                message: 'At least one issue field must be supplied.',
              });
            }
            if (input.stateReason === 'reopened' && input.state !== 'open') {
              context.addIssue({
                code: 'custom',
                message: 'The reopened reason requires state to be open.',
                path: ['stateReason'],
              });
            }
            if (
              (input.stateReason === 'completed' || input.stateReason === 'not_planned') &&
              input.state !== 'closed'
            ) {
              context.addIssue({
                code: 'custom',
                message: 'A completed or not_planned reason requires state to be closed.',
                path: ['stateReason'],
              });
            }
          }),
        async execute(input, context) {
          return result({
            issue: await client.updateIssue({
              ...input,
              ...(context.signal === undefined ? {} : { signal: context.signal }),
            }),
          });
        },
      }),
      defineTool({
        metadata: addIssueCommentMetadata,
        inputSchema: z
          .object({
            ...issueTargetSchema,
            body: bodySchema.trim().min(1),
          })
          .strict(),
        async execute(input, context) {
          return result({
            comment: await client.addIssueComment({
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
      defineTool({
        metadata: getPullRequestMetadata,
        inputSchema: z
          .object({
            ...repositoryTargetSchema,
            pullRequestNumber: z.number().int().positive(),
          })
          .strict(),
        async execute(input, context) {
          return result({
            pullRequest: await client.getPullRequest({
              ...input,
              ...(context.signal === undefined ? {} : { signal: context.signal }),
            }),
          });
        },
      }),
      defineTool({
        metadata: createPullRequestMetadata,
        inputSchema: z
          .object({
            ...repositoryTargetSchema,
            title: titleSchema,
            head: z.string().trim().min(1).max(255),
            base: z.string().trim().min(1).max(255),
            body: bodySchema.optional(),
            draft: z.boolean().optional(),
            maintainerCanModify: z.boolean().optional(),
          })
          .strict()
          .refine((input) => input.head !== input.base, {
            message: 'Head and base branches must be different.',
            path: ['head'],
          }),
        async execute(input, context) {
          return result({
            pullRequest: await client.createPullRequest({
              ...input,
              ...(context.signal === undefined ? {} : { signal: context.signal }),
            }),
          });
        },
      }),
    ],
  });
}
