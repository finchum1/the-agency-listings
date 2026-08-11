import { useRef, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

export default function PhotoManager({ listingId, photos, onChanged }) {
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

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

  const move = async (photo, direction) => {
    const idx = photos.findIndex((p) => p.id === photo.id);
    const swapWith = photos[idx + direction];
    if (!swapWith) return;
    await Promise.all([
      supabase.from("listing_photos").update({ sort_order: swapWith.sort_order }).eq("id", photo.id),
      supabase.from("listing_photos").update({ sort_order: photo.sort_order }).eq("id", swapWith.id),
    ]);
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
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {photos.map((photo, i) => (
            <div key={photo.id} className="relative group border border-black/10 rounded-lg overflow-hidden">
              <img src={photo.url} alt={photo.alt || ""} className="w-full h-32 object-cover" />
              {photo.is_hero && (
                <span className="absolute top-1.5 left-1.5 bg-[#1c1a17] text-white text-[10px] font-semibold px-2 py-0.5 rounded-full">
                  HERO
                </span>
              )}
              <div className="absolute inset-x-0 bottom-0 bg-black/60 backdrop-blur-sm flex items-center justify-center gap-2 py-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  type="button"
                  onClick={() => move(photo, -1)}
                  disabled={i === 0}
                  className="text-white text-xs disabled:opacity-30"
                  title="Move earlier"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => move(photo, 1)}
                  disabled={i === photos.length - 1}
                  className="text-white text-xs disabled:opacity-30"
                  title="Move later"
                >
                  ↓
                </button>
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
      )}
    </div>
  );
}
