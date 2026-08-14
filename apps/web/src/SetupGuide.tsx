import {
  Check,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  KeyRound,
  LockKeyhole,
  PackageOpen,
  RotateCcw,
  ShieldCheck,
  TerminalSquare,
} from 'lucide-react';
import { useState } from 'react';

import { getSetupGuide, setupGuides, type SetupProvider } from './setup-guides.js';

type SetupGuideProps = {
  provider: SetupProvider;
  onProviderChange: (provider: SetupProvider) => void;
};

type CommandBlockProps = {
  label: string;
  command: string;
};

function CommandBlock({ label, command }: CommandBlockProps) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="setup-command">
      <div>
        <span>{label}</span>
        <code>{command}</code>
      </div>
      <button type="button" onClick={() => void copy()} aria-label={`Copy ${label.toLowerCase()}`}>
        {copied ? <Check size={15} aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />}
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  );
}

function environmentCommand(provider: SetupProvider, platform: 'windows' | 'unix') {
  const variable = getSetupGuide(provider).tokenName;
  if (platform === 'windows') {
    return `$secret = Read-Host "${variable}" -AsSecureString\n$token = [System.Net.NetworkCredential]::new("", $secret).Password\n[Environment]::SetEnvironmentVariable("${variable}", $token, "User")\nRemove-Variable secret, token`;
  }
  return `read -rsp "${variable}: " ${variable}; echo\nexport ${variable}`;
}

