import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../hooks/useAuth";
import { makeSnapshot } from "../../lib/cmaAttach";
import { formatPrice } from "../../lib/format";

const muted = "text-[#1c1a17]/60 dark:text-[#faf9f7]/60";
const input =
  "w-full rounded-lg border border-black/10 dark:border-white/15 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#D8091B]/40 dark:focus:ring-[#f2454b]/40";
const card = "rounded-2xl border border-black/10 dark:border-white/15 bg-white dark:bg-[#1a1a1a]";
const quiet = "rounded-full border border-black/10 dark:border-white/15 px-3.5 py-1.5 text-xs font-semibold hover:bg-black/[0.04] dark:hover:bg-white/[0.06]";

// In the CMA editor: which listing this CMA is for. Attaching freezes the CMA's numbers and the listing's price that day, so it can be compared with
// how the listing went (on the listing's page). `cma` is the editor's current document, `row` what the database holds, `onChanged` gets the new
// { listing_id, attach }.
export default function CmaListingLink({ cmaId, cma, row, onChanged }) {
  const { user } = useAuth();
  const [listings, setListings] = useState([]);
  const [pick, setPick] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user?.id) return undefined;
    let live = true;
    supabase.from("listings").select("id, address_line1, city, price, status").eq("agent_id", user.id).order("updated_at", { ascending: false }).limit(100).then(({ data }) => live && setListings(data || []));
    return () => {
      live = false;
    };
  }, [user?.id]);

  const attached = listings.find((l) => l.id === row?.listing_id);
  // Listings whose street address matches the CMA's home come first.
  const street = String(cma.subject?.address || "").trim().toLowerCase();
  const ordered = [...listings].sort((a, b) => Number((b.address_line1 || "").toLowerCase() === street && !!street) - Number((a.address_line1 || "").toLowerCase() === street && !!street));

  const write = async (patch) => {
    setBusy(true);
    setError("");
    const { error: err } = await supabase.from("cmas").update(patch).eq("id", cmaId);
    setBusy(false);
    if (err) return setError(err.message);
    onChanged(patch);
  };
  const attach = (listing) => write({ listing_id: listing.id, attach: makeSnapshot(cma, listing, row?.listing_id === listing.id ? row.attach : {}) });

  return (
    <section className={`${card} p-5 space-y-3`} aria-label="Attach to a listing">
      <h2 className="font-display text-lg font-semibold">Attach to a listing</h2>
      {row?.listing_id ? (
        <>
          <p className="text-sm">
            <span className="font-medium">{attached ? attached.address_line1 : "A listing"}</span>
            {row.attach?.at && <span className={muted}> · frozen {new Date(row.attach.at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>}
          </p>
          <p className={`text-xs ${muted}`}>
            Saved with it: suggested {row.attach?.suggested != null ? formatPrice(row.attach.suggested) : "no price"}
            {row.attach?.list_price != null ? `, listed at ${formatPrice(row.attach.list_price)}` : ""}. Compare it with how the listing went on the listing's page.
          </p>
          <div className="flex flex-wrap gap-2">
            {attached && <Link to={`/dashboard/listings/${attached.id}/edit`} className={quiet}>Open the listing</Link>}
            {attached && <button type="button" disabled={busy} onClick={() => attach(attached)} className={quiet}>Refreeze with today's numbers</button>}
            <button type="button" disabled={busy} onClick={() => write({ listing_id: null, attach: {} })} className={quiet}>Detach</button>
          </div>
        </>
      ) : (
        <>
          <p className={`text-sm ${muted}`}>Tie this CMA to one of your listings. Its numbers are saved as they are today, so you can see later how the price held up.</p>
          <select value={pick} onChange={(e) => setPick(e.target.value)} className={input} aria-label="Listing">
            <option value="">Choose a listing…</option>
            {ordered.map((l) => (
              <option key={l.id} value={l.id}>{l.address_line1}{l.city ? `, ${l.city}` : ""}{l.price ? ` · ${formatPrice(l.price)}` : ""}</option>
            ))}
          </select>
          <button type="button" disabled={!pick || busy} onClick={() => attach(listings.find((l) => l.id === pick))} className="rounded-full bg-[#1c1a17] dark:bg-[#f2454b] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
            Attach
          </button>
        </>
      )}
      {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
    </section>
  );
}
