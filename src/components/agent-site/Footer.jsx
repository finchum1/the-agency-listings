import { useAgentSiteContext } from "../../context/AgentSiteContext";

export default function Footer() {
  const { site } = useAgentSiteContext();
  const { agent, brokerage } = site;
  const year = new Date().getFullYear();

  return (
    <footer className="bg-[#1c1a17] text-white/70 px-6 lg:px-10 py-14">
      <div className="mx-auto max-w-6xl">
        <div className="grid sm:grid-cols-3 gap-10 text-sm items-start">
          <div>
            <img src={brokerage.logo} alt={brokerage.name} className="h-14 sm:h-16 w-auto mb-3" />
            <p>{brokerage.address.line1}</p>
            <p>
              {brokerage.address.city}, {brokerage.address.state} {brokerage.address.zip}
            </p>
          </div>

          <div>
            <p className="text-white/90 font-medium mb-2">{agent.name}</p>
            <p>
              {brokerage.name}
              {agent.license ? ` — ${agent.license}` : ""}
            </p>
            {agent.phone && <p>{agent.phone}</p>}
            {agent.email && <p>{agent.email}</p>}
            {(site.social.instagram || site.social.facebook || site.social.linkedin) && (
              <div className="flex items-center gap-3 mt-3">
                {site.social.instagram && (
                  <a href={site.social.instagram} target="_blank" rel="noopener noreferrer" className="hover:text-white">
                    Instagram
                  </a>
                )}
                {site.social.facebook && (
                  <a href={site.social.facebook} target="_blank" rel="noopener noreferrer" className="hover:text-white">
                    Facebook
                  </a>
                )}
                {site.social.linkedin && (
                  <a href={site.social.linkedin} target="_blank" rel="noopener noreferrer" className="hover:text-white">
                    LinkedIn
                  </a>
                )}
              </div>
            )}
          </div>

          <div className="sm:text-right flex sm:flex-col sm:items-end justify-between">
            <div className="flex items-center gap-2 text-white/60">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M3 10.5 12 3l9 7.5M5 9.5V21h14V9.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="text-xs">Equal Housing Opportunity</span>
            </div>
            <p className="text-xs text-white/40 mt-3 max-w-xs">
              © {year} {agent.name}. All information deemed reliable but not guaranteed.
            </p>
          </div>
        </div>

        <p className="mt-10 pt-6 border-t border-white/10 text-xs text-white/40">
          {brokerage.name} — {brokerage.disclaimer}
        </p>
      </div>
    </footer>
  );
}
