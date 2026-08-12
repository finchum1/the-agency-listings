import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";

// Admin-only overview of every agent's personal site — parallel to
// ListingsTable, but one row per agent instead of per listing. A site
// row doesn't exist until someone (the agent or an admin) first opens
// the editor, so "No site yet" just means nobody has visited it.
export default function SitesPage() {
  const [agents, setAgents] = useState([]);
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      supabase.from("profiles").select("id, full_name, email").order("full_name"),
      supabase.from("agent_sites").select("agent_id, slug, status, updated_at"),
    ]).then(([{ data: a }, { data: s }]) => {
      setAgents(a || []);
      setSites(s || []);
      setLoading(false);
    });
  }, []);

  const siteFor = (agentId) => sites.find((s) => s.agent_id === agentId);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-display font-semibold">Sites</h1>
        <p className="text-sm text-[#1c1a17]/60 mt-1">
          Every agent's personal site — {agents.length} agent{agents.length === 1 ? "" : "s"}
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-[#1c1a17]/50">Loading…</p>
      ) : (
        <div className="bg-white border border-black/5 rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-black/5 text-left text-xs uppercase tracking-wider text-[#1c1a17]/40">
                <th className="px-5 py-3 font-medium">Agent</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Updated</th>
                <th className="px-5 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {agents.map((agent) => {
                const site = siteFor(agent.id);
                return (
                  <tr key={agent.id} className="border-b border-black/5 last:border-0 hover:bg-black/[0.02]">
                    <td className="px-5 py-4">
                      <Link to={`/dashboard/sites/${agent.id}`} className="font-medium hover:underline">
                        {agent.full_name || "(no name yet)"}
                      </Link>
                      <p className="text-xs text-[#1c1a17]/50">{agent.email}</p>
                    </td>
                    <td className="px-5 py-4">
                      {site ? (
                        <span
                          className="text-xs font-semibold px-2.5 py-1 rounded-full"
                          style={
                            site.status === "published"
                              ? { background: "#3fae5c1a", color: "#3fae5c" }
                              : { background: "#00000010", color: "#1c1a17aa" }
                          }
                        >
                          {site.status === "published" ? "Published" : "Draft"}
                        </span>
                      ) : (
                        <span className="text-xs text-[#1c1a17]/40">No site yet</span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-[#1c1a17]/50 text-xs">
                      {site ? new Date(site.updated_at).toLocaleDateString() : "—"}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-3">
                        {site?.status === "published" && (
                          <a
                            href={`/sites/${site.slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-[#8a7a5c] hover:underline"
                          >
                            View live
                          </a>
                        )}
                        <Link
                          to={`/dashboard/sites/${agent.id}`}
                          className="text-xs text-[#1c1a17]/60 hover:text-[#1c1a17]"
                        >
                          {site ? "Edit" : "Create"}
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
