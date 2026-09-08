import { useState } from "react";
import { Link } from "react-router-dom";
import { useRepliersListings } from "../../hooks/useRepliersListings";
import { useFeaturedRepliersListings } from "../../hooks/useFeaturedRepliersListings";
import { useFavorites } from "../../hooks/useFavorites";
import { useBrokerageSiteContext } from "../../context/BrokerageSiteContext";
import IdxListingCard from "./IdxListingCard";
import IdxMap from "./IdxMap";

const PRICE_OPTIONS = [
  { label: "Any Price", min: "", max: "" },
  { label: "Under $500k", min: "", max: "500000" },
  { label: "$500k – $1M", min: "500000", max: "1000000" },
  { label: "$1M – $2M", min: "1000000", max: "2000000" },
  { label: "$2M+", min: "2000000", max: "" },
];

const BEDS_OPTIONS = ["Any Beds", "3+", "4+", "5+"];
const BATHS_OPTIONS = ["Any Baths", "2+", "3+", "4+"];
const SORT_OPTIONS = [
  { value: "createdOnDesc", label: "Newest" },
  { value: "listPriceDesc", label: "Price: High to Low" },
  { value: "listPriceAsc", label: "Price: Low to High" },
  { value: "sqftDesc", label: "Largest" },
];

const pillClass =
  "border border-[var(--as-text)]/10 bg-transparent px-4 py-3 text-sm text-[var(--as-text)]/80 outline-none rounded-full";

