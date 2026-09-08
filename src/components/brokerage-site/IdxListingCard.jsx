import { useState } from "react";
import { formatPrice, STATUS_LABELS } from "../../lib/format";

function HeartIcon({ filled }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 21s-6.7-4.35-9.33-8.24C.9 10.06 1.6 6.6 4.6 5.1c2.2-1.1 4.7-.4 6.1 1.4l1.3 1.7 1.3-1.7c1.4-1.8 3.9-2.5 6.1-1.4 3 1.5 3.7 4.96 1.93 7.66C18.7 16.65 12 21 12 21z"
      />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z" />
    </svg>
  );
}

// Grid card for IdxListings.jsx's list pane — hero photo with "Courtesy
// of ___" attribution overlay (an IDX display requirement most boards
// have, not decoration — see api/_lib/repliers.js's officeName field),
// favorite/share icon buttons, and an MLS# badge, matching the reference
// screenshot Terrence supplied.
export default function IdxListingCard({ listing, favorited, onToggleFavorite }) {
  const [copied, setCopied] = useState(false);

  const share = (e) => {
    e.preventDefault();
    const url = `${window.location.origin}/brokerage/listings/${listing.mlsNumber}`;
    navigator.clipboard?.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <a href={`/brokerage/listings/${listing.mlsNumber}`} className="group block">
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

        <div className="absolute top-3 right-3 flex gap-2">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              onToggleFavorite(listing.mlsNumber);
            }}
            aria-label={favorited ? "Remove from favorites" : "Save to favorites"}
            aria-pressed={favorited}
            className={`flex h-8 w-8 items-center justify-center rounded-full bg-black/45 backdrop-blur-sm transition-colors hover:bg-black/65 ${
              favorited ? "text-[var(--as-accent)]" : "text-white"
            }`}
          >
            <HeartIcon filled={favorited} />
          </button>
          <button
            type="button"
            onClick={share}
            aria-label="Copy link to this listing"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-sm transition-colors hover:bg-black/65"
          >
            <ShareIcon />
          </button>
        </div>

        {copied && (
          <span className="absolute top-14 right-3 rounded bg-black/75 px-2 py-1 text-[10px] font-medium text-white">
            Link copied
          </span>
        )}

        {listing.officeName && (
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-3 pb-2 pt-6">
            <p className="text-[11px] text-white/90">Courtesy of {listing.officeName}</p>
          </div>
        )}
      </div>

      <div className="mt-4 flex items-start justify-between gap-2">
        <p className="font-display text-lg text-[var(--as-accent)]">{formatPrice(listing.price)}</p>
        <span className="shrink-0 rounded border border-[var(--as-text)]/15 px-1.5 py-0.5 text-[9px] uppercase tracked text-[var(--as-text)]/40">
          MLS# {listing.mlsNumber}
        </span>
      </div>
      <p className="text-sm text-[var(--as-text)]/60">
        {listing.city}, {listing.state} {listing.zip}
      </p>
      <p className="mt-1 text-sm text-[var(--as-text)]/50">
        {listing.beds ?? "—"} bd | {listing.baths ?? "—"} ba | {listing.sqft?.toLocaleString() ?? "—"} sqft
      </p>
      <p className="text-[var(--as-text)]">{listing.address_line1}</p>
    </a>
  );
}
