import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import brokerage from "../../lib/brokerage";

const LINKS = [
  { path: "/agent-websites", label: "Agent Websites" },
  { path: "/property-websites", label: "Property Sites" },
  { path: "/upcoming", label: "Upcoming" },
];

// Shared sticky header for every marketing page (home + the three product
// deep-dives) — see DESIGN.md Navigation: active link gets a translucent
// ink/10 pill, inactive is ink/70 with a subtle hover tint. Same pattern
// the dashboard nav uses, just applied to marketing routes instead of
// dashboard tabs.
//
// Below `sm` the link row used to just disappear (hidden sm:flex, no
// fallback) — a visitor on a phone had no way to reach Agent Websites/
// Property Sites/Upcoming at all. Now it collapses into a hamburger that
// opens a stacked panel, same mechanism DashboardLayout.jsx already uses
// for its own mobile nav. "Sign In" stays visible in the header at every
// size, unlike the dashboard's profile/sign-out — it's the single most
// important thing a marketing visitor can do, worth never hiding behind
// a menu tap.
export default function MarketingNav() {
  const location = useLocation();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [location.pathname]);

  return (
    <header className="sticky top-0 z-40 bg-[#faf9f7]/90 backdrop-blur border-b border-black/5">
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <div className="h-20 flex items-center justify-between gap-6">
          <Link to="/" className="shrink-0">
            <img src={brokerage.logo} alt={brokerage.name} className="h-11 w-auto" />
          </Link>

          <nav className="hidden sm:flex items-center gap-1">
            {LINKS.map((link) => {
              const active = location.pathname === link.path;
              return (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`text-sm font-medium px-4 py-2 rounded-full transition-colors ${
                    active ? "bg-[#1c1a17]/10 text-[#1c1a17]" : "text-[#1c1a17]/70 hover:bg-black/5"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2 shrink-0">
            <Link
              to="/login"
              className="text-sm font-semibold px-4 sm:px-5 py-2.5 rounded-full border border-[#1c1a17] text-[#1c1a17] hover:bg-[#1c1a17] hover:text-white transition-colors"
            >
              Sign In
            </Link>

            <button
              type="button"
              onClick={() => setMobileNavOpen((v) => !v)}
              aria-label={mobileNavOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileNavOpen}
              className="sm:hidden -mr-1.5 p-2 text-[#1c1a17]/70 hover:text-[#1c1a17]"
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
                    active ? "bg-[#1c1a17]/10 text-[#1c1a17]" : "text-[#1c1a17]/70"
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
