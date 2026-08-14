import { integrationPath, integrations, primaryCredential, type IntegrationId } from './catalog.js';

export type SetupProvider = IntegrationId;

export type SetupGuide = {
  id: SetupProvider;
  name: string;
  logo: string;
  accent: 'cyan' | 'orange';
  tokenName: string;
  tokenLabel: string;
  tokenUrl: string;
  documentationUrl: string;
  permissions: readonly string[];
  firstPrompt: string;
};

const setupPresentation = {
  github: {
    tokenLabel: 'fine-grained personal access token',
    permissions: [
      'Repository access: only the repositories the agent needs',
      'Issues: read, or write for issue/comment tools',
      'Pull requests: read, or write for PR creation',
    ],
    firstPrompt:
      'Use github.get_authenticated_user to confirm the connected identity. Do not create or modify anything.',
  },
  cloudflare: {
    tokenLabel: 'scoped API token',
    permissions: [
      'Resources: only the account and zones the agent needs',
      'Zone and DNS: read for inspection',
      'DNS: write and Cache Purge only when those tools are needed',
    ],
    firstPrompt:
      'Use cloudflare.verify_token, then list the zones visible to the token. Do not change DNS or purge cache.',
  },
} as const;

export const setupGuides: readonly SetupGuide[] = integrations.map((integration) => {
  const credential = primaryCredential(integration);
  const tokenName = credential.environmentVariables?.[0];
  const tokenUrl = integration.authentication.instructionsUrl;

  if (!tokenName || !tokenUrl) {
    throw new Error(`Website setup data is incomplete for integration "${integration.id}".`);
  }

  return {
    id: integration.id,
    name: integration.name,
    logo: integration.logo,
    accent: integration.accent,
    tokenName,
    tokenLabel: setupPresentation[integration.id].tokenLabel,
    tokenUrl,
    documentationUrl: integrationPath(integration.id),
    permissions: setupPresentation[integration.id].permissions,
    firstPrompt: setupPresentation[integration.id].firstPrompt,
  };
});

export function getSetupGuide(provider: SetupProvider): SetupGuide {
  return setupGuides.find((guide) => guide.id === provider) ?? setupGuides[0]!;
}
