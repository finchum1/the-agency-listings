import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import { useOrg } from "../../context/OrgContext";
import { useOfficeAnalytics } from "../../hooks/useListingAnalytics";
import { RANGES, formatDuration, pct, placeLabel, sourceLabel } from "../../lib/listingAnalytics";
import { STATUS_COLORS, STATUS_LABELS } from "../../lib/format";
import { BarList, Stat, Trend, card, isWeekly, muted } from "./ListingAnalyticsView";

const SOURCES = ["facebook", "instagram", "text", "email", "mls", "flyer", "zillow", "google", "direct", "referral"];
const select =
  "rounded-lg border border-black/10 dark:border-white/15 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#ed2127]/40 dark:focus:ring-[#f2454b]/40";
const th = "px-4 py-3 font-medium whitespace-nowrap";
const LIVE = ["coming_soon", "for_sale", "pending"];

function SortHead({ id, label, sort, setSort, right }) {
  const active = sort.key === id;
  return (
    <th className={`${th} ${right ? "text-right" : ""}`} aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}>
      <button type="button" onClick={() => setSort({ key: id, dir: active && sort.dir === "desc" ? "asc" : "desc" })} className="uppercase tracking-wider hover:text-[#1c1a17] dark:hover:text-[#faf9f7]">
        {label}
        {active ? (sort.dir === "asc" ? " ▲" : " ▼") : ""}
      </button>
    </th>
  );
}

const csvCell = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;

