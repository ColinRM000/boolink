import * as z from 'zod/v4';

const nullableString = z.string().nullable();

const userSummarySchema = z
  .object({
    login: z.string(),
    id: z.number().int(),
    html_url: z.url(),
  })
  .loose();

const labelSchema = z.union([
  z.string(),
  z
    .object({
      name: z.string().nullable(),
    })
    .loose(),
]);

export const authenticatedUserResponseSchema = z
  .object({
    login: z.string(),
    id: z.number().int(),
    name: nullableString,
    company: nullableString,
    blog: z.string(),
    location: nullableString,
    email: nullableString,
    bio: nullableString,
    html_url: z.url(),
    public_repos: z.number().int().nonnegative(),
    followers: z.number().int().nonnegative(),
    following: z.number().int().nonnegative(),
    created_at: z.iso.datetime({ offset: true }),
    updated_at: z.iso.datetime({ offset: true }),
  })
  .loose();

export const issueResponseSchema = z
  .object({
    number: z.number().int().positive(),
    title: z.string(),
    state: z.enum(['open', 'closed']),
    state_reason: z.string().nullable().optional(),
    locked: z.boolean(),
    html_url: z.url(),
    repository_url: z.url(),
    body: nullableString,
    user: userSummarySchema.nullable(),
    labels: z.array(labelSchema),
    assignees: z.array(userSummarySchema).optional().default([]),
    comments: z.number().int().nonnegative(),
    created_at: z.iso.datetime({ offset: true }),
    updated_at: z.iso.datetime({ offset: true }),
    closed_at: z.iso.datetime({ offset: true }).nullable(),
    pull_request: z.object({}).loose().optional(),
  })
  .loose();

export const searchIssuesResponseSchema = z
  .object({
    total_count: z.number().int().nonnegative(),
    incomplete_results: z.boolean(),
    items: z.array(issueResponseSchema),
  })
  .loose();

const branchSchema = z
  .object({
    label: z.string(),
    ref: z.string(),
  })
  .loose();

export const pullRequestResponseSchema = z
  .object({
    number: z.number().int().positive(),
    title: z.string(),
    state: z.enum(['open', 'closed']),
    locked: z.boolean(),
    draft: z.boolean().nullable().optional(),
    html_url: z.url(),
    body: nullableString,
    user: userSummarySchema.nullable(),
    head: branchSchema,
    base: branchSchema,
    created_at: z.iso.datetime({ offset: true }),
    updated_at: z.iso.datetime({ offset: true }),
    closed_at: z.iso.datetime({ offset: true }).nullable(),
    merged_at: z.iso.datetime({ offset: true }).nullable(),
  })
  .loose();

export const pullRequestListResponseSchema = z.array(pullRequestResponseSchema);

export type AuthenticatedUserResponse = z.infer<typeof authenticatedUserResponseSchema>;
export type IssueResponse = z.infer<typeof issueResponseSchema>;
export type PullRequestResponse = z.infer<typeof pullRequestResponseSchema>;
