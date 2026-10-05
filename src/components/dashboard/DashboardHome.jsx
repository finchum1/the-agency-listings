import { Navigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";

// The /dashboard landing page: sends each agent to their own first page —
// Analytics for full website access, Blog Posts for blog-only, and
// Listings for agents who have no website. Login, the installed app's
// start address and every "back to the dashboard" redirect all land here.
export default function DashboardHome() {
  const { profile } = useAuth();
  if (!profile) return <p className="text-sm text-[#1c1a17]/50 dark:text-[#faf9f7]/50">Loading…</p>;
  const access = profile.site_access || "full";
  const to =
    access === "none" ? "/dashboard/listings" : access === "limited" ? "/dashboard/site/blog" : "/dashboard/site/analytics";
  return <Navigate to={to} replace />;
}
