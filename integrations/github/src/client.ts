import { BooLinkError } from '@boolink-dev/core';
import type * as z from 'zod/v4';

import {
  authenticatedUserResponseSchema,
  issueCommentListResponseSchema,
  issueCommentResponseSchema,
  issueResponseSchema,
  pullRequestListResponseSchema,
  pullRequestResponseSchema,
  searchIssuesResponseSchema,
  type AuthenticatedUserResponse,
  type IssueCommentResponse,
  type IssueResponse,
  type PullRequestResponse,
} from './schemas.js';

export const GITHUB_API_VERSION = '2026-03-10';
const DEFAULT_BASE_URL = 'https://api.github.com';
const USER_AGENT = 'BooLink-GitHub/0.2.1';

export type GitHubFetch = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export type GitHubRateLimit = {
  remaining?: number;
  resetAt?: string;
};

export type GitHubPagination = {
  page: number;
  perPage: number;
  hasNextPage: boolean;
  nextPage?: number;
};

export type GitHubPage<T> = {
  items: T[];
  pagination: GitHubPagination;
  rateLimit: GitHubRateLimit;
};

export type GitHubIssue = {
  repository: string;
  number: number;
  title: string;
  state: 'open' | 'closed';
  stateReason?: string | null;
  locked: boolean;
  url: string;
  body: string | null;
  author: string | null;
  labels: string[];
  assignees: string[];
  comments: number;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
  isPullRequest: boolean;
};

export type GitHubPullRequest = {
  repository: string;
  number: number;
  title: string;
  state: 'open' | 'closed';
  locked: boolean;
  draft: boolean | null;
  url: string;
  body: string | null;
  author: string | null;
  head: { label: string; ref: string };
  base: { label: string; ref: string };
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
  mergedAt: string | null;
};

export type GitHubIssueComment = {
  id: number;
  url: string;
  body: string;
  author: string | null;
  authorAssociation: string;
  createdAt: string;
  updatedAt: string;
};

export type GitHubViewer = {
  login: string;
  id: number;
  name: string | null;
  company: string | null;
  blog: string;
  location: string | null;
  email: string | null;
  bio: string | null;
  url: string;
  publicRepositories: number;
  followers: number;
  following: number;
  createdAt: string;
  updatedAt: string;
};

export type SearchIssuesOptions = {
  query: string;
  sort?: 'comments' | 'created' | 'updated';
  order?: 'asc' | 'desc';
  page: number;
  perPage: number;
  signal?: AbortSignal;
};

export type GetIssueOptions = {
  owner: string;
  repository: string;
  issueNumber: number;
  signal?: AbortSignal;
};

export type ListIssueCommentsOptions = GetIssueOptions & {
  page: number;
  perPage: number;
};

export type CreateIssueOptions = {
  owner: string;
  repository: string;
  title: string;
  body?: string | undefined;
  labels?: string[] | undefined;
  assignees?: string[] | undefined;
  signal?: AbortSignal;
};

export type UpdateIssueOptions = GetIssueOptions & {
  title?: string | undefined;
  body?: string | undefined;
  state?: 'open' | 'closed' | undefined;
  stateReason?: 'completed' | 'not_planned' | 'reopened' | undefined;
  labels?: string[] | undefined;
  assignees?: string[] | undefined;
};

export type AddIssueCommentOptions = GetIssueOptions & {
  body: string;
};

export type ListPullRequestsOptions = {
  owner: string;
  repository: string;
  state: 'open' | 'closed' | 'all';
  head?: string;
  base?: string;
  sort: 'created' | 'updated' | 'popularity' | 'long-running';
  direction?: 'asc' | 'desc';
  page: number;
  perPage: number;
  signal?: AbortSignal;
};

export type GetPullRequestOptions = {
  owner: string;
  repository: string;
  pullRequestNumber: number;
  signal?: AbortSignal;
};

export type CreatePullRequestOptions = {
  owner: string;
  repository: string;
  title: string;
  head: string;
  base: string;
  body?: string | undefined;
  draft?: boolean | undefined;
  maintainerCanModify?: boolean | undefined;
  signal?: AbortSignal;
};

