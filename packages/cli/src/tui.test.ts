import { describe, expect, it } from 'vitest';

import { bundledRegistry } from '@boolink/registry';
import {
  createShopState,
  renderShop,
  shouldLaunchInteractive,
  updateShop,
  type ShopState,
} from './tui.js';

function press(state: ShopState, ...keys: string[]): { state: ShopState; command?: string[] } {
  let current = state;
  let command: string[] | undefined;
  for (const key of keys) {
    const update = updateShop(current, key, bundledRegistry);
    current = update.state;
    command = update.command;
  }
  return { state: current, ...(command === undefined ? {} : { command }) };
}

describe('interactive integration shop', () => {
  it('launches only with no arguments and two interactive terminal streams', () => {
    expect(shouldLaunchInteractive([], true, true)).toBe(true);
    expect(shouldLaunchInteractive(['search'], true, true)).toBe(false);
    expect(shouldLaunchInteractive([], false, true)).toBe(false);
    expect(shouldLaunchInteractive([], true, undefined)).toBe(false);
  });

  it('renders the registry without revealing credential values', () => {
    const secret = 'github_pat_tui_must_not_render';
    const rendered = renderShop(
      createShopState(),
      bundledRegistry,
      { GITHUB_TOKEN: secret },
      '/users/octocat',
      false,
    );

    expect(rendered).toContain('BooLink');
    expect(rendered).toContain('Integration Shop');
    expect(rendered).toContain('GitHub');
    expect(rendered).toContain('4 tools');
    expect(rendered).not.toContain(secret);
  });

  it('supports keyboard search and does not treat typed q as quit', () => {
    const searched = press(createShopState(), '/', 'g', 'i', 't', 'h', 'u', 'b', 'enter');
    expect(searched.state.query).toBe('github');
    expect(searched.state.searching).toBe(false);

    const qSearch = updateShop({ ...createShopState(), searching: true }, 'q', bundledRegistry);
    expect(qSearch.quit).toBeUndefined();
    expect(qSearch.state.query).toBe('q');
  });

  it('shows tool and credential safety details before installation', () => {
    const details = press(createShopState(), 'enter').state;
    const rendered = renderShop(details, bundledRegistry, {}, '/users/octocat', false);

    expect(details.screen).toBe('details');
    expect(rendered).toContain('github.get_authenticated_user');
    expect(rendered).toContain('GITHUB_TOKEN ○ not detected');
    expect(rendered).toContain('[read]');
  });

  it('requires client selection and explicit confirmation before returning an approved command', () => {
    const beforeApproval = press(createShopState(), 'enter', 'i', 'enter');
    expect(beforeApproval.state.screen).toBe('confirm');
    expect(beforeApproval.command).toBeUndefined();

    const approved = press(beforeApproval.state, 'y');
    expect(approved.command).toEqual(['add', 'github', '--client', 'codex', '--yes']);
  });

  it('can install without changing a client configuration', () => {
    const approved = press(createShopState(), 'enter', 'i', 'down', 'enter', 'y');
    expect(approved.command).toEqual(['add', 'github', '--yes']);
  });
});
