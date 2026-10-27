import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { useListings } from "../../hooks/useListings";
import { supabase } from "../../lib/supabaseClient";
import { STATUS_LABELS } from "../../lib/format";
import { matchesSearch } from "../../lib/searchMatch";
import ListingsDataTable from "./ListingsDataTable";

export default function ListingsTable() {
  const { user, isAdmin, loading: authLoading } = useAuth();
  // Admins see everything (agentId left unset); everyone else is scoped
  // to their own listings only — see useListings.js for why this can't
  // just be left to RLS. `ready: !authLoading` avoids a flash of every
  // listing before the scope narrows down once we know who's asking.
  const { listings, loading, error, refresh } = useListings({
    agentId: isAdmin ? undefined : user?.id,
    ready: !authLoading,
  });
  const [filter, setFilter] = useState("all");
  const [domainFilter, setDomainFilter] = useState("all"); // all | with | without | down
  const [domainChecks, setDomainChecks] = useState({}); // listingId -> { status, label, domain }
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    return listings.filter(
      (l) =>
        (filter === "all" || l.status === filter) &&
        (domainFilter === "all" || (domainFilter === "down" ? domainChecks[l.id] && domainChecks[l.id].status !== "ok" && Boolean(l.custom_domain) : (domainFilter === "with") === Boolean(l.custom_domain))) &&
        matchesSearch([l.address_line1, l.city, l.state, l.zip, l.mls_number, l.agent?.full_name, l.agent?.email, STATUS_LABELS[l.status], l.price, l.custom_domain], query),
    );
  }, [listings, filter, domainFilter, domainChecks, query]);
  const withDomain = listings.filter((l) => l.custom_domain).length;

  // Is each custom domain actually serving this app? Checked by the server (api/domain-check.js) once the list loads, and again on demand.
  const [checking, setChecking] = useState(false);
  const [checkError, setCheckError] = useState("");
  const domainKey = listings.filter((l) => l.custom_domain).map((l) => `${l.id}:${l.custom_domain}`).join("|");
  const runChecks = useCallback(async () => {
    if (!domainKey) return;
    setChecking(true);
    setCheckError("");
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const res = await fetch("/api/domain-check", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ ids: domainKey.split("|").map((p) => p.split(":")[0]) }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "The check didn't run.");
      setDomainChecks(json.results || {});
    } catch (e) {
      setCheckError(e.message || "The check didn't run.");
    }
    setChecking(false);
  }, [domainKey]);
  useEffect(() => {
    if (!loading) runChecks();
  }, [loading, runChecks]);
  const down = listings.filter((l) => l.custom_domain && domainChecks[l.id] && domainChecks[l.id].status !== "ok");

  const handleStatusChange = async (id, status) => {
    const { error } = await supabase.from("listings").update({ status }).eq("id", id);
    if (error) {
      console.error(error);
      alert("Couldn't update status: " + error.message);
    } else {
      refresh();
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-3 flex-wrap mb-6">
        <div>
          <h1 className="text-2xl font-display font-semibold">Listings</h1>
          <p className="text-sm text-[#1c1a17]/60 dark:text-[#faf9f7]/60 mt-1">
            {listings.length} listing{listings.length === 1 ? "" : "s"}
            {!loading && listings.length > 0 && <> · {withDomain} with a custom domain</>}
            {down.length > 0 && (
              <>
                {" · "}
                <button type="button" onClick={() => setDomainFilter("down")} className="font-semibold text-red-600 dark:text-red-400 hover:underline">
                  {down.length} not responding
                </button>
              </>
            )}
          </p>
        </div>
        <Link
          to="/dashboard/listings/new"
          className="rounded-full bg-[#1c1a17] dark:bg-[#f2454b] text-white text-sm font-semibold px-5 py-2.5 hover:bg-[#1c1a17]/90 dark:hover:bg-[#f2454b]/90 transition-colors"
        >
          + New Listing
        </Link>
      </div>

      <div className="mb-4 flex items-center gap-3">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={isAdmin ? "Search by address, city, zip, MLS number, or agent" : "Search by address, city, zip, or MLS number"}
          aria-label="Search listings"
          className="w-full rounded-lg border border-black/10 dark:border-white/15 bg-transparent px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#ed2127]/40 dark:focus:ring-[#f2454b]/40"
        />
        {(query.trim() || filter !== "all" || domainFilter !== "all") && !loading && (
          <span className="shrink-0 text-xs text-[#1c1a17]/50 dark:text-[#faf9f7]/50">
            {filtered.length} of {listings.length}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2 mb-5 flex-wrap">
        <button
          onClick={() => setFilter("all")}
          className={`text-xs font-semibold rounded-full px-3 py-1.5 transition-colors ${
            filter === "all" ? "bg-[#1c1a17] dark:bg-[#f2454b] text-white" : "bg-black/5 dark:bg-white/10 text-[#1c1a17]/70 dark:text-[#faf9f7]/70 hover:bg-black/10 dark:hover:bg-white/15"
          }`}
        >
          All
        </button>
        {Object.entries(STATUS_LABELS).map(([value, label]) => (
          <button
            key={value}
            onClick={() => setFilter(value)}
            className={`text-xs font-semibold rounded-full px-3 py-1.5 transition-colors ${
              filter === value ? "bg-[#1c1a17] dark:bg-[#f2454b] text-white" : "bg-black/5 dark:bg-white/10 text-[#1c1a17]/70 dark:text-[#faf9f7]/70 hover:bg-black/10 dark:hover:bg-white/15"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2 mb-5 flex-wrap" role="group" aria-label="Custom domain">
        <span className="text-xs text-[#1c1a17]/50 dark:text-[#faf9f7]/50 mr-1">Custom domain</span>
        {[
          ["all", "Any"],
          ["with", `Has one (${withDomain})`],
          ["without", `Doesn't (${listings.length - withDomain})`],
          ...(down.length ? [["down", `Not responding (${down.length})`]] : []),
        ].map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setDomainFilter(value)}
            aria-pressed={domainFilter === value}
            className={`text-xs font-semibold rounded-full px-3 py-1.5 transition-colors ${
              domainFilter === value ? "bg-[#1c1a17] dark:bg-[#f2454b] text-white" : "bg-black/5 dark:bg-white/10 text-[#1c1a17]/70 dark:text-[#faf9f7]/70 hover:bg-black/10 dark:hover:bg-white/15"
            }`}
          >
            {label}
          </button>
        ))}
        {withDomain > 0 && (
          <button type="button" onClick={runChecks} disabled={checking} className="ml-1 text-xs font-semibold text-[#ed2127] dark:text-[#f2454b] hover:underline disabled:opacity-60">
            {checking ? "Checking domains…" : "Check domains again"}
          </button>
        )}
        {checkError && <span className="text-xs text-red-600 dark:text-red-400">{checkError}</span>}
      </div>

      {error && <p className="text-sm text-red-600 dark:text-red-400 mb-4">{error}</p>}
      {loading ? (
        <p className="text-sm text-[#1c1a17]/50 dark:text-[#faf9f7]/50">Loading…</p>
      ) : filtered.length === 0 ? (
        <div className="bg-white dark:bg-[#1a1a1a] border border-black/5 dark:border-white/10 rounded-2xl p-12 text-center">
          <p className="text-[#1c1a17]/60 dark:text-[#faf9f7]/60">
            {listings.length === 0 ? (
              "No listings yet."
            ) : (
              <>
                No listings match.{" "}
                <button type="button" onClick={() => { setQuery(""); setFilter("all"); setDomainFilter("all"); }} className="font-semibold text-[#ed2127] dark:text-[#f2454b] hover:underline">
                  Clear search
                </button>
              </>
            )}
          </p>
        </div>
      ) : (
        <ListingsDataTable rows={filtered} onStatusChange={handleStatusChange} domainChecks={domainChecks} checking={checking} />
      )}
    </div>
  );
}
