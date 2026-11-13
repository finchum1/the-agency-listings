import { useContext, useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useRepliersListings } from "../../hooks/useRepliersListings";
import { useFeaturedRepliersListings } from "../../hooks/useFeaturedRepliersListings";
import { useFavorites } from "../../hooks/useFavorites";
import { BrokerageSiteContext } from "../../context/BrokerageSiteContext";
import IdxListingCard from "./IdxListingCard";
import IdxMap from "./IdxMap";
import VisitorBar from "../idx/VisitorUI";
import { useVisitor } from "../../lib/visitorStore";

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
// `preview` (used on Home, via HomeSections.jsx) caps to `previewCount`
// results, drops the filter bar/map, and adds a "View All Listings" link
// (pass viewAllHref={null} to suppress it) — same convention as
// AgentRoster.jsx/AreasOfExpertise.jsx/BlogList.jsx. The standalone pages
// get the full list+map split view, modeled on a reference screenshot of
// an MLS Grid–powered search Terrence supplied.
//
// initialCity/eyebrowOverride/titleOverride/sectionId exist for
// AgentAreaPage.jsx, which embeds this twice on one page (a curated
// preview of The Agency's own listings, plus the full open-market
// search) both pre-scoped to one area's city — every other call site
// leaves these at their defaults and behaves exactly as before.
//
// Reads BrokerageSiteContext directly (optionally) rather than the
// throwing useBrokerageSiteContext() hook, since AgentAreaPage.jsx
// renders this outside any BrokerageSiteProvider — pinned listings are a
// brokerage-only home-page feature anyway, so simply having none there
// is correct, not a bug.
export default function IdxListings({
  isStandalonePage = false,
  preview = false,
  officeOnly = true,
  initialCity = "",
  previewCount = 3,
  viewAllHref = "/brokerage/listings",
  eyebrowOverride,
  titleOverride,
  sectionId = "listings",
  brand: brandProp,
  // Whose visitors sign in here: {kind: "agent", id} (an agent site's area page) or {kind: "brokerage"}. The brokerage pages default to the brokerage.
  visitorSite: visitorSiteProp,
}) {
  const brokerageSite = useContext(BrokerageSiteContext);
  // Whose IDX account and map: the brokerage site's organization, or the one the caller passes (area pages)
  const brand = brandProp || brokerageSite?.site?.brokerage;
  const orgSlug = brand?.slug;
  const local = useFavorites();
  const location = useLocation();
  // Links in saved-search emails carry the filters in the address.
  const fromLink = (() => { try { return new URLSearchParams(location.search); } catch { return new URLSearchParams(); } })();
  const priceFromLink = PRICE_OPTIONS.findIndex((o) => o.min === (fromLink.get("minPrice") || "") && o.max === (fromLink.get("maxPrice") || ""));
  // A preview strip (Home, an area page's "Our Listings") only joins in when the page tells it to: the sign-in itself lives with the full search.
  const visitorSite = visitorSiteProp || (!preview && brokerageSite ? { kind: "brokerage" } : null);
  const [visitorState, visitorStore] = useVisitor(visitorSite || { kind: "none" });
  useEffect(() => { if (visitorSite) visitorStore.init(); }, [visitorSite?.kind, visitorSite?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  // Signed in: hearts are saved to the account. Otherwise they stay as before (this browser only), and a visitor site asks to sign in first.
  const favorites = visitorSite ? { has: (mls) => visitorStore.isFavorite(mls) } : local.favorites;
  const [priceIdx, setPriceIdx] = useState(priceFromLink > 0 ? priceFromLink : 0);
  const [beds, setBeds] = useState(/^[345]$/.test(fromLink.get("minBeds") || "") ? fromLink.get("minBeds") : "");
  const [baths, setBaths] = useState(/^[234]$/.test(fromLink.get("minBaths") || "") ? fromLink.get("minBaths") : "");
  const [city, setCity] = useState(fromLink.get("city") ? fromLink.get("city").slice(0, 80) : initialCity);
  const [sortBy, setSortBy] = useState(["createdOnDesc", "listPriceDesc", "listPriceAsc", "sqftDesc"].includes(fromLink.get("sortBy")) ? fromLink.get("sortBy") : "");
  const [view, setView] = useState("map"); // default per request — applies to both /brokerage/listings and /brokerage/search, which share this component
  const [boundary, setBoundary] = useState(null); // drawn polygon, from IdxMap.jsx's Draw control

  void visitorState; // re-renders when the visitor signs in or saves a home
  const toggleFavorite = (mls) => {
    if (!visitorSite) return local.toggleFavorite(mls);
    const listing = (search.listings || []).find((l) => l.mlsNumber === mls) || { mlsNumber: mls };
    return visitorStore.toggleFavorite(listing);
  };

  const pinnedMlsNumbers = preview ? (brokerageSite?.site.featuredListingMlsNumbers || []).slice(0, 3) : [];
  const usePinned = pinnedMlsNumbers.length > 0;

  const price = PRICE_OPTIONS[priceIdx];
  // The filters as they are now (for "Save search"), and a saved search put back on the page.
  const currentParams = () => ({ city, minPrice: price.min, maxPrice: price.max, minBeds: beds, minBaths: baths, sortBy, map: boundary ? JSON.stringify(boundary) : "", office: officeOnly });
  const runSaved = (saved) => {
    const p = saved.params || {};
    const at = PRICE_OPTIONS.findIndex((o) => o.min === (p.minPrice || "") && o.max === (p.maxPrice || ""));
    setCity(p.city || "");
    setPriceIdx(at > 0 ? at : 0);
    setBeds(p.minBeds || "");
    setBaths(p.minBaths || "");
    setSortBy(p.sortBy || "");
    try { setBoundary(p.map ? JSON.parse(p.map) : null); } catch { setBoundary(null); }
  };
  const search = useRepliersListings(
    // null skips the fetch entirely once pinned listings already cover
    // this preview — see useRepliersListings.js.
    usePinned
      ? null
      : preview
        ? { resultsPerPage: previewCount, office: officeOnly, city: initialCity, org: orgSlug }
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
            org: orgSlug,
          },
  );
  const pinned = useFeaturedRepliersListings(pinnedMlsNumbers, orgSlug);

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
    <section id={sectionId} className="px-6 lg:px-10 py-24 bg-[var(--as-bg-alt)] border-y border-[var(--as-text)]/10">
      <div className="mx-auto max-w-7xl">
        <p className="text-xs font-medium tracked-wide uppercase text-[var(--as-accent)] mb-3">
          {eyebrowOverride || (officeOnly ? `${brokerageSite?.site?.brokerage?.name || "Our"}'s Listings` : "Home Search")}
        </p>
        <Heading className="text-3xl sm:text-4xl font-display font-semibold mb-10 text-[var(--as-text)]">
          {titleOverride ||
            (preview
              ? "Featured Homes For Sale"
              : officeOnly
                ? "Our Current Listings"
                : "Search Every Home For Sale")}
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
              <div className="flex flex-wrap items-center gap-3">
                {visitorSite && <VisitorBar site={visitorSite} getParams={currentParams} path={`${location.pathname}${location.search ? "" : ""}`} onRun={runSaved} />}
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
              // Side by side: results narrow to 2 columns (this pane is
              // only half the page), map stays visible the whole time so
              // a drawn boundary immediately updates the list beside it.
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 content-start order-2 md:order-1">
                  {listings.map((listing) => (
                    <IdxListingCard
                      key={listing.id}
                      listing={listing}
                      favorited={favorites.has(listing.mlsNumber)}
                      onToggleFavorite={toggleFavorite}
                    />
                  ))}
                </div>
                <div className="h-[500px] md:h-[720px] md:sticky md:top-24 overflow-hidden rounded-2xl border border-[var(--as-text)]/10 order-1 md:order-2">
                  <IdxMap listings={listings} onBoundaryChange={setBoundary} boundaryActive={!!boundary} center={brand?.mapCenter} />
                </div>
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

            {preview && viewAllHref && (
              <div className="mt-14 flex justify-center">
                <Link
                  to={viewAllHref}
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
