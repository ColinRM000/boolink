import { v0_4 } from '@anthropic-ai/mcpb';

export const MCPB_MANIFEST_VERSION = '0.4';

export const MCPB_DEFINITIONS = Object.freeze({
  github: Object.freeze({
    bundleName: 'boolink-github',
    displayName: 'BooLink for GitHub',
    credentialKey: 'github_token',
    credentialTitle: 'GitHub personal access token',
    credentialDescription:
      'A fine-grained GitHub token restricted to the repositories and permissions you want Claude to use.',
    icon: 'apps/web/public/images/providers/github.png',
    privacyPolicies: Object.freeze([
      'https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement',
    ]),
  }),
  cloudflare: Object.freeze({
    bundleName: 'boolink-cloudflare',
    displayName: 'BooLink for Cloudflare',
    credentialKey: 'cloudflare_api_token',
    credentialTitle: 'Cloudflare API token',
    credentialDescription:
      'A Cloudflare API token restricted to the zones and permissions you want Claude to use.',
    icon: 'apps/web/public/images/providers/cloudflare.png',
    privacyPolicies: Object.freeze(['https://www.cloudflare.com/privacypolicy/']),
  }),
});

function definitionFor(integrationId) {
  const definition = MCPB_DEFINITIONS[integrationId];
  if (!definition) throw new Error(`No MCPB definition exists for ${integrationId}.`);
  return definition;
}

function requiredCredentialEnvironment(integration) {
  const variables = integration.authentication.requirements.flatMap(
    (requirement) => requirement.environmentVariables ?? [],
  );
  if (variables.length !== 1) {
    throw new Error(
      `${integration.id} must declare exactly one credential environment variable for MCPB.`,
    );
  }
  return variables[0];
}

export function createMcpbManifest(integration) {
  const definition = definitionFor(integration.id);
  const credentialEnvironment = requiredCredentialEnvironment(integration);
  const manifest = {
    manifest_version: MCPB_MANIFEST_VERSION,
    name: definition.bundleName,
    display_name: definition.displayName,
    version: integration.version,
    description: `${integration.description} Credentials remain in Claude Desktop's local secure configuration.`,
    long_description:
      `BooLink runs the ${integration.name} MCP server locally and connects directly to ${integration.provider}. ` +
      'BooLink infrastructure never receives, proxies, persists, or logs the provider credential.',
    author: {
      name: 'BooLink contributors',
      url: 'https://boolink.dev',
    },
    repository: {
      type: 'git',
      url: integration.repositoryUrl,
    },
    homepage: 'https://boolink.dev',
    documentation: integration.documentationUrl,
    support: `${integration.repositoryUrl}/issues`,
    icon: 'icon.png',
    server: {
      type: 'node',
      entry_point: 'dist/server.js',
      mcp_config: {
        command: 'node',
        args: ['${__dirname}/dist/server.js'],
        env: {
          [credentialEnvironment]: `\${user_config.${definition.credentialKey}}`,
        },
      },
    },
    tools: integration.tools.map(({ name, description }) => ({ name, description })),
    tools_generated: false,
    keywords: ['boolink', 'mcp', integration.id, integration.category, 'local-first'],
    license: 'MIT',
    privacy_policies: [...definition.privacyPolicies],
    compatibility: {
      platforms: ['darwin', 'win32'],
      runtimes: {
        node: '>=22',
      },
    },
    user_config: {
      [definition.credentialKey]: {
        type: 'string',
        title: definition.credentialTitle,
        description: definition.credentialDescription,
        sensitive: true,
        required: true,
      },
    },
  };

  return v0_4.McpbManifestSchema.parse(manifest);
}

export function createMcpbReleaseMetadata(registry) {
  return Object.fromEntries(
    registry.integrations.map((integration) => {
      const definition = definitionFor(integration.id);
      return [
        integration.id,
        {
          version: integration.version,
          file: `${definition.bundleName}-${integration.version}.mcpb`,
        },
      ];
    }),
  );
}
