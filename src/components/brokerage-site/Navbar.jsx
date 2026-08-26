import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useBrokerageSiteContext } from "../../context/BrokerageSiteContext";

// sectionKey matches brokerage_site.home_sections entries (see
// HomeSections.jsx) — a section turned off there isn't advertised in the
// nav, though the page itself still works if linked to directly, same
// as agent-site/Navbar.jsx's own PAGES list. Contact has no sectionKey
// since it's never optional (always shown, both on Home and as its own
// page) — same convention as agent sites.
const PAGES = [
  { path: "/brokerage/about", label: "About", sectionKey: "about" },
  { path: "/brokerage/agents", label: "Agents", sectionKey: "agents" },
  { path: "/brokerage/areas", label: "Areas", sectionKey: "areas" },
  { path: "/brokerage/blog", label: "Blog", sectionKey: "blog" },
  { path: "/brokerage/contact", label: "Contact" },
];

// Parallel to agent-site/Navbar.jsx — fixed nav (no per-slug SiteLink
// needed, there's only one brokerage site), filtered by home_sections.
export default function Navbar() {
  const { site } = useBrokerageSiteContext();
  const visiblePages = PAGES.filter((page) => !page.sectionKey || site.homeSections.includes(page.sectionKey));
  const location = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  const isHome = location.pathname === "/brokerage";
  const solid = scrolled || open || !isHome;

  const linkClass =
    "text-xs font-medium tracked-wide uppercase transition-colors whitespace-nowrap text-[var(--as-on-dark)]/75 hover:text-[var(--as-on-dark)]";

  return (
    <header
      className={`fixed top-0 inset-x-0 z-50 transition-colors duration-300 ${
        solid ? "bg-[var(--as-dark)] shadow-md" : "bg-transparent"
      }`}
    >
      <div className="mx-auto max-w-7xl px-6 lg:px-10 flex items-center justify-between py-4">
        <Link to="/brokerage" className="flex items-center gap-3 min-w-0">
          <img
            src={site.brokerage.logos[site.logoVariant] || site.brokerage.logo}
            alt={site.brokerage.name}
            className="h-9 sm:h-11 w-auto"
          />
        </Link>

        <nav className="hidden lg:flex items-center gap-6 xl:gap-8 shrink-0">
          {visiblePages.map((page) => (
            <Link
              key={page.path}
              to={page.path}
              className={`${linkClass} ${location.pathname === page.path ? "text-[var(--as-on-dark)]" : ""}`}
            >
              {page.label}
            </Link>
          ))}
          {site.contact.phone ? (
            <a
              href={`tel:${site.contact.phone}`}
              className="text-xs font-medium tracked-wide uppercase px-5 py-2.5 border border-[var(--as-on-dark)]/70 text-[var(--as-on-dark)] whitespace-nowrap transition-colors hover:bg-[var(--as-on-dark)] hover:text-[var(--as-dark)]"
            >
              {site.contact.phone}
            </a>
          ) : (
            <Link
              to="/brokerage/contact"
              className="text-xs font-medium tracked-wide uppercase px-5 py-2.5 border border-[var(--as-on-dark)]/70 text-[var(--as-on-dark)] whitespace-nowrap transition-colors hover:bg-[var(--as-on-dark)] hover:text-[var(--as-dark)]"
            >
              Get In Touch
            </Link>
          )}
        </nav>

        <button className="lg:hidden p-2 shrink-0 text-[var(--as-on-dark)]" onClick={() => setOpen((v) => !v)} aria-label="Toggle menu">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            {open ? <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" /> : <path d="M3 6h18M3 12h18M3 18h18" strokeLinecap="round" />}
          </svg>
        </button>
      </div>

      {open && (
        <div className="lg:hidden bg-[var(--as-dark)] border-t border-[var(--as-on-dark)]/10 px-6 py-4 flex flex-col gap-4">
          {visiblePages.map((page) => (
            <Link key={page.path} to={page.path} onClick={() => setOpen(false)} className="text-xs font-medium tracked-wide uppercase text-[var(--as-on-dark)]/80">
              {page.label}
            </Link>
          ))}
          {site.contact.phone ? (
            <a
              href={`tel:${site.contact.phone}`}
              onClick={() => setOpen(false)}
              className="text-xs font-medium tracked-wide uppercase px-5 py-3 bg-[var(--as-accent)] text-white text-center"
            >
              {site.contact.phone}
            </a>
          ) : (
            <Link
              to="/brokerage/contact"
              onClick={() => setOpen(false)}
              className="text-xs font-medium tracked-wide uppercase px-5 py-3 bg-[var(--as-accent)] text-white text-center"
            >
              Get In Touch
            </Link>
          )}
        </div>
      )}
    </header>
  );
}
