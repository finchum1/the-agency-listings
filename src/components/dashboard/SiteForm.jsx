import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import ImageUploadField from "./ImageUploadField";

// Splits/joins bio paragraphs on blank lines, so the textarea is just
// "paragraph, blank line, paragraph" — no special syntax to teach.
const joinParagraphs = (arr) => (arr || []).join("\n\n");
const splitParagraphs = (text) =>
  text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

export default function SiteForm({ site, onSaved }) {
  const [form, setForm] = useState(() => toForm(site));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => setForm(toForm(site)), [site]);

  function toForm(s) {
    return {
      slug: s.slug || "",
      status: s.status || "draft",
      tagline: s.tagline || "",
      region: s.region || "",
      hero_photo_url: s.hero_photo_url || "",
      hero_video_url: s.hero_video_url || "",
      bio: joinParagraphs(s.bio),
      stats: s.stats?.length ? s.stats : [{ label: "", value: "" }],
      instagram_url: s.instagram_url || "",
      facebook_url: s.facebook_url || "",
      linkedin_url: s.linkedin_url || "",
    };
  }

  const update = (field) => (e) => {
    setSaved(false);
    setForm((f) => ({ ...f, [field]: e.target.value }));
  };

  const updateStat = (i, field, value) => {
    setSaved(false);
    setForm((f) => {
      const stats = [...f.stats];
      stats[i] = { ...stats[i], [field]: value };
      return { ...f, stats };
    });
  };

  const addStat = () =>
    setForm((f) => ({ ...f, stats: [...f.stats, { label: "", value: "" }] }));

  const removeStat = (i) =>
    setForm((f) => ({ ...f, stats: f.stats.filter((_, idx) => idx !== i) }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    const payload = {
      slug: form.slug.trim(),
      status: form.status,
      tagline: form.tagline,
      region: form.region,
      hero_photo_url: form.hero_photo_url || null,
      hero_video_url: form.hero_video_url || null,
      bio: splitParagraphs(form.bio),
      stats: form.stats.filter((s) => s.label.trim() || s.value.trim()),
      instagram_url: form.instagram_url,
      facebook_url: form.facebook_url,
      linkedin_url: form.linkedin_url,
    };
    const { error } = await supabase.from("agent_sites").update(payload).eq("id", site.id);
    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    setSaved(true);
    onSaved?.();
  };

  const inputClass =
    "w-full rounded-lg border border-black/10 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#8a7a5c]/40";
  const labelClass = "block text-xs font-medium text-[#1c1a17]/60 mb-1.5";

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-black/5 rounded-2xl p-6 space-y-5">
      <div className="flex items-center justify-between gap-4">
        <h2 className="font-display text-lg font-semibold">Site Details</h2>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs font-medium text-[#1c1a17]/50">
            {form.status === "published" ? "Live" : "Draft — not visible publicly"}
          </span>
          <select
            value={form.status}
            onChange={update("status")}
            className="text-xs font-semibold rounded-full px-3 py-1.5 border-0 outline-none cursor-pointer"
            style={
              form.status === "published"
                ? { background: "#3fae5c1a", color: "#3fae5c" }
                : { background: "#00000010", color: "#1c1a17aa" }
            }
          >
            <option value="draft">Draft</option>
            <option value="published">Published</option>
          </select>
        </div>
      </div>

      {form.status === "published" && (
        <a
          href={`/sites/${form.slug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-[#8a7a5c] hover:underline inline-block"
        >
          View live site →
        </a>
      )}

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>URL slug</label>
          <input required value={form.slug} onChange={update("slug")} className={inputClass} />
          <p className="text-xs text-[#1c1a17]/40 mt-1">/sites/{form.slug || "…"}</p>
        </div>
        <div>
          <label className={labelClass}>Region / metro area</label>
          <input
            value={form.region}
            onChange={update("region")}
            className={inputClass}
            placeholder="Oklahoma City Metro"
          />
        </div>
      </div>

      <div>
        <label className={labelClass}>Tagline</label>
        <input
          value={form.tagline}
          onChange={update("tagline")}
          className={inputClass}
          placeholder="Trusted guidance. Exceptional results."
        />
      </div>

      <ImageUploadField
        agentSiteId={site.id}
        value={form.hero_photo_url}
        onChange={(url) => {
          setSaved(false);
          setForm((f) => ({ ...f, hero_photo_url: url || "" }));
        }}
        label="Hero photo"
      />

      <div>
        <label className={labelClass}>Hero video URL (optional)</label>
        <input
          value={form.hero_video_url}
          onChange={update("hero_video_url")}
          className={inputClass}
          placeholder="https://… (already-hosted video file; used instead of the hero photo when set)"
        />
      </div>

      <div>
        <label className={labelClass}>Bio</label>
        <textarea
          value={form.bio}
          onChange={update("bio")}
          rows={8}
          className={inputClass}
          placeholder={"One paragraph per block, separated by a blank line."}
        />
      </div>

      <div>
        <label className={labelClass}>Stats (e.g. "Years Experience" → "10+")</label>
        <div className="space-y-2">
          {form.stats.map((stat, i) => (
            <div key={i} className="flex gap-2">
              <input
                value={stat.value}
                onChange={(e) => updateStat(i, "value", e.target.value)}
                className={inputClass}
                placeholder="10+"
              />
              <input
                value={stat.label}
                onChange={(e) => updateStat(i, "label", e.target.value)}
                className={inputClass}
                placeholder="Years Experience"
              />
              <button
                type="button"
                onClick={() => removeStat(i)}
                className="text-[#1c1a17]/40 hover:text-red-600 px-2"
                aria-label="Remove stat"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={addStat}
          className="text-xs font-semibold text-[#8a7a5c] hover:underline mt-2"
        >
          + Add stat
        </button>
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        <div>
          <label className={labelClass}>Instagram URL</label>
          <input value={form.instagram_url} onChange={update("instagram_url")} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Facebook URL</label>
          <input value={form.facebook_url} onChange={update("facebook_url")} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>LinkedIn URL</label>
          <input value={form.linkedin_url} onChange={update("linkedin_url")} className={inputClass} />
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {saved && <p className="text-sm text-emerald-700">Saved.</p>}

      <button
        type="submit"
        disabled={saving}
        className="rounded-full bg-[#1c1a17] text-white text-sm font-semibold px-6 py-2.5 hover:bg-[#1c1a17]/90 transition-colors disabled:opacity-60"
      >
        {saving ? "Saving…" : "Save Changes"}
      </button>
    </form>
  );
}
