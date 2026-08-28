import { useState } from "react";
import { supabase } from "../../lib/supabaseClient";

// Picks and orders the curated photo subset the Luxury template's hero
// scroll-scrubs through when the listing has no real hero video (see
// LuxuryHero.jsx). Separate from PhotoManager.jsx's own drag-reorder
// (which drives the regular Gallery.jsx grid) — the best order for a
// scroll walkthrough is often a deliberate narrative (exterior → entry →
// living → kitchen → primary suite → backyard), not necessarily the same
// as the gallery's browsing order.
export default function HeroScrollPhotosManager({ listingId, photos, onChanged }) {
  const [dragId, setDragId] = useState(null);
  const [overId, setOverId] = useState(null);
  const [busy, setBusy] = useState(false);

  const included = [...photos]
    .filter((p) => p.hero_scroll_order != null)
    .sort((a, b) => a.hero_scroll_order - b.hero_scroll_order);
  const available = photos.filter((p) => p.hero_scroll_order == null);

  const add = async (photo) => {
    setBusy(true);
    await supabase.from("listing_photos").update({ hero_scroll_order: included.length }).eq("id", photo.id);
    setBusy(false);
    onChanged?.();
  };

  const remove = async (photo) => {
    setBusy(true);
    const remaining = included.filter((p) => p.id !== photo.id);
    await supabase.from("listing_photos").update({ hero_scroll_order: null }).eq("id", photo.id);
    await Promise.all(
      remaining.map((p, i) =>
        p.hero_scroll_order === i ? Promise.resolve() : supabase.from("listing_photos").update({ hero_scroll_order: i }).eq("id", p.id),
      ),
    );
    setBusy(false);
    onChanged?.();
  };

  // Drag-and-drop reorder among the included photos only — same pattern
  // as PhotoManager.jsx's own gallery reorder.
  const handleDragStart = (photo) => (e) => {
    setDragId(photo.id);
    e.dataTransfer.effectAllowed = "move";
  };
  const handleDragOver = (photo) => (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (photo.id !== dragId) setOverId(photo.id);
  };
  const handleDragEnd = () => {
    setDragId(null);
    setOverId(null);
  };
  const handleDrop = (targetPhoto) => async (e) => {
    e.preventDefault();
    setDragId(null);
    setOverId(null);
    if (!dragId || dragId === targetPhoto.id) return;

    const reordered = [...included];
    const fromIndex = reordered.findIndex((p) => p.id === dragId);
    const toIndex = reordered.findIndex((p) => p.id === targetPhoto.id);
    if (fromIndex === -1 || toIndex === -1) return;
    const [moved] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, moved);

    setBusy(true);
    await Promise.all(
      reordered.map((photo, i) =>
        photo.hero_scroll_order === i ? Promise.resolve() : supabase.from("listing_photos").update({ hero_scroll_order: i }).eq("id", photo.id),
      ),
    );
    setBusy(false);
    onChanged?.();
  };

  return (
    <div className="bg-white border border-black/5 rounded-2xl p-6 space-y-4">
      <div>
        <h2 className="font-display text-lg font-semibold">Hero Scroll Photos</h2>
        <p className="text-xs text-[#1c1a17]/40 mt-1">
          When this listing has no hero video, the hero scroll-scrubs through these photos instead
          — pick a handful in the order you want the story told (drag to reorder), rather than a
          single static photo.
        </p>
      </div>

      {included.length > 0 && (
        <div className="space-y-1.5">
          {included.map((photo, i) => (
            <div
              key={photo.id}
              draggable
              onDragStart={handleDragStart(photo)}
              onDragOver={handleDragOver(photo)}
              onDrop={handleDrop(photo)}
              onDragEnd={handleDragEnd}
              className={`flex items-center gap-3 border rounded-xl p-2 cursor-grab active:cursor-grabbing transition-all ${
                dragId === photo.id
                  ? "opacity-40 border-black/10"
                  : overId === photo.id
                    ? "border-[#ed2127] ring-2 ring-[#ed2127]/30"
                    : "border-black/10"
              }`}
            >
              <span className="w-5 text-center text-xs font-semibold text-[#1c1a17]/40 shrink-0">{i + 1}</span>
              <img src={photo.url} alt="" className="h-12 w-16 rounded-md object-cover shrink-0" draggable={false} />
              <span className="flex-1 text-xs text-[#1c1a17]/50 truncate">{photo.alt || "Untitled photo"}</span>
              <button
                type="button"
                onClick={() => remove(photo)}
                disabled={busy}
                className="text-xs text-[#1c1a17]/40 hover:text-red-600 shrink-0 px-1"
                title="Remove from sequence"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {included.length === 0 && <p className="text-sm text-[#1c1a17]/40">No photos picked yet.</p>}

      {available.length > 0 && (
        <div>
          <p className="text-xs font-medium text-[#1c1a17]/60 mb-2">
            {included.length > 0 ? "Add more" : "Pick photos"}
          </p>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {available.map((photo) => (
              <button
                key={photo.id}
                type="button"
                onClick={() => add(photo)}
                disabled={busy}
                className="group relative rounded-lg overflow-hidden border border-black/10 hover:border-[#ed2127] transition-colors disabled:opacity-50"
              >
                <img src={photo.url} alt="" className="w-full h-20 object-cover" />
                <span className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center text-white text-xs font-semibold opacity-0 group-hover:opacity-100">
                  + Add
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
