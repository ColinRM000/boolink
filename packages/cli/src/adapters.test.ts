import { describe, expect, it } from 'vitest';

import {
  mergeClaudeCodeConfiguration,
  mergeCodexConfiguration,
  removeClaudeCodeConfiguration,
  removeCodexConfiguration,
  renderClaudeCodeConfiguration,
  renderCodexBlock,
  renderCustomJson,
  replaceClaudeCodeConfiguration,
} from './adapters.js';

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

  it('removes only an exact BooLink-managed Codex block', () => {
    const merged = mergeCodexConfiguration('model = "gpt-5"\n', launch);
    expect(removeCodexConfiguration(merged, launch)).toBe('model = "gpt-5"\n');
    expect(() => removeCodexConfiguration(merged.replace('writes', 'untrusted'), launch)).toThrow(
      /changed/u,
    );
  });

  it('renders neutral JSON without credential values', () => {
    const parsed = JSON.parse(renderCustomJson(launch)) as {
      servers: Record<string, { requiredEnvironment: string[]; env?: unknown }>;
    };
    expect(parsed.servers['boolink-github']?.requiredEnvironment).toEqual(['GITHUB_TOKEN']);
    expect(parsed.servers['boolink-github']?.env).toBeUndefined();
  });

  it('renders a Claude Code stdio server with an environment reference, never a value', () => {
    const parsed = JSON.parse(renderClaudeCodeConfiguration(launch)) as {
      mcpServers: Record<
        string,
        { type: string; command: string; args: string[]; env: Record<string, string> }
      >;
    };
    expect(parsed.mcpServers.boolink_github).toEqual({
      type: 'stdio',
      command: 'node',
      args: ['/opt/boolink/github/server.js'],
      env: { GITHUB_TOKEN: '${GITHUB_TOKEN}' },
    });
    expect(removeClaudeCodeConfiguration(renderClaudeCodeConfiguration(launch), launch)).toBe('');
  });

  it('preserves unrelated Claude Code settings and servers across the managed lifecycle', () => {
    const existing = `${JSON.stringify({
      numStartups: 4,
      mcpServers: {
        existing: { type: 'stdio', command: 'existing-server', args: [] },
      },
    })}\n`;
    const merged = mergeClaudeCodeConfiguration(existing, launch);
    const parsed = JSON.parse(merged) as {
      numStartups: number;
      mcpServers: Record<string, unknown>;
    };
    expect(parsed.numStartups).toBe(4);
    expect(parsed.mcpServers.existing).toBeDefined();
    expect(parsed.mcpServers.boolink_github).toBeDefined();
    expect(() => mergeClaudeCodeConfiguration(merged, launch)).toThrow(/already contains/u);

    const nextLaunch = { ...launch, args: ['/opt/boolink/github/server-v2.js'] };
    const replaced = replaceClaudeCodeConfiguration(merged, launch, nextLaunch);
    expect(replaced).toContain('server-v2.js');
    const removed = removeClaudeCodeConfiguration(replaced, nextLaunch);
    const remaining = JSON.parse(removed) as {
      numStartups: number;
      mcpServers: Record<string, unknown>;
    };
    expect(remaining.numStartups).toBe(4);
    expect(remaining.mcpServers).toEqual({
      existing: { type: 'stdio', command: 'existing-server', args: [] },
    });
  });

  it('refuses to replace or remove a changed Claude Code server entry', () => {
    const changed = renderClaudeCodeConfiguration(launch).replace(
      '${GITHUB_TOKEN}',
      'literal-value',
    );
    expect(() => replaceClaudeCodeConfiguration(changed, launch, launch)).toThrow(/changed/u);
    expect(() => removeClaudeCodeConfiguration(changed, launch)).toThrow(/changed/u);
  });
});
