import {
  ArrowLeft,
  ArrowRight,
  Check,
  Copy,
  Download,
  ExternalLink,
  KeyRound,
  LockKeyhole,
  PackageCheck,
  ShieldCheck,
  TerminalSquare,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { integrationPath, primaryCredential, type WebIntegration } from './catalog.js';
import { getSetupGuide } from './setup-guides.js';

type IntegrationPageProps = {
  integration: WebIntegration;
};

function CopyCommand({ command, label }: { command: string; label: string }) {
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
    <div className="detail-command">
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

export function IntegrationPage({ integration }: IntegrationPageProps) {
  const [installClient, setInstallClient] = useState<'claude-code' | 'claude-desktop' | 'codex'>(
    'codex',
  );
  const guide = getSetupGuide(integration.id);
  const credential = primaryCredential(integration);
  const scopes = useMemo(
    () =>
      [...new Set(integration.tools.flatMap((tool) => tool.requiredScopes))].sort((left, right) =>
        left.localeCompare(right),
      ),
    [integration],
  );
  const sourceUrl = `${integration.repositoryUrl}/tree/main/integrations/${integration.id}`;
  const setupUrl = `/?integration=${integration.id}#setup`;
  const installCommand = `npx @boolink-dev/cli add ${integration.id} --client ${installClient}`;

  useEffect(() => {
    document.title = `${integration.name} MCP integration | BooLink`;
    window.scrollTo(0, 0);
  }, [integration]);

  return (
    <div className={`integration-detail-page detail-${integration.accent}`}>
      <a className="skip-link" href="#integration-main">
        Skip to content
      </a>

      <header className="detail-header">
        <a className="brand brand-lockup" href="/" aria-label="BooLink home">
          <img className="brand-logo" src="/images/boolink-lockup.png" alt="" />
        </a>
        <nav aria-label="Integration navigation">
          <a href="/#integrations">All integrations</a>
          <a href="/#cli">CLI</a>
          <a href="https://github.com/ColinRM000/boolink" target="_blank" rel="noreferrer">
            GitHub <ExternalLink size={13} aria-hidden="true" />
          </a>
        </nav>
      </header>

      <main id="integration-main" className="detail-main">
        <a className="detail-back" href="/#integrations">
          <ArrowLeft size={16} aria-hidden="true" /> All integrations
        </a>

        <section className="detail-hero">
          <div className="detail-hero-copy">
            <div className="detail-provider-row">
              <span
                className={`provider-logo provider-logo-${integration.id} provider-logo-detail`}
              >
                <img src={integration.logo} alt={`${integration.name} logo`} />
              </span>
              <div>
                <span className="detail-category">{integration.category} integration</span>
                <div className="detail-status-row">
                  <span className={`status-chip status-${integration.verification}`}>
                    {integration.statusLabel}
                  </span>
                  <span>v{integration.version}</span>
                  <span>Local stdio</span>
                </div>
              </div>
            </div>
            <h1>{integration.headline}</h1>
            <p>{integration.overview}</p>
            <div className="detail-actions">
              <a className="button button-primary" href={setupUrl}>
                Install {integration.name} <ArrowRight size={17} aria-hidden="true" />
              </a>
              <a
                className="button button-secondary"
                href={sourceUrl}
                target="_blank"
                rel="noreferrer"
              >
                View source <ExternalLink size={15} aria-hidden="true" />
              </a>
            </div>
          </div>

          <aside className="detail-facts" aria-label={`${integration.name} integration facts`}>
            <div>
              <strong>{integration.tools.length}</strong>
              <span>MCP tools</span>
            </div>
            <div>
              <strong>{integration.readToolCount}</strong>
              <span>Read tools</span>
            </div>
            <div>
              <strong>{integration.writeToolCount}</strong>
              <span>Write or admin tools</span>
            </div>
            <div>
              <strong>0</strong>
              <span>Hosted credentials</span>
            </div>
          </aside>
        </section>

        <section className="detail-boundary" aria-label="Credential boundary">
          <LockKeyhole size={22} aria-hidden="true" />
          <div>
            <strong>Your credential stays in your environment.</strong>
            <span>
              BooLink records the variable name <code>{credential.environmentVariables?.[0]}</code>,
              never its value. The local server talks directly to {integration.provider}.
            </span>
          </div>
          <ShieldCheck size={21} aria-hidden="true" />
        </section>

        <section className="detail-section" id="tools">
          <div className="detail-section-heading">
            <div>
              <p className="kicker">Published tool surface</p>
              <h2>Know exactly what the integration can do.</h2>
            </div>
            <p>
              Capabilities, side effects, and provider scopes come directly from the versioned
              BooLink registry.
            </p>
          </div>

          <div className="detail-tools">
            {integration.tools.map((tool) => (
              <article className="detail-tool" key={tool.name}>
                <div className="detail-tool-heading">
                  <code>{tool.name}</code>
                  {tool.destructive ? <span className="tool-risk">Destructive</span> : null}
                </div>
                <h3>{tool.title}</h3>
                <p>{tool.description}</p>
                <div className="tool-capabilities" aria-label={`${tool.title} capabilities`}>
                  {tool.capabilities.map((capability) => (
                    <span key={capability}>{capability}</span>
                  ))}
                  <span>{tool.idempotent ? 'idempotent' : 'may duplicate'}</span>
                </div>
                {tool.requiredScopes.length > 0 ? (
                  <small>
                    <KeyRound size={13} aria-hidden="true" /> {tool.requiredScopes.join(' · ')}
                  </small>
                ) : (
                  <small>
                    <KeyRound size={13} aria-hidden="true" /> No additional provider scope declared
                  </small>
                )}
              </article>
            ))}
          </div>
        </section>

        <section className="detail-section detail-install" id="install">
          <div className="detail-section-heading">
            <div>
              <p className="kicker">Local installation</p>
              <h2>Preview first. Apply only after review.</h2>
            </div>
            <p>
              Requires Node.js 22 or newer and a narrowly scoped {guide.tokenLabel}. The CLI never
              accepts credential values as arguments.
            </p>
          </div>

          <div className="detail-install-grid">
            <div className="detail-install-card">
              <TerminalSquare size={22} aria-hidden="true" />
              <h3>Install with the BooLink CLI</h3>
              <div className="platform-switch" role="group" aria-label="Choose AI client">
                <button
                  type="button"
                  className={installClient === 'codex' ? 'is-active' : undefined}
                  aria-pressed={installClient === 'codex'}
                  onClick={() => setInstallClient('codex')}
                >
                  Codex
                </button>
                <button
                  type="button"
                  className={installClient === 'claude-code' ? 'is-active' : undefined}
                  aria-pressed={installClient === 'claude-code'}
                  onClick={() => setInstallClient('claude-code')}
                >
                  Claude Code
                </button>
                <button
                  type="button"
                  className={installClient === 'claude-desktop' ? 'is-active' : undefined}
                  aria-pressed={installClient === 'claude-desktop'}
                  onClick={() => setInstallClient('claude-desktop')}
                >
                  Claude Desktop
                </button>
              </div>
              {installClient === 'claude-desktop' ? (
                <div className="desktop-download-panel">
                  <p>
                    Download the verified MCP Bundle, open it with Claude Desktop, and enter your
                    token in Claude's masked local configuration prompt.
                  </p>
                  <a className="button button-primary" href={guide.desktopDownloadUrl}>
                    <Download size={17} aria-hidden="true" /> Download .mcpb
                  </a>
                  <small>Available for current Claude Desktop on Windows and macOS.</small>
                </div>
              ) : (
                <>
                  <CopyCommand label="Preview write plan" command={installCommand} />
                  <CopyCommand label="Apply after review" command={`${installCommand} --yes`} />
                  <CopyCommand label="Diagnose locally" command="npx @boolink-dev/cli doctor" />
                </>
              )}
            </div>

            <div className="detail-install-card">
              <PackageCheck size={22} aria-hidden="true" />
              <h3>Authentication and permissions</h3>
              <p>{credential.description}</p>
              <ul>
                {scopes.map((scope) => (
                  <li key={scope}>
                    <Check size={14} aria-hidden="true" /> {scope}
                  </li>
                ))}
              </ul>
              <a href={integration.authentication.instructionsUrl} target="_blank" rel="noreferrer">
                Open provider authentication guide <ExternalLink size={14} aria-hidden="true" />
              </a>
            </div>
          </div>
        </section>

        <section className="detail-resources" aria-label="Integration resources">
          <div>
            <p className="kicker">Release resources</p>
            <h2>Inspect the package before you run it.</h2>
          </div>
          <div className="detail-resource-links">
            <a
              href={`https://www.npmjs.com/package/${integration.packageName}`}
              target="_blank"
              rel="noreferrer"
            >
              npm package <ExternalLink size={14} aria-hidden="true" />
            </a>
            <a href={sourceUrl} target="_blank" rel="noreferrer">
              Source and README <ExternalLink size={14} aria-hidden="true" />
            </a>
            <a href={`${integration.repositoryUrl}/releases`} target="_blank" rel="noreferrer">
              Changelog and releases <ExternalLink size={14} aria-hidden="true" />
            </a>
          </div>
        </section>

        <nav className="detail-switcher" aria-label="Other BooLink integrations">
          {integration.id === 'github' ? (
            <a href={integrationPath('cloudflare')}>
              Next: Cloudflare integration <ArrowRight size={16} aria-hidden="true" />
            </a>
          ) : (
            <a href={integrationPath('github')}>
              <ArrowLeft size={16} aria-hidden="true" /> GitHub integration
            </a>
          )}
        </nav>
      </main>

      <footer className="detail-footer">
        <p>BooLink · Open-source MCP integrations · Credentials stay local</p>
        <a href="/">boolink.dev</a>
      </footer>
    </div>
  );
}
