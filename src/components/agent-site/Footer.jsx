import { useAgentSiteContext } from "../../context/AgentSiteContext";
import SiteLink from "./SiteLink";
import BrandLogo from "../BrandLogo";
import { resolveLanding } from "../../lib/landingPages";
import { orderByNav } from "../../lib/siteNav";

// "Explore" column — only pages that actually exist today. label can read
// the agent's first name for the About link. sectionKey mirrors
// Navbar.jsx's PAGES — a link whose section is off isn't advertised here
// either. Contact has no sectionKey since it's never optional.
const EXPLORE_LINKS = [
  { path: "/about", label: (firstName) => `About ${firstName}`, sectionKey: "bio" },
  { path: "/listings", label: () => "Properties", sectionKey: "listings" },
  { path: "/blog", label: () => "Blog", sectionKey: "blog" },
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

function TikTokIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
      <path d="M16.6 5.82c-.9-.9-1.4-2.13-1.4-3.42h-3.1v13.13c0 1.5-1.22 2.72-2.72 2.72s-2.72-1.22-2.72-2.72 1.22-2.72 2.72-2.72c.28 0 .55.04.8.12V9.87c-.26-.03-.53-.05-.8-.05C6.3 9.82 4 12.12 4 15.2s2.3 5.38 5.38 5.38 5.38-2.3 5.38-5.38V9.02a7.14 7.14 0 0 0 4.24 1.38V7.3c-.94 0-1.83-.3-2.4-.88Z" />
    </svg>
  );
}

function YouTubeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="16" height="16">
      <rect x="2.5" y="6" width="19" height="12" rx="3.5" />
      <path d="M10.5 9.5l5 2.5-5 2.5z" fill="currentColor" stroke="none" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

// Hardcoded literal Agency Red, not --as-accent -- the Red template
// repurposes --as-accent as black (see index.css), but these badges
// should stay the actual brand red on every template, that one included.
// The white ring exists for that same Red template: its footer is this
// exact red too, so without it the badges would blend straight into the
// background instead of reading as their own button.
function SocialIcon({ href, children }) {
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="h-9 w-9 rounded-full bg-[#ed2127] ring-1 ring-white/30 flex items-center justify-center text-white transition-opacity hover:opacity-85"
    >
      {children}
    </a>
  );
}

const heading = "text-xs font-semibold tracked-wide uppercase text-[var(--as-on-dark)]/50 mb-4";
const hoverLink = "block hover:text-[var(--as-on-dark)] transition-colors";