export type GitHubClient = {
  getAuthenticatedUser: (signal?: AbortSignal) => Promise<GitHubViewer>;
  searchIssues: (options: SearchIssuesOptions) => Promise<{
    totalCount: number;
    incompleteResults: boolean;
    page: GitHubPage<GitHubIssue>;
  }>;
  getIssue: (options: GetIssueOptions) => Promise<GitHubIssue>;
  listIssueComments: (options: ListIssueCommentsOptions) => Promise<GitHubPage<GitHubIssueComment>>;
  createIssue: (options: CreateIssueOptions) => Promise<GitHubIssue>;
  updateIssue: (options: UpdateIssueOptions) => Promise<GitHubIssue>;
  addIssueComment: (options: AddIssueCommentOptions) => Promise<GitHubIssueComment>;
  listPullRequests: (options: ListPullRequestsOptions) => Promise<GitHubPage<GitHubPullRequest>>;
  getPullRequest: (options: GetPullRequestOptions) => Promise<GitHubPullRequest>;
  createPullRequest: (options: CreatePullRequestOptions) => Promise<GitHubPullRequest>;
};

type ClientOptions = {
  token: string;
  fetchImpl?: GitHubFetch;
  baseUrl?: string;
  now?: () => number;
};

type RequestOptions<TSchema extends z.ZodType> = {
  path: string;
  schema: TSchema;
  method?: 'GET' | 'POST' | 'PATCH';
  body?: Record<string, unknown>;
  query?: Record<string, string | number | undefined>;
  signal?: AbortSignal;
};

function parseIntegerHeader(value: string | null): number | undefined {
  if (value === null || !/^\d+$/u.test(value)) return undefined;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : undefined;
}

function getRateLimit(headers: Headers): GitHubRateLimit {
  const remaining = parseIntegerHeader(headers.get('x-ratelimit-remaining'));
  const reset = parseIntegerHeader(headers.get('x-ratelimit-reset'));

  return {
    ...(remaining === undefined ? {} : { remaining }),
    ...(reset === undefined ? {} : { resetAt: new Date(reset * 1_000).toISOString() }),
  };
}

function getNextPage(linkHeader: string | null): number | undefined {
  if (linkHeader === null) return undefined;

  for (const segment of linkHeader.split(',')) {
    const match = segment.match(/^\s*<([^>]+)>;\s*rel="([^"]+)"\s*$/u);
    if (!match || match[2] !== 'next') continue;

    try {
      const page = Number(new URL(match[1] ?? '').searchParams.get('page'));
      if (Number.isSafeInteger(page) && page > 0) return page;
    } catch {
      return undefined;
    }
  }

  return undefined;
}

function getRetryDelaySeconds(headers: Headers, now: number): number | undefined {
  const retryAfter = headers.get('retry-after');
  if (retryAfter !== null) {
    if (/^\d+$/u.test(retryAfter)) return Number(retryAfter);
    const retryAt = Date.parse(retryAfter);
    if (Number.isFinite(retryAt)) return Math.max(0, Math.ceil((retryAt - now) / 1_000));
  }

  if (headers.get('x-ratelimit-remaining') === '0') {
    const reset = parseIntegerHeader(headers.get('x-ratelimit-reset'));
    if (reset !== undefined) return Math.max(0, Math.ceil(reset - now / 1_000));
  }

  return undefined;
}

function errorForResponse(response: Response, now: number): BooLinkError {
  const retryDelay = getRetryDelaySeconds(response.headers, now);
  if ((response.status === 403 || response.status === 429) && retryDelay !== undefined) {
    return new BooLinkError({
      code: 'github_rate_limited',
      safeMessage: `GitHub rate limit exceeded. Retry after ${retryDelay} seconds.`,
      retryable: true,
    });
  }

  if (response.status === 401) {
    return new BooLinkError({
      code: 'github_unauthorized',
      safeMessage: 'GitHub rejected the locally configured token.',
    });
  }

  if (response.status === 403) {
    return new BooLinkError({
      code: 'github_forbidden',
      safeMessage: 'The GitHub token does not have permission for this resource.',
    });
  }

  if (response.status === 404) {
    return new BooLinkError({
      code: 'github_not_found',
      safeMessage: 'The requested GitHub resource was not found or is not visible to this token.',
    });
  }

  if (response.status === 410) {
    return new BooLinkError({
      code: 'github_feature_disabled',
      safeMessage: 'The requested GitHub feature is disabled or no longer available.',
    });
  }

  if (response.status === 422) {
    return new BooLinkError({
      code: 'github_invalid_request',
      safeMessage: 'GitHub could not process the validated request.',
    });
  }

  return new BooLinkError({
    code: 'github_unavailable',
    safeMessage: 'GitHub is temporarily unavailable.',
    retryable: response.status >= 500,
  });
}

