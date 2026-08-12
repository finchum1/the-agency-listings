import { useAuth } from "../../hooks/useAuth";
import SiteEditor from "./SiteEditor";

export default function MySitePage() {
  const { user, profile } = useAuth();
  if (!user) return null;
  return <SiteEditor agentId={user.id} agentName={profile?.full_name} heading="My Site" />;
}