// Live MLS search for the Brokerage Site — two distinct pages share this
// component:
//   - /brokerage/listings ("Our Listings", officeOnly=true, the default):
//     scoped to The Agency's own inventory only (Repliers' `brokerage`
//     filter, applied server-side — see api/repliers.js). This is what
//     the Home page preview also shows.
//   - /brokerage/search ("Home Search", officeOnly=false): the open MLS,
//     every listing on the board, not just The Agency's own.
// `preview` (used on Home, via HomeSections.jsx) caps to 3 results, drops
// the filter bar/map, and adds a "View All Listings" link — same
// convention as AgentRoster.jsx/AreasOfExpertise.jsx/BlogList.jsx. The
// standalone pages get the full list+map split view, modeled on a
// reference screenshot of an MLS Grid–powered search Terrence supplied.
export default function IdxListings({ isStandalonePage = false, preview = false, officeOnly = true }) {
  const { site } = useBrokerageSiteContext();
  const { favorites, toggleFavorite } = useFavorites();
  const [priceIdx, setPriceIdx] = useState(0);
  const [beds, setBeds] = useState("");
  const [baths, setBaths] = useState("");
  const [city, setCity] = useState("");
  const [sortBy, setSortBy] = useState("");
  const [view, setView] = useState("list");
  const [boundary, setBoundary] = useState(null); // drawn polygon, from IdxMap.jsx's Draw control

  const pinnedMlsNumbers = preview ? site.featuredListingMlsNumbers.slice(0, 3) : [];
  const usePinned = pinnedMlsNumbers.length > 0;

  const price = PRICE_OPTIONS[priceIdx];
  const search = useRepliersListings(
    // null skips the fetch entirely once pinned listings already cover
    // this preview — see useRepliersListings.js.
    usePinned
      ? null
      : preview
        ? { resultsPerPage: 3, office: officeOnly }
        : {
            minPrice: price.min,
            maxPrice: price.max,
            minBeds: beds,
            minBaths: baths,
            city,
            office: officeOnly,
            sortBy,
            map: boundary ? JSON.stringify(boundary) : "",
            resultsPerPage: 48,
          },
  );
  const pinned = useFeaturedRepliersListings(pinnedMlsNumbers);

  const { listings, loading, error } = usePinned
    ? { listings: pinned.listings, loading: pinned.loading, error: "" }
    : { listings: search.listings, loading: search.loading, error: search.error };
  const meta = usePinned ? { count: pinned.listings.length } : search.meta;

  // Preview (Home) hides the whole section rather than showing a broken
  // or empty-looking block — same convention as AgentRoster.jsx returning
  // null when there's nothing to show.
  if (preview && !loading && (error || listings.length === 0)) return null;

  const Heading = isStandalonePage ? "h1" : "h2";

  return (
    <section id="listings" className="px-6 lg:px-10 py-24 bg-[var(--as-bg-alt)] border-y border-[var(--as-text)]/10">
      <div className="mx-auto max-w-7xl">
        <p className="text-xs font-medium tracked-wide uppercase text-[var(--as-accent)] mb-3">
          {officeOnly ? "The Agency's Listings" : "Home Search"}
        </p>
        <Heading className="text-3xl sm:text-4xl font-display font-semibold mb-10 text-[var(--as-text)]">
          {preview
            ? "Featured Homes For Sale"
            : officeOnly
              ? "Our Current Listings"
              : "Search Every Home For Sale"}
        </Heading>

        {!preview && (
          <>
            <div className="mb-6 flex flex-wrap gap-3 border border-[var(--as-text)]/10 bg-[var(--as-bg)] p-4 rounded-2xl">
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="City, neighborhood, ZIP…"
                className="flex-1 min-w-[180px] border border-[var(--as-text)]/10 bg-transparent px-4 py-3 text-sm text-[var(--as-text)] placeholder:text-[var(--as-text)]/40 outline-none rounded-full"
              />
              <select value={priceIdx} onChange={(e) => setPriceIdx(Number(e.target.value))} className={`flex-1 min-w-[140px] ${pillClass}`}>
                {PRICE_OPTIONS.map((opt, i) => (
                  <option key={opt.label} value={i}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <select value={beds} onChange={(e) => setBeds(e.target.value)} className={`flex-1 min-w-[120px] ${pillClass}`}>
                {BEDS_OPTIONS.map((label, i) => (
                  <option key={label} value={i === 0 ? "" : String(i + 2)}>
                    {label}
                  </option>
                ))}
              </select>
              <select value={baths} onChange={(e) => setBaths(e.target.value)} className={`flex-1 min-w-[120px] ${pillClass}`}>
                {BATHS_OPTIONS.map((label, i) => (
                  <option key={label} value={i === 0 ? "" : String(i + 1)}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div className="mb-10 flex flex-wrap items-center justify-between gap-4">
              <p className="text-sm text-[var(--as-text)]/60">
                {loading ? "Searching…" : `${meta.count} result${meta.count === 1 ? "" : "s"}`}
              </p>
              <div className="flex items-center gap-3">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="border border-[var(--as-text)]/10 bg-transparent px-3 py-2 text-xs uppercase tracked text-[var(--as-text)]/70 outline-none rounded-full"
                >
                  {SORT_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      Sort: {opt.label}
                    </option>
                  ))}
                </select>
                <div className="flex rounded-full border border-[var(--as-text)]/10 overflow-hidden text-xs font-medium uppercase tracked">
                  <button
                    type="button"
                    onClick={() => setView("list")}
                    className={`px-4 py-2 transition-colors ${view === "list" ? "bg-[var(--as-dark)] text-[var(--as-on-dark)]" : "text-[var(--as-text)]/60"}`}
                  >
                    List
                  </button>
                  <button
                    type="button"
                    onClick={() => setView("map")}
                    className={`px-4 py-2 transition-colors ${view === "map" ? "bg-[var(--as-dark)] text-[var(--as-on-dark)]" : "text-[var(--as-text)]/60"}`}
                  >
                    Map
                  </button>
                </div>
              </div>
            </div>
          </>
        )}

        {loading && <p className="text-sm text-[var(--as-text)]/50">Searching listings…</p>}

        {!loading && error && (
          <p className="text-sm text-[var(--as-accent)]">
            {error} — confirm REPLIERS_API_KEY is set in Vercel and try again.
          </p>
        )}

        {!loading && !error && listings.length === 0 && !preview && (
          <p className="text-sm text-[var(--as-text)]/50">No listings match those filters right now.</p>
        )}

        {!loading && !error && listings.length > 0 && (
          <>
            {preview ? (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
                {listings.map((listing) => (
                  <IdxListingCard
                    key={listing.id}
                    listing={listing}
                    favorited={favorites.has(listing.mlsNumber)}
                    onToggleFavorite={toggleFavorite}
                  />
                ))}
              </div>
            ) : view === "map" ? (
              <div className="h-[600px] md:h-[720px] overflow-hidden rounded-2xl border border-[var(--as-text)]/10">
                <IdxMap listings={listings} onBoundaryChange={setBoundary} boundaryActive={!!boundary} />
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                {listings.map((listing) => (
                  <IdxListingCard
                    key={listing.id}
                    listing={listing}
                    favorited={favorites.has(listing.mlsNumber)}
                    onToggleFavorite={toggleFavorite}
                  />
                ))}
              </div>
            )}

            {preview && (
              <div className="mt-14 flex justify-center">
                <Link
                  to="/brokerage/listings"
                  className="border border-[var(--as-text)]/20 px-8 py-3 text-xs font-medium tracked-wide uppercase text-[var(--as-text)] transition-colors hover:bg-[var(--as-text)] hover:text-[var(--as-bg)]"
                >
                  View All Listings
                </Link>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