function repositoryFromApiUrl(repositoryUrl: string): string {
  const segments = new URL(repositoryUrl).pathname.split('/').filter(Boolean);
  return segments.slice(-2).join('/');
}

function labelsFromResponse(labels: IssueResponse['labels']): string[] {
  return labels.flatMap((label) => {
    if (typeof label === 'string') return [label];
    return label.name === null ? [] : [label.name];
  });
}

function mapIssue(issue: IssueResponse, repository?: string): GitHubIssue {
  return {
    repository: repository ?? repositoryFromApiUrl(issue.repository_url),
    number: issue.number,
    title: issue.title,
    state: issue.state,
    ...(issue.state_reason === undefined ? {} : { stateReason: issue.state_reason }),
    locked: issue.locked,
    url: issue.html_url,
    body: issue.body,
    author: issue.user?.login ?? null,
    labels: labelsFromResponse(issue.labels),
    assignees: issue.assignees.map(({ login }) => login),
    comments: issue.comments,
    createdAt: issue.created_at,
    updatedAt: issue.updated_at,
    closedAt: issue.closed_at,
    isPullRequest: issue.pull_request !== undefined,
  };
}

function mapPullRequest(pullRequest: PullRequestResponse, repository: string): GitHubPullRequest {
  return {
    repository,
    number: pullRequest.number,
    title: pullRequest.title,
    state: pullRequest.state,
    locked: pullRequest.locked,
    draft: pullRequest.draft ?? null,
    url: pullRequest.html_url,
    body: pullRequest.body,
    author: pullRequest.user?.login ?? null,
    head: pullRequest.head,
    base: pullRequest.base,
    createdAt: pullRequest.created_at,
    updatedAt: pullRequest.updated_at,
    closedAt: pullRequest.closed_at,
    mergedAt: pullRequest.merged_at,
  };
}

function mapIssueComment(comment: IssueCommentResponse): GitHubIssueComment {
  return {
    id: comment.id,
    url: comment.html_url,
    body: comment.body,
    author: comment.user?.login ?? null,
    authorAssociation: comment.author_association,
    createdAt: comment.created_at,
    updatedAt: comment.updated_at,
  };
}

function mapViewer(user: AuthenticatedUserResponse): GitHubViewer {
  return {
    login: user.login,
    id: user.id,
    name: user.name,
    company: user.company,
    blog: user.blog,
    location: user.location,
    email: user.email,
    bio: user.bio,
    url: user.html_url,
    publicRepositories: user.public_repos,
    followers: user.followers,
    following: user.following,
    createdAt: user.created_at,
    updatedAt: user.updated_at,
  };
}

