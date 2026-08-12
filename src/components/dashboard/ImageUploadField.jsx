import { useRef, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

// Single-image upload field, shared by SiteForm (hero photo), AreasManager
// (area photo), and PostsManager (post image) — all agent-site content
// that needs exactly one image, not a gallery (PhotoManager is the
// gallery version, used only by listings).
export default function ImageUploadField({ agentSiteId, value, onChange, label = "Photo" }) {
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError("");

    const path = `${agentSiteId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.]/g, "-")}`;
    const { error: uploadError } = await supabase.storage
      .from("agent-site-photos")
      .upload(path, file);
    if (uploadError) {
      setError(uploadError.message);
      setUploading(false);
      return;
    }
    const { data } = supabase.storage.from("agent-site-photos").getPublicUrl(path);
    onChange(data.publicUrl);
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div>
      <label className="block text-xs font-medium text-[#1c1a17]/60 mb-1.5">{label}</label>
      <div className="flex items-center gap-4">
        <div className="h-20 w-20 rounded-xl bg-black/5 overflow-hidden shrink-0">
          {value && <img src={value} alt="" className="h-full w-full object-cover" />}
        </div>
        <div className="flex-1 min-w-0">
          <label className="text-xs font-semibold text-[#8a7a5c] hover:underline cursor-pointer">
            {uploading ? "Uploading…" : value ? "Replace photo" : "Upload photo"}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
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
          {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
        </div>
      </div>
    </div>
  );
}
