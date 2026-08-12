import {
  ArrowDown,
  ArrowRight,
  Boxes,
  Check,
  ChevronRight,
  CircleDot,
  Cloud,
  Code2,
  GitBranch,
  KeyRound,
  LockKeyhole,
  PackageCheck,
  Search,
  ShieldCheck,
  Sparkles,
  TerminalSquare,
  Workflow,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

type Integration = {
  name: string;
  description: string;
  category: string;
  status: 'Experimental' | 'Planned' | 'To be selected';
  auth: string;
  icon: LucideIcon;
};

const githubTools = [
  ['github.get_authenticated_user', 'Confirm the identity attached to the local token.'],
  ['github.search_issues', 'Search issues with GitHub query syntax.'],
  ['github.get_issue', 'Retrieve a single issue and its normalized metadata.'],
  ['github.list_pull_requests', 'List pull requests with branch and state filters.'],
] as const;

const integrations: readonly Integration[] = [
  {
    name: 'GitHub',
    description:
      'A working, read-only MCP reference for issues, pull requests, and repository collaboration.',
    category: 'Development',
    status: 'Experimental',
    auth: 'Local GITHUB_TOKEN',
    icon: GitBranch,
  },
  {
    name: 'Cloudflare',
    description: 'Infrastructure visibility and carefully scoped operational capabilities.',
    category: 'Infrastructure',
    status: 'Planned',
    auth: 'Local API token',
    icon: Cloud,
  },
  {
    name: 'Third reference integration',
    description:
      'Selected for architectural contrast after the first two integrations are validated.',
    category: 'Research',
    status: 'To be selected',
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
    label: 'One coherent product',
    detail: 'Shared contracts, errors, tests, and documentation across official integrations.',
  },
] as const;

const roadmap = [
  ['Foundation', 'Complete', 'Contracts, registry helpers, MCP v2 adapter, tests, and CI.'],
  [
    'GitHub reference',
    'Complete',
    'Four read-only tools now validate the local-first architecture.',
  ],
  [
    'Registry + CLI',
    'Now',
    'The interactive integration shop works; package publishing and downloads come next.',
  ],
  ['Broader ecosystem', 'Later', 'Additional official integrations before community publishing.'],
] as const;

export function App() {
  const [query, setQuery] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

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
          ['principles', 'Trust'],
          ['architecture', 'Architecture'],
          ['roadmap', 'Roadmap'],
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
          <a href="#architecture">Architecture</a>
          <a href="#roadmap">Roadmap</a>
        </nav>

        <a className="header-status" href="#roadmap">
          <span className="status-pulse" aria-hidden="true" />
          Building in public
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
              BooLink is building maintained integrations that connect AI agents to the tools you
              already use—without sending your credentials through BooLink.
            </p>
            <div className="hero-actions">
              <a className="button button-primary" href="#integrations">
                Explore the project
                <ArrowRight size={18} aria-hidden="true" />
              </a>
              <a className="button button-secondary" href="#architecture">
                See how it works
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
                <span className="terminal-green">✓</span> GitHub reference integration{' '}
                <span className="terminal-muted">4 tools ready</span>
              </code>
            </div>
          </div>
        </section>

        <section
          className="signal-strip"
          aria-label="BooLink foundation status"
          data-reveal="stagger"
        >
          <div>
            <strong>2026-07-28</strong>
            <span>Current MCP era</span>
          </div>
          <div>
            <strong>3</strong>
            <span>Foundation packages</span>
          </div>
          <div>
            <strong>36</strong>
            <span>Passing tests</span>
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
              The catalog is deliberately small while the contracts are proven. Status labels are
              real—nothing below is presented as available before it is ready.
            </p>
          </div>

          <label className="integration-search" data-reveal="rise">
            <span className="sr-only">Search planned BooLink integrations</span>
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
                  <span className="integration-icon integration-icon-large">
                    <GitBranch size={30} aria-hidden="true" />
                  </span>
                  <span className="status-chip status-experimental">Experimental · built</span>
                </div>
                <p className="integration-category">Reference integration</p>
                <h3>GitHub MCP is ready for local testing.</h3>
                <p>
                  The first real BooLink integration runs beside your AI client, talks directly to
                  GitHub, and keeps its token out of BooLink infrastructure.
                </p>
                <div className="feature-stats" aria-label="GitHub integration attributes">
                  <span>
                    <strong>4</strong> read-only tools
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
                    <LockKeyhole size={13} /> Read only
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
                      <span className="integration-icon">
                        <Icon size={24} aria-hidden="true" />
                      </span>
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
                    </div>
                  </article>
                );
              })}
            </div>
          ) : null}
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
              <p className="kicker">The road to a useful MVP</p>
              <h2>Build the trust layer before the catalog.</h2>
            </div>
            <p>
              Three excellent integrations are more useful than thirty unreliable wrappers. Each
              phase stays runnable and verifiable.
            </p>
          </div>
          <div className="roadmap-list" data-reveal="roadmap">
            {roadmap.map(([title, status, detail], index) => (
              <article className="roadmap-item" key={title}>
                <span className="roadmap-number">{String(index + 1).padStart(2, '0')}</span>
                <div>
                  <span className={`roadmap-status roadmap-${status.toLowerCase()}`}>{status}</span>
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
            <p className="kicker">The foundation is live</p>
            <h2>Secure integrations. Conventional tools. A little more spirit.</h2>
            <p>
              The GitHub reference integration is built. The registry and CLI are now the active
              milestone on the path to a clean one-command install.
            </p>
          </div>
          <a className="button button-primary" href="#roadmap">
            Follow the build
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
