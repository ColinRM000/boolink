import * as z from 'zod/v4';

const PACKAGE_NAME_PATTERN = /^@boolink\/[a-z][a-z0-9-]*$/;
const INTEGRATION_ID_PATTERN = /^[a-z][a-z0-9-]*$/;
const TOOL_NAME_PATTERN = /^[a-z][a-z0-9-]*\.[a-z][a-z0-9_]*$/;
const SEMVER_PATTERN =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

export const capabilitySchema = z.enum([
  'read',
  'create',
  'modify',
  'delete',
  'financial',
  'communication',
  'administrative',
]);

export const verificationStatusSchema = z.enum([
  'official',
  'verified',
  'community',
  'experimental',
  'deprecated',
]);

export const authenticationTypeSchema = z.enum([
  'none',
  'api-key',
  'bearer-token',
  'oauth2',
  'custom',
]);

export const credentialSourceSchema = z.enum([
  'environment',
  'local-file',
  'os-keychain',
  'host-secret-store',
  'local-oauth',
]);

export const credentialRequirementSchema = z
  .object({
    id: z.string().regex(INTEGRATION_ID_PATTERN),
    label: z.string().min(1).max(80),
    description: z.string().min(1).max(500),
    source: credentialSourceSchema,
    environmentVariables: z
      .array(z.string().regex(/^[A-Z][A-Z0-9_]*$/))
      .max(5)
      .optional(),
    required: z.boolean(),
  })
  .strict()
  .superRefine((requirement, context) => {
    if (
      requirement.source === 'environment' &&
      (!requirement.environmentVariables || requirement.environmentVariables.length === 0)
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Environment credentials must declare at least one environment variable.',
        path: ['environmentVariables'],
      });
    }
  });

export const authenticationSchema = z
  .object({
    type: authenticationTypeSchema,
    instructionsUrl: z.url().optional(),
    requirements: z.array(credentialRequirementSchema).max(10),
  })
  .strict()
  .superRefine((authentication, context) => {
    if (authentication.type === 'none' && authentication.requirements.length > 0) {
      context.addIssue({
        code: 'custom',
        message: 'An unauthenticated integration cannot declare credential requirements.',
        path: ['requirements'],
      });
    }
  });

export const toolMetadataSchema = z
  .object({
    name: z.string().regex(TOOL_NAME_PATTERN),
    title: z.string().min(1).max(100),
    description: z.string().min(20).max(1_000),
    capabilities: z.array(capabilitySchema).min(1).max(7),
    destructive: z.boolean(),
    idempotent: z.boolean(),
    requiredScopes: z.array(z.string().min(1).max(200)).max(30),
  })
  .strict();

export const integrationManifestSchema = z
  .object({
    schemaVersion: z.literal(1),
    id: z.string().regex(INTEGRATION_ID_PATTERN),
    name: z.string().min(1).max(100),
    description: z.string().min(20).max(1_000),
    version: z.string().regex(SEMVER_PATTERN),
    provider: z.string().min(1).max(100),
    category: z.string().regex(INTEGRATION_ID_PATTERN),
    packageName: z.string().regex(PACKAGE_NAME_PATTERN),
    repositoryUrl: z.url(),
    documentationUrl: z.url(),
    verification: verificationStatusSchema,
    authentication: authenticationSchema,
    transports: z.array(z.enum(['stdio', 'streamable-http'])).min(1),
    tools: z.array(toolMetadataSchema),
  })
  .strict()
  .superRefine((manifest, context) => {
    const names = new Set<string>();
    for (const [index, tool] of manifest.tools.entries()) {
      if (!tool.name.startsWith(`${manifest.id}.`)) {
        context.addIssue({
          code: 'custom',
          message: `Tool name must use the integration prefix "${manifest.id}.".`,
          path: ['tools', index, 'name'],
        });
      }
      if (names.has(tool.name)) {
        context.addIssue({
          code: 'custom',
          message: 'Tool names must be unique within an integration.',
          path: ['tools', index, 'name'],
        });
      }
      names.add(tool.name);
    }
  });

