import { useState } from "react";
import { Link } from "react-router-dom";
import { useRepliersListings } from "../../hooks/useRepliersListings";
import { useFeaturedRepliersListings } from "../../hooks/useFeaturedRepliersListings";
import { useBrokerageSiteContext } from "../../context/BrokerageSiteContext";
import { formatPrice, STATUS_LABELS } from "../../lib/format";

const PRICE_OPTIONS = [
  { label: "Any Price", min: "", max: "" },
  { label: "Under $500k", min: "", max: "500000" },
  { label: "$500k – $1M", min: "500000", max: "1000000" },
  { label: "$1M – $2M", min: "1000000", max: "2000000" },
  { label: "$2M+", min: "2000000", max: "" },
];

const BEDS_OPTIONS = ["Any Beds", "3+", "4+", "5+"];

// Live MLS search for the Brokerage Site — two distinct pages share this
// component:
//   - /brokerage/listings ("Our Listings", officeOnly=true, the default):
//     scoped to The Agency's own inventory only (Repliers' `brokerage`
//     filter, applied server-side — see api/repliers.js). This is what
//     the Home page preview also shows.
//   - /brokerage/search ("Home Search", officeOnly=false): the open MLS,
//     every listing on the board, not just The Agency's own.
// `preview` (used on Home, via HomeSections.jsx) caps to 3 results, drops
// the filter bar, and adds a "View All Listings" link — same convention
// as AgentRoster.jsx/AreasOfExpertise.jsx/BlogList.jsx. First IDX
// integration built against Repliers (see IDX & Next.js Roadmap, Stage 1).
export default function IdxListings({ isStandalonePage = false, preview = false, officeOnly = true }) {
  const { site } = useBrokerageSiteContext();
  const [priceIdx, setPriceIdx] = useState(0);
  const [beds, setBeds] = useState("");
  const [city, setCity] = useState("");

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
            city,
            office: officeOnly,
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
          <div className="mb-12 flex flex-wrap gap-3 border border-[var(--as-text)]/10 bg-[var(--as-bg)] p-4">
            <input
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="City (e.g. Edmond)"
              className="flex-1 min-w-[160px] border border-[var(--as-text)]/10 bg-transparent px-4 py-3 text-sm text-[var(--as-text)] placeholder:text-[var(--as-text)]/40 outline-none"
            />
            <select
              value={priceIdx}
              onChange={(e) => setPriceIdx(Number(e.target.value))}
              className="flex-1 min-w-[160px] border border-[var(--as-text)]/10 bg-transparent px-4 py-3 text-sm text-[var(--as-text)]/80 outline-none"
            >
              {PRICE_OPTIONS.map((opt, i) => (
                <option key={opt.label} value={i}>
                  {opt.label}
                </option>
              ))}
            </select>
            <select
              value={beds}
              onChange={(e) => setBeds(e.target.value)}
              className="flex-1 min-w-[160px] border border-[var(--as-text)]/10 bg-transparent px-4 py-3 text-sm text-[var(--as-text)]/80 outline-none"
            >
              {BEDS_OPTIONS.map((label, i) => (
                <option key={label} value={i === 0 ? "" : String(i + 2)}>
                  {label}
                </option>
              ))}
            </select>
          </div>
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
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
              {listings.map((listing) => (
                <a key={listing.id} href={`/brokerage/listings/${listing.mlsNumber}`} className="group block">
                  <div className="relative overflow-hidden bg-[var(--as-surface)] aspect-[4/3]">
                    {listing.hero_photo_url && (
                      <img
                        src={listing.hero_photo_url}
                        alt={`${listing.address_line1}, ${listing.city}, ${listing.state}`}
                        loading="lazy"
                        className="h-full w-full object-cover transition group-hover:scale-105"
                      />
                    )}
                    <span className="absolute top-4 left-4 bg-[var(--as-dark)] text-[var(--as-on-dark)] text-[10px] font-medium tracked-wide uppercase px-3 py-1.5">
                      {STATUS_LABELS[listing.status] || listing.status || "For Sale"}
                    </span>
                  </div>
                  <p className="mt-4 font-medium text-[var(--as-text)]">{listing.address_line1}</p>
                  <p className="text-sm text-[var(--as-text)]/60">
                    {listing.city}, {listing.state} {listing.zip}
                  </p>
                  <p className="mt-1 text-sm text-[var(--as-text)]/50">
                    {listing.beds ?? "—"} bd | {listing.baths ?? "—"} ba | {listing.sqft?.toLocaleString() ?? "—"} sqft
                  </p>
                  <p className="mt-1 font-display text-lg text-[var(--as-accent)]">{formatPrice(listing.price)}</p>
                </a>
              ))}
            </div>
            {preview ? (
              <div className="mt-14 flex justify-center">
                <Link
                  to="/brokerage/listings"
                  className="border border-[var(--as-text)]/20 px-8 py-3 text-xs font-medium tracked-wide uppercase text-[var(--as-text)] transition-colors hover:bg-[var(--as-text)] hover:text-[var(--as-bg)]"
                >
                  View All Listings
                </Link>
              </div>
            ) : (
              <p className="mt-10 text-xs text-[var(--as-text)]/40">
                {meta.count} listing{meta.count === 1 ? "" : "s"} · data provided by MLS, updated live
              </p>
            )}
          </>
        )}
      </div>
    </section>
  );
}
