import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useRepliersListing } from "../../hooks/useRepliersListing";
import { DEFAULT_ORG_SLUG } from "../../lib/brand";
import { isAppHost } from "../../lib/appHosts";
import { formatNumber, formatPrice } from "../../lib/format";
import { isSampleListing } from "../../lib/idxSample";

const muted = "text-[#1c1a17]/60 dark:text-[#faf9f7]/60";
const quietBtn = "rounded-full border border-black/10 dark:border-white/15 px-3.5 py-2 text-xs font-semibold hover:bg-black/[0.04] dark:hover:bg-white/[0.06]";

/** The public page of this home, when there is one: the brokerage site lives on the app host for the default office and on the office's own domain otherwise. */
function publicLink(slug, mls) {
  if (typeof window === "undefined") return "";
  const host = window.location.hostname;
  if (isAppHost(host) && slug !== DEFAULT_ORG_SLUG) return ""; // the app host's public pages belong to the default office
  return `${window.location.origin}/brokerage/listings/${encodeURIComponent(mls)}`;
}

function Fact({ label, value }) {
  return (
    <div className="rounded-xl border border-black/10 dark:border-white/15 px-3 py-2">
      <p className={`text-[11px] uppercase tracking-wide ${muted}`}>{label}</p>
      <p className="text-sm font-semibold">{value}</p>
    </div>
  );
}

// The side panel for one MLS listing: photos, the facts, the description and the ways to hand it to a client.
// The search result is shown straight away; the full listing (more photos, the whole description) fills in when it arrives.
export default function HomeSearchPanel({ listing: summary, slug, brand, onClose }) {
  const { listing: full } = useRepliersListing(summary.mlsNumber, slug);
  const listing = useMemo(() => ({ ...summary, ...(full || {}) }), [summary, full]);
  const photos = listing.photos?.length ? listing.photos : listing.hero_photo_url ? [listing.hero_photo_url] : [];
  const [shot, setShot] = useState(0);
  const [copied, setCopied] = useState("");
  const link = publicLink(slug, listing.mlsNumber);

  useEffect(() => setShot(0), [summary.mlsNumber]);
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const address = [listing.address_line1, listing.city, [listing.state, listing.zip].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  const facts = [listing.beds != null && `${listing.beds} bed`, listing.baths != null && `${listing.baths} bath`, listing.sqft && `${formatNumber(listing.sqft)} sqft`].filter(Boolean).join(", ");
  const blurb = [`${address}`, `${formatPrice(listing.price)}${facts ? `, ${facts}` : ""}`, `MLS# ${listing.mlsNumber}`, link].filter(Boolean).join("\n");
  const subject = `A home to look at: ${listing.address_line1 || address}`;

  const copy = async (key, text) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    setCopied(key);
    setTimeout(() => setCopied((c) => (c === key ? "" : c)), 1800);
  };

  return createPortal(
    <div className="fixed inset-0 z-[80] flex justify-end bg-black/40" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <aside role="dialog" aria-label={`Listing ${listing.mlsNumber}`} className="h-full w-full max-w-xl overflow-y-auto bg-white dark:bg-[#1c1c1c] text-[#1c1a17] dark:text-[#faf9f7] shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-black/10 dark:border-white/10 bg-white/95 dark:bg-[#1c1c1c]/95 px-5 py-3 backdrop-blur">
          <p className={`text-xs ${muted}`}>MLS# {listing.mlsNumber}</p>
          <button type="button" onClick={onClose} aria-label="Close" className="p-1 text-[#1c1a17]/50 dark:text-[#faf9f7]/50">
            ✕
          </button>
        </div>

        {photos.length > 0 && (
          <div>
            <div className="relative aspect-[4/3] bg-black/[0.06] dark:bg-white/[0.06]">
              <img src={photos[shot]} alt={`Photo ${shot + 1} of ${photos.length}`} className="h-full w-full object-cover" />
              {photos.length > 1 && (
                <>
                  <button type="button" aria-label="Previous photo" onClick={() => setShot((i) => (i - 1 + photos.length) % photos.length)} className="absolute left-3 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-black/50 text-white">
                    ‹
                  </button>
                  <button type="button" aria-label="Next photo" onClick={() => setShot((i) => (i + 1) % photos.length)} className="absolute right-3 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-black/50 text-white">
                    ›
                  </button>
                  <span className="absolute bottom-3 right-3 rounded-full bg-black/55 px-2.5 py-1 text-[11px] text-white">
                    {shot + 1} / {photos.length}
                  </span>
                </>
              )}
            </div>
            {photos.length > 1 && (
              <div className="flex gap-1.5 overflow-x-auto px-5 py-2.5">
                {photos.slice(0, 24).map((src, i) => (
                  <button key={src + i} type="button" onClick={() => setShot(i)} aria-label={`Show photo ${i + 1}`} className={`h-14 w-20 shrink-0 overflow-hidden rounded-lg border-2 ${i === shot ? "border-[#D8091B] dark:border-[#f2454b]" : "border-transparent"}`}>
                    <img src={src} alt="" loading="lazy" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="space-y-5 p-5">
          <div>
            <p className="font-display text-3xl font-semibold">{formatPrice(listing.price)}</p>
            <h2 className="mt-1 text-lg">{listing.address_line1 || "Address on request"}</h2>
            <p className={`text-sm ${muted}`}>{[listing.city, [listing.state, listing.zip].filter(Boolean).join(" ")].filter(Boolean).join(", ")}</p>
          </div>

          {isSampleListing(listing) && (
            <p role="status" className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3.5 py-2.5 text-xs">
              Sample home from the test feed. It is not a real listing.
            </p>
          )}

          <div className="grid grid-cols-3 gap-2">
            <Fact label="Beds" value={listing.beds ?? "—"} />
            <Fact label="Baths" value={listing.baths ?? "—"} />
            <Fact label="Sq ft" value={listing.sqft ? formatNumber(listing.sqft) : "—"} />
            {listing.sqft && listing.price ? <Fact label="Per sq ft" value={formatPrice(Math.round(listing.price / listing.sqft))} /> : null}
            {listing.propertyType ? <Fact label="Type" value={listing.propertyType} /> : null}
          </div>

          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => copy("msg", blurb)} className="rounded-full bg-[#1c1a17] dark:bg-[#f2454b] text-white text-sm font-semibold px-5 py-2.5">
              {copied === "msg" ? "Copied" : "Copy to send a client"}
            </button>
            <a href={`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(blurb)}`} className={`${quietBtn} inline-flex items-center`}>
              Email it
            </a>
            <button type="button" onClick={() => copy("mls", String(listing.mlsNumber))} className={quietBtn}>
              {copied === "mls" ? "Copied" : "Copy MLS #"}
            </button>
            {link && (
              <a href={link} target="_blank" rel="noreferrer" className={`${quietBtn} inline-flex items-center`}>
                Public page
              </a>
            )}
          </div>

          {listing.description && <p className="whitespace-pre-line text-sm leading-relaxed">{listing.description}</p>}

          {listing.officeName && <p className={`text-xs ${muted}`}>Courtesy of {listing.officeName}</p>}
          {brand?.disclaimer && <p className={`text-[11px] leading-relaxed ${muted}`}>{brand.disclaimer}</p>}
        </div>
      </aside>
    </div>,
    document.body,
  );
}
