import { Navigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { useOrg } from "../../context/OrgContext";

// The /dashboard landing page: sends each agent to their own first page —
// Analytics for full website access, Blog Posts for blog-only, and
// Listings for agents who have no website. Login, the installed app's
// start address and every "back to the dashboard" redirect all land here.
export default function DashboardHome() {
  const { profile, isPlatformAdmin } = useAuth();
  const { org, loading: orgLoading } = useOrg();
  if (!profile || orgLoading) return <p className="text-sm text-[#1c1a17]/50 dark:text-[#faf9f7]/50">Loading…</p>;
  // The platform owner inside another organization has no Website or People menus there, so start at its agents.
  if (isPlatformAdmin && org && profile.org_id && org.id !== profile.org_id) return <Navigate to="/dashboard/agents" replace />;
  const access = profile.site_access || "full";
  const to =
    access === "none" ? "/dashboard/listings" : access === "limited" ? "/dashboard/site/blog" : "/dashboard/site/analytics";
  return <Navigate to={to} replace />;
}
