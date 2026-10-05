import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import brokerage from "../../lib/brokerage";
import { useTheme } from "../../hooks/useTheme";

// Order matches the home page's own product sections (LandingPage.jsx) —
// Brokerage Site leads, then Agent Websites, then Property Sites, then
// People, Upcoming last. Keep both in sync if this order ever changes again.
const LINKS = [
  { path: "/brokerage-website", label: "Brokerage Site" },
  { path: "/agent-websites", label: "Agent Websites" },
  { path: "/property-websites", label: "Property Sites" },
  { path: "/people", label: "People" },
  { path: "/upcoming", label: "Upcoming" },
];

// Flush, full-width sticky header for every marketing page (home + the
// three product deep-dives) — not a detached/floating pill (that
// treatment exists only as agent sites' opt-in "Floating" header style
// now, see Navbar.jsx/SiteForm.jsx; unaffected by this file).
//
// Transparent at the very top — it just matches the page's own cream
// body background, no visible bar at all — and crosses to a solid white
// bar (with a hairline border + soft shadow, since white and the page's
// cream are close enough in value to need that for definition) once the
// page scrolls. Logo and link text stay dark/red in both states; unlike
// the black version this replaced, neither state here is a dark
// background, so nothing needs to flip to a light variant.
//
// Nav links sit at the far right (ml-auto) rather than centered — with
// no Sign In/CTA on the right to balance against, a centered link row
// read as adrift; anchored right, the logo anchors left and the links
// read as a single deliberate cluster. Active link is a solid Agency-red
// pill.
//
// Below `sm` the link row collapses into a hamburger that opens a
// dropdown directly beneath the bar. That dropdown always has its own
// solid white background regardless of scroll state — an open menu
// needs to stay legible over whatever's directly below it even before
// the page has scrolled.
//
// No Sign In link here on purpose — this is a pure product-marketing
// page now (also served standalone at theagency.latchpointstudios.com,
// a Latchpoint Studios marketing subdomain with no dashboard access at
// all), not a login funnel. /login itself is untouched and still reachable
// by direct URL on the main app host.
// Light/dark switch for the marketing pages. useTheme (shared with the
// dashboard) owns storage and the `dark` class on <html>; this just flips
// between the two explicit choices, starting from whatever the page is
// showing right now (the device setting until someone picks one).
function ThemeToggle() {
  const [, setTheme] = useTheme();
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains("dark"));

  useEffect(() => {
    const root = document.documentElement;
    const sync = () => setIsDark(root.classList.contains("dark"));
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className="p-2 rounded-full text-[#1c1a17]/70 dark:text-[#faf9f7]/70 hover:bg-black/5 dark:hover:bg-white/10 hover:text-[#1c1a17] dark:hover:text-[#faf9f7] transition-colors"
    >
      {isDark ? (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      ) : (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z" />
        </svg>
      )}
    </button>
  );
}

export default function MarketingNav() {
  const location = useLocation();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-40 transition-colors duration-300 ${
        scrolled ? "bg-white/95 dark:bg-[#0d0d0d]/95 backdrop-blur-md border-b border-black/5 dark:border-white/10 shadow-sm" : "bg-transparent border-b border-transparent"
      }`}
    >
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <div className="h-20 flex items-center gap-4">
          <Link to="/" className="shrink-0">
            <img src={brokerage.logo} alt={brokerage.name} className="h-12 w-auto" />
          </Link>

          <div className="ml-auto flex items-center gap-2">
            <nav className="hidden sm:flex items-center gap-1">
              {LINKS.map((link) => {
                const active = location.pathname === link.path;
                return (
                  <Link
                    key={link.path}
                    to={link.path}
                    className={`text-sm font-medium px-4 py-2 rounded-full transition-colors ${
                      active ? "bg-[#ed2127] text-white shadow-sm" : "text-[#1c1a17]/70 dark:text-[#faf9f7]/70 hover:bg-[#ed2127]/10 hover:text-[#ed2127]"
                    }`}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </nav>

            <ThemeToggle />

            <button
              type="button"
              onClick={() => setMobileNavOpen((v) => !v)}
              aria-label={mobileNavOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileNavOpen}
              className="sm:hidden -mr-1 p-2 rounded-full text-[#1c1a17]/70 dark:text-[#faf9f7]/70 hover:bg-black/5 dark:hover:bg-white/10 hover:text-[#1c1a17] dark:hover:text-[#faf9f7]"
            >
              {mobileNavOpen ? (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                  <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              ) : (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                  <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {mobileNavOpen && (
          <nav className="sm:hidden mb-4 rounded-xl bg-white dark:bg-[#161616] border border-black/5 dark:border-white/10 shadow-sm p-2 flex flex-col gap-1">
            {LINKS.map((link) => {
              const active = location.pathname === link.path;
              return (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`rounded-lg px-3 py-2.5 text-sm font-medium ${
                    active ? "bg-[#ed2127] text-white" : "text-[#1c1a17]/70 dark:text-[#faf9f7]/70"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        )}
      </div>
    </header>
  );
}
