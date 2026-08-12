import {
  BooLinkError,
  defineIntegration,
  redactSensitiveText,
  type BooLinkTool,
  type IntegrationDefinition,
  type ToolResult,
} from '@boolink/core';
import { McpServer, type CallToolResult } from '@modelcontextprotocol/server';
import { serveStdio } from '@modelcontextprotocol/server/stdio';

const BOOLINK_TOOL_META_KEY = 'io.boolink/tool';

function isReadOnly(tool: BooLinkTool): boolean {
  return tool.metadata.capabilities.every((capability) => capability === 'read');
}

function mapToolResult(result: ToolResult): CallToolResult {
  return {
    content: result.content,
    ...(result.structuredContent === undefined
      ? {}
      : { structuredContent: result.structuredContent }),
  };
}

function mapToolError(error: unknown): CallToolResult {
  if (error instanceof BooLinkError) {
    const safeMessage = redactSensitiveText(error.message);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            error: {
              code: error.code,
              message: safeMessage,
              retryable: error.retryable,
            },
          }),
        },
      ],
      isError: true,
      structuredContent: {
        error: {
          code: error.code,
          message: safeMessage,
          retryable: error.retryable,
        },
      },
    };
  }

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          error: {
            code: 'internal_error',
            message: 'The integration failed unexpectedly.',
            retryable: false,
          },
        }),
      },
    ],
    isError: true,
    structuredContent: {
      error: {
        code: 'internal_error',
        message: 'The integration failed unexpectedly.',
        retryable: false,
      },
    },
  };
}

export function createBooLinkServer(definition: IntegrationDefinition): McpServer {
  const integration = defineIntegration(definition);
  const { manifest } = integration;
  const server = new McpServer(
    {
      name: `boolink-${manifest.id}`,
      version: manifest.version,
      description: manifest.description,
      websiteUrl: manifest.documentationUrl,
    },
    {
      instructions:
        'Use each tool only for its documented purpose. Credentials are configured locally and must never be requested through tool arguments.',
    },
  );

  for (const tool of integration.tools) {
    server.registerTool(
      tool.metadata.name,
      {
        title: tool.metadata.title,
        description: tool.metadata.description,
        inputSchema: tool.inputSchema,
        annotations: {
          title: tool.metadata.title,
          readOnlyHint: isReadOnly(tool),
          destructiveHint: tool.metadata.destructive,
          idempotentHint: tool.metadata.idempotent,
          openWorldHint: true,
        },
        _meta: {
          [BOOLINK_TOOL_META_KEY]: {
            capabilities: tool.metadata.capabilities,
            requiredScopes: tool.metadata.requiredScopes,
          },
        },
      },
      async (input): Promise<CallToolResult> => {
        try {
          return mapToolResult(await tool.execute(input, {}));
        } catch (error) {
          return mapToolError(error);
        }
      },
    );
  }

  return server;
}

export async function serveIntegrationStdio(definition: IntegrationDefinition): Promise<void> {
  await serveStdio(() => createBooLinkServer(definition));
}
