import type { RegistryDocument } from '@boolink-dev/registry';
import catalogDocument from '@boolink-dev/registry/catalog.json' with { type: 'json' };

declare const __BOOLINK_CLI_VERSION__: string;

const presentation = {
  cloudflare: {
    logo: '/images/providers/cloudflare.png',
    accent: 'orange',
    headline: 'Operate Cloudflare without leaving the conversation.',
    overview:
      'Inspect zones and DNS, create or update records, remove an explicitly selected record, and purge exact URLs or a confirmed full cache. The integration talks directly to Cloudflare from your machine.',
  },
  github: {
    logo: '/images/providers/github.png',
    accent: 'cyan',
    headline: 'Bring GitHub into the conversation.',
    overview:
      'Search issues, read conversations, update issue state, add comments, and open pull requests. The integration talks directly to GitHub from your machine, so your token stays in your environment.',
  },
} as const;

export type IntegrationId = keyof typeof presentation;
export type RegistryIntegration = RegistryDocument['integrations'][number];

const statusLabels: Record<RegistryIntegration['verification'], string> = {
  official: 'Official',
  verified: 'Verified',
  community: 'Community',
  experimental: 'Experimental',
  deprecated: 'Deprecated',
};

export type WebIntegration = RegistryIntegration & {
  id: IntegrationId;
  accent: (typeof presentation)[IntegrationId]['accent'];
  headline: string;
  logo: string;
  overview: string;
  readToolCount: number;
  writeToolCount: number;
  statusLabel: string;
};

const registry = catalogDocument as RegistryDocument;

export const cliVersion = __BOOLINK_CLI_VERSION__;

export const integrations: readonly WebIntegration[] = registry.integrations.map((integration) => {
  if (!(integration.id in presentation)) {
    throw new Error(`Website presentation is missing for integration "${integration.id}".`);
  }

  const id = integration.id as IntegrationId;
  const view = presentation[id];
  const readToolCount = integration.tools.filter((tool) =>
    tool.capabilities.includes('read'),
  ).length;

  return {
    ...integration,
    id,
    ...view,
    readToolCount,
    writeToolCount: integration.tools.length - readToolCount,
    statusLabel: statusLabels[integration.verification],
  };
});

export function getIntegration(id: string): WebIntegration | undefined {
  return integrations.find((integration) => integration.id === id);
}

export function integrationPath(id: IntegrationId): string {
  return `/integrations/${id}`;
}

export function primaryCredential(integration: WebIntegration) {
  const requirement = integration.authentication.requirements[0];
  if (!requirement) {
    throw new Error(`Integration "${integration.id}" has no authentication requirement.`);
  }
  return requirement;
}
