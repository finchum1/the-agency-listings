import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import brokerage from "../../lib/brokerage";

// Order matches the home page's own product sections (LandingPage.jsx) —
// Brokerage Site leads, then Agent Websites, then Property Sites,
// Upcoming last. Keep both in sync if this order ever changes again.
const LINKS = [
  { path: "/brokerage-website", label: "Brokerage Site" },
  { path: "/agent-websites", label: "Agent Websites" },
  { path: "/property-websites", label: "Property Sites" },
  { path: "/upcoming", label: "Upcoming" },
];

// Flush, full-width sticky header for every marketing page (home + the
// three product deep-dives) — always solid, no scroll-triggered
// transition. (A floating, clear-at-top-then-pill-on-scroll version of
// this existed briefly; removed per feedback, specifically from the
// marketing site only — agent sites still have that exact treatment
// available as an opt-in "Floating" header style, see Navbar.jsx /
// SiteForm.jsx, unaffected by this.)
//
// Black (#1c1a17, the same ink used everywhere else) rather than the
// original cream fill, with the logo kept in its red mark+wordmark
// variant and link text in white — both per explicit requests.
//
// Nav links sit at the far right (ml-auto) rather than centered — with
// no Sign In/CTA on the right to balance against, a centered link row
// read as adrift; anchored right, the logo anchors left and the links
// read as a single deliberate cluster. Active link is a solid Agency-red
// pill.
//
// Below `sm` the link row collapses into a hamburger that opens a
// dropdown directly beneath the bar, inside the same header element.
//
// No Sign In link here on purpose — this is a pure product-marketing
// page now (also served standalone at theagency.latchpointstudios.com,
// a Latchpoint Studios marketing subdomain with no dashboard access at
// all), not a login funnel. /login itself is untouched and still reachable
// by direct URL on the main app host.
export default function MarketingNav() {
  const location = useLocation();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [location.pathname]);

  return (
    <header className="sticky top-0 z-40 bg-[#1c1a17] border-b border-white/10">
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
                      active ? "bg-[#ed2127] text-white shadow-sm" : "text-white/70 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </nav>

            <button
              type="button"
              onClick={() => setMobileNavOpen((v) => !v)}
              aria-label={mobileNavOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileNavOpen}
              className="sm:hidden -mr-1 p-2 rounded-full text-white/70 hover:bg-white/10 hover:text-white"
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
          <nav className="sm:hidden pb-4 flex flex-col gap-1">
            {LINKS.map((link) => {
              const active = location.pathname === link.path;
              return (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`rounded-lg px-3 py-2.5 text-sm font-medium ${
                    active ? "bg-[#ed2127] text-white" : "text-white/70"
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
