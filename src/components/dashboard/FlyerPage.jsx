import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useListing } from "../../hooks/useListing";
import { supabase } from "../../lib/supabaseClient";
import { formatPrice, formatNumber, STATUS_LABELS } from "../../lib/format";
import brokerage from "../../lib/brokerage";

const STAT_ICONS = {
  beds: <path d="M3 18v-6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6M3 18v2M21 18v2M3 12V9a2 2 0 0 1 2-2h3v5M9 7h6" />,
  baths: <path d="M4 12h16M6 12V6a2 2 0 0 1 2-2h1M6 12v6a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-6M9 18v2M15 18v2" />,
  sqft: <path d="M4 4h7v7H4zM13 13h7v7h-7zM4 20h4M20 4h-4" />,
  lot: <path d="M4 20 20 4M4 4h6M4 4v6M14 20h6M20 20v-6" />,
  year: <path d="M4 10h16M7 3v4M17 3v4M5 6h14a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Z" />,
};

const MAX_FLYER_PHOTOS = 6;

// "{category}|||{item}" — a stable key for one feature-list line, so
// toggling it on/off for the flyer never has to touch the listing's real
// features data (listings.features), just the flyer's own exclude-list.
const featureKey = (category, item) => `${category}|||${item}`;

// Default photo order for a listing whose flyer has never been
// configured: the marked hero photo first (matching what a visitor sees
// as the hero on the real listing site), then the rest by their existing
// sort order.
function defaultPhotoIds(photos) {
  const hero = photos.find((p) => p.is_hero);
  const rest = photos.filter((p) => !hero || p.id !== hero.id);
  return [...(hero ? [hero] : []), ...rest].slice(0, MAX_FLYER_PHOTOS).map((p) => p.id);
}

