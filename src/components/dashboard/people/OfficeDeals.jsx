import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { useTransactionProgress } from "../../../hooks/useTransactionProgress";
import { refreshDealAttention } from "../../../hooks/useDealAttention";
import { ComplianceChip } from "./DealCompliance";
import DealPanel from "./DealPanel";

const muted = "text-[#1c1a17]/50 dark:text-[#faf9f7]/50";
const select = "rounded-lg border border-black/10 dark:border-white/15 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#ed2127]/40";
const FILTERS = [
  ["all", "All"],
  ["submitted", "To review"],
  ["needs_changes", "Sent back"],
  ["none", "Not submitted"],
  ["approved", "Approved"],
];
const ORDER = { submitted: 0, needs_changes: 1, none: 2, approved: 3 };
const dateLabel = (d) => (d ? new Date(`${d}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "–");

// The office view of deals for a transaction coordinator (their agents' deals, editable) and compliance (every deal in the
// office, with the review actions). What each person can see is decided by the database, not by this screen.
export default function OfficeDeals({ viewer }) {
  const [deals, setDeals] = useState([]);
  const [agents, setAgents] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState(viewer === "compliance" ? "submitted" : "all");
  const [agent, setAgent] = useState("");
  const [showClosed, setShowClosed] = useState(false);
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState(() => new URLSearchParams(window.location.search).get("deal"));
  const { progress, reload: reloadProgress } = useTransactionProgress(true);
  const [unread, setUnread] = useState({});

  const load = async () => {
    const { data, error: err } = await supabase.from("people").select("*").eq("stage_group", "transaction").eq("archived", false).order("closing_date", { ascending: true, nullsFirst: false });
    if (err) setError(err.message);
    else {
      setError("");
      setDeals(data || []);
      const ids = [...new Set((data || []).map((d) => d.owner_id))];
      if (ids.length) {
        const { data: profs } = await supabase.from("profiles").select("id, full_name").in("id", ids);
        setAgents(Object.fromEntries((profs || []).map((p) => [p.id, p.full_name])));
      }
    }
    setLoading(false);
  };
  const loadUnread = async () => {
    const [{ data: msgs }, { data: reads }] = await Promise.all([
      supabase.from("deal_messages").select("person_id, author_id, created_at").order("created_at", { ascending: false }).limit(2000),
      supabase.from("deal_reads").select("person_id, read_at"),
    ]);
    const me = (await supabase.auth.getUser()).data.user?.id;
    const readAt = Object.fromEntries((reads || []).map((r) => [r.person_id, r.read_at]));
    const out = {};
    for (const m of msgs || []) if (m.author_id !== me && (!readAt[m.person_id] || m.created_at > readAt[m.person_id])) out[m.person_id] = (out[m.person_id] || 0) + 1;
    setUnread(out);
  };
  useEffect(() => {
    load();
    loadUnread();
  }, []);

  const closedNames = useMemo(() => new Set(["Closed"]), []);
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return deals
      .filter((d) => (filter === "all" || (d.compliance_status || "none") === filter) && (!agent || d.owner_id === agent) && (showClosed || !closedNames.has(d.stage)) && (!needle || `${d.name} ${d.property_address} ${agents[d.owner_id] || ""}`.toLowerCase().includes(needle)))
      .sort((a, b) => ORDER[a.compliance_status || "none"] - ORDER[b.compliance_status || "none"] || (a.closing_date || "9999").localeCompare(b.closing_date || "9999"));
  }, [deals, filter, agent, showClosed, q, agents, closedNames]);

  const counts = useMemo(() => {
    const c = { all: 0 };
    for (const d of deals) {
      if (!showClosed && closedNames.has(d.stage)) continue;
      c.all += 1;
      c[d.compliance_status || "none"] = (c[d.compliance_status || "none"] || 0) + 1;
    }
    return c;
  }, [deals, showClosed, closedNames]);
  const open = deals.find((d) => d.id === openId);
  const agentIds = [...new Set(deals.map((d) => d.owner_id))].sort((a, b) => (agents[a] || "").localeCompare(agents[b] || ""));

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2" role="group" aria-label="Review status">
        {FILTERS.map(([key, label]) => (
          <button key={key} type="button" onClick={() => setFilter(key)} className={`rounded-full px-3.5 py-1.5 text-xs font-semibold ${filter === key ? "bg-[#1c1a17] dark:bg-[#f2454b] text-white" : "bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15"}`}>
            {label} <span className="opacity-60">{counts[key] || 0}</span>
          </button>
        ))}
        <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search deals" aria-label="Search deals" className={`${select} w-40`} />
          <select value={agent} onChange={(e) => setAgent(e.target.value)} aria-label="Agent" className={select}>
            <option value="">All agents</option>
            {agentIds.map((id) => (
              <option key={id} value={id}>{agents[id] || "Unknown"}</option>
            ))}
          </select>
          <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" checked={showClosed} onChange={(e) => setShowClosed(e.target.checked)} className="accent-[#ed2127]" /> Show closed</label>
        </div>
      </div>
      {error && <p className="mb-3 text-sm text-red-600 dark:text-red-400">{error}</p>}

      {loading ? (
        <div className="h-48 rounded-2xl bg-black/[0.04] dark:bg-white/[0.05] animate-pulse" />
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-black/5 dark:border-white/10 bg-white dark:bg-[#1a1a1a] p-12 text-center">
          <p className="font-display text-xl font-semibold">{deals.length === 0 ? "No deals to show yet" : "Nothing matches"}</p>
          <p className={`mt-1 text-sm ${muted}`}>
            {deals.length === 0 ? (viewer === "compliance" ? "Deals from every agent in the office appear here." : "Deals from the agents you work with appear here.") : "Try another status or clear the search."}
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-black/5 dark:border-white/10 bg-white dark:bg-[#1a1a1a] overflow-hidden">
          <div className="hidden md:grid grid-cols-[minmax(0,2.2fr)_minmax(0,1.3fr)_7rem_5rem_6.5rem_9.5rem] gap-3 border-b border-black/5 dark:border-white/10 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[#1c1a17]/45 dark:text-[#faf9f7]/45">
            <span>Deal</span><span>Agent</span><span>Stage</span><span>Closing</span><span>Tasks · Docs</span><span>Compliance</span>
          </div>
          <ul>
            {rows.map((d) => {
              const pr = progress[d.id];
              return (
                <li key={d.id} className="border-b border-black/5 dark:border-white/10 last:border-0">
                  <button type="button" onClick={() => setOpenId(d.id)} className="grid w-full grid-cols-1 md:grid-cols-[minmax(0,2.2fr)_minmax(0,1.3fr)_7rem_5rem_6.5rem_9.5rem] items-center gap-x-3 gap-y-1 px-4 py-3 text-left hover:bg-black/[0.02] dark:hover:bg-white/[0.03]">
                    <span className="min-w-0">
                      <span className="flex items-center gap-2">
                        <span className="truncate font-medium">{d.property_address || d.name}</span>
                        {unread[d.id] > 0 && <span title={`${unread[d.id]} unread`} className="h-2 w-2 shrink-0 rounded-full bg-[#ed2127] dark:bg-[#f2454b]" aria-label={`${unread[d.id]} unread messages`} />}
                      </span>
                      <span className={`block truncate text-xs ${muted}`}>{d.property_address ? `${d.name} · ` : ""}{d.side === "buyer" ? "Buyer" : d.side === "seller" ? "Seller" : "Side not set"}</span>
                    </span>
                    <span className={`block text-xs md:hidden ${muted}`}>
                      {[agents[d.owner_id], d.stage, d.closing_date ? `Closes ${dateLabel(d.closing_date)}` : "", pr ? `Tasks ${pr.tasks.done}/${pr.tasks.total} · Docs ${pr.docs.done}/${pr.docs.total}` : ""].filter(Boolean).join(" · ")}
                    </span>
                    <span className="hidden md:block text-sm truncate">{agents[d.owner_id] || "–"}</span>
                    <span className={`hidden md:block text-xs ${muted}`}>{d.stage}</span>
                    <span className={`hidden md:block text-xs ${muted}`}>{dateLabel(d.closing_date)}</span>
                    <span className={`hidden md:block text-xs ${muted}`}>{pr ? `${pr.tasks.done}/${pr.tasks.total} · ${pr.docs.done}/${pr.docs.total}` : "–"}</span>
                    <span className="mt-1 md:mt-0"><ComplianceChip status={d.compliance_status} /></span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {open && (
        <DealPanel
          key={open.id}
          deal={open}
          agentName={agents[open.owner_id]}
          viewer={viewer}
          onClose={() => {
            setOpenId(null);
            load();
            loadUnread();
            reloadProgress();
            refreshDealAttention();
          }}
          onChanged={() => load()}
        />
      )}
    </div>
  );
}
