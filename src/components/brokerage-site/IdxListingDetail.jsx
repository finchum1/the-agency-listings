import { useParams, Navigate, Link } from "react-router-dom";
import { useRepliersListing } from "../../hooks/useRepliersListing";
import { useBrokerageSiteContext } from "../../context/BrokerageSiteContext";
import { formatPrice, STATUS_LABELS } from "../../lib/format";

// Single-listing page for a live MLS result, matching ContactCard.jsx's
// convention of mailto/tel only — there's no per-agent inbox to route an
// IDX lead to at the brokerage level, so no submission form here either.
export default function IdxListingDetail() {
  const { mlsNumber } = useParams();
  const { site } = useBrokerageSiteContext();
  const { listing, loading, notFound, error } = useRepliersListing(mlsNumber);

  if (loading) {
    return (
      <div className="px-6 lg:px-10 py-32 text-center text-[var(--as-text)]/50">
        Loading listing…
      </div>
    );
  }

  if (notFound) return <Navigate to="/404" replace />;

  if (error || !listing) {
    return (
      <div className="px-6 lg:px-10 py-32 text-center text-[var(--as-accent)]">
        {error || "Failed to load this listing."}
      </div>
    );
  }

  return (
    <div>
      <div className="relative h-[60vh] min-h-[400px] w-full bg-[var(--as-surface)]">
        {listing.hero_photo_url && (
          <img
            src={listing.hero_photo_url}
            alt={listing.address_line1}
            className="absolute inset-0 h-full w-full object-cover"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
        <div className="absolute bottom-0 left-0 w-full px-6 pb-10 text-white lg:px-10">
          <div className="mx-auto max-w-7xl">
            <span className="bg-[var(--as-dark)] text-[var(--as-on-dark)] px-3 py-1 text-[11px] uppercase tracked">
              {STATUS_LABELS[listing.status] || listing.status || "For Sale"}
            </span>
            <h1 className="mt-4 font-display text-3xl sm:text-4xl">{listing.address_line1}</h1>
            <p className="mt-1 text-white/80">
              {listing.city}, {listing.state} {listing.zip}
            </p>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6 py-16 lg:px-10">
        <div className="grid grid-cols-1 gap-16 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <p className="font-display text-3xl text-[var(--as-accent)]">{formatPrice(listing.price)}</p>
            <div className="mt-4 flex gap-8 border-y border-[var(--as-text)]/10 py-4 text-sm uppercase tracked text-[var(--as-text)]/60">
              <span>{listing.beds ?? "—"} Beds</span>
              <span>{listing.baths ?? "—"} Baths</span>
              <span>{listing.sqft?.toLocaleString() ?? "—"} Sq Ft</span>
            </div>
            {listing.description && (
              <>
                <h2 className="mt-8 font-display text-xl text-[var(--as-text)]">About This Home</h2>
                <p className="mt-4 leading-relaxed text-[var(--as-text)]/80">{listing.description}</p>
              </>
            )}

            {listing.photos.length > 1 && (
              <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {listing.photos.slice(1, 10).map((src) => (
                  <div key={src} className="aspect-[4/3] overflow-hidden bg-[var(--as-surface)]">
                    <img src={src} alt="" loading="lazy" className="h-full w-full object-cover" />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="border border-[var(--as-text)]/10 bg-[var(--as-bg-alt)] p-8">
            <h3 className="font-display text-xl text-[var(--as-text)]">Interested In This Home?</h3>
            <p className="mt-3 text-sm leading-relaxed text-[var(--as-text)]/70">
              Reach out to The Agency to schedule a private showing.
            </p>
            <div className="mt-6 flex flex-col gap-3">
              {site.contact.phone && (
                <a
                  href={`tel:${site.contact.phone}`}
                  className="text-center text-xs font-medium tracked-wide uppercase px-6 py-3 bg-[var(--as-accent)] text-white hover:opacity-90"
                >
                  {site.contact.phone}
                </a>
              )}
              {site.contact.email && (
                <a
                  href={`mailto:${site.contact.email}?subject=${encodeURIComponent(
                    `Interested in ${listing.address_line1}`,
                  )}`}
                  className="text-center text-xs font-medium tracked-wide uppercase px-6 py-3 border border-[var(--as-text)]/20 text-[var(--as-text)] hover:bg-[var(--as-text)] hover:text-[var(--as-bg)]"
                >
                  {site.contact.email}
                </a>
              )}
            </div>
            <p className="mt-6 text-[10px] uppercase tracked text-[var(--as-text)]/40">
              MLS# {listing.mlsNumber} · data provided by MLS
            </p>
          </div>
        </div>

        <div className="mt-16">
          <Link
            to="/brokerage/listings"
            className="text-xs font-medium tracked-wide uppercase text-[var(--as-text)] hover:underline"
          >
            &larr; Back to All Listings
          </Link>
        </div>
      </div>
    </div>
  );
}