// Printable 8.5x11 listing flyer — echoes the public listing site's look
// (same fonts/colors/photo treatment) but is its own page, not a reuse of
// listing-site/* components, since a print sheet needs fixed inch
// dimensions and a completely different layout (one page, no scroll
// sections) rather than anything those components already do. "Edit"
// means picking a punchier headline/blurb, which photos appear, and
// which features appear — stored on the listing
// (flyer_headline/flyer_blurb/flyer_photo_ids/flyer_excluded_features,
// see supabase/flyer-fields.sql + flyer-features-field.sql), separate
// from the real web copy so editing one never touches the other.
// Printing is the browser's own Print dialog (Save as PDF) via the
// .no-print / #flyer-sheet rules in index.css — no PDF library, so what
// you see here is exactly what prints.
export default function FlyerPage() {
  const { id } = useParams();
  const { listing, agent, photos, loading, notFound, refresh } = useListing({ id });

  const [headline, setHeadline] = useState("");
  const [blurb, setBlurb] = useState("");
  const [selectedIds, setSelectedIds] = useState([]);
  const [excludedFeatures, setExcludedFeatures] = useState([]);
  const [textInitialized, setTextInitialized] = useState(false);
  const [photosTouched, setPhotosTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Text/features init — a one-time gate is fine here since it doesn't
  // depend on an async photos fetch settling.
  useEffect(() => {
    if (loading || !listing || textInitialized) return;
    setHeadline(listing.flyer_headline || listing.address_line1);
    setBlurb(listing.flyer_blurb || listing.description?.[0] || "");
    setExcludedFeatures(listing.flyer_excluded_features || []);
    setTextInitialized(true);
  }, [loading, listing, textInitialized]);

  // Photo selection — deliberately NOT a one-time gate like the effect
  // above. It keeps re-syncing from the saved/default selection on every
  // `photos` update until the agent actually touches a photo themselves
  // (photosTouched, set only inside togglePhoto) — otherwise a listing
  // whose photos hadn't finished loading yet on the very first render
  // would get permanently stuck with an empty selection, which is
  // exactly what "hero photo not populating" looked like. Also falls
  // back to defaults if every *saved* id turns out stale (e.g. from
  // before this fix existed) instead of only checking the raw array's
  // length before filtering.
  useEffect(() => {
    if (loading || !listing || photosTouched || photos.length === 0) return;
    const savedIds = (listing.flyer_photo_ids || []).filter((pid) => photos.some((p) => p.id === pid));
    setSelectedIds(savedIds.length > 0 ? savedIds : defaultPhotoIds(photos));
  }, [loading, listing, photos, photosTouched]);

  const orderedSelected = useMemo(
    () => selectedIds.map((pid) => photos.find((p) => p.id === pid)).filter(Boolean),
    [selectedIds, photos],
  );
  const heroPhoto = orderedSelected[0] || photos.find((p) => p.is_hero) || photos[0];
  const galleryPhotos = orderedSelected.slice(1);

  const includedFeatures = useMemo(
    () =>
      (listing?.features || []).flatMap((group) =>
        group.items
          .filter((item) => !excludedFeatures.includes(featureKey(group.category, item)))
          .map((item) => item),
      ),
    [listing?.features, excludedFeatures],
  );

  const togglePhoto = (photoId) => {
    setSaved(false);
    setPhotosTouched(true);
    setSelectedIds((ids) =>
      ids.includes(photoId) ? ids.filter((i) => i !== photoId) : [...ids, photoId].slice(0, MAX_FLYER_PHOTOS),
    );
  };

  const toggleFeature = (key) => {
    setSaved(false);
    setExcludedFeatures((keys) => (keys.includes(key) ? keys.filter((k) => k !== key) : [...keys, key]));
  };

  const handleSave = async () => {
    setSaving(true);
    await supabase
      .from("listings")
      .update({
        flyer_headline: headline,
        flyer_blurb: blurb,
        flyer_photo_ids: selectedIds,
        flyer_excluded_features: excludedFeatures,
      })
      .eq("id", id);
    setSaving(false);
    setSaved(true);
    refresh();
  };

  const inputClass =
    "w-full rounded-lg border border-black/10 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#8a7a5c]/40";
  const labelClass = "block text-xs font-medium text-[#1c1a17]/60 mb-1.5";

  // Only the very first load shows this — NOT a refresh triggered by
  // Save (handleSave calls refresh() itself, and saving also fires the
  // realtime subscription in useListing, both flipping `loading` true
  // again). Unmounting the whole flyer preview on every save was a real
  // bug: the hero photo (and everything else) would flash blank while
  // the refresh was in flight, easy to mistake for "didn't save."
  if (loading && !listing) return <p className="text-sm text-[#1c1a17]/50">Loading…</p>;
  if (notFound || !listing) {
    return (
      <div>
        <p className="text-sm text-[#1c1a17]/60 mb-4">Listing not found, or you don't have access to it.</p>
        <Link to="/dashboard" className="text-sm text-[#8a7a5c] hover:underline">
          ← Back to listings
        </Link>
      </div>
    );
  }

  const f = {
    beds: listing.beds ?? "—",
    baths: listing.baths ?? "—",
    sqft: formatNumber(listing.sqft),
    lot: listing.lot_size || "—",
    year: listing.year_built || "—",
  };

  return (
    <div>
      <div className="no-print max-w-3xl mb-10 space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-display font-semibold">Flyer</h1>
            <p className="text-sm text-[#1c1a17]/60 mt-1">{listing.address_line1}</p>
          </div>
          <div className="flex items-center gap-4">
            <Link to={`/dashboard/listings/${id}/edit`} className="text-sm text-[#1c1a17]/60 hover:text-[#1c1a17]">
              ← Back to listing
            </Link>
            <button
              type="button"
              onClick={() => window.print()}
              className="rounded-full bg-[#1c1a17] text-white text-sm font-semibold px-5 py-2.5 hover:bg-[#1c1a17]/90 transition-colors"
            >
              Print / Save as PDF
            </button>
          </div>
        </div>

        <div className="bg-white border border-black/5 rounded-2xl p-6 space-y-5">
          <div>
            <label className={labelClass}>Flyer headline</label>
            <input
              value={headline}
              onChange={(e) => {
                setSaved(false);
                setHeadline(e.target.value);
              }}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Flyer blurb</label>
            <textarea
              rows={3}
              value={blurb}
              onChange={(e) => {
                setSaved(false);
                setBlurb(e.target.value);
              }}
              className={inputClass}
              placeholder="A short, punchy line or two — this can be tighter than the full web description."
            />
          </div>
          <div>
            <label className={labelClass}>
              Photos on the flyer ({selectedIds.length}/{MAX_FLYER_PHOTOS}) — first picked is the hero
            </label>
            {photos.length === 0 ? (
              <p className="text-sm text-[#1c1a17]/40">Add photos to this listing first.</p>
            ) : (
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                {photos.map((photo) => {
                  const idx = selectedIds.indexOf(photo.id);
                  return (
                    <button
                      key={photo.id}
                      type="button"
                      onClick={() => togglePhoto(photo.id)}
                      className={`relative rounded-lg overflow-hidden border-2 aspect-square ${
                        idx !== -1 ? "border-[#8a7a5c]" : "border-transparent"
                      }`}
                    >
                      <img src={photo.url} alt="" className="w-full h-full object-cover" />
                      {idx !== -1 && (
                        <span className="absolute top-1 left-1 h-5 w-5 rounded-full bg-[#8a7a5c] text-white text-[10px] font-semibold flex items-center justify-center">
                          {idx + 1}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {listing.features?.length > 0 && (
            <div>
              <label className={labelClass}>Features on the flyer — uncheck any to remove them</label>
              <div className="space-y-3">
                {listing.features.map((group) => (
                  <div key={group.category}>
                    <p className="text-xs font-semibold text-[#1c1a17]/70 mb-1.5">{group.category}</p>
                    <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                      {group.items.map((item) => {
                        const key = featureKey(group.category, item);
                        const included = !excludedFeatures.includes(key);
                        return (
                          <label key={key} className="flex items-center gap-1.5 text-sm cursor-pointer">
                            <input
                              type="checkbox"
                              checked={included}
                              onChange={() => toggleFeature(key)}
                              className="accent-[#8a7a5c]"
                            />
                            <span className={included ? "text-[#1c1a17]" : "text-[#1c1a17]/35 line-through"}>
                              {item}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="rounded-full bg-[#1c1a17] text-white text-sm font-semibold px-6 py-2.5 hover:bg-[#1c1a17]/90 transition-colors disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save Flyer Content"}
            </button>
            {saved && <p className="text-sm text-emerald-700">Saved.</p>}
          </div>
        </div>
      </div>

      {/* The actual flyer — the only thing that prints, see index.css.
          Flex column, not fixed-height absolute blocks: the footer always
          sits right after the content instead of being pinned to the
          bottom of whatever ancestor happens to be positioned (the bug
          this replaced), and if the content ever runs long the sheet
          just grows/overflows onto a second printed page instead of
          silently overlapping. */}
      <div
        id="flyer-sheet"
        className="relative mx-auto flex flex-col bg-[#faf9f7] text-[#1c1a17] overflow-hidden shadow-xl shadow-black/10"
        style={{ width: "8.5in", minHeight: "11in" }}
      >
        <div className="relative h-[4.2in] w-full shrink-0">
          {heroPhoto ? (
            <img src={heroPhoto.url} alt="" className="absolute inset-0 h-full w-full object-cover" />
          ) : (
            <div className="absolute inset-0 bg-[#1c1a17]" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
          <div className="absolute top-5 left-5 right-5 flex items-center justify-between">
            <span className="inline-flex items-center rounded-full bg-white/95 px-3 py-1 text-[10px] font-semibold tracking-wider-plus uppercase text-[#1c1a17]">
              {STATUS_LABELS[listing.status] || listing.status}
            </span>
            <img src={brokerage.logo} alt={brokerage.name} className="h-7 w-auto" />
          </div>
          <div className="absolute bottom-5 left-5 right-5">
            <h1 className="text-white text-3xl font-display font-semibold leading-tight">{headline}</h1>
            <p className="text-white/85 text-sm mt-1 tracking-wide">
              {listing.city}, {listing.state} {listing.zip}
            </p>
          </div>
        </div>

        <div className="px-6 pt-5 flex-1">
          <div className="flex items-center justify-between">
            <span className="text-2xl font-display font-semibold text-[#1c1a17]">
              {formatPrice(listing.price)}
            </span>
            {listing.mls_number && (
              <span className="text-[10px] tracking-wider-plus uppercase text-[#1c1a17]/40">
                MLS# {listing.mls_number}
              </span>
            )}
          </div>

          <div className="mt-4 bg-white rounded-xl shadow-sm shadow-black/5 grid grid-cols-5 divide-x divide-black/5">
            {[
              { key: "beds", label: "Beds", value: f.beds },
              { key: "baths", label: "Baths", value: f.baths },
              { key: "sqft", label: "Sq Ft", value: f.sqft },
              { key: "lot", label: "Lot", value: f.lot },
              { key: "year", label: "Built", value: f.year },
            ].map((s) => (
              <div key={s.key} className="flex flex-col items-center justify-center gap-1 py-3 px-1 text-center">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8a7a5c" strokeWidth="1.6">
                  {STAT_ICONS[s.key]}
                </svg>
                <span className="text-sm font-semibold text-[#1c1a17]">{s.value}</span>
                <span className="text-[9px] uppercase tracking-wider-plus text-[#1c1a17]/50">{s.label}</span>
              </div>
            ))}
          </div>

          {blurb && <p className="mt-4 text-[13px] leading-relaxed text-[#1c1a17]/75">{blurb}</p>}

          {includedFeatures.length > 0 && (
            <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1">
              {includedFeatures.map((item, i) => (
                <div key={i} className="flex items-center gap-1.5 text-[11px] text-[#1c1a17]/75">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#8a7a5c" strokeWidth="2.5" className="shrink-0">
                    <path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span className="truncate">{item}</span>
                </div>
              ))}
            </div>
          )}

          {galleryPhotos.length > 0 && (
            <div className="mt-4 grid grid-cols-5 gap-2">
              {galleryPhotos.map((photo) => (
                <div key={photo.id} className="aspect-square rounded-lg overflow-hidden bg-black/5">
                  <img src={photo.url} alt="" className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="shrink-0 px-6 py-4 bg-white border-t border-black/5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {agent?.photo_url && (
              <img src={agent.photo_url} alt="" className="h-11 w-11 rounded-full object-cover bg-black/5" />
            )}
            <div>
              <p className="text-sm font-semibold text-[#1c1a17]">{agent?.full_name}</p>
              <p className="text-[11px] text-[#1c1a17]/60">
                {agent?.phone}
                {agent?.phone && agent?.email ? " · " : ""}
                {agent?.email}
              </p>
              {agent?.license && <p className="text-[10px] text-[#1c1a17]/40">{agent.license}</p>}
            </div>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-[#1c1a17]/50">
              {brokerage.address.line1}, {brokerage.address.city}, {brokerage.address.state}{" "}
              {brokerage.address.zip}
            </p>
            <p className="text-[9px] text-[#1c1a17]/35 mt-0.5 max-w-[3in] ml-auto">{brokerage.disclaimer}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
