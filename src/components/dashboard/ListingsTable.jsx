import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useListings } from "../../hooks/useListings";
import { useListingsAnalytics } from "../../hooks/useListingsAnalytics";
import { supabase } from "../../lib/supabaseClient";
import { formatPrice, STATUS_LABELS } from "../../lib/format";
import StatusSelect from "./StatusSelect";
import AnalyticsStats from "./AnalyticsStats";

export default function ListingsTable() {
  const { listings, loading, error, refresh } = useListings();
  const [filter, setFilter] = useState("all");

  // useListings() already scopes rows to "my listings, or all if admin"
  // via RLS — the stats strip just aggregates whatever's already loaded.
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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-display font-semibold">Listings</h1>
          <p className="text-sm text-[#1c1a17]/60 mt-1">
            {listings.length} listing{listings.length === 1 ? "" : "s"}
          </p>
        </div>
        <Link
          to="/dashboard/listings/new"
          className="rounded-full bg-[#1c1a17] text-white text-sm font-semibold px-5 py-2.5 hover:bg-[#1c1a17]/90 transition-colors"
        >
          + New Listing
        </Link>
      </div>

      <AnalyticsStats stats={analytics} />

      <div className="flex items-center gap-2 mb-5 flex-wrap">
        <button
          onClick={() => setFilter("all")}
          className={`text-xs font-semibold rounded-full px-3 py-1.5 transition-colors ${
            filter === "all" ? "bg-[#1c1a17] text-white" : "bg-black/5 text-[#1c1a17]/70 hover:bg-black/10"
          }`}
        >
          All
        </button>
        {Object.entries(STATUS_LABELS).map(([value, label]) => (
          <button
            key={value}
            onClick={() => setFilter(value)}
            className={`text-xs font-semibold rounded-full px-3 py-1.5 transition-colors ${
              filter === value ? "bg-[#1c1a17] text-white" : "bg-black/5 text-[#1c1a17]/70 hover:bg-black/10"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}
      {loading ? (
        <p className="text-sm text-[#1c1a17]/50">Loading…</p>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-black/5 rounded-2xl p-12 text-center">
          <p className="text-[#1c1a17]/60">No listings yet.</p>
        </div>
      ) : (
        <div className="bg-white border border-black/5 rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-black/5 text-left text-xs uppercase tracking-wider text-[#1c1a17]/40">
                <th className="px-5 py-3 font-medium">Address</th>
                <th className="px-5 py-3 font-medium">Agent</th>
                <th className="px-5 py-3 font-medium">Price</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Updated</th>
                <th className="px-5 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((listing) => (
                <tr key={listing.id} className="border-b border-black/5 last:border-0 hover:bg-black/[0.02]">
                  <td className="px-5 py-4">
                    <Link
                      to={`/dashboard/listings/${listing.id}/edit`}
                      className="font-medium hover:underline"
                    >
                      {listing.address_line1}
                    </Link>
                    <p className="text-xs text-[#1c1a17]/50">
                      {listing.city}, {listing.state} {listing.zip}
                    </p>
                  </td>
                  <td className="px-5 py-4 text-[#1c1a17]/70">
                    {listing.agent?.full_name || "—"}
                  </td>
                  <td className="px-5 py-4 text-[#1c1a17]/70">{formatPrice(listing.price)}</td>
                  <td className="px-5 py-4">
                    <StatusSelect
                      value={listing.status}
                      onChange={(status) => handleStatusChange(listing.id, status)}
                    />
                  </td>
                  <td className="px-5 py-4 text-[#1c1a17]/50 text-xs">
                    {new Date(listing.updated_at).toLocaleDateString()}
                  </td>
                  <td className="px-5 py-4 text-right">
                    <div className="flex items-center justify-end gap-3">
                      {listing.status !== "draft" && (
                        <a
                          href={`/listings/${listing.slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-[#8a7a5c] hover:underline"
                        >
                          View live
                        </a>
                      )}
                      <Link
                        to={`/dashboard/listings/${listing.id}/edit`}
                        className="text-xs text-[#1c1a17]/60 hover:text-[#1c1a17]"
                      >
                        Edit
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
