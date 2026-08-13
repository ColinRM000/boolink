import {
  Activity,
  ArrowDown,
  ArrowRight,
  Boxes,
  Check,
  ChevronRight,
  CircleDot,
  Code2,
  Copy,
  ExternalLink,
  KeyRound,
  LockKeyhole,
  PackageCheck,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
  Sparkles,
  TerminalSquare,
  Trash2,
  Workflow,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

type Integration = {
  name: string;
  description: string;
  category: string;
  status: 'Available in beta' | 'Coming soon' | 'Community choice';
  auth: string;
  toolCount?: number;
  icon?: LucideIcon;
  logo?: string;
  logoAlt?: string;
};

const githubTools = [
  ['github.get_authenticated_user', 'Confirm the identity attached to the local token.'],
  ['github.search_issues', 'Search issues with GitHub query syntax.'],
  ['github.get_issue', 'Retrieve a single issue and its normalized metadata.'],
  ['github.list_issue_comments', 'Read an issue or pull-request conversation.'],
  ['github.list_pull_requests', 'List pull requests with branch and state filters.'],
  ['github.get_pull_request', 'Retrieve one pull request and its branch metadata.'],
  ['github.create_issue', 'Publish a reviewed repository issue.'],
  ['github.update_issue', 'Change reviewed fields, labels, assignees, or state.'],
  ['github.add_issue_comment', 'Publish a reviewed issue or pull-request comment.'],
  ['github.create_pull_request', 'Open a pull request between pushed branches.'],
] as const;

const integrations: readonly Integration[] = [
  {
    name: 'GitHub',
    description:
      'Search issues, follow conversations, manage issue state, and open pull requests from your AI client.',
    category: 'Development',
    status: 'Available in beta',
    auth: 'Local GITHUB_TOKEN',
    toolCount: 10,
    logo: '/images/providers/github.png',
    logoAlt: 'GitHub',
  },
  {
    name: 'Cloudflare',
    description:
      'Inspect zones and DNS, manage DNS records, and purge cache through a tightly scoped local server.',
    category: 'Infrastructure',
    status: 'Available in beta',
    auth: 'Local CLOUDFLARE_API_TOKEN',
    toolCount: 10,
    logo: '/images/providers/cloudflare.png',
    logoAlt: 'Cloudflare',
  },
  {
    name: 'Your most-wanted integration',
    description:
      'Future integrations will be prioritized around the tools the community uses most.',
    category: 'Community',
    status: 'Community choice',
    auth: 'Provider-specific',
    icon: Boxes,
  },
];

const principles = [
  {
    icon: LockKeyhole,
    label: 'Local-first by default',
    detail: 'Credentials stay in the environment where the integration runs.',
  },
  {
    icon: ShieldCheck,
    label: 'Capabilities you can inspect',
    detail: 'Read, write, destructive, and administrative actions are clearly classified.',
  },
  {
    icon: PackageCheck,
    label: 'Predictable everywhere',
    detail: 'Consistent installation, permissions, errors, and documentation across integrations.',
  },
] as const;

const cliLifecycle = [
  {
    icon: TerminalSquare,
    label: 'Explore',
    detail: 'Open the interactive integration shop and inspect every tool before installing.',
    command: 'npx @boolink-dev/cli',
  },
  {
    icon: Activity,
    label: 'Diagnose',
    detail: 'Check the managed package, launcher, client configuration, and local state.',
    command: 'npx @boolink-dev/cli doctor',
  },
  {
    icon: RotateCcw,
    label: 'Repair',
    detail: 'Restore an exact managed install without touching credential values.',
    command: 'npx @boolink-dev/cli repair github',
  },
  {
    icon: RefreshCw,
    label: 'Upgrade',
    detail: 'Move to the catalog version with an explicit, previewable write plan.',
    command: 'npx @boolink-dev/cli upgrade github',
  },
  {
    icon: Trash2,
    label: 'Remove',
    detail: 'Cleanly remove only BooLink-managed files and configuration.',
    command: 'npx @boolink-dev/cli remove github',
  },
] as const;

const roadmap = [
  [
    'GitHub integration',
    'Available',
    'Ten tools for issues, conversations, and pull requests are available today.',
  ],
  [
    'BooLink CLI',
    'Available',
    'Browse, install, diagnose, upgrade, repair, and remove integrations from one local CLI.',
  ],
  [
    'Cloudflare integration',
    'Available',
    'Ten bounded tools for zones, DNS records, and cache purging are available today.',
  ],
  [
    'More integrations',
    'Planned',
    'New providers will follow community demand and real use cases.',
  ],
] as const;

export function App() {
  const [query, setQuery] = useState('');
  const [copiedCommand, setCopiedCommand] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  async function copyCommand(command: string) {
    try {
      await navigator.clipboard.writeText(command);
      setCopiedCommand(command);
      window.setTimeout(() => setCopiedCommand(null), 1600);
    } catch {
      setCopiedCommand(null);
    }
  }

  useEffect(() => {
    const root = document.documentElement;
    const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const revealElements = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal]'));
    const scrollScenes = Array.from(
      document.querySelectorAll<HTMLElement>('[data-scroll-section]'),
    );
    const chapterLinks = Array.from(
      document.querySelectorAll<HTMLAnchorElement>('[data-chapter-link]'),
    );
    const roadmapList = document.querySelector<HTMLElement>('.roadmap-list');
    const roadmapItems = Array.from(
      document.querySelectorAll<HTMLElement>('.roadmap-list .roadmap-item'),
    );
    let animationFrame = 0;

    function updateScrollEffects() {
      const scrollRange = Math.max(document.documentElement.scrollHeight - window.innerHeight, 1);
      const progress = Math.min(Math.max(window.scrollY / scrollRange, 0), 1);
      const heroProgress = Math.min(Math.max(window.scrollY / (window.innerHeight * 0.95), 0), 1);
      const motionEnabled = !motionPreference.matches;
      let activeScene = scrollScenes[0];
      let closestSceneDistance = Number.POSITIVE_INFINITY;

      root.style.setProperty('--scroll-progress', progress.toString());
      root.style.setProperty('--hero-drift', `${motionEnabled ? heroProgress * -42 : 0}px`);
      root.style.setProperty('--terminal-drift', `${motionEnabled ? heroProgress * 24 : 0}px`);
      root.style.setProperty('--grid-drift', `${motionEnabled ? window.scrollY * 0.055 : 0}px`);
      root.style.setProperty('--ambient-drift', `${motionEnabled ? progress * 28 : 0}vh`);

      scrollScenes.forEach((scene) => {
        const bounds = scene.getBoundingClientRect();
        const sceneCenter = bounds.top + bounds.height / 2;
        const distanceFromFocus = Math.abs(sceneCenter - window.innerHeight * 0.52);
        const focus = motionEnabled
          ? 1 - Math.min(distanceFromFocus / Math.max(window.innerHeight * 0.85, 1), 1)
          : 1;
        const sceneTravel = Math.max(window.innerHeight + bounds.height, 1);
        const sceneProgress = Math.min(
          Math.max((window.innerHeight - bounds.top) / sceneTravel, 0),
          1,
        );

        scene.style.setProperty('--scene-focus', focus.toFixed(3));
        scene.style.setProperty('--scene-progress', sceneProgress.toFixed(3));

        if (distanceFromFocus < closestSceneDistance) {
          closestSceneDistance = distanceFromFocus;
          activeScene = scene;
        }
      });

      const activeSceneId = activeScene?.id;
      chapterLinks.forEach((link) => {
        const isActive = link.dataset.chapterLink === activeSceneId;
        link.classList.toggle('is-active', isActive);
        if (isActive) link.setAttribute('aria-current', 'step');
        else link.removeAttribute('aria-current');
      });

      if (roadmapList) {
        const roadmapBounds = roadmapList.getBoundingClientRect();
        const roadmapTravel = Math.max(roadmapBounds.height - window.innerHeight * 0.18, 1);
        const roadmapProgress = motionEnabled
          ? Math.min(
              Math.max((window.innerHeight * 0.72 - roadmapBounds.top) / roadmapTravel, 0),
              1,
            )
          : 1;
        roadmapList.style.setProperty('--roadmap-progress', roadmapProgress.toFixed(3));

        roadmapItems.forEach((item) => {
          const itemBounds = item.getBoundingClientRect();
          const itemProgress = motionEnabled
            ? Math.min(
                Math.max(
                  (window.innerHeight * 0.76 - itemBounds.top) /
                    Math.max(window.innerHeight * 0.28, 1),
                  0,
                ),
                1,
              )
            : 1;
          item.style.setProperty('--item-progress', itemProgress.toFixed(3));
        });
      }

      animationFrame = 0;
    }

    function requestScrollUpdate() {
      if (!animationFrame) animationFrame = window.requestAnimationFrame(updateScrollEffects);
    }

    let observer: IntersectionObserver | undefined;

    if (motionPreference.matches || !('IntersectionObserver' in window)) {
      revealElements.forEach((element) => element.classList.add('is-visible'));
    } else {
      observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            entry.target.classList.add('is-visible');
            observer?.unobserve(entry.target);
          });
        },
        { rootMargin: '0px 0px -12% 0px', threshold: 0.12 },
      );

      revealElements.forEach((element) => observer?.observe(element));
    }

    updateScrollEffects();
    window.addEventListener('scroll', requestScrollUpdate, { passive: true });
    window.addEventListener('resize', requestScrollUpdate);
    motionPreference.addEventListener('change', requestScrollUpdate);

    return () => {
      observer?.disconnect();
      window.removeEventListener('scroll', requestScrollUpdate);
      window.removeEventListener('resize', requestScrollUpdate);
      motionPreference.removeEventListener('change', requestScrollUpdate);
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
    };
  }, []);

  useEffect(() => {
    function focusSearch(event: KeyboardEvent) {
      const activeElement = document.activeElement;
      const isTyping =
        activeElement instanceof HTMLInputElement || activeElement instanceof HTMLTextAreaElement;

      if (event.key === '/' && !isTyping) {
        event.preventDefault();
        searchRef.current?.focus();
      }
    }

    window.addEventListener('keydown', focusSearch);
    return () => window.removeEventListener('keydown', focusSearch);
  }, []);

  const filteredIntegrations = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('en-US');
    if (!normalized) return integrations;

    return integrations.filter((integration) =>
      [integration.name, integration.description, integration.category, integration.status]
        .join(' ')
        .toLocaleLowerCase('en-US')
        .includes(normalized),
    );
  }, [query]);

  const featuredGitHub = filteredIntegrations.find((integration) => integration.name === 'GitHub');
  const catalogCards = filteredIntegrations.filter((integration) => integration.name !== 'GitHub');

  return (
    <>
      <div className="scroll-progress" aria-hidden="true">
        <span />
      </div>

      <div className="scroll-atmosphere" aria-hidden="true">
        <span className="atmosphere-orb atmosphere-orb-cyan" />
        <span className="atmosphere-orb atmosphere-orb-violet" />
      </div>

      <nav className="chapter-rail" aria-label="Page chapters">
        <span className="chapter-rail-label">Explore</span>
        {[
          ['top', 'Intro'],
          ['integrations', 'Integrations'],
          ['cli', 'CLI'],
          ['principles', 'Trust'],
          ['architecture', 'Architecture'],
          ['roadmap', "What's next"],
        ].map(([id, label]) => (
          <a href={`#${id}`} data-chapter-link={id} key={id}>
            <i aria-hidden="true" />
            <span>{label}</span>
          </a>
        ))}
      </nav>

      <a className="skip-link" href="#main">
        Skip to content
      </a>

      <header className="site-header" data-release="brand-lockup-2026-08-12">
        <a className="brand brand-lockup" href="#top" aria-label="BooLink home">
          <img className="brand-logo" src="/images/boolink-lockup.png" alt="" />
        </a>

        <nav aria-label="Main navigation">
          <a href="#integrations">Integrations</a>
          <a href="#cli">CLI</a>
          <a href="#architecture">Architecture</a>
          <a href="#roadmap">What&apos;s next</a>
        </nav>

        <a className="header-status" href="#roadmap">
          <span className="status-pulse" aria-hidden="true" />2 integrations available
        </a>
      </header>

      <main id="main">
        <section className="hero" id="top" data-scroll-section>
          <div className="hero-glow hero-glow-cyan" aria-hidden="true" />
          <div className="hero-glow hero-glow-violet" aria-hidden="true" />

          <div className="hero-copy">
            <div className="eyebrow">
              <Sparkles size={15} aria-hidden="true" />
              Open source · MCP compatible · Local first
            </div>
            <h1>
              Give your AI a <span>ghost in the machine.</span>
            </h1>
            <p className="hero-lede">
              BooLink connects AI agents to the tools you already use through local, inspectable MCP
              integrations—without routing your credentials through a hosted middleman.
            </p>
            <div className="hero-actions">
              <a className="button button-primary" href="#integrations">
                Browse integrations
                <ArrowRight size={18} aria-hidden="true" />
              </a>
              <a className="button button-secondary" href="#cli">
                Get the CLI
                <ArrowDown size={18} aria-hidden="true" />
              </a>
            </div>
            <div className="trust-row" aria-label="Project attributes">
              <span>
                <Check size={15} aria-hidden="true" /> MIT licensed
              </span>
              <span>
                <Check size={15} aria-hidden="true" /> Portable Node.js
              </span>
              <span>
                <Check size={15} aria-hidden="true" /> No hosted credential proxy
              </span>
            </div>
          </div>

          <div className="hero-visual" aria-label="BooLink mascot and local integration preview">
            <div className="mascot-orbit" aria-hidden="true">
              <div className="orbit orbit-one" />
              <div className="orbit orbit-two" />
              <span className="orbit-node node-one" />
              <span className="orbit-node node-two" />
            </div>
            <img
              className="hero-mascot"
              src="/images/boolink-mascot.png"
              alt="BooLink's friendly ghost mascot flying forward"
            />
            <div className="terminal-card">
              <div className="terminal-titlebar">
                <span className="terminal-dots" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                </span>
                <span>local terminal</span>
                <TerminalSquare size={15} aria-hidden="true" />
              </div>
              <code>
                <span className="terminal-muted">$</span> boo add github
                <br />
                <span className="terminal-cyan">◈</span> Credentials stay on this machine
                <br />
                <span className="terminal-green">✓</span> GitHub integration{' '}
                <span className="terminal-muted">10 tools ready</span>
              </code>
            </div>
          </div>
        </section>

        <section
          className="signal-strip"
          aria-label="BooLink product highlights"
          data-reveal="stagger"
        >
          <div>
            <strong>MIT</strong>
            <span>Open-source license</span>
          </div>
          <div>
            <strong>Local</strong>
            <span>Runs beside your AI client</span>
          </div>
          <div>
            <strong>20</strong>
            <span>MCP tools across 2 integrations</span>
          </div>
          <div>
            <strong>0</strong>
            <span>Credentials stored by BooLink</span>
          </div>
        </section>

        <section className="section" id="integrations" data-scroll-section>
          <div className="section-heading" data-reveal="rise">
            <div>
              <p className="kicker">Integration registry</p>
              <h2>Start with a capability, not custom plumbing.</h2>
            </div>
            <p>
              Install only what you need, inspect every available tool, and see credential and
              permission requirements before an integration touches your setup.
            </p>
          </div>

          <label className="integration-search" data-reveal="rise">
            <span className="sr-only">Search BooLink integrations</span>
            <Search size={20} aria-hidden="true" />
            <input
              ref={searchRef}
              type="search"
              aria-keyshortcuts="/"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search integrations, categories, or status…"
            />
            <span className="search-shortcut" aria-hidden="true">
              /
            </span>
          </label>
          <p className="result-count" aria-live="polite">
            {filteredIntegrations.length} {filteredIntegrations.length === 1 ? 'result' : 'results'}
          </p>

          {featuredGitHub ? (
            <article className="integration-feature" data-reveal="scale">
              <div className="integration-feature-intro">
                <div className="integration-card-top">
                  <span className="provider-logo provider-logo-github provider-logo-featured">
                    <img src="/images/providers/github.png" alt="GitHub" />
                  </span>
                  <span className="status-chip status-experimental">Available · beta</span>
                </div>
                <p className="integration-category">GitHub integration</p>
                <h3>Bring GitHub into the conversation.</h3>
                <p>
                  Let your AI client search issues, read conversations, update issue state, add
                  comments, and open pull requests. The integration talks directly to GitHub from
                  your machine, so your token stays in your environment.
                </p>
                <div className="feature-stats" aria-label="GitHub integration attributes">
                  <span>
                    <strong>10</strong> tools
                  </span>
                  <span>
                    <strong>stdio</strong> local transport
                  </span>
                  <span>
                    <strong>0</strong> hosted credentials
                  </span>
                </div>
              </div>

              <div className="integration-toolbox">
                <div className="toolbox-heading">
                  <span>Available MCP tools</span>
                  <span className="toolbox-readonly">
                    <ShieldCheck size={13} /> 6 read · 4 write
                  </span>
                </div>
                <ul>
                  {githubTools.map(([name, detail]) => (
                    <li key={name}>
                      <code>{name}</code>
                      <span>{detail}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="integration-quickstart">
                <div>
                  <p className="quickstart-label">Browse with the integration shop</p>
                  <p>
                    Run BooLink with no arguments to search, inspect tools, choose a client, and
                    review every file change before approving an installation.
                  </p>
                </div>
                <pre aria-label="GitHub integration local run commands">
                  <code>
                    <span>$</span> npx @boolink-dev/cli
                  </code>
                </pre>
              </div>
            </article>
          ) : null}

          {catalogCards.length > 0 ? (
            <div className="integration-grid integration-grid-secondary" data-reveal="stagger">
              {catalogCards.map((integration) => {
                const Icon = integration.icon;
                return (
                  <article className="integration-card" key={integration.name}>
                    <div className="integration-card-top">
                      {integration.logo ? (
                        <span
                          className={`provider-logo provider-logo-${integration.name.toLowerCase()}`}
                        >
                          <img
                            src={integration.logo}
                            alt={integration.logoAlt ?? integration.name}
                          />
                        </span>
                      ) : Icon ? (
                        <span className="integration-icon">
                          <Icon size={24} aria-hidden="true" />
                        </span>
                      ) : null}
                      <span
                        className={`status-chip status-${integration.status.replaceAll(' ', '-').toLowerCase()}`}
                      >
                        {integration.status}
                      </span>
                    </div>
                    <p className="integration-category">{integration.category}</p>
                    <h3>{integration.name}</h3>
                    <p>{integration.description}</p>
                    <div className="integration-meta">
                      <span>
                        <KeyRound size={15} aria-hidden="true" /> {integration.auth}
                      </span>
                      <span>
                        <CircleDot size={15} aria-hidden="true" /> Explicit capabilities
                      </span>
                      {integration.toolCount ? (
                        <span>
                          <PackageCheck size={15} aria-hidden="true" /> {integration.toolCount} MCP
                          tools
                        </span>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </div>
          ) : null}
        </section>

        <section className="section cli-section" id="cli" data-scroll-section>
          <div className="section-heading" data-reveal="rise">
            <div>
              <p className="kicker">Available on npm · CLI 0.4.0</p>
              <h2>One command in. A complete local lifecycle after.</h2>
            </div>
            <p>
              Browse the shop interactively, then diagnose, repair, upgrade, or remove an
              integration without handing BooLink your credentials.
            </p>
          </div>

          <div className="cli-launchpad" data-reveal="scale">
            <div className="cli-launch-copy">
              <span className="cli-release">
                <span aria-hidden="true" /> Public package · beta
              </span>
              <h3>Meet Boo, your integration shop.</h3>
              <p>
                No global install is required. Run one command, use the arrow keys to browse, and
                review tools, capabilities, credential requirements, and every affected file before
                you approve anything.
              </p>
              <div className="cli-safety-row" aria-label="CLI safety properties">
                <span>
                  <ShieldCheck size={15} aria-hidden="true" /> Exact versions
                </span>
                <span>
                  <LockKeyhole size={15} aria-hidden="true" /> Local credentials
                </span>
                <span>
                  <RotateCcw size={15} aria-hidden="true" /> Reversible changes
                </span>
              </div>
            </div>

            <div className="cli-window" aria-label="BooLink CLI launch command">
              <div className="cli-window-bar">
                <span className="terminal-dots" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                </span>
                <span>boolink · local terminal</span>
                <span className="cli-version">v0.4.0</span>
              </div>
              <div className="cli-window-body">
                <p>
                  <span className="terminal-muted">$</span> npx @boolink-dev/cli
                </p>
                <div className="cli-window-preview">
                  <span className="terminal-cyan">◈ BooLink</span>
                  <strong>Choose an integration</strong>
                  <span>› GitHub</span>
                  <small>6 read + 4 write tools · local stdio</small>
                  <span>Cloudflare</span>
                  <small>5 read + 5 DNS/cache tools · local stdio</small>
                </div>
                <button
                  className="copy-button copy-button-primary"
                  type="button"
                  onClick={() => void copyCommand('npx @boolink-dev/cli')}
                  aria-label="Copy CLI launch command"
                >
                  {copiedCommand === 'npx @boolink-dev/cli' ? (
                    <Check size={16} aria-hidden="true" />
                  ) : (
                    <Copy size={16} aria-hidden="true" />
                  )}
                  {copiedCommand === 'npx @boolink-dev/cli' ? 'Copied' : 'Copy command'}
                </button>
              </div>
            </div>
          </div>

          <div className="cli-lifecycle-heading" data-reveal="rise">
            <p className="kicker">After installation</p>
            <p>
              Every write is previewed. Add <code>--yes</code> only when you are ready to apply it.
            </p>
          </div>
          <div className="cli-lifecycle" data-reveal="stagger">
            {cliLifecycle.map((step, index) => {
              const Icon = step.icon;
              return (
                <article className="cli-step" key={step.label}>
                  <div className="cli-step-top">
                    <span className="cli-step-number">{String(index + 1).padStart(2, '0')}</span>
                    <Icon size={19} aria-hidden="true" />
                  </div>
                  <h3>{step.label}</h3>
                  <p>{step.detail}</p>
                  <div className="cli-step-command">
                    <code>{step.command}</code>
                    <button
                      type="button"
                      onClick={() => void copyCommand(step.command)}
                      aria-label={`Copy ${step.label.toLowerCase()} command`}
                    >
                      {copiedCommand === step.command ? (
                        <Check size={14} aria-hidden="true" />
                      ) : (
                        <Copy size={14} aria-hidden="true" />
                      )}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>

          <div className="cli-links" data-reveal="rise">
            <span>Go deeper</span>
            <a
              href="https://www.npmjs.com/package/@boolink-dev/cli"
              target="_blank"
              rel="noreferrer"
            >
              npm package <ExternalLink size={14} aria-hidden="true" />
            </a>
            <a
              href="https://github.com/ColinRM000/boolink/tree/main/packages/cli"
              target="_blank"
              rel="noreferrer"
            >
              CLI guide <ExternalLink size={14} aria-hidden="true" />
            </a>
            <a href="https://github.com/ColinRM000/boolink" target="_blank" rel="noreferrer">
              GitHub source <ExternalLink size={14} aria-hidden="true" />
            </a>
          </div>
        </section>

        <section className="section principles-section" id="principles" data-scroll-section>
          <div className="section-heading compact" data-reveal="rise">
            <div>
              <p className="kicker">Built for trust</p>
              <h2>The integration layer should disappear—not your control.</h2>
            </div>
          </div>
          <div className="principle-grid" data-reveal="stagger">
            {principles.map((principle, index) => {
              const Icon = principle.icon;
              return (
                <article className="principle-card" key={principle.label}>
                  <span className="principle-index">0{index + 1}</span>
                  <Icon size={26} aria-hidden="true" />
                  <h3>{principle.label}</h3>
                  <p>{principle.detail}</p>
                </article>
              );
            })}
          </div>
        </section>

        <section className="section architecture-section" id="architecture" data-scroll-section>
          <div className="architecture-copy" data-reveal="slide-left">
            <p className="kicker">Local-first architecture</p>
            <h2>BooLink stays out of the runtime path.</h2>
            <p>
              Once installed, an integration runs beside your AI client and talks directly to the
              provider. BooLink does not receive your API keys, proxy requests, or become a required
              service dependency.
            </p>
            <ul className="check-list">
              <li>
                <Check aria-hidden="true" /> Credentials remain in your environment
              </li>
              <li>
                <Check aria-hidden="true" /> Tools are strongly typed and runtime validated
              </li>
              <li>
                <Check aria-hidden="true" /> Side effects are machine-readable before execution
              </li>
            </ul>
          </div>

          <div
            className="architecture-diagram"
            aria-label="AI client connects through a local BooLink integration to an external API"
            data-reveal="slide-right"
          >
            <div className="diagram-node">
              <Code2 size={24} aria-hidden="true" />
              <span>AI client</span>
              <small>Codex · Claude · Cursor</small>
            </div>
            <div className="diagram-link">
              <span>MCP</span>
              <i />
              <ChevronRight size={18} aria-hidden="true" />
            </div>
            <div className="diagram-node diagram-node-highlight">
              <img className="diagram-mascot" src="/favicon.ico" alt="" />
              <span>BooLink integration</span>
              <small>Runs in your environment</small>
            </div>
            <div className="diagram-link">
              <span>Your auth</span>
              <i />
              <ChevronRight size={18} aria-hidden="true" />
            </div>
            <div className="diagram-node">
              <Workflow size={24} aria-hidden="true" />
              <span>Provider API</span>
              <small>GitHub · Cloudflare · more</small>
            </div>
            <div className="credential-boundary">
              <ShieldCheck size={18} aria-hidden="true" />
              Credential boundary
            </div>
          </div>
        </section>

        <section className="section roadmap-section" id="roadmap" data-scroll-section>
          <div className="section-heading" data-reveal="rise">
            <div>
              <p className="kicker">Available now and coming next</p>
              <h2>Start with GitHub or Cloudflare. Add more as BooLink grows.</h2>
            </div>
            <p>
              BooLink prioritizes useful, well-documented integrations over a long catalog of thin
              wrappers. Here is what you can use today and what is coming next.
            </p>
          </div>
          <div className="roadmap-list" data-reveal="roadmap">
            {roadmap.map(([title, status, detail], index) => (
              <article className="roadmap-item" key={title}>
                <span className="roadmap-number">{String(index + 1).padStart(2, '0')}</span>
                <div>
                  <span
                    className={`roadmap-status roadmap-${status.toLowerCase().replaceAll(' ', '-')}`}
                  >
                    {status}
                  </span>
                  <h3>{title}</h3>
                  <p>{detail}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="closing-cta" data-reveal="scale">
          <div className="closing-ghost" aria-hidden="true">
            <img src="/images/boolink-mascot.png" alt="" />
          </div>
          <div>
            <p className="kicker">Ready to connect</p>
            <h2>Give your AI useful tools without giving up control.</h2>
            <p>
              Install BooLink, connect GitHub or Cloudflare, and give your agent a clear,
              inspectable set of capabilities—all running locally in your environment.
            </p>
          </div>
          <a className="button button-primary" href="#cli">
            Open the shop
            <ArrowRight size={18} aria-hidden="true" />
          </a>
        </section>
      </main>

      <footer>
        <a className="brand" href="#top">
          <span className="brand-mark" aria-hidden="true">
            <img src="/images/boolink-mascot.png" alt="" />
          </span>
          <span>BooLink</span>
        </a>
        <p>Open-source MCP integrations for AI agents.</p>
        <p>MIT licensed · Credentials stay with you.</p>
      </footer>
    </>
  );
}
