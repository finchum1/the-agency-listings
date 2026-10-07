import { useEffect, useState } from "react";
import { useParams, Link, Navigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import SiteEditor from "./SiteEditor";

const TABS = [
  ["analytics", "Analytics"],
  ["details", "Site Details"],
  ["testimonials", "Testimonials"],
  ["areas", "Areas of Expertise"],
  ["blog", "Blog Posts"],
  ["redirects", "Redirects"],
];

// Admin-only: edit any agent's site by their profile id (route
// /dashboard/sites/:agentId/:section?). Self-editing goes through
// MySitePage instead — same underlying SiteEditor either way. The
// sections are tabs across the top of this page (not sidebar items), so
// the sidebar stays a single "Agent Sites" entry no matter whose site
// is open.
export default function EditAgentSitePage() {
  const { agentId, section = "analytics" } = useParams();
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

  if (!TABS.some(([key]) => key === section)) {
    return <Navigate to={`/dashboard/sites/${agentId}/analytics`} replace />;
  }

  return (
    <div className="space-y-6">
      <div className="max-w-3xl">
        <Link to="/dashboard/sites" className="text-xs font-medium text-[#1c1a17]/50 dark:text-[#faf9f7]/50 hover:text-[#1c1a17] dark:hover:text-[#faf9f7]">
          ← All sites
        </Link>
        <h1 className="text-2xl font-display font-semibold mt-2">{agent.full_name || agent.email}'s Site</h1>
        <nav className="mt-4 -mx-1 px-1 flex gap-1 overflow-x-auto border-b border-black/10 dark:border-white/10" aria-label="Site sections">
          {TABS.map(([key, label]) => (
            <Link
              key={key}
              to={`/dashboard/sites/${agentId}/${key}`}
              className={`whitespace-nowrap px-3.5 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                section === key
                  ? "border-[#ed2127] dark:border-[#f2454b] text-[#1c1a17] dark:text-[#faf9f7]"
                  : "border-transparent text-[#1c1a17]/60 dark:text-[#faf9f7]/60 hover:text-[#1c1a17] dark:hover:text-[#faf9f7]"
              }`}
            >
              {label}
            </Link>
          ))}
        </nav>
      </div>
      <SiteEditor key={`${agent.id}-${section}`} agentId={agent.id} agentName={agent.full_name} section={section} hideHeader />
    </div>
  );
}
