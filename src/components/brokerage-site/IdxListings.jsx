import { useState } from "react";
import { useRepliersListings } from "../../hooks/useRepliersListings";
import { formatPrice, STATUS_LABELS } from "../../lib/format";

const PRICE_OPTIONS = [
  { label: "Any Price", min: "", max: "" },
  { label: "Under $500k", min: "", max: "500000" },
  { label: "$500k – $1M", min: "500000", max: "1000000" },
  { label: "$1M – $2M", min: "1000000", max: "2000000" },
  { label: "$2M+", min: "2000000", max: "" },
];

const BEDS_OPTIONS = ["Any Beds", "3+", "4+", "5+"];

// Live MLS search for the Brokerage Site's /brokerage/listings page —
// first IDX integration built against Repliers (see IDX & Next.js
// Roadmap, Stage 1). Same visual language as AgentRoster.jsx/
// FeaturedListings.jsx (--as-* tokens), so it reads as part of the same
// site rather than a bolted-on widget.
export default function IdxListings({ isStandalonePage = false }) {
  const [priceIdx, setPriceIdx] = useState(0);
  const [beds, setBeds] = useState("");
  const [city, setCity] = useState("");

  const price = PRICE_OPTIONS[priceIdx];
  const { listings, meta, loading, error } = useRepliersListings({
    minPrice: price.min,
    maxPrice: price.max,
    minBeds: beds,
    city,
  });

  const Heading = isStandalonePage ? "h1" : "h2";

  return (
    <section id="listings" className="px-6 lg:px-10 py-24 bg-[var(--as-bg-alt)] border-y border-[var(--as-text)]/10">
      <div className="mx-auto max-w-7xl">
        <p className="text-xs font-medium tracked-wide uppercase text-[var(--as-accent)] mb-3">
          Current Listings
        </p>
        <Heading className="text-3xl sm:text-4xl font-display font-semibold mb-10 text-[var(--as-text)]">
          Search Homes For Sale
        </Heading>

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

        {loading && <p className="text-sm text-[var(--as-text)]/50">Searching listings…</p>}

        {!loading && error && (
          <p className="text-sm text-[var(--as-accent)]">
            {error} — confirm REPLIERS_API_KEY is set in Vercel and try again.
          </p>
        )}

        {!loading && !error && listings.length === 0 && (
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
            <p className="mt-10 text-xs text-[var(--as-text)]/40">
              {meta.count} listing{meta.count === 1 ? "" : "s"} · data provided by MLS, updated live
            </p>
          </>
        )}
      </div>
    </section>
  );
}
