import { Navigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import SiteEditor from "./SiteEditor";

// One page of the agent's own My Site (section = analytics | details |
// testimonials | areas | blog). What they may open follows
// profiles.site_access: full = everything, limited = Blog Posts only,
// none = no website at all. Anything else bounces to the nearest page they
// do have. UX only — the real limits are RLS.
export default function MySitePage({ section }) {
  const { user, profile } = useAuth();
  if (!user || !profile) return null;
  const access = profile.site_access || "full";
  if (access === "none") return <Navigate to="/dashboard/listings" replace />;
  if (access === "limited" && section !== "blog") return <Navigate to="/dashboard/site/blog" replace />;
  return <SiteEditor agentId={user.id} agentName={profile.full_name} section={section} />;
}
