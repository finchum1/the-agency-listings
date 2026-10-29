import { useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useListings } from "../../hooks/useListings";
import { STATUS_LABELS } from "../../lib/format";
import ListingsDataTable from "./ListingsDataTable";
import ListingFromLink from "./ListingFromLink";
import ListingForm from "./ListingForm";

const muted = "text-[#1c1a17]/50 dark:text-[#faf9f7]/50";

// An agent's listings, inside their website editor. They are the same rows as the Listings page (listings.agent_id), so one added there shows here and one
// added here shows there; every listing that isn't a draft is on the agent's website. Adding one opens the same pieces the Listings page uses (start from a
// link, or the full form), already set to this agent.
export default function SiteListingsManager({ agentId, agentName }) {
  const { listings, loading, error, refresh } = useListings({ agentId });
  const [filter, setFilter] = useState("all");
  const [adding, setAdding] = useState(false);
  const [justAdded, setJustAdded] = useState(null);

  const shown = useMemo(() => listings.filter((l) => filter === "all" || l.status === filter), [listings, filter]);
  const onSite = listings.filter((l) => l.status !== "draft").length;

  const setStatus = async (id, status) => {
    const { error: err } = await supabase.from("listings").update({ status }).eq("id", id);
    if (err) alert("Couldn't update status: " + err.message);
    else refresh();
  };
  const added = (id) => {
    setAdding(false);
    setJustAdded(id);
    refresh();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-xl">
          <h2 className="font-display text-lg font-semibold">Listings</h2>
          <p className={`mt-1 text-sm ${muted}`}>
            {agentName ? `${agentName}'s` : "Your"} listings, the same ones as on the Listings page. Add one here or there and it shows in both. Anything that isn't a draft is on the website
            {listings.length > 0 ? ` (${onSite} of ${listings.length} right now)` : ""}.
          </p>
        </div>
        {!adding && (
          <button type="button" onClick={() => { setAdding(true); setJustAdded(null); }} className="rounded-full bg-[#1c1a17] dark:bg-[#f2454b] text-white text-sm font-semibold px-5 py-2.5 hover:opacity-90">
            + Add listing
          </button>
        )}
      </div>

      {justAdded && (
        <p role="status" className="rounded-xl border border-emerald-600/30 bg-emerald-600/10 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-300">
          Listing added. It's a draft until you set its status to something else below.{" "}
          <a href={`/dashboard/listings/${justAdded}/edit`} className="font-semibold underline">
            Open it to finish
          </a>
        </p>
      )}

      {adding && (
        <div className="space-y-4 rounded-2xl border border-black/10 dark:border-white/15 p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-display text-base font-semibold">Add a listing</h3>
            <button type="button" onClick={() => setAdding(false)} className={`text-sm hover:underline ${muted}`}>
              Cancel
            </button>
          </div>
          <ListingFromLink agentId={agentId} onCreated={added} />
          <ListingForm mode="create" defaultAgentId={agentId} onSaved={added} />
        </div>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        {[["all", "All"], ...Object.entries(STATUS_LABELS)].map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setFilter(value)}
            className={`text-xs font-semibold rounded-full px-3 py-1.5 transition-colors ${
              filter === value ? "bg-[#1c1a17] dark:bg-[#f2454b] text-white" : "bg-black/5 dark:bg-white/10 text-[#1c1a17]/70 dark:text-[#faf9f7]/70 hover:bg-black/10 dark:hover:bg-white/15"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      {loading ? (
        <p className={`text-sm ${muted}`}>Loading…</p>
      ) : shown.length === 0 ? (
        <div className="rounded-2xl border border-black/5 dark:border-white/10 bg-white dark:bg-[#1a1a1a] p-10 text-center">
          <p className={muted}>{listings.length === 0 ? "No listings yet. Add the first one above." : "No listings with that status."}</p>
        </div>
      ) : (
        <ListingsDataTable rows={shown} onStatusChange={setStatus} />
      )}
    </div>
  );
}
