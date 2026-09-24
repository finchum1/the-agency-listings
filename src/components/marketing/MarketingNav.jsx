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

// Floating pill header for every marketing page (home + the three product
// deep-dives). Clear/transparent at the very top of the page — just the
// logo and links sitting directly on the hero, no bar — and crossfades
// into the solid floating pill (background, border, shadow) once the
// page scrolls, via a scroll-position listener. The outer wrapper is
// what actually sticks (top-0, with its own pt-4 for the gap), so once
// scrolled the pill sits the same 16px below the viewport top and never
// touches an edge.
//
// Nav links sit at the far right of the pill (ml-auto) rather than
// centered — with no Sign In/CTA on the right to balance against, a
// centered link row read as adrift; anchored right, the logo anchors
// left and the links read as a single deliberate cluster.
//
// Agency-branded: active link is a solid Agency-red pill (not the
// dashboard's neutral ink pill), and the solid (scrolled) pill's shadow
// carries a faint warm red tint alongside the usual neutral drop shadow.
//
// Below `sm` the link row collapses into a hamburger that opens a second
// floating panel directly beneath the pill, same mechanism
// DashboardLayout.jsx uses for its own mobile nav. That panel always
// keeps its own solid background regardless of scroll state — an
// open menu needs to stay legible over whatever hero content is behind
// it even before the user has scrolled.
//
// No Sign In link here on purpose — this is a pure product-marketing
// page now (also served standalone at theagency.latchpointstudios.com,
// a Latchpoint Studios marketing subdomain with no dashboard access at
// all), not a login funnel. /login itself is untouched and still reachable
// by direct URL on the main app host.
const FLOAT_SHADOW =
  "shadow-[0_18px_40px_-18px_rgba(237,33,39,0.35),0_10px_26px_-12px_rgba(28,26,23,0.28)]";

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
    <div className="sticky top-0 z-40 pt-4 px-4 sm:px-6">
      <header className="mx-auto max-w-5xl">
        <div
          className={`h-16 flex items-center gap-4 rounded-full px-3 sm:px-4 transition-all duration-300 ${
            scrolled
              ? `border border-black/5 bg-[#faf9f7]/95 backdrop-blur-md ${FLOAT_SHADOW}`
              : "border border-transparent bg-transparent"
          }`}
        >
          <Link to="/" className="shrink-0 pl-1">
            <img src={brokerage.logo} alt={brokerage.name} className="h-9 w-auto" />
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
                      active ? "bg-[#ed2127] text-white shadow-sm" : "text-[#1c1a17]/70 hover:bg-[#ed2127]/10 hover:text-[#ed2127]"
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
              className="sm:hidden -mr-1 p-2 rounded-full text-[#1c1a17]/70 hover:bg-black/5 hover:text-[#1c1a17]"
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
          <nav
            className={`sm:hidden mt-2 rounded-2xl border border-black/5 bg-[#faf9f7]/98 backdrop-blur-md p-2 flex flex-col gap-1 ${FLOAT_SHADOW}`}
          >
            {LINKS.map((link) => {
              const active = location.pathname === link.path;
              return (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors ${
                    active ? "bg-[#ed2127] text-white" : "text-[#1c1a17]/70 hover:bg-[#ed2127]/10 hover:text-[#ed2127]"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        )}
      </header>
    </div>
  );
}
