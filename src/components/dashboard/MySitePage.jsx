import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import SiteEditor from "./SiteEditor";
import AgentSiteWorkspace from "./AgentSiteWorkspace";

// One page of the agent's own website (section = analytics | details | compare | testimonials | areas | sales | blog | redirects). What they may open
// follows profiles.site_access: full = every page, in the same menu-and-one-page workspace an admin gets for any agent's site; limited = Blog Posts only
// (no menu, just the blog page); none = no website at all. Anything else bounces to the nearest page they do have. UX only — the real limits are RLS.
export default function MySitePage({ section }) {
  const { user, profile } = useAuth();
  const location = useLocation();
  if (!user || !profile) return null;
  const access = profile.site_access || "full";
  if (access === "none") return <Navigate to="/dashboard/listings" replace />;
  if (access === "limited") {
    if (section !== "blog") return <Navigate to="/dashboard/site/blog" replace />;
    return <SiteEditor agentId={user.id} agentName={profile.full_name} section={section} />;
  }
  return <AgentSiteWorkspace mode="self" agentId={user.id} agentName={profile.full_name} section={section} hash={location.hash.replace(/^#/, "")} />;
}
