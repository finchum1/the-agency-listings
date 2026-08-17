import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { useAgentSiteContext } from "../../context/AgentSiteContext";
import { agentSiteHref } from "../../lib/agentSiteLinks";
import SiteLink from "./SiteLink";

// sectionKey matches agent_sites.home_sections entries (see
// HomeSections.jsx) — a page whose section an agent has turned off isn't
// advertised in the nav, though the page itself still works if linked to
// directly (see SiteForm.jsx's section toggle for why). Contact has no
// sectionKey since it's never optional.
const PAGES = [
  { path: "/about", label: "About", sectionKey: "bio" },
  { path: "/listings", label: "Listings", sectionKey: "listings" },
  { path: "/areas", label: "Areas", sectionKey: "areas" },
  { path: "/blog", label: "Blog", sectionKey: "blog" },
  { path: "/contact", label: "Contact" },
];

export default function Navbar() {
  const { site } = useAgentSiteContext();
  const location = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Transparent-over-hero only makes sense on the home page, which is the
  // only page with a full-bleed photo/video behind the nav — every other
  // page would render light nav text on a light page background. Reset on
  // every navigation so a subpage never inherits a stale scroll position.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);
  const isHome = location.pathname === agentSiteHref(site.slug) || location.pathname === "/";
  const solid = scrolled || open || !isHome;

  const visiblePages = PAGES.filter((page) => !page.sectionKey || site.homeSections.includes(page.sectionKey));

  const linkClass =
    "text-xs font-medium tracked-wide uppercase transition-colors whitespace-nowrap text-[var(--as-on-dark)]/75 hover:text-[var(--as-on-dark)]";

  return (
    <header
      className={`fixed top-0 inset-x-0 z-50 transition-colors duration-300 ${
        solid ? "bg-[var(--as-dark)] shadow-md" : "bg-transparent"
      }`}
    >
      <div className="mx-auto max-w-7xl px-6 lg:px-10 flex items-center justify-between py-4">
        <SiteLink slug={site.slug} path="" className="flex items-center gap-3 min-w-0">
          <img src={site.brokerage.logo} alt={site.brokerage.name} className="h-9 sm:h-11 w-auto" />
          {site.secondaryLogo && (
            <>
              <span className="h-8 w-px bg-[var(--as-on-dark)]/25 shrink-0" aria-hidden="true" />
              <img src={site.secondaryLogo} alt="" className="h-8 sm:h-10 w-auto" />
            </>
          )}
          <span className="hidden sm:block ml-2 text-sm font-display tracked-wide whitespace-nowrap text-[var(--as-on-dark)]">
            {site.agent.name}
          </span>
        </SiteLink>

        <nav className="hidden lg:flex items-center gap-6 xl:gap-8 shrink-0">
          {visiblePages.map((page) => {
            const active = location.pathname === agentSiteHref(site.slug, page.path);
            return (
              <SiteLink
                key={page.path}
                slug={site.slug}
                path={page.path}
                className={`${linkClass} ${active ? "text-[var(--as-on-dark)]" : ""}`}
              >
                {page.label}
              </SiteLink>
            );
          })}
          {site.agent.phone ? (
            <a
              href={`tel:${site.agent.phone}`}
              className="text-xs font-medium tracked-wide uppercase px-5 py-2.5 border border-[var(--as-on-dark)]/70 text-[var(--as-on-dark)] whitespace-nowrap transition-colors hover:bg-[var(--as-on-dark)] hover:text-[var(--as-dark)]"
            >
              {site.agent.phone}
            </a>
          ) : (
            <SiteLink
              slug={site.slug}
              path="/contact"
              className="text-xs font-medium tracked-wide uppercase px-5 py-2.5 border border-[var(--as-on-dark)]/70 text-[var(--as-on-dark)] whitespace-nowrap transition-colors hover:bg-[var(--as-on-dark)] hover:text-[var(--as-dark)]"
            >
              Let&rsquo;s Connect
            </SiteLink>
          )}
        </nav>

        <button
          className="lg:hidden p-2 shrink-0 text-[var(--as-on-dark)]"
          onClick={() => setOpen((v) => !v)}
          aria-label="Toggle menu"
        >
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            {open ? (
              <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
            ) : (
              <path d="M3 6h18M3 12h18M3 18h18" strokeLinecap="round" />
            )}
          </svg>
        </button>
      </div>

      {open && (
        <div className="lg:hidden bg-[var(--as-dark)] border-t border-[var(--as-on-dark)]/10 px-6 py-4 flex flex-col gap-4">
          {visiblePages.map((page) => (
            <SiteLink
              key={page.path}
              slug={site.slug}
              path={page.path}
              onClick={() => setOpen(false)}
              className="text-xs font-medium tracked-wide uppercase text-[var(--as-on-dark)]/80"
            >
              {page.label}
            </SiteLink>
          ))}
          {site.agent.phone ? (
            <a
              href={`tel:${site.agent.phone}`}
              onClick={() => setOpen(false)}
              className="text-xs font-medium tracked-wide uppercase px-5 py-3 bg-[var(--as-accent)] text-white text-center"
            >
              {site.agent.phone}
            </a>
          ) : (
            <SiteLink
              slug={site.slug}
              path="/contact"
              onClick={() => setOpen(false)}
              className="text-xs font-medium tracked-wide uppercase px-5 py-3 bg-[var(--as-accent)] text-white text-center"
            >
              Let&rsquo;s Connect
            </SiteLink>
          )}
        </div>
      )}
    </header>
  );
}
