import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import SiteEditor from "./SiteEditor";

// Admin-only: edit any agent's site by their profile id (route
// /dashboard/sites/:agentId). Self-editing goes through MySitePage
// instead — same underlying SiteEditor either way.
export default function EditAgentSitePage() {
  const { agentId } = useParams();
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
        <p className="text-sm text-[#1c1a17]/60 mb-4">Agent not found.</p>
        <Link to="/dashboard/sites" className="text-sm text-[#ed2127] hover:underline">
          ← Back to sites
        </Link>
      </div>
    );
  }

  if (!agent) return <p className="text-sm text-[#1c1a17]/50">Loading…</p>;

  return (
    <SiteEditor
      agentId={agent.id}
      agentName={agent.full_name}
      heading={`${agent.full_name || agent.email}'s Site`}
    />
  );
}