// Dashboard > Admin > Office analytics: every property website (and agent website) in the office on one page, narrowed by
// period, agent, listing status and where the visit came from. The filters live in the address, so a view can be bookmarked.
export default function OfficeAnalyticsPage() {
  const { orgId } = useOrg();
  const [params, setParams] = useSearchParams();
  const days = Number(params.get("days")) || 30;
  const agent = params.get("agent") || "";
  const status = params.get("status") || "";
  const source = params.get("source") || "";
  const tab = params.get("tab") === "sites" ? "sites" : "listings";
  const { data, loading, error } = useOfficeAnalytics({ days, agent, status, source });
  const [agents, setAgents] = useState([]);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState({ key: "views", dir: "desc" });

  const set = (key, value) =>
    setParams(
      (p) => {
        const next = new URLSearchParams(p);
        if (value) next.set(key, value);
        else next.delete(key);
        return next;
      },
      { replace: true },
    );

  useEffect(() => {
    if (!orgId) return;
    supabase.from("profiles").select("id, full_name").eq("org_id", orgId).order("full_name").then(({ data: rows }) => setAgents(rows || []));
  }, [orgId]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = (data?.listings || []).filter((l) => !q || `${l.address_line1} ${l.city} ${l.agent_name}`.toLowerCase().includes(q));
    const dir = sort.dir === "asc" ? 1 : -1;
    const val = (l) => (sort.key === "address" ? l.address_line1 : sort.key === "agent" ? l.agent_name || "" : sort.key === "status" ? l.status : sort.key === "last" ? l.last_view || "" : l[sort.key] ?? -1);
    return [...list].sort((a, b) => (val(a) > val(b) ? dir : val(a) < val(b) ? -dir : 0));
  }, [data, query, sort]);

  const filtered = Boolean(agent || status || source);
  const delta = data && data.prior_views >= 10 ? Math.round(((data.views - data.prior_views) / data.prior_views) * 100) : null;
  const withTraffic = data ? data.listings.filter((l) => l.views > 0).length : 0;

  const download = () => {
    const head = ["Address", "City", "Agent", "Status", "Views", "Visitors", "Avg time (sec)", "Inquiries", "Last visit"];
    const lines = rows.map((l) => [l.address_line1, l.city, l.agent_name, STATUS_LABELS[l.status] || l.status, l.views, l.visitors, l.avg_duration ?? "", l.leads, l.last_view ? l.last_view.slice(0, 10) : ""].map(csvCell).join(","));
    const url = URL.createObjectURL(new Blob([[head.map(csvCell).join(","), ...lines].join("\n")], { type: "text/csv" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: `office-analytics-${days}d.csv` });
    a.click();
    URL.revokeObjectURL(url);
  };

  const chip = (active) => `px-3 py-1.5 rounded-full transition-colors ${active ? "bg-[#1c1a17] dark:bg-[#f2454b] text-white" : "text-[#1c1a17]/55 dark:text-[#faf9f7]/55 hover:text-[#1c1a17] dark:hover:text-[#faf9f7]"}`;

  return (
    <div className="max-w-6xl">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-display font-semibold">Office analytics</h1>
          <p className={`text-sm mt-0.5 ${muted}`}>Every property website and agent website in the office, together.</p>
        </div>
        <div className="flex items-center rounded-full border border-black/10 dark:border-white/15 p-0.5 text-xs font-medium" role="group" aria-label="Time period">
          {RANGES.map((r) => (
            <button key={r.days} type="button" onClick={() => set("days", r.days === 30 ? "" : String(r.days))} className={chip(days === r.days)}>
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className={`${card} mb-5 flex flex-wrap items-end gap-x-5 gap-y-3`}>
        <label className="text-[11px] font-semibold uppercase tracking-wide text-[#1c1a17]/50 dark:text-[#faf9f7]/50">
          Agent
          <select value={agent} onChange={(e) => set("agent", e.target.value)} className={`${select} mt-1 block min-w-[11rem] normal-case tracking-normal font-normal`}>
            <option value="">All agents</option>
            {agents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.full_name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-[11px] font-semibold uppercase tracking-wide text-[#1c1a17]/50 dark:text-[#faf9f7]/50">
          Listing status
          <select value={status} onChange={(e) => set("status", e.target.value)} className={`${select} mt-1 block min-w-[10rem] normal-case tracking-normal font-normal`}>
            <option value="">Any status</option>
            {Object.entries(STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label className="text-[11px] font-semibold uppercase tracking-wide text-[#1c1a17]/50 dark:text-[#faf9f7]/50">
          Visits from
          <select value={source} onChange={(e) => set("source", e.target.value)} className={`${select} mt-1 block min-w-[10rem] normal-case tracking-normal font-normal`}>
            <option value="">Anywhere</option>
            {SOURCES.map((s) => (
              <option key={s} value={s}>
                {sourceLabel(s)}
              </option>
            ))}
          </select>
        </label>
        {filtered && (
          <button type="button" onClick={() => setParams((p) => { const n = new URLSearchParams(); if (p.get("days")) n.set("days", p.get("days")); if (p.get("tab")) n.set("tab", p.get("tab")); return n; }, { replace: true })} className="text-xs font-semibold text-[#ed2127] dark:text-[#f2454b] hover:underline pb-2.5">
            Clear filters
          </button>
        )}
      </div>

      {error ? (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      ) : loading || !data ? (
        <div className={`${card} h-64 animate-pulse`} />
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <Stat label="Views" value={data.views.toLocaleString()} hint={delta == null ? (data.prior_views ? `${data.prior_views} the period before` : undefined) : `${delta >= 0 ? "▲" : "▼"} ${Math.abs(delta)}% vs the period before`} />
            <Stat label="Unique visitors" value={data.visitors.toLocaleString()} />
            <Stat label="Avg. time on page" value={formatDuration(data.avg_duration)} />
            <Stat label="Inquiries" value={data.leads.toLocaleString()} hint={data.visitors ? `${pct(data.leads, data.visitors)}% of visitors` : undefined} />
            <Stat label="Listings visited" value={`${withTraffic} of ${data.listings_count}`} hint={data.listings_count - withTraffic > 0 ? `${data.listings_count - withTraffic} with no visits` : undefined} />
          </div>

          <div className={card}>
            <div className="flex items-baseline justify-between mb-3">
              <h3 className="font-display text-base font-semibold">{isWeekly(data.daily) ? "Views by week" : "Views by day"}</h3>
              <span className={`text-xs ${muted}`}>All property websites{filtered ? ", filtered" : ""}</span>
            </div>
            <Trend daily={data.daily} />
          </div>

          <div className="flex items-center gap-1 text-sm font-medium" role="tablist">
            {[
              ["listings", "Property websites"],
              ["sites", "Agent websites"],
            ].map(([k, label]) => (
              <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => set("tab", k === "listings" ? "" : k)} className={`px-4 py-2 rounded-full border ${tab === k ? "border-[#1c1a17] dark:border-[#f2454b] bg-[#1c1a17] dark:bg-[#f2454b] text-white" : "border-black/10 dark:border-white/15 text-[#1c1a17]/60 dark:text-[#faf9f7]/60"}`}>
                {label}
              </button>
            ))}
          </div>

          {tab === "listings" ? (
            <>
              <div className={`${card} !p-0 overflow-hidden`}>
                <div className="p-5 pb-3 flex flex-wrap items-center justify-between gap-3">
                  <h3 className="font-display text-base font-semibold">Listings</h3>
                  <div className="flex items-center gap-2">
                    <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search address or agent" aria-label="Search listings" className={`${select} w-56`} />
                    <button type="button" onClick={download} className="rounded-full border border-black/10 dark:border-white/15 px-3 py-2 text-xs font-semibold hover:bg-black/[0.04] dark:hover:bg-white/[0.06]">
                      Download CSV
                    </button>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-y border-black/5 dark:border-white/10 text-left text-xs text-[#1c1a17]/45 dark:text-[#faf9f7]/45">
                        <SortHead id="address" label="Listing" sort={sort} setSort={setSort} />
                        <SortHead id="agent" label="Agent" sort={sort} setSort={setSort} />
                        <SortHead id="status" label="Status" sort={sort} setSort={setSort} />
                        <SortHead id="views" label="Views" sort={sort} setSort={setSort} right />
                        <SortHead id="visitors" label="Visitors" sort={sort} setSort={setSort} right />
                        <SortHead id="avg_duration" label="Avg. time" sort={sort} setSort={setSort} right />
                        <SortHead id="leads" label="Inquiries" sort={sort} setSort={setSort} right />
                        <SortHead id="last" label="Last visit" sort={sort} setSort={setSort} right />
                      </tr>
                    </thead>
                    <tbody>
                      {rows.length === 0 && (
                        <tr>
                          <td colSpan={8} className={`px-4 py-8 text-center ${muted}`}>
                            No listings match.
                          </td>
                        </tr>
                      )}
                      {rows.map((l) => (
                        <tr key={l.id} className="border-b border-black/5 dark:border-white/10 last:border-0 hover:bg-black/[0.02] dark:hover:bg-white/[0.04]">
                          <td className="px-4 py-3">
                            <Link to={`/dashboard/listings/${l.id}/analytics`} className="font-medium hover:underline">
                              {l.address_line1}
                            </Link>
                            <span className={`block text-xs ${muted}`}>{l.city}</span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">{l.agent_name || "–"}</td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className="inline-flex items-center gap-1.5 text-xs font-semibold">
                              <span className="h-2 w-2 rounded-full" style={{ background: STATUS_COLORS[l.status] }} />
                              {STATUS_LABELS[l.status] || l.status}
                            </span>
                            {l.views === 0 && LIVE.includes(l.status) && <span className="ml-2 rounded-full bg-red-600/10 text-red-700 dark:text-red-300 px-2 py-0.5 text-[10px] font-semibold">No visits</span>}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums font-semibold">{l.views.toLocaleString()}</td>
                          <td className="px-4 py-3 text-right tabular-nums">{l.visitors.toLocaleString()}</td>
                          <td className="px-4 py-3 text-right tabular-nums">{formatDuration(l.avg_duration)}</td>
                          <td className="px-4 py-3 text-right tabular-nums">{l.leads}</td>
                          <td className={`px-4 py-3 text-right whitespace-nowrap ${muted}`}>{l.last_view ? new Date(l.last_view).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "–"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-5">
                <div className={card}>
                  <h3 className="font-display text-base font-semibold mb-3">By agent</h3>
                  <BarList rows={data.agents.map((a) => ({ label: a.agent_name || "Unassigned", value: a.views, note: `${a.views.toLocaleString()} views · ${a.listings} listing${a.listings === 1 ? "" : "s"} · ${a.leads} inquir${a.leads === 1 ? "y" : "ies"}` }))} empty="No listings match these filters." />
                </div>
                <div className={card}>
                  <h3 className="font-display text-base font-semibold mb-3">Where visitors came from</h3>
                  <BarList rows={data.sources.map((s) => ({ label: sourceLabel(s.source), value: s.views, note: `${s.views.toLocaleString()} · ${pct(s.views, data.views)}%` }))} empty="No visits in this period." />
                </div>
                <div className={card}>
                  <h3 className="font-display text-base font-semibold mb-3">Devices</h3>
                  <BarList rows={data.devices.map((d) => ({ label: d.device === "unknown" ? "Not recorded" : d.device[0].toUpperCase() + d.device.slice(1), value: d.views, note: `${pct(d.views, data.views)}%` }))} empty="No visits in this period." />
                </div>
                <div className={card}>
                  <h3 className="font-display text-base font-semibold mb-3">Top locations</h3>
                  <BarList rows={data.locations.map((l) => ({ label: placeLabel(l) || "Unknown", value: l.views }))} empty="Locations appear as new visits come in." />
                </div>
              </div>
            </>
          ) : (
            <div className={`${card} !p-0 overflow-hidden`}>
              <div className="p-5 pb-3">
                <h3 className="font-display text-base font-semibold">Agent websites</h3>
                <p className={`text-xs mt-1 ${muted}`}>Page views of each agent's website and blog. The agent and "visits from" filters apply here; the listing status filter doesn't.</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-y border-black/5 dark:border-white/10 text-left text-xs uppercase tracking-wider text-[#1c1a17]/45 dark:text-[#faf9f7]/45">
                      <th className={th}>Agent</th>
                      <th className={`${th} text-right`}>Views</th>
                      <th className={`${th} text-right`}>Visitors</th>
                      <th className={`${th} text-right`}>Inquiries</th>
                      <th className={th}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.sites.map((s) => (
                      <tr key={s.site_id} className="border-b border-black/5 dark:border-white/10 last:border-0">
                        <td className="px-4 py-3 font-medium">{s.agent_name || s.slug}</td>
                        <td className="px-4 py-3 text-right tabular-nums font-semibold">{s.views.toLocaleString()}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{s.visitors.toLocaleString()}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{s.leads}</td>
                        <td className="px-4 py-3 text-right">
                          <Link to={`/dashboard/sites/${s.agent_id}/analytics`} className="text-xs font-semibold text-[#ed2127] dark:text-[#f2454b] hover:underline">
                            Open analytics
                          </Link>
                        </td>
                      </tr>
                    ))}
                    {data.sites.length === 0 && (
                      <tr>
                        <td colSpan={5} className={`px-4 py-8 text-center ${muted}`}>
                          No agent websites match.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
