import { useEffect, useMemo, useState } from "react";
import { useOrg } from "../../context/OrgContext";
import { useIdxEnabled } from "../../hooks/useIdxEnabled";
import { useMediaQuery } from "../../hooks/useMediaQuery";
import { useRepliersListings } from "../../hooks/useRepliersListings";
import { formatNumber, formatPrice } from "../../lib/format";
import { isSampleListing } from "../../lib/idxSample";
import IdxMap from "../brokerage-site/IdxMap";
import HomeSearchPanel from "./HomeSearchPanel";

const muted = "text-[#1c1a17]/60 dark:text-[#faf9f7]/60";
const fieldClass =
  "rounded-lg border border-black/10 dark:border-white/15 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#D8091B]/40 dark:focus:ring-[#f2454b]/40";

const PRICES = [100000, 150000, 200000, 250000, 300000, 400000, 500000, 750000, 1000000, 1500000, 2000000];
const priceLabel = (n) => (n >= 1000000 ? `$${n / 1000000}M` : `$${n / 1000}k`);
const SORTS = [
  { value: "", label: "Newest" },
  { value: "listPriceDesc", label: "Price: high to low" },
  { value: "listPriceAsc", label: "Price: low to high" },
  { value: "sqftDesc", label: "Largest" },
];
const PAGE_SIZE = 24;

/** The search box waits for a pause in typing before it asks the feed again. */
function useDebounced(value, ms = 450) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

function ResultRow({ listing, active, onOpen }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(listing)}
      aria-label={`${listing.address_line1}, ${listing.city}: ${formatPrice(listing.price)}`}
      className={`flex w-full gap-3 rounded-2xl border p-2.5 text-left transition-colors ${
        active
          ? "border-[#D8091B]/50 dark:border-[#f2454b]/60 bg-[#D8091B]/[0.04]"
          : "border-black/10 dark:border-white/15 bg-white dark:bg-[#1a1a1a] hover:bg-black/[0.02] dark:hover:bg-white/[0.04]"
      }`}
    >
      <div className="h-24 w-32 sm:h-28 sm:w-40 shrink-0 overflow-hidden rounded-xl bg-black/[0.05] dark:bg-white/[0.06]">
        {listing.hero_photo_url && <img src={listing.hero_photo_url} alt="" loading="lazy" className="h-full w-full object-cover" />}
      </div>
      <div className="min-w-0 flex-1 py-0.5">
        <div className="flex items-baseline justify-between gap-2">
          <p className="font-display text-lg font-semibold">{formatPrice(listing.price)}</p>
          <span className={`shrink-0 text-[11px] ${muted}`}>MLS# {listing.mlsNumber}</span>
        </div>
        <p className="truncate text-sm">{listing.address_line1 || "Address on request"}</p>
        <p className={`truncate text-xs ${muted}`}>
          {[listing.city, [listing.state, listing.zip].filter(Boolean).join(" ")].filter(Boolean).join(", ")}
        </p>
        <p className={`mt-1 text-xs ${muted}`}>
          {listing.beds ?? "—"} bd · {listing.baths ?? "—"} ba · {listing.sqft ? `${formatNumber(listing.sqft)} sqft` : "— sqft"}
        </p>
        {listing.officeName && <p className={`mt-1 truncate text-[11px] ${muted}`}>Courtesy of {listing.officeName}</p>}
      </div>
    </button>
  );
}

