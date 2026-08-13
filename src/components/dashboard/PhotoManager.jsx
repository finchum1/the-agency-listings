import { useRef, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

export default function PhotoManager({ listingId, photos, onChanged }) {
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [dragId, setDragId] = useState(null);
  const [overId, setOverId] = useState(null);

  const handleUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setUploading(true);
    setError("");

    const wasEmpty = photos.length === 0;
    let nextOrder = photos.length;
    for (const [index, file] of files.entries()) {
      const path = `${listingId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.]/g, "-")}`;
      const { error: uploadError } = await supabase.storage
        .from("listing-photos")
        .upload(path, file);
      if (uploadError) {
        setError(uploadError.message);
        continue;
      }
      const { data: publicUrl } = supabase.storage.from("listing-photos").getPublicUrl(path);
      await supabase.from("listing_photos").insert({
        listing_id: listingId,
        url: publicUrl.publicUrl,
        sort_order: nextOrder++,
        is_hero: wasEmpty && index === 0,
      });
    }

    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
    onChanged?.();
  };

  // Drag-and-drop reorder — plain HTML5 DnD, no extra dependency. Dropping
  // re-indexes the whole array (not just a pairwise swap), so a photo can
  // move any distance in one drag, then every photo's sort_order is
  // persisted to match its new position.
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

    const reordered = [...photos];
    const fromIndex = reordered.findIndex((p) => p.id === dragId);
    const toIndex = reordered.findIndex((p) => p.id === targetPhoto.id);
    if (fromIndex === -1 || toIndex === -1) return;
    const [moved] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, moved);

    await Promise.all(
      reordered.map((photo, i) =>
        photo.sort_order === i
          ? Promise.resolve()
          : supabase.from("listing_photos").update({ sort_order: i }).eq("id", photo.id),
      ),
    );
    onChanged?.();
  };

  const setHero = async (photo) => {
    await supabase.from("listing_photos").update({ is_hero: false }).eq("listing_id", listingId);
    await supabase.from("listing_photos").update({ is_hero: true }).eq("id", photo.id);
    onChanged?.();
  };

  const remove = async (photo) => {
    if (!confirm("Delete this photo?")) return;
    const path = photo.url.split("/listing-photos/")[1];
    if (path) await supabase.storage.from("listing-photos").remove([path]);
    await supabase.from("listing_photos").delete().eq("id", photo.id);
    onChanged?.();
  };

  return (
    <div className="bg-white border border-black/5 rounded-2xl p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold">Photos</h2>
        <label className="text-xs font-semibold text-[#8a7a5c] hover:underline cursor-pointer">
          {uploading ? "Uploading…" : "+ Add photos"}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleUpload}
            disabled={uploading}
            className="hidden"
          />
        </label>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {photos.length === 0 ? (
        <p className="text-sm text-[#1c1a17]/40">No photos yet.</p>
      ) : (
        <>
          <p className="text-xs text-[#1c1a17]/40">Drag to reorder. First photo is the hero unless you star another.</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {photos.map((photo) => (
              <div
                key={photo.id}
                draggable
                onDragStart={handleDragStart(photo)}
                onDragOver={handleDragOver(photo)}
                onDrop={handleDrop(photo)}
                onDragEnd={handleDragEnd}
                className={`relative group border rounded-lg overflow-hidden cursor-grab active:cursor-grabbing transition-all ${
                  dragId === photo.id
                    ? "opacity-40 border-black/10"
                    : overId === photo.id
                      ? "border-[#8a7a5c] ring-2 ring-[#8a7a5c]/30"
                      : "border-black/10"
                }`}
              >
                <img
                  src={photo.url}
                  alt={photo.alt || ""}
                  className="w-full h-32 object-cover pointer-events-none"
                  draggable={false}
                />
                {photo.is_hero && (
                  <span className="absolute top-1.5 left-1.5 bg-[#1c1a17] text-white text-[10px] font-semibold px-2 py-0.5 rounded-full">
                    HERO
                  </span>
                )}
                <div className="absolute inset-x-0 bottom-0 bg-black/60 backdrop-blur-sm flex items-center justify-center gap-3 py-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    type="button"
                    onClick={() => setHero(photo)}
                    className="text-white text-xs"
                    title="Set as hero"
                  >
                    ★
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(photo)}
                    className="text-white text-xs"
                    title="Delete"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