export function createGitHubClient(options: ClientOptions): GitHubClient {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
  const now = options.now ?? Date.now;

  async function request<TSchema extends z.ZodType>(
    requestOptions: RequestOptions<TSchema>,
  ): Promise<{ data: z.output<TSchema>; headers: Headers }> {
    const url = new URL(requestOptions.path, baseUrl);
    for (const [name, value] of Object.entries(requestOptions.query ?? {})) {
      if (value !== undefined) url.searchParams.set(name, String(value));
    }

    let response: Response;
    const method = requestOptions.method ?? 'GET';
    try {
      response = await fetchImpl(url, {
        method,
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${options.token}`,
          ...(requestOptions.body === undefined ? {} : { 'Content-Type': 'application/json' }),
          'User-Agent': USER_AGENT,
          'X-GitHub-Api-Version': GITHUB_API_VERSION,
        },
        ...(requestOptions.body === undefined ? {} : { body: JSON.stringify(requestOptions.body) }),
        ...(requestOptions.signal === undefined ? {} : { signal: requestOptions.signal }),
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new BooLinkError({
          code: 'github_request_cancelled',
          safeMessage: 'The GitHub request was cancelled.',
          cause: error,
        });
      }

      throw new BooLinkError({
        code: 'github_unavailable',
        safeMessage: 'GitHub could not be reached.',
        retryable: true,
        cause: error,
      });
    }

    if (!response.ok) throw errorForResponse(response, now());

    let body: unknown;
    try {
      body = await response.json();
    } catch (error) {
      throw new BooLinkError({
        code: 'github_invalid_response',
        safeMessage: 'GitHub returned an unreadable response.',
        retryable: true,
        cause: error,
      });
    }

    const parsed = requestOptions.schema.safeParse(body);
    if (!parsed.success) {
      throw new BooLinkError({
        code: 'github_invalid_response',
        safeMessage: 'GitHub returned an unexpected response.',
        retryable: true,
        cause: parsed.error,
      });
    }

    return { data: parsed.data, headers: response.headers };
  }

  function pagination(headers: Headers, page: number, perPage: number): GitHubPagination {
    const nextPage = getNextPage(headers.get('link'));
    return {
      page,
      perPage,
      hasNextPage: nextPage !== undefined,
      ...(nextPage === undefined ? {} : { nextPage }),
    };
  }

  return {
    async getAuthenticatedUser(signal) {
      const { data } = await request({
        path: '/user',
        schema: authenticatedUserResponseSchema,
        ...(signal === undefined ? {} : { signal }),
      });
      return mapViewer(data);
    },

    async searchIssues(searchOptions) {
      const { data, headers } = await request({
        path: '/search/issues',
        schema: searchIssuesResponseSchema,
        query: {
          q: `${searchOptions.query} is:issue`,
          sort: searchOptions.sort,
          order: searchOptions.order,
          page: searchOptions.page,
          per_page: searchOptions.perPage,
        },
        ...(searchOptions.signal === undefined ? {} : { signal: searchOptions.signal }),
      });

      return {
        totalCount: data.total_count,
        incompleteResults: data.incomplete_results,
        page: {
          items: data.items.map((issue) => mapIssue(issue)),
          pagination: pagination(headers, searchOptions.page, searchOptions.perPage),
          rateLimit: getRateLimit(headers),
        },
      };
    },

    async getIssue(issueOptions) {
      const repository = `${issueOptions.owner}/${issueOptions.repository}`;
      const { data } = await request({
        path: `/repos/${encodeURIComponent(issueOptions.owner)}/${encodeURIComponent(issueOptions.repository)}/issues/${issueOptions.issueNumber}`,
        schema: issueResponseSchema,
        ...(issueOptions.signal === undefined ? {} : { signal: issueOptions.signal }),
      });
      return mapIssue(data, repository);
    },

    async listIssueComments(commentOptions) {
      const { data, headers } = await request({
        path: `/repos/${encodeURIComponent(commentOptions.owner)}/${encodeURIComponent(commentOptions.repository)}/issues/${commentOptions.issueNumber}/comments`,
        schema: issueCommentListResponseSchema,
        query: { page: commentOptions.page, per_page: commentOptions.perPage },
        ...(commentOptions.signal === undefined ? {} : { signal: commentOptions.signal }),
      });
      return {
        items: data.map(mapIssueComment),
        pagination: pagination(headers, commentOptions.page, commentOptions.perPage),
        rateLimit: getRateLimit(headers),
      };
    },

    async createIssue(issueOptions) {
      const repository = `${issueOptions.owner}/${issueOptions.repository}`;
      const { data } = await request({
        path: `/repos/${encodeURIComponent(issueOptions.owner)}/${encodeURIComponent(issueOptions.repository)}/issues`,
        method: 'POST',
        schema: issueResponseSchema,
        body: {
          title: issueOptions.title,
          ...(issueOptions.body === undefined ? {} : { body: issueOptions.body }),
          ...(issueOptions.labels === undefined ? {} : { labels: issueOptions.labels }),
          ...(issueOptions.assignees === undefined ? {} : { assignees: issueOptions.assignees }),
        },
        ...(issueOptions.signal === undefined ? {} : { signal: issueOptions.signal }),
      });
      return mapIssue(data, repository);
    },

    async updateIssue(issueOptions) {
      const repository = `${issueOptions.owner}/${issueOptions.repository}`;
      const { data } = await request({
        path: `/repos/${encodeURIComponent(issueOptions.owner)}/${encodeURIComponent(issueOptions.repository)}/issues/${issueOptions.issueNumber}`,
        method: 'PATCH',
        schema: issueResponseSchema,
        body: {
          ...(issueOptions.title === undefined ? {} : { title: issueOptions.title }),
          ...(issueOptions.body === undefined ? {} : { body: issueOptions.body }),
          ...(issueOptions.state === undefined ? {} : { state: issueOptions.state }),
          ...(issueOptions.stateReason === undefined
            ? {}
            : { state_reason: issueOptions.stateReason }),
          ...(issueOptions.labels === undefined ? {} : { labels: issueOptions.labels }),
          ...(issueOptions.assignees === undefined ? {} : { assignees: issueOptions.assignees }),
        },
        ...(issueOptions.signal === undefined ? {} : { signal: issueOptions.signal }),
      });
      return mapIssue(data, repository);
    },

    async addIssueComment(commentOptions) {
      const { data } = await request({
        path: `/repos/${encodeURIComponent(commentOptions.owner)}/${encodeURIComponent(commentOptions.repository)}/issues/${commentOptions.issueNumber}/comments`,
        method: 'POST',
        schema: issueCommentResponseSchema,
        body: { body: commentOptions.body },
        ...(commentOptions.signal === undefined ? {} : { signal: commentOptions.signal }),
      });
      return mapIssueComment(data);
    },

    async listPullRequests(listOptions) {
      const repository = `${listOptions.owner}/${listOptions.repository}`;
      const { data, headers } = await request({
        path: `/repos/${encodeURIComponent(listOptions.owner)}/${encodeURIComponent(listOptions.repository)}/pulls`,
        schema: pullRequestListResponseSchema,
        query: {
          state: listOptions.state,
          head: listOptions.head,
          base: listOptions.base,
          sort: listOptions.sort,
          direction: listOptions.direction,
          page: listOptions.page,
          per_page: listOptions.perPage,
        },
        ...(listOptions.signal === undefined ? {} : { signal: listOptions.signal }),
      });

      return {
        items: data.map((pullRequest) => mapPullRequest(pullRequest, repository)),
        pagination: pagination(headers, listOptions.page, listOptions.perPage),
        rateLimit: getRateLimit(headers),
      };
    },

    async getPullRequest(pullRequestOptions) {
      const repository = `${pullRequestOptions.owner}/${pullRequestOptions.repository}`;
      const { data } = await request({
        path: `/repos/${encodeURIComponent(pullRequestOptions.owner)}/${encodeURIComponent(pullRequestOptions.repository)}/pulls/${pullRequestOptions.pullRequestNumber}`,
        schema: pullRequestResponseSchema,
        ...(pullRequestOptions.signal === undefined ? {} : { signal: pullRequestOptions.signal }),
      });
      return mapPullRequest(data, repository);
    },

    async createPullRequest(pullRequestOptions) {
      const repository = `${pullRequestOptions.owner}/${pullRequestOptions.repository}`;
      const { data } = await request({
        path: `/repos/${encodeURIComponent(pullRequestOptions.owner)}/${encodeURIComponent(pullRequestOptions.repository)}/pulls`,
        method: 'POST',
        schema: pullRequestResponseSchema,
        body: {
          title: pullRequestOptions.title,
          head: pullRequestOptions.head,
          base: pullRequestOptions.base,
          ...(pullRequestOptions.body === undefined ? {} : { body: pullRequestOptions.body }),
          ...(pullRequestOptions.draft === undefined ? {} : { draft: pullRequestOptions.draft }),
          ...(pullRequestOptions.maintainerCanModify === undefined
            ? {}
            : { maintainer_can_modify: pullRequestOptions.maintainerCanModify }),
        },
        ...(pullRequestOptions.signal === undefined ? {} : { signal: pullRequestOptions.signal }),
      });
      return mapPullRequest(data, repository);
    },
  };
}
