import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { flushSync } from "react-dom";
import { useParams, Link } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { useListing } from "../../hooks/useListing";
import { supabase } from "../../lib/supabaseClient";
import { formatNumber } from "../../lib/format";
import { brandFromOrg } from "../../lib/brand";
import { FLYER_TEMPLATES, FlyerSheet } from "./flyer/templates";
import { listingUrl, taggedUrl } from "../../lib/listingAnalytics";


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

const PAGE_PX = 11 * 96; // a letter page at 96 css px per inch

function measureFit() {
  const sheet = document.getElementById("flyer-sheet");
  if (!sheet) return null;
  const overPx = Math.max(0, Math.round(sheet.getBoundingClientRect().height - PAGE_PX));
  const body = sheet.querySelector("[data-flyer-body]");
  const grow = sheet.querySelector("[data-flyer-grow]");
  const last = grow?.lastElementChild;
  const roomPx = body && last ? Math.max(0, Math.round(body.getBoundingClientRect().bottom - last.getBoundingClientRect().bottom)) : 0;
  return { overPx, roomPx };
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
  const { user, isAdmin } = useAuth();
  const { listing, agent, photos, loading, notFound } = useListing({ id });
  const brokerage = brandFromOrg(listing?.org);
  // Same reasoning as EditListingPage.jsx's noAccess guard — RLS lets
  // anyone read a published listing by id, so this blocks a non-owning
  // agent from opening another agent's flyer page directly by URL.
  const noAccess = listing && !isAdmin && listing.agent_id !== user?.id;

  const [headline, setHeadline] = useState("");
  const [blurb, setBlurb] = useState("");
  const [selectedIds, setSelectedIds] = useState([]);
  const [excludedFeatures, setExcludedFeatures] = useState([]);
  const [template, setTemplate] = useState("classic");
  // How the flyer sits on the page right now: overPx > 0 means it spills onto a second printed page; roomPx is the spare space
  // left for more text (see measureFit).
  const [fit, setFit] = useState(null);
  const [textInitialized, setTextInitialized] = useState(false);
  const [photosTouched, setPhotosTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");
  // The QR code is on by default; turning it off is only for the sheet being printed right now, not saved.
  const [includeQr, setIncludeQr] = useState(true);
  // Set only right before printing (see handlePrint) -- an inlined
  // data: URI version of the hero photo, so the printed output has zero
  // network dependency left to race against. Normal on-screen viewing
  // just uses heroPhoto.url directly; this stays null until the first
  // print.
  const [printHeroUrl, setPrintHeroUrl] = useState(null);

  // Measured after every render, since the text, features, photos and template all change the height. It looks at the real
  // laid-out sheet, so it stays right whatever the fonts or the template do.
  useLayoutEffect(() => {
    const next = measureFit();
    setFit((prev) => (prev && next && prev.overPx === next.overPx && prev.roomPx === next.roomPx ? prev : next));
  });
  useEffect(() => {
    // Web fonts can arrive after the first paint and change line breaks.
    document.fonts?.ready?.then(() => setFit(measureFit()));
  }, [template]);

  // Text/features init — a one-time gate is fine here since it doesn't
  // depend on an async photos fetch settling.
  useEffect(() => {
    if (loading || !listing || textInitialized) return;
    setHeadline(listing.flyer_headline || listing.address_line1);
    setBlurb(listing.flyer_blurb || listing.description?.[0] || "");
    setExcludedFeatures(listing.flyer_excluded_features || []);
    setTemplate(FLYER_TEMPLATES.some((t) => t.key === listing.flyer_template) ? listing.flyer_template : "classic");
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

  // Drop any inlined print copy from a previous hero photo the moment the
  // hero changes, so a later print can't silently reuse a stale image.
  useEffect(() => {
    setPrintHeroUrl(null);
  }, [heroPhoto?.url]);

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

  // Cuts the blurb to the most that fits on one page, at a sentence end when one is close, otherwise at a word. It measures the real
  // sheet after each try (binary search), so it's right for whichever template and however many features or photos there are.
  const trimToFit = () => {
    let lo = 0;
    let hi = blurb.length;
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2);
      flushSync(() => setBlurb(blurb.slice(0, mid)));
      if ((measureFit()?.overPx ?? 0) === 0) lo = mid;
      else hi = mid - 1;
    }
    let cut = blurb.slice(0, lo);
    const sentence = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("! "), cut.lastIndexOf("? "));
    if (sentence > lo * 0.6) cut = cut.slice(0, sentence + 1);
    else if (lo < blurb.length) cut = cut.replace(/\s+\S*$/, "");
    flushSync(() => setBlurb(cut.trim()));
    setSaved(false);
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveError("");
    const { error } = await supabase
      .from("listings")
      .update({
        flyer_headline: headline,
        flyer_blurb: blurb,
        flyer_photo_ids: selectedIds,
        flyer_excluded_features: excludedFeatures,
        flyer_template: template,
      })
      .eq("id", id);
    setSaving(false);
    if (error) {
      console.error("Flyer save failed:", error);
      setSaveError(error.message);
      return;
    }
    // No refresh() here on purpose: local state already holds exactly
    // what was just persisted, so re-fetching immediately adds nothing —
    // and it used to actively cause a real bug, racing against the
    // refresh useListing's own realtime subscription fires in reaction
    // to this same update.
    setSaved(true);
  };

  const inputClass =
    "w-full rounded-lg border border-black/10 dark:border-white/15 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#ed2127]/40 dark:focus:ring-[#f2454b]/40";
  const labelClass = "block text-xs font-medium text-[#1c1a17]/60 dark:text-[#faf9f7]/60 mb-1.5";

  // Only the very first load shows this — NOT a refresh triggered by
  // Save (handleSave calls refresh() itself, and saving also fires the
  // realtime subscription in useListing, both flipping `loading` true
  // again). Unmounting the whole flyer preview on every save was a real
  // bug: the hero photo (and everything else) would flash blank while
  // the refresh was in flight, easy to mistake for "didn't save."
  if (loading && !listing) return <p className="text-sm text-[#1c1a17]/50 dark:text-[#faf9f7]/50">Loading…</p>;
  if (notFound || !listing || noAccess) {
    return (
      <div>
        <p className="text-sm text-[#1c1a17]/60 dark:text-[#faf9f7]/60 mb-4">Listing not found, or you don't have access to it.</p>
        <Link to="/dashboard/listings" className="text-sm text-[#ed2127] dark:text-[#f2454b] hover:underline">
          ← Back to listings
        </Link>
      </div>
    );
  }

  // The code opens the listing's own website, tagged so every scan shows up as "Flyer / QR code" in its analytics. A draft has
  // no public page yet, so there's nothing to scan.
  const qrUrl = listing.status === "draft" ? "" : taggedUrl(listingUrl(listing), "flyer");

  const tpl = FLYER_TEMPLATES.find((t) => t.key === template) || FLYER_TEMPLATES[0];

  const f = {
    beds: listing.beds ?? "—",
    baths: listing.baths ?? "—",
    sqft: formatNumber(listing.sqft),
    lot: listing.lot_size || "—",
    year: listing.year_built || "—",
  };

  // window.print() rasterizes whatever's already painted right now -- it
  // doesn't wait for images. Confirmed live, across two prior attempts
  // (waiting for decode(), then switching the hero photo from an <img>
  // to a CSS background-image with print-color-adjust: exact) that the
  // remaining failure is the print/PDF rasterizer not reliably waiting
  // for a background-image's own network fetch to finish before it
  // captures the page -- worked in on-screen preview, still blank/solid
  // in the actual printed output, in both Chrome and Safari. Removing
  // the network dependency entirely is the only fix that can't race:
  // fetch the hero photo and inline it as a data: URI (bytes already in
  // the page, nothing left to wait on) right before printing, flushed
  // synchronously so the DOM has it painted before window.print() runs
  // on the next line.
  const handlePrint = async () => {
    if (fit?.overPx > 0 && !confirm("This flyer is longer than one page, so the footer will print on a second page. Print anyway?")) return;
    if (heroPhoto?.url) {
      try {
        const res = await fetch(heroPhoto.url);
        const blob = await res.blob();
        const dataUrl = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(blob);
        });
        flushSync(() => setPrintHeroUrl(dataUrl));
      } catch {
        // Couldn't inline it (network hiccup, a storage CORS quirk,
        // etc.) -- still let the user print rather than silently doing
        // nothing; they'll get the same remote-URL behavior as before.
      }
    }
    window.print();
  };

  return (
    <div>
      <div className="no-print max-w-3xl mb-10 space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-display font-semibold">Flyer</h1>
            <p className="text-sm text-[#1c1a17]/60 dark:text-[#faf9f7]/60 mt-1">{listing.address_line1}</p>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/dashboard/listings" className="text-sm text-[#1c1a17]/60 dark:text-[#faf9f7]/60 hover:text-[#1c1a17] dark:hover:text-[#faf9f7]">
              ← All listings
            </Link>
            <Link to={`/dashboard/listings/${id}/edit`} className="text-sm text-[#1c1a17]/60 dark:text-[#faf9f7]/60 hover:text-[#1c1a17] dark:hover:text-[#faf9f7]">
              ← Back to listing
            </Link>
            <button
              type="button"
              onClick={handlePrint}
              className="rounded-full bg-[#1c1a17] dark:bg-[#f2454b] text-white text-sm font-semibold px-5 py-2.5 hover:bg-[#1c1a17]/90 dark:hover:bg-[#f2454b]/90 transition-colors"
            >
              Print / Save as PDF
            </button>
          </div>
        </div>

        <div className="bg-white dark:bg-[#1a1a1a] border border-black/5 dark:border-white/10 rounded-2xl p-6 space-y-5">
          <div>
            <label className={labelClass}>Template</label>
            <div className="grid sm:grid-cols-2 gap-2" role="radiogroup" aria-label="Flyer template">
              {FLYER_TEMPLATES.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  role="radio"
                  aria-checked={template === t.key}
                  onClick={() => {
                    setSaved(false);
                    setTemplate(t.key);
                  }}
                  className={`text-left rounded-xl border-2 p-3 transition-colors ${template === t.key ? "border-[#ed2127] dark:border-[#f2454b] bg-[#ed2127]/[0.04]" : "border-black/10 dark:border-white/15 hover:border-black/25 dark:hover:border-white/30"}`}
                >
                  <span className="block text-sm font-semibold">{t.label}</span>
                  <span className="block text-xs text-[#1c1a17]/55 dark:text-[#faf9f7]/55 mt-0.5">{t.hint}</span>
                </button>
              ))}
            </div>
          </div>
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
            {fit?.overPx > 0 && blurb.length > 0 && (
              <button type="button" onClick={trimToFit} className="mt-2 rounded-full border border-red-600/40 dark:border-red-400/40 text-red-600 dark:text-red-400 text-xs font-semibold px-3 py-1.5 hover:bg-red-600/5">
                Trim the blurb to fit one page
              </button>
            )}
            {fit && (
              <p className={`mt-1.5 text-xs ${fit.overPx > 0 ? "text-red-600 dark:text-red-400 font-medium" : "text-[#1c1a17]/50 dark:text-[#faf9f7]/50"}`}>
                {blurb.length.toLocaleString()} characters ·{" "}
                {fit.overPx > 0
                  ? `Too long: this flyer runs about ${Math.ceil(fit.overPx / tpl.lineHeight)} line${Math.ceil(fit.overPx / tpl.lineHeight) === 1 ? "" : "s"} onto a second page. Shorten the blurb by about ${((Math.ceil(fit.overPx / tpl.lineHeight) + 1) * tpl.lineChars).toLocaleString()} characters, or uncheck some features or photos.`
                  : `Fits on one page, with room for about ${(Math.floor(fit.roomPx / tpl.lineHeight) * Math.round(tpl.lineChars * 0.85)).toLocaleString()} more characters.`}
              </p>
            )}
          </div>
          <div>
            <label className={labelClass}>
              Photos on the flyer ({selectedIds.length}/{MAX_FLYER_PHOTOS}) — first picked is the hero{template === "editorial" ? "; this layout shows the hero plus the next three" : ""}
            </label>
            {photos.length === 0 ? (
              <p className="text-sm text-[#1c1a17]/40 dark:text-[#faf9f7]/40">Add photos to this listing first.</p>
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
                        idx !== -1 ? "border-[#ed2127] dark:border-[#f2454b]" : "border-transparent"
                      }`}
                    >
                      <img src={photo.url} alt="" className="w-full h-full object-cover" />
                      {idx !== -1 && (
                        <span className="absolute top-1 left-1 h-5 w-5 rounded-full bg-[#ed2127] text-white text-[10px] font-semibold flex items-center justify-center">
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
                    <p className="text-xs font-semibold text-[#1c1a17]/70 dark:text-[#faf9f7]/70 mb-1.5">{group.category}</p>
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
                              className="accent-[#ed2127] dark:accent-[#f2454b]"
                            />
                            <span className={included ? "text-[#1c1a17] dark:text-[#faf9f7]" : "text-[#1c1a17]/35 dark:text-[#faf9f7]/35 line-through"}>
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

          <div>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={includeQr && Boolean(qrUrl)} disabled={!qrUrl} onChange={(e) => setIncludeQr(e.target.checked)} className="accent-[#ed2127] dark:accent-[#f2454b]" />
              Include a QR code to the listing website
            </label>
            <p className="mt-1 text-xs text-[#1c1a17]/50 dark:text-[#faf9f7]/50">
              {qrUrl ? (
                <>
                  Opens <span className="font-mono">{qrUrl}</span>. Scans are counted as “Flyer / QR code” in this listing's analytics.
                </>
              ) : (
                "Available once the listing is published, since a draft has no public website to scan to."
              )}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="rounded-full bg-[#1c1a17] dark:bg-[#f2454b] text-white text-sm font-semibold px-6 py-2.5 hover:bg-[#1c1a17]/90 dark:hover:bg-[#f2454b]/90 transition-colors disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save Flyer Content"}
            </button>
            {saved && <p className="text-sm text-emerald-700 dark:text-emerald-400">Saved.</p>}
            {saveError && <p className="text-sm text-red-600 dark:text-red-400">Couldn't save: {saveError}</p>}
          </div>
        </div>
      </div>

      <FlyerSheet
        template={template}
        listing={listing}
        agent={agent}
        brokerage={brokerage}
        headline={headline}
        blurb={blurb}
        heroPhoto={heroPhoto}
        printHeroUrl={printHeroUrl}
        galleryPhotos={galleryPhotos}
        includedFeatures={includedFeatures}
        f={f}
        qrUrl={qrUrl}
        includeQr={includeQr}
      />
    </div>
  );
}