// Footer styles (agent_sites.footer_style, adapted as site.footerStyle; see the "Footer style" picker in SiteForm.jsx). All of them draw from the same
// pieces below, so what's in the footer (the pages, the contact details, the social links, the disclaimer) never differs by style, only how it's arranged:
//   classic  three columns: the agent, how to reach them, the pages.      centered  everything in one centered stack.
//   cta      a "thinking of making a move?" band over the classic columns.   wide  four columns, with the buy and sell pages and the areas.
//   slim     one line: logo, pages, phone.
export default function Footer() {
  const { site } = useAgentSiteContext();
  const { agent, brokerage } = site;
  const firstName = agent.name.split(" ")[0];
  const landing = resolveLanding(site.landing);
  const landingLinks = site.homeSections.includes("cards") && landing.menu ? landing.cards.filter((c) => c.on).map((c) => ({ path: c.path, label: () => c.nav })) : [];
  const baseLinks = EXPLORE_LINKS.filter((link) => !link.sectionKey || site.homeSections.includes(link.sectionKey));
  // The three landing pages sit just before the last link (Let's Connect), unless the agent has put the menu in an order of their own.
  const visibleLinks = orderByNav([...baseLinks.slice(0, -1), ...landingLinks, ...baseLinks.slice(-1)], site.navOrder);
  const style = ["centered", "cta", "wide", "slim"].includes(site.footerStyle) ? site.footerStyle : "classic";
  const hasSocial = Boolean(site.social.instagram || site.social.facebook || site.social.linkedin || site.social.tiktok || site.social.youtube || site.social.x);
  const address = `${brokerage.address.line1}, ${brokerage.address.city}, ${brokerage.address.state} ${brokerage.address.zip}`;

  const logo = <BrandLogo src={brokerage.logo} name={brokerage.name} className="h-10 sm:h-12 w-auto" />;
  const agentLine = (className = "") => (
    <div className={`flex items-center gap-3 ${className}`}>
      {site.secondaryLogo && <img src={site.secondaryLogo} alt="" className="agent-secondary-logo h-8 w-auto" />}
      <p className="font-display text-2xl tracked-wide text-[var(--as-on-dark)]">{agent.name}</p>
    </div>
  );
  const socials = (className = "") =>
    hasSocial && (
      <div className={`flex items-center gap-3 ${className}`}>
        <SocialIcon href={site.social.instagram}>
          <InstagramIcon />
        </SocialIcon>
        <SocialIcon href={site.social.facebook}>
          <FacebookIcon />
        </SocialIcon>
        <SocialIcon href={site.social.linkedin}>
          <LinkedInIcon />
        </SocialIcon>
        <SocialIcon href={site.social.tiktok}>
          <TikTokIcon />
        </SocialIcon>
        <SocialIcon href={site.social.youtube}>
          <YouTubeIcon />
        </SocialIcon>
        <SocialIcon href={site.social.x}>
          <XIcon />
        </SocialIcon>
      </div>
    );
  const contact = (
    <div className="space-y-1.5">
      {agent.email && (
        <a href={`mailto:${agent.email}`} className={hoverLink}>
          {agent.email}
        </a>
      )}
      {agent.phone && (
        <a href={`tel:${agent.phone}`} className={hoverLink}>
          {agent.phone}
        </a>
      )}
      <p>{address}</p>
    </div>
  );
  const links = (className = "block hover:text-[var(--as-on-dark)] transition-colors") =>
    visibleLinks.map((link) => (
      <SiteLink key={link.path} slug={site.slug} path={link.path} className={className}>
        {link.label(firstName)}
      </SiteLink>
    ));
  const disclaimer = (center) => (
    <p className={`mt-12 pt-6 border-t border-[var(--as-on-dark)]/10 text-xs text-[var(--as-on-dark)]/35 ${center ? "text-center" : ""}`}>
      {brokerage.name} — {brokerage.disclaimer}
    </p>
  );

  const shell = "mt-auto bg-[var(--as-dark)] text-[var(--as-on-dark)]/65 px-6 lg:px-10";

  const columns = (
    <div className="grid sm:grid-cols-3 gap-12 text-sm items-start">
      <div>
        <div className="mb-6">{logo}</div>
        {agentLine("mb-2")}
        {agent.license && <p className="text-[var(--as-on-dark)]/50">{agent.license}</p>}
      </div>
      <div>
        <p className={heading}>Get In Touch</p>
        {contact}
        {socials("mt-5")}
      </div>
      <div>
        <p className={heading}>Explore</p>
        <div className="space-y-1.5">{links()}</div>
      </div>
    </div>
  );

  if (style === "centered") {
    return (
      <footer className={`${shell} py-16`}>
        <div className="mx-auto max-w-4xl text-sm text-center flex flex-col items-center">
          {logo}
          {agentLine("mt-6 justify-center")}
          {agent.license && <p className="mt-1 text-[var(--as-on-dark)]/50">{agent.license}</p>}
          <nav className="mt-8 flex flex-wrap justify-center gap-x-8 gap-y-3 text-xs font-medium tracked-wide uppercase">{links()}</nav>
          {socials("mt-8 justify-center")}
          <div className="mt-8 space-y-1.5">
            {[agent.phone, agent.email].filter(Boolean).length > 0 && (
              <p>
                {agent.phone && (
                  <a href={`tel:${agent.phone}`} className="hover:text-[var(--as-on-dark)] transition-colors">
                    {agent.phone}
                  </a>
                )}
                {agent.phone && agent.email && " · "}
                {agent.email && (
                  <a href={`mailto:${agent.email}`} className="hover:text-[var(--as-on-dark)] transition-colors">
                    {agent.email}
                  </a>
                )}
              </p>
            )}
            <p>{address}</p>
          </div>
          <div className="w-full">{disclaimer(true)}</div>
        </div>
      </footer>
    );
  }

  if (style === "cta") {
    return (
      <footer className="mt-auto">
        <div className="bg-[var(--as-accent)] text-white px-6 lg:px-10 py-12">
          <div className="mx-auto max-w-6xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
            <div>
              <p className="font-display text-2xl sm:text-3xl font-semibold">Thinking of making a move?</p>
              <p className="mt-1 text-white/80">Tell {firstName} what you have in mind and get an answer within one business day.</p>
            </div>
            <SiteLink slug={site.slug} path="/contact" className="as-btn shrink-0 self-start sm:self-auto text-xs font-medium tracked-wide uppercase px-8 py-4 border border-white text-white transition-colors hover:bg-white hover:text-[var(--as-dark)]">
              Let&rsquo;s talk
            </SiteLink>
          </div>
        </div>
        <div className={`${shell} py-16`}>
          <div className="mx-auto max-w-6xl">
            {columns}
            {disclaimer(false)}
          </div>
        </div>
      </footer>
    );
  }

  if (style === "wide") {
    const buySell = landing.cards.filter((c) => c.on && site.homeSections.includes("cards"));
    const areas = (site.areas || []).slice(0, 6);
    const cols = 2 + (buySell.length ? 1 : 0) + (areas.length ? 1 : 0);
    return (
      <footer className={`${shell} py-16`}>
        <div className="mx-auto max-w-6xl">
          <div className={`grid gap-12 text-sm items-start sm:grid-cols-2 ${cols >= 4 ? "lg:grid-cols-[1.4fr_1fr_1fr_1fr]" : "lg:grid-cols-[1.4fr_1fr_1fr]"}`}>
            <div>
              <div className="mb-6">{logo}</div>
              {agentLine("mb-2")}
              {agent.license && <p className="text-[var(--as-on-dark)]/50 mb-5">{agent.license}</p>}
              {contact}
              {socials("mt-5")}
            </div>
            <div>
              <p className={heading}>Explore</p>
              <div className="space-y-1.5">{visibleLinks.filter((l) => !buySell.some((c) => c.path === l.path)).map((link) => (
                <SiteLink key={link.path} slug={site.slug} path={link.path} className={hoverLink}>
                  {link.label(firstName)}
                </SiteLink>
              ))}</div>
            </div>
            {buySell.length > 0 && (
              <div>
                <p className={heading}>Buy And Sell</p>
                <div className="space-y-1.5">
                  {buySell.map((c) => (
                    <SiteLink key={c.path} slug={site.slug} path={c.path} className={hoverLink}>
                      {c.nav}
                    </SiteLink>
                  ))}
                </div>
              </div>
            )}
            {areas.length > 0 && (
              <div>
                <p className={heading}>Areas</p>
                <div className="space-y-1.5">
                  {areas.map((a) => (
                    <SiteLink key={a.slug} slug={site.slug} path={`/areas/${a.slug}`} className={hoverLink}>
                      {a.name}
                    </SiteLink>
                  ))}
                </div>
              </div>
            )}
          </div>
          {disclaimer(false)}
        </div>
      </footer>
    );
  }

  if (style === "slim") {
    return (
      <footer className={`${shell} py-8`}>
        <div className="mx-auto max-w-6xl text-sm">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div className="flex items-center gap-4 min-w-0">
              <BrandLogo src={brokerage.logo} name={brokerage.name} className="h-8 w-auto" />
              <span className="font-display text-[var(--as-on-dark)] truncate">{agent.name}</span>
            </div>
            <nav className="flex flex-wrap gap-x-6 gap-y-2 text-xs font-medium tracked-wide uppercase">{links()}</nav>
            <div className="flex items-center gap-4">
              {agent.phone && (
                <a href={`tel:${agent.phone}`} className="hover:text-[var(--as-on-dark)] transition-colors whitespace-nowrap">
                  {agent.phone}
                </a>
              )}
              {socials()}
            </div>
          </div>
          <p className="mt-6 pt-5 border-t border-[var(--as-on-dark)]/10 text-xs text-[var(--as-on-dark)]/35">
            {brokerage.name} — {brokerage.disclaimer}
          </p>
        </div>
      </footer>
    );
  }

  return (
    <footer className={`${shell} py-16`}>
      <div className="mx-auto max-w-6xl">
        {columns}
        {disclaimer(false)}
      </div>
    </footer>
  );
}
