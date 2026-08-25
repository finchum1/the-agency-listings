import { useEffect, useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import brokerage from "../../lib/brokerage";
import { useAuth } from "../../hooks/useAuth";
import AdminNavMenu from "./AdminNavMenu";

// Each item's own `activeWhen` instead of a generic "starts with `to`"
// check — the generic version broke down for My Site specifically, since
// its `to` ("/dashboard") is a literal string-prefix of every other tab's
// path ("/dashboard/listings", "/dashboard/upcoming-listings", …), so it
// matched everywhere and stayed highlighted no matter which tab you were
// on. My Site is first — it's the /dashboard index route (App.jsx), so
// it's what every "back to the dashboard" redirect (login, admin-gate
// fallback, session-already-active root) lands on.
const NAV_ITEMS = [
  { to: "/dashboard", label: "My Site", activeWhen: (p) => p === "/dashboard" },
  { to: "/dashboard/listings", label: "Listings", activeWhen: (p) => p === "/dashboard/listings" || p.startsWith("/dashboard/listings/") },
  { to: "/dashboard/upcoming", label: "Upcoming", activeWhen: (p) => p === "/dashboard/upcoming" },
];

// Sites/Agents are office settings, not something every agent reaches
// for day to day — grouped under one "Admin" dropdown (AdminNavMenu.jsx)
// instead of two more flat pills, both because that's a truer picture of
// what they are and because it keeps the header from getting so crowded
// it breaks down on a phone screen (see the mobile nav below).
const ADMIN_ITEMS = [
  { to: "/dashboard/sites", label: "Sites" },
  { to: "/dashboard/agents", label: "Agents" },
  { to: "/dashboard/brokerage-site", label: "Brokerage Site" },
];

export default function DashboardLayout() {
  const { profile, isAdmin } = useAuth();
  const location = useLocation();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Never leave the mobile menu open behind a new page after a nav tap.
  useEffect(() => {
    setMobileNavOpen(false);
  }, [location.pathname]);

  const navLinkClass = (isActive) =>
    `text-sm font-medium px-4 py-2 rounded-full transition-colors ${
      isActive ? "bg-[#1c1a17]/10 text-[#1c1a17]" : "text-[#1c1a17]/70 hover:bg-black/5"
    }`;

  const isAdminActive = ADMIN_ITEMS.some((item) => location.pathname.startsWith(item.to));

  const avatarSrc =
    profile?.photo_url ||
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Ccircle cx='12' cy='8' r='4' fill='%23e5e0d8'/%3E%3Cpath d='M4 20c0-4 4-6 8-6s8 2 8 6' fill='%23e5e0d8'/%3E%3C/svg%3E";

  return (
    <div className="min-h-screen bg-[#faf9f7]">
      <header className="border-b border-black/5 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center justify-between gap-3">
            {/* Logo lockup — the "Oklahoma" divider label is decorative
                branding, not something a phone screen has room for
                alongside real navigation, so it drops below `sm`. That's
                what was overlapping the first nav pill before. */}
            <div className="flex items-center gap-3 min-w-0 shrink-0">
              <img src={brokerage.logo} alt={brokerage.name} className="h-8 sm:h-9 w-auto shrink-0" />
              <span className="hidden sm:inline h-6 w-px bg-black/10" aria-hidden="true" />
              <span className="hidden sm:inline text-xs font-semibold tracking-wider-plus uppercase text-[#1c1a17]/50 whitespace-nowrap">
                Oklahoma
              </span>
            </div>

            {/* Desktop nav — hidden below `md`, replaced by the hamburger
                + stacked panel at the bottom of this header. */}
            <nav className="hidden md:flex items-center gap-1">
              {NAV_ITEMS.map((item) => (
                <Link key={item.to} to={item.to} className={navLinkClass(item.activeWhen(location.pathname))}>
                  {item.label}
                </Link>
              ))}
              {isAdmin && <AdminNavMenu active={isAdminActive} items={ADMIN_ITEMS} />}
            </nav>

            <div className="flex items-center gap-3 sm:gap-4 shrink-0">
              <Link
                to="/dashboard/profile"
                className="hidden md:flex items-center gap-2.5 text-sm text-[#1c1a17]/60 hover:text-[#1c1a17] transition-colors"
              >
                <img src={avatarSrc} alt="" className="h-7 w-7 rounded-full object-cover bg-black/5" />
                {profile?.full_name || profile?.email}
                {isAdmin && <span className="text-xs font-semibold text-[#ed2127]">ADMIN</span>}
              </Link>
              <button
                onClick={() => supabase.auth.signOut()}
                className="hidden md:inline text-sm font-medium text-[#1c1a17]/60 hover:text-[#1c1a17] transition-colors"
              >
                Sign out
              </button>

              {/* Mobile menu toggle */}
              <button
                type="button"
                onClick={() => setMobileNavOpen((v) => !v)}
                aria-label={mobileNavOpen ? "Close menu" : "Open menu"}
                aria-expanded={mobileNavOpen}
                className="md:hidden -mr-1.5 p-2 text-[#1c1a17]/70 hover:text-[#1c1a17]"
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

          {/* Mobile nav panel — every desktop nav destination, stacked,
              plus the profile/sign-out row that's hidden from the header
              itself below `md`. */}
          {mobileNavOpen && (
            <nav className="md:hidden mt-3 pt-3 border-t border-black/5 flex flex-col gap-1">
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`rounded-lg px-3 py-2.5 text-sm font-medium ${
                    item.activeWhen(location.pathname) ? "bg-[#1c1a17]/10 text-[#1c1a17]" : "text-[#1c1a17]/70"
                  }`}
                >
                  {item.label}
                </Link>
              ))}
              {isAdmin && (
                <>
                  <p className="px-3 pt-3 pb-1 text-xs font-semibold uppercase tracking-wider text-[#1c1a17]/40">
                    Admin
                  </p>
                  {ADMIN_ITEMS.map((item) => (
                    <Link
                      key={item.to}
                      to={item.to}
                      className={`rounded-lg px-3 py-2.5 text-sm font-medium ${
                        location.pathname.startsWith(item.to) ? "bg-[#1c1a17]/10 text-[#1c1a17]" : "text-[#1c1a17]/70"
                      }`}
                    >
                      {item.label}
                    </Link>
                  ))}
                </>
              )}
              <div className="mt-2 pt-3 border-t border-black/5 flex items-center justify-between px-3">
                <Link
                  to="/dashboard/profile"
                  className="flex items-center gap-2.5 text-sm text-[#1c1a17]/70"
                >
                  <img src={avatarSrc} alt="" className="h-7 w-7 rounded-full object-cover bg-black/5" />
                  {profile?.full_name || profile?.email}
                  {isAdmin && <span className="text-xs font-semibold text-[#ed2127]">ADMIN</span>}
                </Link>
                <button
                  onClick={() => supabase.auth.signOut()}
                  className="text-sm font-medium text-[#1c1a17]/60 hover:text-[#1c1a17]"
                >
                  Sign out
                </button>
              </div>
            </nav>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 sm:px-6 py-6 sm:py-10">
        <Outlet />
      </main>
    </div>
  );
}
