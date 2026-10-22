import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import { useOrg } from "../../context/OrgContext";
import { matchesSearch } from "../../lib/searchMatch";
import { LAYOUT_OPTIONS } from "../../lib/sitePreview";


// Admin-only overview of every agent's personal site — parallel to
// ListingsTable, but one row per agent instead of per listing. A site
// row doesn't exist until someone (the agent or an admin) first opens
// the editor, so "No site yet" just means nobody has visited it.
export default function SitesPage() {
  const [agents, setAgents] = useState([]);
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [show, setShow] = useState("all"); // all | published | draft | none
  const { orgId, loading: orgLoading } = useOrg();

  useEffect(() => {
    if (orgLoading) return;
    if (!orgId) {
      setLoading(false);
      return;
    }
    Promise.all([
      supabase.from("profiles").select("id, full_name, email, title").eq("org_id", orgId).order("full_name"),
      supabase.from("agent_sites").select("agent_id, slug, status, updated_at, custom_domain, region, layout, theme").eq("org_id", orgId),
    ]).then(([{ data: a }, { data: s }]) => {
      setAgents(a || []);
      setSites(s || []);
      setLoading(false);
    });
  }, [orgId, orgLoading]);

  const siteFor = (agentId) => sites.find((s) => s.agent_id === agentId);

  const layoutLabel = (v) => LAYOUT_OPTIONS.find((l) => l.value === v)?.label;
  const stateOf = (agent) => {
    const s = siteFor(agent.id);
    return !s ? "none" : s.status === "published" ? "published" : "draft";
  };
  const counts = { all: agents.length, published: 0, draft: 0, none: 0 };
  for (const a of agents) counts[stateOf(a)] += 1;
  const visible = agents.filter((a) => {
    if (show !== "all" && stateOf(a) !== show) return false;
    const s = siteFor(a.id);
    return matchesSearch([a.full_name, a.email, a.title, s?.slug, s?.custom_domain, s?.region, layoutLabel(s?.layout), s?.theme, s ? (s.status === "published" ? "published live" : "draft") : "no site"], query);
  });
  const filtering = query.trim() !== "" || show !== "all";

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-display font-semibold">Agent Sites</h1>
        <p className="text-sm text-[#1c1a17]/60 dark:text-[#faf9f7]/60 mt-1">
          Every agent's personal site — {filtering ? `${visible.length} of ${agents.length}` : agents.length} agent{agents.length === 1 ? "" : "s"}
        </p>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by agent, email, web address, domain or region"
          aria-label="Search agent sites"
          className="flex-1 min-w-[16rem] rounded-lg border border-black/10 dark:border-white/15 bg-transparent px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#ed2127]/40 dark:focus:ring-[#f2454b]/40"
        />
        <div className="flex items-center gap-1.5" role="group" aria-label="Show">
          {[
            ["all", "All"],
            ["published", "Published"],
            ["draft", "Draft"],
            ["none", "No site"],
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setShow(key)}
              aria-pressed={show === key}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${show === key ? "bg-[#1c1a17] dark:bg-[#f2454b] text-white" : "border border-black/10 dark:border-white/15 text-[#1c1a17]/70 dark:text-[#faf9f7]/70 hover:bg-black/5 dark:hover:bg-white/10"}`}
            >
              {label} <span className="opacity-60 font-medium">{counts[key]}</span>
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-[#1c1a17]/50 dark:text-[#faf9f7]/50">Loading…</p>
      ) : visible.length === 0 ? (
        <p className="text-sm text-[#1c1a17]/50 dark:text-[#faf9f7]/50">
          {agents.length === 0 ? "No agents yet." : "Nothing matches. "}
          {filtering && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setShow("all");
              }}
              className="font-semibold text-[#ed2127] dark:text-[#f2454b] hover:underline"
            >
              Clear filters
            </button>
          )}
        </p>
      ) : (
        <div className="bg-white dark:bg-[#1a1a1a] border border-black/5 dark:border-white/10 rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-black/5 dark:border-white/10 text-left text-xs uppercase tracking-wider text-[#1c1a17]/40 dark:text-[#faf9f7]/40">
                <th className="px-5 py-3 font-medium">Agent</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Updated</th>
                <th className="px-5 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {visible.map((agent) => {
                const site = siteFor(agent.id);
                return (
                  <tr key={agent.id} className="border-b border-black/5 dark:border-white/10 last:border-0 hover:bg-black/[0.02] dark:hover:bg-white/[0.04]">
                    <td className="px-5 py-4">
                      <Link to={`/dashboard/sites/${agent.id}`} className="font-medium hover:underline">
                        {agent.full_name || "(no name yet)"}
                      </Link>
                      <p className="text-xs text-[#1c1a17]/50 dark:text-[#faf9f7]/50">{agent.email}</p>
                      {site && <p className="text-xs text-[#1c1a17]/40 dark:text-[#faf9f7]/40">{site.custom_domain || `/sites/${site.slug}`}</p>}
                    </td>
                    <td className="px-5 py-4">
                      {site ? (
                        <span
                          className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                            site.status === "published"
                              ? "bg-[#3fae5c]/10 text-[#3fae5c]"
                              : "bg-black/10 dark:bg-white/15 text-[#1c1a17]/70 dark:text-[#faf9f7]/70"
                          }`}
                        >
                          {site.status === "published" ? "Published" : "Draft"}
                        </span>
                      ) : (
                        <span className="text-xs text-[#1c1a17]/40 dark:text-[#faf9f7]/40">No site yet</span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-[#1c1a17]/50 dark:text-[#faf9f7]/50 text-xs">
                      {site ? new Date(site.updated_at).toLocaleDateString() : "—"}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-2.5">
                        {site?.status === "published" && (
                          <a
                            href={`/sites/${site.slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-full border border-[#ed2127] dark:border-[#f2454b] text-[#ed2127] dark:text-[#f2454b] text-[11px] font-semibold px-3 py-1 hover:bg-[#ed2127] dark:hover:bg-[#f2454b] hover:text-white dark:hover:text-white transition-colors"
                          >
                            View live
                          </a>
                        )}
                        <Link
                          to={`/dashboard/sites/${agent.id}`}
                          className="text-xs text-[#1c1a17]/60 dark:text-[#faf9f7]/60 hover:text-[#1c1a17] dark:hover:text-[#faf9f7]"
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
