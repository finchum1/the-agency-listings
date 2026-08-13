import { Link, Outlet, useLocation } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import brokerage from "../../lib/brokerage";
import { useAuth } from "../../hooks/useAuth";

// Each item's own `activeWhen` instead of a generic "starts with `to`"
// check — the generic version broke down for Listings specifically,
// since its `to` ("/dashboard") is a literal string-prefix of every other
// tab's path ("/dashboard/site", "/dashboard/agents", …), so it matched
// everywhere and stayed highlighted no matter which tab you were on.
const NAV_ITEMS = [
  { to: "/dashboard", label: "Listings", activeWhen: (p) => p === "/dashboard" || p.startsWith("/dashboard/listings/") },
  { to: "/dashboard/site", label: "My Site", activeWhen: (p) => p === "/dashboard/site" },
  { to: "/dashboard/sites", label: "Sites", activeWhen: (p) => p.startsWith("/dashboard/sites"), adminOnly: true },
  { to: "/dashboard/agents", label: "Agents", activeWhen: (p) => p === "/dashboard/agents", adminOnly: true },
];

export default function DashboardLayout() {
  const { profile, isAdmin } = useAuth();
  const location = useLocation();

  const navLink = ({ to, label, activeWhen }) => (
    <Link
      key={to}
      to={to}
      className={`text-sm font-medium px-4 py-2 rounded-full transition-colors ${
        activeWhen(location.pathname)
          ? "bg-[#1c1a17]/10 text-[#1c1a17]"
          : "text-[#1c1a17]/70 hover:bg-black/5"
      }`}
    >
      {label}
    </Link>
  );

  return (
    <div className="min-h-screen bg-[#faf9f7]">
      <header className="border-b border-black/5 bg-white">
        <div className="mx-auto max-w-7xl px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <img src={brokerage.logo} alt={brokerage.name} className="h-9 w-auto" />
              <span className="h-6 w-px bg-black/10" aria-hidden="true" />
              <span className="text-xs font-semibold tracking-wider-plus uppercase text-[#1c1a17]/50">
                Oklahoma
              </span>
            </div>
            <nav className="flex items-center gap-1">
              {NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin).map(navLink)}
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <Link
              to="/dashboard/profile"
              className="text-sm text-[#1c1a17]/60 hover:text-[#1c1a17] transition-colors"
            >
              {profile?.full_name || profile?.email}
              {isAdmin && (
                <span className="ml-2 text-xs font-semibold text-[#8a7a5c]">ADMIN</span>
              )}
            </Link>
            <button
              onClick={() => supabase.auth.signOut()}
              className="text-sm font-medium text-[#1c1a17]/60 hover:text-[#1c1a17] transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-10">
        <Outlet />
      </main>
    </div>
  );
}
