import { useEffect, useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import brokerage from "../../lib/brokerage";
import { useAuth } from "../../hooks/useAuth";

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

// Sites/Agents/Brokerage Site are office settings, not something every
// agent reaches for day to day — grouped under their own "Admin" heading
// rather than mixed into NAV_ITEMS. Previously tucked into a dropdown
// (AdminNavMenu.jsx) to save width in a horizontal header; a left-hand
// sidebar has the vertical room to just list them, so that's gone now.
const ADMIN_ITEMS = [
  { to: "/dashboard/brokerage-site", label: "Brokerage Site" },
  { to: "/dashboard/sites", label: "Agent Sites" },
  { to: "/dashboard/agents", label: "Agents" },
];

// Left-hand sidebar nav (logo top, nav + admin section in the middle,
// profile/sign-out pinned to the bottom) — more consistent with the
// other web apps agents already use day to day than the old horizontal
// top bar. Collapses to a top bar + slide-down panel below `md`, same
// shape the old mobile nav already used.
export default function DashboardLayout() {
  const { profile, isAdmin } = useAuth();
  const location = useLocation();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Never leave the mobile menu open behind a new page after a nav tap.
  useEffect(() => {
    setMobileNavOpen(false);
  }, [location.pathname]);

  const navLinkClass = (isActive) =>
    `block rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
      isActive ? "bg-[#1c1a17]/10 text-[#1c1a17]" : "text-[#1c1a17]/70 hover:bg-black/5"
    }`;

  const avatarSrc =
    profile?.photo_url ||
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Ccircle cx='12' cy='8' r='4' fill='%23e5e0d8'/%3E%3Cpath d='M4 20c0-4 4-6 8-6s8 2 8 6' fill='%23e5e0d8'/%3E%3C/svg%3E";

  const NavList = ({ onNavigate }) => (
    <>
      <div className="space-y-1">
        {NAV_ITEMS.map((item) => (
          <Link key={item.to} to={item.to} onClick={onNavigate} className={navLinkClass(item.activeWhen(location.pathname))}>
            {item.label}
          </Link>
        ))}
      </div>
      {isAdmin && (
        <div className="mt-6">
          <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wider text-[#1c1a17]/40">Admin</p>
          <div className="space-y-1">
            {ADMIN_ITEMS.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                onClick={onNavigate}
                className={navLinkClass(location.pathname === item.to || location.pathname.startsWith(`${item.to}/`))}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </>
  );

  const ProfileBlock = ({ onNavigate }) => (
    <div className="space-y-3">
      <Link
        to="/dashboard/profile"
        onClick={onNavigate}
        className="flex items-center gap-2.5 text-sm text-[#1c1a17]/70 hover:text-[#1c1a17] transition-colors min-w-0"
      >
        <img src={avatarSrc} alt="" className="h-8 w-8 rounded-full object-cover bg-black/5 shrink-0" />
        <span className="min-w-0">
          <span className="block truncate">{profile?.full_name || profile?.email}</span>
          {isAdmin && <span className="text-xs font-semibold text-[#ed2127]">ADMIN</span>}
        </span>
      </Link>
      <button
        onClick={() => supabase.auth.signOut()}
        className="text-sm font-medium text-[#1c1a17]/60 hover:text-[#1c1a17] transition-colors"
      >
        Sign out
      </button>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#faf9f7] md:flex">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:w-64 md:shrink-0 md:flex-col md:h-screen md:sticky md:top-0 border-r border-black/5 bg-white">
        <div className="flex items-center gap-3 px-6 py-6 shrink-0">
          <img src={brokerage.logo} alt={brokerage.name} className="h-9 w-auto" />
          <span className="h-6 w-px bg-black/10" aria-hidden="true" />
          <span className="text-xs font-semibold tracking-wider-plus uppercase text-[#1c1a17]/50">Oklahoma</span>
        </div>

        <nav className="flex-1 overflow-y-auto px-4">
          <NavList />
        </nav>

        <div className="px-4 py-5 border-t border-black/5 shrink-0">
          <ProfileBlock />
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="md:hidden border-b border-black/5 bg-white">
        <div className="px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <img src={brokerage.logo} alt={brokerage.name} className="h-8 w-auto shrink-0" />
          </div>
          <button
            type="button"
            onClick={() => setMobileNavOpen((v) => !v)}
            aria-label={mobileNavOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileNavOpen}
            className="p-2 -mr-1.5 text-[#1c1a17]/70 hover:text-[#1c1a17]"
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

        {mobileNavOpen && (
          <nav className="px-4 pb-4 border-t border-black/5 pt-3">
            <NavList onNavigate={() => setMobileNavOpen(false)} />
            <div className="mt-5 pt-4 border-t border-black/5">
              <ProfileBlock onNavigate={() => setMobileNavOpen(false)} />
            </div>
          </nav>
        )}
      </header>

      <main className="flex-1 min-w-0">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6 sm:py-10">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
