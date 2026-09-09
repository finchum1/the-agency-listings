import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { useListings } from "../../hooks/useListings";
import { useListingsAnalytics } from "../../hooks/useListingsAnalytics";
import { supabase } from "../../lib/supabaseClient";
import { STATUS_LABELS } from "../../lib/format";
import AnalyticsStats from "./AnalyticsStats";
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

  const listingIds = useMemo(() => listings.map((l) => l.id), [listings]);
  const analytics = useListingsAnalytics(listingIds);

  const filtered = useMemo(() => {
    if (filter === "all") return listings;
    return listings.filter((l) => l.status === filter);
  }, [listings, filter]);

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
          </p>
        </div>
        <Link
          to="/dashboard/listings/new"
          className="rounded-full bg-[#1c1a17] dark:bg-[#f2454b] text-white text-sm font-semibold px-5 py-2.5 hover:bg-[#1c1a17]/90 dark:hover:bg-[#f2454b]/90 transition-colors"
        >
          + New Listing
        </Link>
      </div>

      <AnalyticsStats stats={analytics} />

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

      {error && <p className="text-sm text-red-600 dark:text-red-400 mb-4">{error}</p>}
      {loading ? (
        <p className="text-sm text-[#1c1a17]/50 dark:text-[#faf9f7]/50">Loading…</p>
      ) : filtered.length === 0 ? (
        <div className="bg-white dark:bg-[#1a1a1a] border border-black/5 dark:border-white/10 rounded-2xl p-12 text-center">
          <p className="text-[#1c1a17]/60 dark:text-[#faf9f7]/60">No listings yet.</p>
        </div>
      ) : (
        <ListingsDataTable rows={filtered} onStatusChange={handleStatusChange} />
      )}
    </div>
  );
}
