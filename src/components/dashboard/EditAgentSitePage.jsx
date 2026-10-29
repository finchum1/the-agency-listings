import { useEffect, useState } from "react";
import { useParams, Link, useLocation } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import AgentSiteWorkspace from "./AgentSiteWorkspace";

// Admin-only: edit any agent's site by their profile id (route /dashboard/sites/:agentId/:section?). Self-editing goes through MySitePage instead; both
// use the same workspace (AgentSiteWorkspace): a menu of the site's pages down the left and one page at a time on the right.
export default function EditAgentSitePage() {
  const { agentId, section = "details" } = useParams();
  const location = useLocation();
  const [agent, setAgent] = useState(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    supabase
      .from("profiles")
      .select("id, full_name, email")
      .eq("id", agentId)
      .single()
      .then(({ data }) => {
        if (!data) setNotFound(true);
        setAgent(data);
      });
  }, [agentId]);

  if (notFound) {
    return (
      <div>
        <p className="text-sm text-[#1c1a17]/60 dark:text-[#faf9f7]/60 mb-4">Agent not found.</p>
        <Link to="/dashboard/sites" className="text-sm text-[#ed2127] dark:text-[#f2454b] hover:underline">
          ← Back to sites
        </Link>
      </div>
    );
  }
  if (!agent) return <p className="text-sm text-[#1c1a17]/50 dark:text-[#faf9f7]/50">Loading…</p>;

  return <AgentSiteWorkspace mode="admin" agentId={agent.id} agentName={agent.full_name || agent.email} section={section} hash={location.hash.replace(/^#/, "")} />;
}
