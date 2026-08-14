import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline';

import type { IntegrationManifest } from '@boolink-dev/core';
import { bundledRegistry, searchRegistry, type RegistryDocument } from '@boolink-dev/registry';

export type ShopScreen = 'catalog' | 'details' | 'client' | 'confirm';
export type ShopClient = 'claude-code' | 'codex' | 'none';

export type ShopState = {
  screen: ShopScreen;
  query: string;
  searching: boolean;
  selectedIndex: number;
  selectedIntegrationId?: string | undefined;
  client: ShopClient;
};

export type ShopUpdate = {
  state: ShopState;
  quit?: boolean;
  command?: string[];
};

export type InteractiveShopOptions = {
  registry?: RegistryDocument;
  environment?: NodeJS.ProcessEnv;
  userHome?: string;
  input?: NodeJS.ReadStream;
  output?: NodeJS.WriteStream;
};

const RESET = '\u001B[0m';
const CYAN = '\u001B[96m';
const VIOLET = '\u001B[95m';
const GREEN = '\u001B[92m';
const YELLOW = '\u001B[93m';
const MUTED = '\u001B[90m';
const BOLD = '\u001B[1m';
const SHOP_CLIENTS: readonly ShopClient[] = ['codex', 'claude-code', 'none'];

function clientLabel(client: ShopClient): string {
  if (client === 'codex') return 'Codex / ChatGPT desktop';
  if (client === 'claude-code') return 'Claude Code';
  return 'No client changes';
}

export function createShopState(): ShopState {
  return {
    screen: 'catalog',
    query: '',
    searching: false,
    selectedIndex: 0,
    client: 'codex',
  };
}

export function shouldLaunchInteractive(
  args: readonly string[],
  inputIsTty: boolean | undefined,
  outputIsTty: boolean | undefined,
): boolean {
  return args.length === 0 && inputIsTty === true && outputIsTty === true;
}

function matches(state: ShopState, registry: RegistryDocument): readonly IntegrationManifest[] {
  return searchRegistry(registry, state.query);
}

function selectedIntegration(
  state: ShopState,
  registry: RegistryDocument,
): IntegrationManifest | undefined {
  if (state.selectedIntegrationId) {
    return registry.integrations.find(({ id }) => id === state.selectedIntegrationId);
  }
  return matches(state, registry)[state.selectedIndex];
}

function requiredEnvironment(integration: IntegrationManifest): string[] {
  return integration.authentication.requirements.flatMap(
    (requirement) => requirement.environmentVariables ?? [],
  );
}

function color(text: string, code: string, enabled: boolean): string {
  return enabled ? `${code}${text}${RESET}` : text;
}

function truncate(text: string, width: number): string {
  return text.length <= width ? text : `${text.slice(0, Math.max(width - 1, 0))}…`;
}

function header(useColor: boolean): string[] {
  return [
    color(
      '╭──────────────────────────────────────────────────────────────────────╮',
      CYAN,
      useColor,
    ),
    `${color('│', CYAN, useColor)}  ${color('👻 BooLink', BOLD, useColor)}  ${color('Integration Shop', VIOLET, useColor)}`,
    `${color('│', CYAN, useColor)}  Local-first MCP integrations. Credentials stay on this machine.`,
    color(
      '╰──────────────────────────────────────────────────────────────────────╯',
      CYAN,
      useColor,
    ),
    '',
  ];
}

function renderCatalog(state: ShopState, registry: RegistryDocument, useColor: boolean): string[] {
  const integrations = matches(state, registry);
  const lines = [
    `${color('Search', MUTED, useColor)}  ${state.query || color('Press / to filter integrations', MUTED, useColor)}${state.searching ? color('▌', CYAN, useColor) : ''}`,
    '',
  ];

  if (integrations.length === 0) {
    lines.push(color('  No integrations match this search.', YELLOW, useColor));
  } else {
    integrations.forEach((integration, index) => {
      const selected = index === state.selectedIndex;
      const marker = selected ? color('❯', CYAN, useColor) : ' ';
      const name = selected
        ? color(integration.name.padEnd(16), BOLD, useColor)
        : integration.name.padEnd(16);
      const status = color(
        integration.verification.padEnd(13),
        integration.verification === 'experimental' ? YELLOW : GREEN,
        useColor,
      );
      lines.push(
        `${marker} ${name} ${status} ${String(integration.tools.length).padStart(2)} tools`,
      );
      lines.push(`  ${color(truncate(integration.description, 67), MUTED, useColor)}`);
      lines.push('');
    });
  }

  lines.push(
    color(
      state.searching
        ? 'Type to search · Enter finish · Esc cancel'
        : '↑↓ Browse · Enter inspect · / Search · Q Quit',
      MUTED,
      useColor,
    ),
  );
  return lines;
}

