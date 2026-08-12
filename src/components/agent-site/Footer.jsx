import { useAgentSiteContext } from "../../context/AgentSiteContext";
import SiteLink from "./SiteLink";

// "Explore" column — only pages that actually exist today. label can read
// the agent's first name for the About link.
const EXPLORE_LINKS = [
  { path: "/about", label: (firstName) => `About ${firstName}` },
  { path: "/listings", label: () => "Properties" },
  { path: "/blog", label: () => "Blog" },
  { path: "/contact", label: () => "Let’s Connect" },
];

function InstagramIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="16" height="16">
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="0.6" fill="currentColor" stroke="none" />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="16" height="16">
      <path d="M15 3h-2a4 4 0 0 0-4 4v3H6v4h3v7h4v-7h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
    </svg>
  );
}

function LinkedInIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="16" height="16">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="7" cy="6.7" r="0.6" fill="currentColor" stroke="none" />
      <line x1="7" y1="10" x2="7" y2="17" />
      <path d="M11 17v-4.2a2.3 2.3 0 0 1 4.6 0V17" />
      <line x1="11" y1="10" x2="11" y2="17" />
    </svg>
  );
}

function SocialIcon({ href, children }) {
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="h-9 w-9 rounded-full border border-[var(--as-on-dark)]/30 flex items-center justify-center text-[var(--as-on-dark)]/70 transition-colors hover:text-[var(--as-on-dark)] hover:border-[var(--as-on-dark)]/60"
    >
      {children}
    </a>
  );
}

export default function Footer() {
  const { site } = useAgentSiteContext();
  const { agent, brokerage } = site;
  const firstName = agent.name.split(" ")[0];

  return (
    <footer className="bg-[var(--as-dark)] text-[var(--as-on-dark)]/65 px-6 lg:px-10 py-16">
      <div className="mx-auto max-w-6xl">
        <div className="grid sm:grid-cols-3 gap-12 text-sm items-start">
          <div>
            <img src={brokerage.logo} alt={brokerage.name} className="h-10 sm:h-12 w-auto mb-6" />
            <div className="flex items-center gap-3 mb-2">
              {site.secondaryLogo && <img src={site.secondaryLogo} alt="" className="h-8 w-auto" />}
              <p className="font-display text-2xl tracked-wide text-[var(--as-on-dark)]">{agent.name}</p>
            </div>
            {agent.license && <p className="text-[var(--as-on-dark)]/50">{agent.license}</p>}
          </div>

          <div>
            <p className="text-xs font-semibold tracked-wide uppercase text-[var(--as-on-dark)]/50 mb-4">
              Get In Touch
            </p>
            <div className="space-y-1.5">
              {agent.email && (
                <a href={`mailto:${agent.email}`} className="block hover:text-[var(--as-on-dark)] transition-colors">
                  {agent.email}
                </a>
              )}
              {agent.phone && (
                <a href={`tel:${agent.phone}`} className="block hover:text-[var(--as-on-dark)] transition-colors">
                  {agent.phone}
                </a>
              )}
              <p>
                {brokerage.address.line1}, {brokerage.address.city}, {brokerage.address.state}{" "}
                {brokerage.address.zip}
              </p>
            </div>
            {(site.social.instagram || site.social.facebook || site.social.linkedin) && (
              <div className="flex items-center gap-3 mt-5">
                <SocialIcon href={site.social.instagram}>
                  <InstagramIcon />
                </SocialIcon>
                <SocialIcon href={site.social.facebook}>
                  <FacebookIcon />
                </SocialIcon>
                <SocialIcon href={site.social.linkedin}>
                  <LinkedInIcon />
                </SocialIcon>
              </div>
            )}
          </div>

          <div>
            <p className="text-xs font-semibold tracked-wide uppercase text-[var(--as-on-dark)]/50 mb-4">
              Explore
            </p>
            <div className="space-y-1.5">
              {EXPLORE_LINKS.map((link) => (
                <SiteLink
                  key={link.path}
                  slug={site.slug}
                  path={link.path}
                  className="block hover:text-[var(--as-on-dark)] transition-colors"
                >
                  {link.label(firstName)}
                </SiteLink>
              ))}
            </div>
          </div>
        </div>

        <p className="mt-12 pt-6 border-t border-[var(--as-on-dark)]/10 text-xs text-[var(--as-on-dark)]/35">
          {brokerage.name} — {brokerage.disclaimer}
        </p>
      </div>
    </footer>
  );
}
