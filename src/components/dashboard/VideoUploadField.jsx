import { useRef, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

// Same pattern as ImageUploadField.jsx, adapted for a single video file —
// used for a listing's hero video (ListingForm.jsx). Only usable once a
// listing already has a real id (edit mode) — the storage bucket's own
// RLS policy checks the uploaded path's first folder segment against a
// real listings.id row (see supabase/storage-policies.sql), same
// constraint PhotoManager.jsx already has for the photo gallery, which is
// why that's edit-mode-only too.
//
// Large video files are the norm here, not the exception — flag
// anything over ~40MB rather than blocking it outright: still usable,
// but a nudge toward compressing before upload (a 4K/uncompressed export
// straight off a drone or camera can be 10x that and will load slowly on
// a visitor's phone regardless of how good the hero effect is).
const SIZE_WARNING_BYTES = 40 * 1024 * 1024;

export default function VideoUploadField({ bucket, folder, value, onChange, label = "Video" }) {
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError("");
    setWarning(
      file.size > SIZE_WARNING_BYTES
        ? `That's a ${(file.size / (1024 * 1024)).toFixed(0)}MB file — it'll still upload, but a visitor on a slow connection may wait a while for it to load. Compressing it first (under ~40MB) is worth doing if you can.`
        : "",
    );

    const path = `${folder}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.]/g, "-")}`;
    const { error: uploadError } = await supabase.storage.from(bucket).upload(path, file);
    if (uploadError) {
      setError(uploadError.message);
      setUploading(false);
      return;
    }
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    onChange(data.publicUrl);
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div>
      <label className="block text-xs font-medium text-[#1c1a17]/60 mb-1.5">{label}</label>
      <div className="flex items-center gap-4">
        <div className="h-20 w-32 rounded-xl bg-black/5 overflow-hidden shrink-0">
          {value && <video src={value} className="h-full w-full object-cover" muted playsInline />}
        </div>
        <div className="flex-1 min-w-0">
          <label className="text-xs font-semibold text-[#ed2127] hover:underline cursor-pointer">
            {uploading ? "Uploading…" : value ? "Replace video" : "Upload video"}
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              onChange={handleUpload}
              disabled={uploading}
              className="hidden"
            />
          </label>
          {value && (
            <button
              type="button"
              onClick={() => onChange(null)}
              className="block text-xs text-[#1c1a17]/40 hover:text-[#1c1a17]/70 mt-1"
            >
              Remove
            </button>
          )}
          {warning && <p className="text-xs text-amber-700 mt-1">{warning}</p>}
          {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
        </div>
      </div>
    </div>
  );
}