export type Capability = z.infer<typeof capabilitySchema>;
export type ToolMetadata = z.infer<typeof toolMetadataSchema>;
export type IntegrationManifest = z.infer<typeof integrationManifestSchema>;

export type ToolContent = {
  type: 'text';
  text: string;
};

export type ToolResult = {
  content: ToolContent[];
  structuredContent?: Record<string, unknown>;
};

export type ToolExecutionContext = {
  signal?: AbortSignal;
};

export type BooLinkTool = {
  metadata: ToolMetadata;
  inputSchema: z.ZodType;
  execute: (input: unknown, context: ToolExecutionContext) => Promise<ToolResult>;
};

export type IntegrationDefinition = {
  manifest: IntegrationManifest;
  tools: readonly BooLinkTool[];
};

type ToolDefinition<TSchema extends z.ZodType> = {
  metadata: ToolMetadata;
  inputSchema: TSchema;
  execute: (input: z.output<TSchema>, context: ToolExecutionContext) => Promise<ToolResult>;
};

export function defineTool<TSchema extends z.ZodType>(
  definition: ToolDefinition<TSchema>,
): BooLinkTool {
  const metadata = toolMetadataSchema.parse(definition.metadata);

  return {
    metadata,
    inputSchema: definition.inputSchema,
    async execute(input, context) {
      return definition.execute(await definition.inputSchema.parseAsync(input), context);
    },
  };
}

export function defineIntegration(definition: IntegrationDefinition): IntegrationDefinition {
  const manifest = integrationManifestSchema.parse(definition.manifest);
  const manifestToolNames = manifest.tools.map((tool) => tool.name).sort();
  const implementationToolNames = definition.tools.map((tool) => tool.metadata.name).sort();

  if (new Set(implementationToolNames).size !== implementationToolNames.length) {
    throw new Error('Integration tool implementations must have unique names.');
  }

  if (JSON.stringify(manifestToolNames) !== JSON.stringify(implementationToolNames)) {
    throw new Error('Manifest tools must exactly match the implemented tool definitions.');
  }

  return { manifest, tools: definition.tools };
}

export type BooLinkErrorOptions = {
  code: string;
  safeMessage: string;
  retryable?: boolean;
  cause?: unknown;
};

export class BooLinkError extends Error {
  readonly code: string;
  readonly retryable: boolean;

  constructor(options: BooLinkErrorOptions) {
    super(options.safeMessage, { cause: options.cause });
    this.name = 'BooLinkError';
    this.code = options.code;
    this.retryable = options.retryable ?? false;
  }
}

const SECRET_PATTERNS: ReadonlyArray<{ pattern: RegExp; replacement: string }> = [
  { pattern: /\bBearer\s+[A-Za-z0-9._~+/=-]+/giu, replacement: 'Bearer [REDACTED]' },
  {
    pattern:
      /\b(api[_-]?key|access[_-]?token|refresh[_-]?token|password|secret|token)\s*[:=]\s*[^\s,;]+/giu,
    replacement: '$1=[REDACTED]',
  },
  { pattern: /\b(?:ghp|github_pat)_[A-Za-z0-9_]+/gu, replacement: '[REDACTED]' },
  {
    pattern: /([?&](?:api[_-]?key|access[_-]?token|token|secret)=)[^&#\s]+/giu,
    replacement: '$1[REDACTED]',
  },
];

export function redactSensitiveText(text: string, secrets: readonly string[] = []): string {
  let redacted = text;

  for (const secret of secrets) {
    if (secret.length >= 4) {
      redacted = redacted.replaceAll(secret, '[REDACTED]');
    }
  }

  for (const { pattern, replacement } of SECRET_PATTERNS) {
    redacted = redacted.replace(pattern, replacement);
  }

  return redacted;
}
