import { Link, Outlet, useLocation } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import brokerage from "../../lib/brokerage";
import { useAuth } from "../../hooks/useAuth";

export default function DashboardLayout() {
  const { profile, isAdmin } = useAuth();
  const location = useLocation();

  const navLink = (to, label) => (
    <Link
      to={to}
      className={`text-sm font-medium px-3 py-2 rounded-lg transition-colors ${
        location.pathname === to || location.pathname.startsWith(to + "/")
          ? "bg-[#1c1a17] text-white"
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
            <img src={brokerage.logo} alt={brokerage.name} className="h-9 w-auto" />
            <nav className="flex items-center gap-1">
              {navLink("/dashboard", "Listings")}
              {navLink("/dashboard/site", "My Site")}
              {isAdmin && navLink("/dashboard/sites", "Sites")}
              {isAdmin && navLink("/dashboard/agents", "Agents")}
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
