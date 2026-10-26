import { Navigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { useOrg } from "../../context/OrgContext";
import DashboardHomePage from "./home/DashboardHomePage";
import { dealAccess } from "../../lib/deals";

// The /dashboard landing page. Login, the installed app's start address and every "back to the dashboard" redirect
// land here. Agents and admins get the home page (welcome, blog, People highlights, listings); the platform owner
// inside someone else's organization has no Website or People menus there, so starts at that organization's agents.
export default function DashboardHome() {
  const { profile, isPlatformAdmin } = useAuth();
  const { org, loading: orgLoading } = useOrg();
  if (!profile || orgLoading) return <p className="text-sm text-[#1c1a17]/50 dark:text-[#faf9f7]/50">Loading…</p>;
  if (isPlatformAdmin && org && profile.org_id && org.id !== profile.org_id) return <Navigate to="/dashboard/agents" replace />;
  // A transaction coordinator or compliance reviewer has no People module, so their home is Deals.
  const access = dealAccess(profile);
  if (!access.mine && access.team) return <Navigate to="/dashboard/deals" replace />;
  return <DashboardHomePage />;
}
