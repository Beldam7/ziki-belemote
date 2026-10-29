import { useEffect, useRef, useState, type ReactNode } from 'react';
import { OWNER, ZIKI_BASE } from '../data/zikiSnapshot';
import { hueFor, initials } from '../status';
import type { Agent } from '../types';

interface Props {
  agents: Agent[];
  onSelectAgent: (agentId: string) => void;
  children: ReactNode;
}

const DASHBOARD = `${ZIKI_BASE}/dashboard`;
// Agent Briefs is not part of the Ziki app yet, so the live dashboard has no way back here.
// Ziki links open in a new tab and this page stays open in its own.
const TO_ZIKI = { target: '_blank', rel: 'noreferrer' } as const;

// Small inline icons in the style of the Ziki top bar.
const icon = {
  product: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  ),
  marketing: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 10v4h3l5 4V6L7 10H4z" />
      <path d="M16 9a4 4 0 0 1 0 6" />
    </svg>
  ),
  security: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  ),
  agents: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="5" y="8" width="14" height="11" rx="2" />
      <path d="M12 4v4M9 13h.01M15 13h.01" />
    </svg>
  ),
  chevron: (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="chev">
      <path d="M7 10l5 5 5-5" />
    </svg>
  ),
  trophy: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8 4h8v5a4 4 0 0 1-8 0V4zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 20h8" />
    </svg>
  ),
  bell: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4l2-2zM10 20a2 2 0 0 0 4 0" />
    </svg>
  ),
};

const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function DashboardLayout({ agents, onSelectAgent, children }: Props) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !menuRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', close);
    };
  }, [open]);

  return (
    <>
      <a className="skip" href="#main-content">
        Skip to content
      </a>
      <header className="topnav">
        <div className="topnav-inner">
          <a className="brand" href={DASHBOARD} {...TO_ZIKI}>
            <img src={`${ZIKI_BASE}/homepage/ziki-mark.svg`} alt="" width={22} height={22} />
            <span>ziki</span>
          </a>
          <a className="project" href={DASHBOARD} {...TO_ZIKI}>
            Zedu {icon.chevron}
          </a>
          <nav className="teams" aria-label="Teams">
            <a href={DASHBOARD} {...TO_ZIKI}>{icon.product}Product</a>
            <a href={DASHBOARD} {...TO_ZIKI}>{icon.marketing}Marketing</a>
            <a href={DASHBOARD} {...TO_ZIKI}>{icon.security}Security</a>
          </nav>

          <div className="topnav-right">
            <div className="menu-wrap" ref={menuRef}>
              <button className="pill agents-btn" aria-expanded={open} aria-haspopup="true" onClick={() => setOpen((o) => !o)}>
                {icon.agents}
                <span className="hide-sm">Agents</span>
                {icon.chevron}
              </button>
              {open && (
                <div className="menu" role="menu">
                  <p className="menu-head">Project agents</p>
                  {agents.map((a) => (
                    <button
                      key={a.id}
                      role="menuitem"
                      className="menu-agent"
                      onClick={() => {
                        onSelectAgent(a.id);
                        setOpen(false);
                      }}
                    >
                      <span className={`chip-initials agent-avatar hue-${hueFor(a.id)}`}>{initials(a.name)}</span>
                      <span className="menu-name">{a.name}</span>
                      <span className="role">{capitalise(a.level)}</span>
                    </button>
                  ))}
                  <hr />
                  <a role="menuitem" className="menu-link accent" href={DASHBOARD} {...TO_ZIKI}>
                    + Create agent
                  </a>
                  <a role="menuitem" className="menu-link" href={DASHBOARD} {...TO_ZIKI}>
                    Get started
                  </a>
                  <a role="menuitem" className="menu-link" href={DASHBOARD} {...TO_ZIKI}>
                    Manage agents
                  </a>
                  <a role="menuitem" className="menu-link current" href="#" aria-current="page" onClick={() => setOpen(false)}>
                    Agent Briefs <span className="badge-new">New</span>
                  </a>
                </div>
              )}
            </div>
            <a className="pill user" href={DASHBOARD} {...TO_ZIKI}>
              <span className="avatar">{OWNER.name.charAt(0)}</span>
              <span className="hide-sm">{OWNER.name}</span>
              <span className="hide-sm">{icon.chevron}</span>
            </a>
            <span className="pts">
              {icon.trophy}
              {OWNER.points}
              <span className="hide-sm">pts</span>
            </span>
            <a className="bell" href={DASHBOARD} {...TO_ZIKI} aria-label="Notifications">
              {icon.bell}
            </a>
          </div>
        </div>
      </header>
      <main id="main-content" className="shell">
        {children}
      </main>
    </>
  );
}