function renderDetails(
  integration: IntegrationManifest,
  environment: NodeJS.ProcessEnv,
  useColor: boolean,
): string[] {
  const variables = requiredEnvironment(integration);
  const credentialReady = variables.every((name) => Boolean(environment[name]));
  const capabilities = [...new Set(integration.tools.flatMap((tool) => tool.capabilities))];
  const lines = [
    `${color(integration.name, BOLD, useColor)}  ${color(`v${integration.version}`, MUTED, useColor)}  ${color(integration.verification, YELLOW, useColor)}`,
    integration.description,
    '',
    `${color('Transport', MUTED, useColor)}      ${integration.transports.join(', ')}`,
    `${color('Capabilities', MUTED, useColor)}   ${capabilities.join(', ')}`,
    `${color('Credential', MUTED, useColor)}     ${variables.join(', ') || 'none'} ${credentialReady ? color('● detected', GREEN, useColor) : color('○ not detected', YELLOW, useColor)}`,
    '',
    color('Available tools', BOLD, useColor),
  ];

  for (const tool of integration.tools) {
    lines.push(
      `  ${color('•', CYAN, useColor)} ${tool.name} ${color(`[${tool.capabilities.join(', ')}]`, MUTED, useColor)}`,
    );
  }

  lines.push('', color('I Install · B Back · Q Quit', MUTED, useColor));
  return lines;
}

function renderClient(state: ShopState, useColor: boolean): string[] {
  const choices: ReadonlyArray<{ id: ShopClient; title: string; detail: string }> = [
    {
      id: 'codex',
      title: 'Codex / ChatGPT desktop',
      detail: 'Add a local stdio server to the shared Codex config.toml.',
    },
    {
      id: 'claude-code',
      title: 'Claude Code',
      detail: 'Add a private user-scoped stdio server to ~/.claude.json.',
    },
    {
      id: 'none',
      title: 'Integration only',
      detail: 'Record the local integration without changing a client configuration.',
    },
  ];

  const lines = [color('Choose a client', BOLD, useColor), ''];
  for (const choice of choices) {
    const selected = state.client === choice.id;
    lines.push(
      `${selected ? color('❯', CYAN, useColor) : ' '} ${selected ? color(choice.title, BOLD, useColor) : choice.title}`,
    );
    lines.push(`  ${color(choice.detail, MUTED, useColor)}`, '');
  }
  lines.push(color('↑↓ Choose · Enter continue · B Back · Q Quit', MUTED, useColor));
  return lines;
}

function renderConfirm(
  state: ShopState,
  integration: IntegrationManifest,
  environment: NodeJS.ProcessEnv,
  userHome: string,
  useColor: boolean,
): string[] {
  const variables = requiredEnvironment(integration);
  const credentialReady = variables.every((name) => Boolean(environment[name]));
  const boolinkHome = environment.BOOLINK_HOME ?? path.join(userHome, '.boolink');
  const lines = [
    color('Review installation', BOLD, useColor),
    '',
    `${color('Integration', MUTED, useColor)}   ${integration.name} v${integration.version}`,
    `${color('Client', MUTED, useColor)}        ${clientLabel(state.client)}`,
    `${color('Package', MUTED, useColor)}       ${integration.packageName}@${integration.version}`,
    `${color('Install path', MUTED, useColor)}  ${path.join(boolinkHome, 'integrations', integration.id, integration.version)}`,
    `${color('State file', MUTED, useColor)}    ${path.join(boolinkHome, 'installations.json')}`,
  ];

  if (state.client === 'codex') {
    lines.push(
      `${color('Client file', MUTED, useColor)}   ${path.join(userHome, '.codex', 'config.toml')}`,
    );
  } else if (state.client === 'claude-code') {
    lines.push(`${color('Client file', MUTED, useColor)}   ${path.join(userHome, '.claude.json')}`);
  }

  lines.push(
    `${color('Credential', MUTED, useColor)}    ${variables.join(', ') || 'none'} ${credentialReady ? color('● detected', GREEN, useColor) : color('○ missing — install can continue, tools need it later', YELLOW, useColor)}`,
    '',
    color('No credential values will be written to BooLink files.', GREEN, useColor),
    color('npm lifecycle scripts are disabled during installation.', GREEN, useColor),
    '',
    color('Y Approve install · N Go back · Q Quit', MUTED, useColor),
  );
  return lines;
}

export function renderShop(
  state: ShopState,
  registry: RegistryDocument,
  environment: NodeJS.ProcessEnv,
  userHome: string,
  useColor = true,
): string {
  const integration = selectedIntegration(state, registry);
  let body: string[];

  if (state.screen === 'details' && integration) {
    body = renderDetails(integration, environment, useColor);
  } else if (state.screen === 'client' && integration) {
    body = renderClient(state, useColor);
  } else if (state.screen === 'confirm' && integration) {
    body = renderConfirm(state, integration, environment, userHome, useColor);
  } else {
    body = renderCatalog(state, registry, useColor);
  }

  return `${[...header(useColor), ...body].join('\n')}\n`;
}

