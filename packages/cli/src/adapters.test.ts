import { describe, expect, it } from 'vitest';

import { mergeCodexConfiguration, renderCodexBlock, renderCustomJson } from './adapters.js';

const launch = {
  id: 'github',
  command: 'node',
  args: ['/opt/boolink/github/server.js'],
  requiredEnvironment: ['GITHUB_TOKEN'],
};

describe('client configuration adapters', () => {
  it('renders a Codex stdio configuration that forwards only credential names', () => {
    const rendered = renderCodexBlock(launch);

    expect(rendered).toContain('[mcp_servers.boolink_github]');
    expect(rendered).toContain('command = "node"');
    expect(rendered).toContain('env_vars = ["GITHUB_TOKEN"]');
    expect(rendered).toContain('default_tools_approval_mode = "writes"');
    expect(rendered).not.toContain('env =');
  });

  it('preserves existing Codex configuration and refuses duplicate server tables', () => {
    const merged = mergeCodexConfiguration('model = "gpt-5"\n', launch);
    expect(merged).toMatch(/^model = "gpt-5"/u);
    expect(() => mergeCodexConfiguration(merged, launch)).toThrow(/already contains/u);
  });

  it('renders neutral JSON without credential values', () => {
    const parsed = JSON.parse(renderCustomJson(launch)) as {
      servers: Record<string, { requiredEnvironment: string[]; env?: unknown }>;
    };
    expect(parsed.servers['boolink-github']?.requiredEnvironment).toEqual(['GITHUB_TOKEN']);
    expect(parsed.servers['boolink-github']?.env).toBeUndefined();
  });
});
