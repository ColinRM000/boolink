export type SetupProvider = 'github' | 'cloudflare';

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
  installPreview: string;
  installApply: string;
  firstPrompt: string;
};

export const setupGuides: readonly SetupGuide[] = [
  {
    id: 'github',
    name: 'GitHub',
    logo: '/images/providers/github.png',
    accent: 'cyan',
    tokenName: 'GITHUB_TOKEN',
    tokenLabel: 'fine-grained personal access token',
    tokenUrl: 'https://github.com/settings/personal-access-tokens/new',
    documentationUrl:
      'https://github.com/ColinRM000/boolink/blob/main/integrations/github/README.md',
    permissions: [
      'Repository access: only the repositories the agent needs',
      'Issues: read, or write for issue/comment tools',
      'Pull requests: read, or write for PR creation',
    ],
    installPreview: 'npx @boolink-dev/cli add github --client codex',
    installApply: 'npx @boolink-dev/cli add github --client codex --yes',
    firstPrompt:
      'Use github.get_authenticated_user to confirm the connected identity. Do not create or modify anything.',
  },
  {
    id: 'cloudflare',
    name: 'Cloudflare',
    logo: '/images/providers/cloudflare.png',
    accent: 'orange',
    tokenName: 'CLOUDFLARE_API_TOKEN',
    tokenLabel: 'scoped API token',
    tokenUrl: 'https://dash.cloudflare.com/profile/api-tokens',
    documentationUrl:
      'https://github.com/ColinRM000/boolink/blob/main/integrations/cloudflare/README.md',
    permissions: [
      'Resources: only the account and zones the agent needs',
      'Zone and DNS: read for inspection',
      'DNS: write and Cache Purge only when those tools are needed',
    ],
    installPreview: 'npx @boolink-dev/cli add cloudflare --client codex',
    installApply: 'npx @boolink-dev/cli add cloudflare --client codex --yes',
    firstPrompt:
      'Use cloudflare.verify_token, then list the zones visible to the token. Do not change DNS or purge cache.',
  },
] as const;

export function getSetupGuide(provider: SetupProvider): SetupGuide {
  return setupGuides.find((guide) => guide.id === provider) ?? setupGuides[0]!;
}