export function SetupGuide({ provider, onProviderChange }: SetupGuideProps) {
  const [client, setClient] = useState<'claude-code' | 'claude-desktop' | 'codex'>('codex');
  const [platform, setPlatform] = useState<'windows' | 'unix'>(() =>
    navigator.userAgent.includes('Windows') ? 'windows' : 'unix',
  );
  const guide = getSetupGuide(provider);
  const clientName =
    client === 'codex' ? 'Codex' : client === 'claude-code' ? 'Claude Code' : 'Claude Desktop';
  const installCommand = `npx @boolink-dev/cli add ${guide.id} --client ${client}`;

  return (
    <section className="section setup-section" id="setup" data-scroll-section>
      <div className="section-heading" data-reveal="rise">
        <div>
          <p className="kicker">Five-minute local setup</p>
          <h2>Connect one provider. Keep every credential local.</h2>
        </div>
        <p>
          BooLink installs the MCP server and updates your client configuration. Provider tokens
          remain in your operating-system environment and never pass through this website.
        </p>
      </div>

      <div className="setup-shell" data-reveal="scale">
        <div className="setup-provider-tabs" role="tablist" aria-label="Choose a setup guide">
          {setupGuides.map((candidate) => (
            <button
              className={candidate.id === provider ? 'is-active' : undefined}
              type="button"
              role="tab"
              aria-selected={candidate.id === provider}
              aria-controls="setup-guide-panel"
              id={`setup-tab-${candidate.id}`}
              onClick={() => onProviderChange(candidate.id)}
              key={candidate.id}
            >
              <span className={`setup-tab-logo setup-tab-logo-${candidate.id}`}>
                <img src={candidate.logo} alt="" />
              </span>
              <span>
                <small>Install guide</small>
                {candidate.name}
              </span>
              {candidate.id === provider ? <CheckCircle2 size={18} aria-hidden="true" /> : null}
            </button>
          ))}
        </div>

        <div
          className={`setup-panel setup-panel-${guide.accent}`}
          id="setup-guide-panel"
          role="tabpanel"
          aria-labelledby={`setup-tab-${guide.id}`}
        >
          <div className="setup-intro">
            <span className={`provider-logo provider-logo-${guide.id} provider-logo-featured`}>
              <img src={guide.logo} alt={`${guide.name} logo`} />
            </span>
            <div>
              <p className="integration-category">
                {guide.name} + {clientName}
              </p>
              <h3>Ready in four reviewed steps.</h3>
              <p>
                {client === 'claude-desktop'
                  ? 'Install with one local bundle. Start with the narrowest token permissions and a read-only identity check.'
                  : 'Requires Node.js 22 or newer. Start with the narrowest token permissions and a read-only identity check before enabling any mutating tools.'}
              </p>
            </div>
          </div>

          <div
            className="platform-switch setup-client-switch"
            role="group"
            aria-label="Choose AI client"
          >
            <button
              type="button"
              className={client === 'codex' ? 'is-active' : undefined}
              aria-pressed={client === 'codex'}
              onClick={() => setClient('codex')}
            >
              Codex
            </button>
            <button
              type="button"
              className={client === 'claude-code' ? 'is-active' : undefined}
              aria-pressed={client === 'claude-code'}
              onClick={() => setClient('claude-code')}
            >
              Claude Code
            </button>
            <button
              type="button"
              className={client === 'claude-desktop' ? 'is-active' : undefined}
              aria-pressed={client === 'claude-desktop'}
              onClick={() => setClient('claude-desktop')}
            >
              Claude Desktop
            </button>
          </div>

          {client === 'claude-desktop' ? (
            <ol className="setup-steps">
              <li>
                <div className="setup-step-number">01</div>
                <div className="setup-step-content">
                  <div className="setup-step-heading">
                    <KeyRound size={19} aria-hidden="true" />
                    <div>
                      <span>Create the provider credential</span>
                      <h4>Use a {guide.tokenLabel}.</h4>
                    </div>
                  </div>
                  <ul className="permission-list">
                    {guide.permissions.map((permission) => (
                      <li key={permission}>
                        <Check size={14} aria-hidden="true" /> {permission}
                      </li>
                    ))}
                  </ul>
                  <a href={guide.tokenUrl} target="_blank" rel="noreferrer">
                    Open {guide.name} token settings <ExternalLink size={14} aria-hidden="true" />
                  </a>
                </div>
              </li>

              <li>
                <div className="setup-step-number">02</div>
                <div className="setup-step-content">
                  <div className="setup-step-heading">
                    <Download size={19} aria-hidden="true" />
                    <div>
                      <span>Download the reviewed release asset</span>
                      <h4>Get the {guide.name} MCP Bundle.</h4>
                    </div>
                  </div>
                  <a
                    className="button button-primary setup-download"
                    href={guide.desktopDownloadUrl}
                  >
                    <Download size={16} aria-hidden="true" /> Download BooLink for {guide.name}
                  </a>
                  <p className="setup-note">
                    The release also includes SHA-256 checksums. The bundle contains the local
                    server and its runtime dependencies—never a provider credential.
                  </p>
                </div>
              </li>

              <li>
                <div className="setup-step-number">03</div>
                <div className="setup-step-content">
                  <div className="setup-step-heading">
                    <PackageOpen size={19} aria-hidden="true" />
                    <div>
                      <span>Install locally</span>
                      <h4>Open the .mcpb file with Claude Desktop.</h4>
                    </div>
                  </div>
                  <p>
                    Review the declared tools, approve the extension, and enter {guide.tokenName}
                    when Claude displays its masked credential field. Restart Claude Desktop if it
                    asks you to.
                  </p>
                </div>
              </li>

              <li>
                <div className="setup-step-number">04</div>
                <div className="setup-step-content">
                  <div className="setup-step-heading">
                    <ShieldCheck size={19} aria-hidden="true" />
                    <div>
                      <span>Verify before writing</span>
                      <h4>Begin with one read-only tool.</h4>
                    </div>
                  </div>
                  <CommandBlock label="Safe first prompt" command={guide.firstPrompt} />
                  <a href={guide.documentationUrl} target="_blank" rel="noreferrer">
                    Read the complete {guide.name} guide{' '}
                    <ExternalLink size={14} aria-hidden="true" />
                  </a>
                </div>
              </li>
            </ol>
          ) : (
            <ol className="setup-steps">
              <li>
                <div className="setup-step-number">01</div>
                <div className="setup-step-content">
                  <div className="setup-step-heading">
                    <KeyRound size={19} aria-hidden="true" />
                    <div>
                      <span>Create the provider credential</span>
                      <h4>Use a {guide.tokenLabel}.</h4>
                    </div>
                  </div>
                  <ul className="permission-list">
                    {guide.permissions.map((permission) => (
                      <li key={permission}>
                        <Check size={14} aria-hidden="true" /> {permission}
                      </li>
                    ))}
                  </ul>
                  <a href={guide.tokenUrl} target="_blank" rel="noreferrer">
                    Open {guide.name} token settings <ExternalLink size={14} aria-hidden="true" />
                  </a>
                </div>
              </li>

              <li>
                <div className="setup-step-number">02</div>
                <div className="setup-step-content">
                  <div className="setup-step-heading">
                    <LockKeyhole size={19} aria-hidden="true" />
                    <div>
                      <span>Keep it outside BooLink</span>
                      <h4>Set {guide.tokenName} locally.</h4>
                    </div>
                  </div>
                  <div
                    className="platform-switch"
                    role="group"
                    aria-label="Choose operating system"
                  >
                    <button
                      type="button"
                      className={platform === 'windows' ? 'is-active' : undefined}
                      aria-pressed={platform === 'windows'}
                      onClick={() => setPlatform('windows')}
                    >
                      Windows
                    </button>
                    <button
                      type="button"
                      className={platform === 'unix' ? 'is-active' : undefined}
                      aria-pressed={platform === 'unix'}
                      onClick={() => setPlatform('unix')}
                    >
                      macOS / Linux
                    </button>
                  </div>
                  <CommandBlock
                    label={
                      platform === 'windows'
                        ? 'PowerShell · masked input'
                        : 'Shell · current session'
                    }
                    command={environmentCommand(guide.id, platform)}
                  />
                  <p className="setup-note">
                    Restart {clientName} after setting a persistent Windows user variable. On macOS
                    or Linux, launch the client from the same session or use its normal secret
                    manager.
                  </p>
                </div>
              </li>

              <li>
                <div className="setup-step-number">03</div>
                <div className="setup-step-content">
                  <div className="setup-step-heading">
                    <TerminalSquare size={19} aria-hidden="true" />
                    <div>
                      <span>Preview before writing</span>
                      <h4>Inspect the exact installation plan.</h4>
                    </div>
                  </div>
                  <CommandBlock label="Preview only" command={installCommand} />
                  <CommandBlock label="Apply after review" command={`${installCommand} --yes`} />
                  <p className="setup-note">
                    The preview identifies the package, launcher, credential-variable name, and
                    client file before <code>--yes</code> permits any change.
                  </p>
                </div>
              </li>

              <li>
                <div className="setup-step-number">04</div>
                <div className="setup-step-content">
                  <div className="setup-step-heading">
                    <ShieldCheck size={19} aria-hidden="true" />
                    <div>
                      <span>Verify locally</span>
                      <h4>Diagnose, restart, then begin read-only.</h4>
                    </div>
                  </div>
                  <CommandBlock label="Local diagnostics" command="npx @boolink-dev/cli doctor" />
                  <CommandBlock label="Safe first prompt" command={guide.firstPrompt} />
                  <a href={guide.documentationUrl} target="_blank" rel="noreferrer">
                    Read the complete {guide.name} guide{' '}
                    <ExternalLink size={14} aria-hidden="true" />
                  </a>
                </div>
              </li>
            </ol>
          )}

          <div className="setup-boundary" aria-label="BooLink credential boundary">
            <ShieldCheck size={20} aria-hidden="true" />
            <div>
              <strong>Your token never enters this website or BooLink infrastructure.</strong>
              {client === 'claude-desktop' ? (
                <span>
                  The bundle marks the credential as sensitive. Claude Desktop collects it locally
                  and supplies it only to the installed server process at runtime.
                </span>
              ) : (
                <span>
                  Only the variable name <code>{guide.tokenName}</code> is recorded. The installed
                  server reads its value from the local client process at runtime.
                </span>
              )}
            </div>
            <RotateCcw size={18} aria-hidden="true" />
          </div>
        </div>
      </div>
    </section>
  );
}