// Home Search in the dashboard: the live MLS feed (the same Repliers account the public Home Search uses, see api/repliers.js) for the
// agent's own work: find homes for a client, check what is around a listing, send one over. Public visitor sign-in is not part of this page.
export default function HomeSearchPage() {
  const { org, brand } = useOrg();
  const slug = org?.slug;
  const idx = useIdxEnabled(slug);
  const wide = useMediaQuery("(min-width: 1024px)");

  const [text, setText] = useState("");
  const city = useDebounced(text.trim());
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [beds, setBeds] = useState("");
  const [baths, setBaths] = useState("");
  const [sortBy, setSortBy] = useState("");
  const [ourOnly, setOurOnly] = useState(false);
  const [boundary, setBoundary] = useState(null);
  const [paged, setPaged] = useState({ sig: "", page: 1 });
  const [view, setView] = useState("list"); // phones and tablets: the list or the map (a wide screen shows both)
  const [open, setOpen] = useState(null);

  // Any change to the filters starts again at the first page (the page number belongs to the filters it was picked under).
  const sig = JSON.stringify([city, minPrice, maxPrice, beds, baths, sortBy, ourOnly, boundary]);
  const page = paged.sig === sig ? paged.page : 1;
  const setPage = (update) => setPaged({ sig, page: typeof update === "function" ? update(page) : update });

  const filters = useMemo(
    () =>
      idx.enabled
        ? { city, minPrice, maxPrice, minBeds: beds, minBaths: baths, sortBy, office: ourOnly ? "true" : "", map: boundary ? JSON.stringify(boundary) : "", pageNum: page, resultsPerPage: PAGE_SIZE, org: slug }
        : null,
    [idx.enabled, city, minPrice, maxPrice, beds, baths, sortBy, ourOnly, boundary, page, slug],
  );
  const { listings, meta, loading, error } = useRepliersListings(filters);
  const sample = listings.some(isSampleListing);
  const narrowed = Boolean(city || minPrice || maxPrice || beds || baths || ourOnly || boundary);
  const clearAll = () => {
    setText("");
    setMinPrice("");
    setMaxPrice("");
    setBeds("");
    setBaths("");
    setOurOnly(false);
    setBoundary(null);
  };

  if (idx.loading) return <p className={`text-sm ${muted}`}>Loading…</p>;
  if (!idx.enabled) {
    return (
      <div className="max-w-xl">
        <h1 className="text-2xl font-display font-semibold">Home Search</h1>
        <p className={`mt-2 text-sm ${muted}`}>
          Home Search is not switched on for {brand?.name || "this office"}. It needs a live MLS data feed (an MLS data license and a Repliers account connected to it). Once that is set up for the office, it shows up here on its own.
        </p>
      </div>
    );
  }

  const list = (
    <div className="space-y-2.5">
      {listings.map((l) => (
        <ResultRow key={l.id} listing={l} active={open?.mlsNumber === l.mlsNumber} onOpen={setOpen} />
      ))}
      {meta.numPages > 1 && (
        <div className="flex items-center justify-between gap-3 pt-2">
          <button type="button" disabled={page <= 1 || loading} onClick={() => setPage((p) => p - 1)} className="rounded-full border border-black/10 dark:border-white/15 px-4 py-2 text-xs font-semibold disabled:opacity-40">
            Previous
          </button>
          <span className={`text-xs ${muted}`}>
            Page {page} of {meta.numPages}
          </span>
          <button type="button" disabled={page >= meta.numPages || loading} onClick={() => setPage((p) => p + 1)} className="rounded-full border border-black/10 dark:border-white/15 px-4 py-2 text-xs font-semibold disabled:opacity-40">
            Next
          </button>
        </div>
      )}
    </div>
  );

  const map = (
    <div className="h-[60vh] min-h-[360px] lg:h-[calc(100vh-15rem)] overflow-hidden rounded-2xl border border-black/10 dark:border-white/15">
      <IdxMap listings={listings} onBoundaryChange={setBoundary} boundaryActive={Boolean(boundary)} center={brand?.mapCenter} onSelect={setOpen} />
    </div>
  );

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-2xl font-display font-semibold">Home Search</h1>
        <p className={`mt-1 text-sm ${muted}`}>The live MLS feed. Find homes for a client, then open one to share it.</p>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="City, neighborhood or ZIP"
          aria-label="City, neighborhood or ZIP"
          className={`${fieldClass} min-w-[200px] flex-1`}
        />
        <select value={minPrice} onChange={(e) => setMinPrice(e.target.value)} aria-label="Minimum price" className={fieldClass}>
          <option value="">No min</option>
          {PRICES.map((n) => (
            <option key={n} value={n}>
              {priceLabel(n)}
            </option>
          ))}
        </select>
        <select value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} aria-label="Maximum price" className={fieldClass}>
          <option value="">No max</option>
          {PRICES.map((n) => (
            <option key={n} value={n}>
              {priceLabel(n)}
            </option>
          ))}
        </select>
        <select value={beds} onChange={(e) => setBeds(e.target.value)} aria-label="Bedrooms" className={fieldClass}>
          <option value="">Any beds</option>
          {[1, 2, 3, 4, 5].map((n) => (
            <option key={n} value={n}>
              {n}+ beds
            </option>
          ))}
        </select>
        <select value={baths} onChange={(e) => setBaths(e.target.value)} aria-label="Bathrooms" className={fieldClass}>
          <option value="">Any baths</option>
          {[1, 2, 3, 4].map((n) => (
            <option key={n} value={n}>
              {n}+ baths
            </option>
          ))}
        </select>
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} aria-label="Sort" className={fieldClass}>
          {SORTS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={ourOnly} onChange={(e) => setOurOnly(e.target.checked)} />
          {brand?.name || "Our"} listings only
        </label>
        {boundary && (
          <button type="button" onClick={() => setBoundary(null)} className="rounded-full border border-black/10 dark:border-white/15 px-3 py-1 text-xs font-semibold">
            Clear drawn area
          </button>
        )}
        {narrowed && (
          <button type="button" onClick={clearAll} className="text-xs font-semibold underline">
            Clear all filters
          </button>
        )}
        <span className={`text-sm ${muted}`} aria-live="polite">
          {loading ? "Searching…" : `${formatNumber(meta.count)} home${meta.count === 1 ? "" : "s"}`}
        </span>
        {!wide && (
          <div className="ml-auto flex overflow-hidden rounded-full border border-black/10 dark:border-white/15 text-xs font-semibold">
            {["list", "map"].map((v) => (
              <button key={v} type="button" onClick={() => setView(v)} aria-pressed={view === v} className={`px-4 py-2 ${view === v ? "bg-[#1c1a17] dark:bg-[#f2454b] text-white" : ""}`}>
                {v === "list" ? "List" : "Map"}
              </button>
            ))}
          </div>
        )}
      </div>

      {sample && (
        <p role="status" className="mb-4 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">
          These are sample homes, not real listings. The office's feed is still a test account, so nothing here is real until it is connected to the MLS.
        </p>
      )}
      {error && (
        <p role="alert" className="mb-4 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      {!error && !loading && listings.length === 0 ? (
        <div className={`rounded-2xl border border-dashed border-black/15 dark:border-white/20 p-8 text-center text-sm ${muted}`}>
          No homes match.{narrowed && " Try fewer filters."}
        </div>
      ) : wide ? (
        <div className="grid grid-cols-2 items-start gap-5">
          <div className={loading ? "opacity-60 transition-opacity" : ""}>{list}</div>
          <div className="sticky top-4">{map}</div>
        </div>
      ) : view === "map" ? (
        map
      ) : (
        <div className={loading ? "opacity-60 transition-opacity" : ""}>{list}</div>
      )}

      {open && <HomeSearchPanel listing={open} slug={slug} brand={brand} onClose={() => setOpen(null)} />}
    </div>
  );
}
