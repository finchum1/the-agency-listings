import { Link } from "react-router-dom";
import { useBrokerageSiteContext } from "../../context/BrokerageSiteContext";

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
function SocialIcon({ href, children }) {
  if (!href) return null;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="h-9 w-9 rounded-full border border-[var(--as-on-dark)]/30 flex items-center justify-center text-[var(--as-on-dark)]/70 transition-colors hover:text-[var(--as-on-dark)] hover:border-[var(--as-on-dark)]/60">
      {children}
    </a>
  );
}

// Same sectionKey convention as Navbar.jsx's PAGES — a link whose
// section is off in home_sections isn't advertised here either. Agents
// has no sectionKey (unlike the rest) for the same reason as Navbar.jsx:
// its Home preview was removed, but the page and its links stay put.
const EXPLORE_LINKS = [
  { path: "/brokerage/about", label: "About", sectionKey: "about" },
  { path: "/brokerage/agents", label: "Our Agents" },
  { path: "/brokerage/areas", label: "Areas of Expertise", sectionKey: "areas" },
  { path: "/brokerage/blog", label: "Blog", sectionKey: "blog" },
  { path: "/brokerage/home-valuation", label: "Home Valuation" },
];

export default function Footer() {
  const { site } = useBrokerageSiteContext();
  const { brokerage } = site;
  const visibleLinks = EXPLORE_LINKS.filter((link) => !link.sectionKey || site.homeSections.includes(link.sectionKey));

  return (
    <footer className="bg-[var(--as-dark)] text-[var(--as-on-dark)]/65 px-6 lg:px-10 py-16">
      <div className="mx-auto max-w-6xl">
        <div className="grid sm:grid-cols-3 gap-12 text-sm items-start">
          <div>
            <img
              src={brokerage.logos[site.logoVariant] || brokerage.logo}
              alt={brokerage.name}
              className="h-10 sm:h-12 w-auto mb-6"
            />
            <p className="text-[var(--as-on-dark)]/50">
              {brokerage.address.line1}, {brokerage.address.city}, {brokerage.address.state} {brokerage.address.zip}
            </p>
          </div>

          <div>
            <p className="text-xs font-semibold tracked-wide uppercase text-[var(--as-on-dark)]/50 mb-4">Get In Touch</p>
            <div className="space-y-1.5">
              {site.contact.email && (
                <a href={`mailto:${site.contact.email}`} className="block hover:text-[var(--as-on-dark)] transition-colors">
                  {site.contact.email}
                </a>
              )}
              {site.contact.phone && (
                <a href={`tel:${site.contact.phone}`} className="block hover:text-[var(--as-on-dark)] transition-colors">
                  {site.contact.phone}
                </a>
              )}
            </div>
            {(site.social.instagram ||
              site.social.facebook ||
              site.social.linkedin ||
              site.social.tiktok ||
              site.social.youtube) && (
              <div className="flex items-center gap-3 mt-5">
                <SocialIcon href={site.social.instagram}><InstagramIcon /></SocialIcon>
                <SocialIcon href={site.social.facebook}><FacebookIcon /></SocialIcon>
                <SocialIcon href={site.social.linkedin}><LinkedInIcon /></SocialIcon>
                <SocialIcon href={site.social.tiktok}><TikTokIcon /></SocialIcon>
                <SocialIcon href={site.social.youtube}><YouTubeIcon /></SocialIcon>
              </div>
            )}
          </div>

          <div>
            <p className="text-xs font-semibold tracked-wide uppercase text-[var(--as-on-dark)]/50 mb-4">Explore</p>
            <div className="space-y-1.5">
              {visibleLinks.map((link) => (
                <Link key={link.path} to={link.path} className="block hover:text-[var(--as-on-dark)] transition-colors">
                  {link.label}
                </Link>
              ))}
              <Link to="/brokerage/contact" className="block hover:text-[var(--as-on-dark)] transition-colors">
                Contact
              </Link>
            </div>
          </div>
        </div>

        <div className="mt-12 pt-6 border-t border-[var(--as-on-dark)]/10 flex flex-col sm:flex-row sm:items-center gap-5">
          <div className="flex items-center gap-3 shrink-0">
            {/* White chip on both — the official REALTOR® and Equal
                Housing Opportunity marks (downloaded straight from
                nar.realtor and hud.gov) are fixed black-on-white assets,
                not currentColor, so they need their own light background
                to stay legible against --as-dark, whatever that theme's
                dark color actually is. */}
            <div className="bg-white rounded px-2 py-1.5 inline-flex items-center">
              <img src="/images/realtor-logo.png" alt="REALTOR®" className="h-9 w-auto" />
            </div>
            <div className="bg-white rounded px-2 py-1.5 inline-flex items-center">
              <img src="/images/equal-housing-logo.png" alt="Equal Housing Opportunity" className="h-9 w-auto" />
            </div>
          </div>
          <p className="text-xs text-[var(--as-on-dark)]/35">{brokerage.franchiseDisclaimer}</p>
        </div>
      </div>
    </footer>
  );
}