export function updateShop(state: ShopState, key: string, registry: RegistryDocument): ShopUpdate {
  if (state.screen === 'catalog' && state.searching) {
    if (key === 'escape') return { state: { ...state, searching: false } };
    if (key === 'enter') return { state: { ...state, searching: false, selectedIndex: 0 } };
    if (key === 'backspace') {
      return { state: { ...state, query: state.query.slice(0, -1), selectedIndex: 0 } };
    }
    if (key.length === 1 && key >= ' ' && key !== '\u007f') {
      return { state: { ...state, query: `${state.query}${key}`, selectedIndex: 0 } };
    }
    return { state };
  }

  if (key === 'q' || key === 'ctrl-c') return { state, quit: true };

  if (state.screen === 'catalog') {
    const integrations = matches(state, registry);
    if (key === '/') return { state: { ...state, searching: true } };
    if (key === 'escape') return { state: { ...state, query: '', selectedIndex: 0 } };
    if (key === 'down' && integrations.length > 0) {
      return {
        state: { ...state, selectedIndex: (state.selectedIndex + 1) % integrations.length },
      };
    }
    if (key === 'up' && integrations.length > 0) {
      return {
        state: {
          ...state,
          selectedIndex: (state.selectedIndex - 1 + integrations.length) % integrations.length,
        },
      };
    }
    if (key === 'enter') {
      const integration = integrations[state.selectedIndex];
      if (integration) {
        return {
          state: {
            ...state,
            screen: 'details',
            selectedIntegrationId: integration.id,
          },
        };
      }
    }
    return { state };
  }

  if (state.screen === 'details') {
    if (key === 'b' || key === 'escape') {
      return { state: { ...state, screen: 'catalog', selectedIntegrationId: undefined } };
    }
    if (key === 'i' || key === 'enter') return { state: { ...state, screen: 'client' } };
    return { state };
  }

  if (state.screen === 'client') {
    if (key === 'b' || key === 'escape') return { state: { ...state, screen: 'details' } };
    if (key === 'up' || key === 'down') {
      const currentIndex = SHOP_CLIENTS.indexOf(state.client);
      const offset = key === 'down' ? 1 : SHOP_CLIENTS.length - 1;
      return {
        state: {
          ...state,
          client: SHOP_CLIENTS[(currentIndex + offset) % SHOP_CLIENTS.length]!,
        },
      };
    }
    if (key === 'enter') return { state: { ...state, screen: 'confirm' } };
    return { state };
  }

  if (state.screen === 'confirm') {
    if (key === 'n' || key === 'b' || key === 'escape') {
      return { state: { ...state, screen: 'client' } };
    }
    if (key === 'y' && state.selectedIntegrationId) {
      return {
        state,
        command: [
          'add',
          state.selectedIntegrationId,
          ...(state.client === 'none' ? [] : ['--client', state.client]),
          '--yes',
        ],
      };
    }
  }

  return { state };
}

function keyName(value: string | undefined, key: readline.Key): string {
  if (key.ctrl && key.name === 'c') return 'ctrl-c';
  if (key.name === 'return') return 'enter';
  if (key.name === 'backspace') return 'backspace';
  if (key.name === 'escape') return 'escape';
  if (key.name === 'up' || key.name === 'down') return key.name;
  return value ?? '';
}

export async function runInteractiveShop(
  options: InteractiveShopOptions = {},
): Promise<string[] | undefined> {
  const registry = options.registry ?? bundledRegistry;
  const environment = options.environment ?? process.env;
  const userHome = options.userHome ?? os.homedir();
  const input = options.input ?? process.stdin;
  const output = options.output ?? process.stdout;
  let state = createShopState();

  readline.emitKeypressEvents(input);
  input.setRawMode(true);
  input.resume();
  output.write('\u001B[?25l');

  function draw(): void {
    output.write(`\u001B[2J\u001B[H${renderShop(state, registry, environment, userHome)}`);
  }

  draw();

  return new Promise((resolve) => {
    function finish(command?: string[]): void {
      input.off('keypress', onKeypress);
      input.setRawMode(false);
      input.pause();
      output.write('\u001B[?25h\u001B[2J\u001B[H');
      resolve(command);
    }

    function onKeypress(value: string | undefined, key: readline.Key): void {
      const update = updateShop(state, keyName(value, key), registry);
      state = update.state;
      if (update.quit) {
        finish();
        return;
      }
      if (update.command) {
        finish(update.command);
        return;
      }
      draw();
    }

    input.on('keypress', onKeypress);
  });
}
