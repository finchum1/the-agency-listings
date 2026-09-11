import { useEffect, useState } from "react";
import { formatPrice } from "../../lib/format";

// Lets an admin hand-pick which live IDX/MLS listings show first on the
// Brokerage Site's home page preview and standalone /brokerage/listings
// page (see IdxListings.jsx). The listing DATA itself (price, photos,
// status) always comes live from Repliers — this only stores an ordered
// list of MLS numbers in brokerage_site.featured_listing_mls_numbers;
// nothing about the listing is editable here. Empty list = no pinning,
// falls back to Repliers' own default search order (see IdxListings.jsx).
//
// Each pinned entry is verified against the live API on mount/add, so a
// typo or a listing that's since sold shows up as a clear error instead
// of silently breaking the home page.
export default function BrokerageFeaturedListingsPicker({ value, onChange }) {
  const [mlsInput, setMlsInput] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState("");
  const [previews, setPreviews] = useState({}); // mlsNumber -> { loading, listing, error }

  useEffect(() => {
    value.forEach((mlsNumber) => {
      if (previews[mlsNumber]) return;
      setPreviews((p) => ({ ...p, [mlsNumber]: { loading: true } }));
      fetch(`/api/repliers?mlsNumber=${encodeURIComponent(mlsNumber)}`)
        .then(async (res) => {
          const body = await res.json();
          if (!res.ok) throw new Error(body.error || "Not found");
          return body.listing;
        })
        .then((listing) => setPreviews((p) => ({ ...p, [mlsNumber]: { listing } })))
        .catch((err) => setPreviews((p) => ({ ...p, [mlsNumber]: { error: err.message } })));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const addListing = async () => {
    const mlsNumber = mlsInput.trim();
    if (!mlsNumber) return;
    if (value.includes(mlsNumber)) {
      setAddError("That listing is already featured.");
      return;
    }
    setAdding(true);
    setAddError("");
    try {
      const res = await fetch(`/api/repliers?mlsNumber=${encodeURIComponent(mlsNumber)}`);
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Listing not found.");
      setPreviews((p) => ({ ...p, [mlsNumber]: { listing: body.listing } }));
      onChange([...value, mlsNumber]);
      setMlsInput("");
    } catch (err) {
      setAddError(err.message || "Couldn't find that listing.");
    } finally {
      setAdding(false);
    }
  };

  const removeListing = (mlsNumber) => onChange(value.filter((n) => n !== mlsNumber));

  const moveListing = (i, direction) => {
    const j = i + direction;
    if (j < 0 || j >= value.length) return;
    const arr = [...value];
    [arr[i], arr[j]] = [arr[j], arr[i]];
    onChange(arr);
  };

  return (
    <div>
      <label className="block text-xs font-medium text-[#1c1a17]/60 dark:text-[#faf9f7]/60 mb-1.5">Featured listings</label>
      <p className="text-xs text-[#1c1a17]/40 dark:text-[#faf9f7]/40 mb-2">
        Pin specific MLS listings to show on the home page. Leave empty to just show whatever comes back
        first from the live search.
      </p>

      <div className="space-y-1.5 mb-3">
        {value.map((mlsNumber, i) => {
          const preview = previews[mlsNumber];
          return (
            <div key={mlsNumber} className="flex items-center gap-2 bg-white dark:bg-[#1a1a1a] border border-black/10 dark:border-white/15 rounded-lg px-3 py-2">
              <div className="flex-1 min-w-0 text-sm">
                {preview?.listing ? (
                  <>
                    <span className="font-medium">{preview.listing.address_line1}</span>
                    <span className="text-[#1c1a17]/50 dark:text-[#faf9f7]/50">
                      {" "}
                      — {preview.listing.city}, {preview.listing.state} · {formatPrice(preview.listing.price)}
                    </span>
                  </>
                ) : preview?.error ? (
                  <span className="text-[#c0392b] dark:text-[#f87171]">
                    MLS# {mlsNumber} — {preview.error}
                  </span>
                ) : (
                  <span className="text-[#1c1a17]/40 dark:text-[#faf9f7]/40">MLS# {mlsNumber} — checking…</span>
                )}
              </div>
              <button
                type="button"
                onClick={() => moveListing(i, -1)}
                disabled={i === 0}
                className="text-[#1c1a17]/40 dark:text-[#faf9f7]/40 hover:text-[#1c1a17] dark:hover:text-[#faf9f7] disabled:opacity-20 disabled:hover:text-[#1c1a17]/40 dark:disabled:hover:text-[#faf9f7]/40 px-1"
                title="Move earlier"
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => moveListing(i, 1)}
                disabled={i === value.length - 1}
                className="text-[#1c1a17]/40 dark:text-[#faf9f7]/40 hover:text-[#1c1a17] dark:hover:text-[#faf9f7] disabled:opacity-20 disabled:hover:text-[#1c1a17]/40 dark:disabled:hover:text-[#faf9f7]/40 px-1"
                title="Move later"
              >
                ↓
              </button>
              <button
                type="button"
                onClick={() => removeListing(mlsNumber)}
                className="text-[#1c1a17]/40 dark:text-[#faf9f7]/40 hover:text-[#c0392b] dark:hover:text-[#f87171] px-1"
                title="Remove"
              >
                ✕
              </button>
            </div>
          );
        })}
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={mlsInput}
          onChange={(e) => setMlsInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addListing();
            }
          }}
          placeholder="MLS number, e.g. ACT8714298"
          className="flex-1 rounded-lg border border-black/10 dark:border-white/15 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#ed2127]/40 dark:focus:ring-[#f2454b]/40"
        />
        <button
          type="button"
          onClick={addListing}
          disabled={adding || !mlsInput.trim()}
          className="rounded-lg bg-[#0d0d0c] dark:bg-[#f2454b] px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-white hover:bg-[#ed2127] disabled:opacity-40"
        >
          {adding ? "Checking…" : "Add"}
        </button>
      </div>
      {addError && <p className="mt-1.5 text-xs text-[#c0392b] dark:text-[#f87171]">{addError}</p>}
    </div>
  );
}
