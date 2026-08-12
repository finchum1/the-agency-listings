import { useAgentSiteContext } from "../../context/AgentSiteContext";

export default function Footer() {
  const { site } = useAgentSiteContext();
  const { agent, brokerage } = site;
  const year = new Date().getFullYear();

  return (
    <footer className="bg-[var(--as-dark)] text-[var(--as-on-dark)]/65 px-6 lg:px-10 py-14">
      <div className="mx-auto max-w-6xl">
        <div className="grid sm:grid-cols-3 gap-10 text-sm items-start">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <img src={brokerage.logo} alt={brokerage.name} className="h-14 sm:h-16 w-auto" />
              {site.secondaryLogo && (
                <>
                  <span className="h-10 w-px bg-[var(--as-on-dark)]/20 shrink-0" aria-hidden="true" />
                  <img src={site.secondaryLogo} alt="" className="h-10 sm:h-12 w-auto" />
                </>
              )}
            </div>
            <p>{brokerage.address.line1}</p>
            <p>
              {brokerage.address.city}, {brokerage.address.state} {brokerage.address.zip}
            </p>
          </div>

          <div>
            <p className="text-[var(--as-on-dark)]/90 font-medium mb-2">{agent.name}</p>
            <p>
              {brokerage.name}
              {agent.license ? ` — ${agent.license}` : ""}
            </p>
            {agent.phone && <p>{agent.phone}</p>}
            {agent.email && <p>{agent.email}</p>}
            {(site.social.instagram || site.social.facebook || site.social.linkedin) && (
              <div className="flex items-center gap-3 mt-3 text-xs tracked-wide uppercase">
                {site.social.instagram && (
                  <a href={site.social.instagram} target="_blank" rel="noopener noreferrer" className="hover:text-[var(--as-on-dark)]">
                    Instagram
                  </a>
                )}
                {site.social.facebook && (
                  <a href={site.social.facebook} target="_blank" rel="noopener noreferrer" className="hover:text-[var(--as-on-dark)]">
                    Facebook
                  </a>
                )}
                {site.social.linkedin && (
                  <a href={site.social.linkedin} target="_blank" rel="noopener noreferrer" className="hover:text-[var(--as-on-dark)]">
                    LinkedIn
                  </a>
                )}
              </div>
            )}
          </div>

          <div className="sm:text-right flex sm:flex-col sm:items-end justify-between">
            <div className="flex items-center gap-2 text-[var(--as-on-dark)]/55">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M3 10.5 12 3l9 7.5M5 9.5V21h14V9.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="text-xs tracked uppercase">Equal Housing Opportunity</span>
            </div>
            <p className="text-xs text-[var(--as-on-dark)]/35 mt-3 max-w-xs">
              © {year} {agent.name}. All information deemed reliable but not guaranteed.
            </p>
          </div>
        </div>

        <p className="mt-10 pt-6 border-t border-[var(--as-on-dark)]/10 text-xs text-[var(--as-on-dark)]/35">
          {brokerage.name} — {brokerage.disclaimer}
        </p>
      </div>
    </footer>
  );
}
