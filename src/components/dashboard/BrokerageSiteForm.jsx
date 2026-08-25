import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import ImageUploadField from "./ImageUploadField";
import VideoUploadField from "./VideoUploadField";
import RichTextEditor from "./RichTextEditor";

// Site-level details for the brokerage site — parallel to SiteForm.jsx,
// but no slug/theme/font/logo/custom-domain: the brokerage site has one
// fixed look (see BrokerageSitePage.jsx) built to match
// the-agency-oklahoma.vercel.app, not a per-agent customization surface.
export default function BrokerageSiteForm({ site, onSaved }) {
  const [form, setForm] = useState(() => toForm(site));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => setForm(toForm(site)), [site]);

  function toForm(s) {
    return {
      status: s.status || "draft",
      tagline: s.tagline || "",
      hero_photo_url: s.hero_photo_url || "",
      hero_video_url: s.hero_video_url || "",
      about_html: s.about_html || "",
      stats: s.stats?.length ? s.stats : [{ label: "", value: "" }],
      contact_email: s.contact_email || "",
      contact_phone: s.contact_phone || "",
      instagram_url: s.instagram_url || "",
      facebook_url: s.facebook_url || "",
      linkedin_url: s.linkedin_url || "",
      seo_title: s.seo_title || "",
      seo_description: s.seo_description || "",
      og_image_url: s.og_image_url || "",
    };
  }

  const update = (field) => (e) => {
    setSaved(false);
    setForm((f) => ({ ...f, [field]: e.target.value }));
  };

  const set = (field, value) => {
    setSaved(false);
    setForm((f) => ({ ...f, [field]: value }));
  };

  const updateStat = (i, field, value) => {
    setSaved(false);
    setForm((f) => {
      const stats = [...f.stats];
      stats[i] = { ...stats[i], [field]: value };
      return { ...f, stats };
    });
  };

  const addStat = () => setForm((f) => ({ ...f, stats: [...f.stats, { label: "", value: "" }] }));
  const removeStat = (i) => setForm((f) => ({ ...f, stats: f.stats.filter((_, idx) => idx !== i) }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    const payload = {
      status: form.status,
      tagline: form.tagline,
      hero_photo_url: form.hero_photo_url || null,
      hero_video_url: form.hero_video_url || null,
      about_html: form.about_html,
      stats: form.stats.filter((s) => s.label.trim() || s.value.trim()),
      contact_email: form.contact_email,
      contact_phone: form.contact_phone,
      instagram_url: form.instagram_url,
      facebook_url: form.facebook_url,
      linkedin_url: form.linkedin_url,
      seo_title: form.seo_title || null,
      seo_description: form.seo_description || null,
      og_image_url: form.og_image_url || null,
    };
    const { error } = await supabase.from("brokerage_site").update(payload).eq("id", site.id);
    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    setSaved(true);
    onSaved?.();
  };

  const inputClass =
    "w-full rounded-lg border border-black/10 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#ed2127]/40";
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
        <a href="/brokerage" target="_blank" rel="noopener noreferrer" className="text-sm text-[#ed2127] hover:underline inline-block">
          View live site →
        </a>
      )}

      <div>
        <label className={labelClass}>Tagline</label>
        <input
          value={form.tagline}
          onChange={update("tagline")}
          className={inputClass}
          placeholder="A boutique brokerage representing Oklahoma's most distinctive properties."
        />
      </div>

      <ImageUploadField
        bucket="brokerage-site-photos"
        folder={site.id}
        value={form.hero_photo_url}
        onChange={(url) => set("hero_photo_url", url || "")}
        label="Hero photo"
      />

      <VideoUploadField
        bucket="brokerage-site-photos"
        folder={site.id}
        value={form.hero_video_url}
        onChange={(url) => set("hero_video_url", url || "")}
        label="Hero video (optional — used instead of the hero photo when set)"
      />

      <div>
        <label className={labelClass}>About</label>
        <RichTextEditor
          value={form.about_html}
          onChange={(html) => set("about_html", html)}
          placeholder="Tell people about the brokerage…"
          minHeight="10rem"
        />
      </div>

      <div>
        <label className={labelClass}>Stats (e.g. "Years Experience" → "50+")</label>
        <div className="space-y-2">
          {form.stats.map((stat, i) => (
            <div key={i} className="flex gap-2">
              <input value={stat.value} onChange={(e) => updateStat(i, "value", e.target.value)} className={inputClass} placeholder="50+" />
              <input value={stat.label} onChange={(e) => updateStat(i, "label", e.target.value)} className={inputClass} placeholder="Years Experience" />
              <button type="button" onClick={() => removeStat(i)} className="text-[#1c1a17]/40 hover:text-red-600 px-2" aria-label="Remove stat">
                ✕
              </button>
            </div>
          ))}
        </div>
        <button type="button" onClick={addStat} className="text-xs font-semibold text-[#ed2127] hover:underline mt-2">
          + Add stat
        </button>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Contact email</label>
          <input type="email" value={form.contact_email} onChange={update("contact_email")} className={inputClass} placeholder="info@theagencyoklahoma.com" />
        </div>
        <div>
          <label className={labelClass}>Contact phone</label>
          <input value={form.contact_phone} onChange={update("contact_phone")} className={inputClass} placeholder="(405) 555-0100" />
        </div>
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

      <div className="bg-[#faf9f7] border border-black/5 rounded-2xl p-5 space-y-4">
        <div>
          <h3 className="font-display text-base font-semibold">SEO &amp; Sharing (optional)</h3>
          <p className="text-xs text-[#1c1a17]/50 mt-1">
            Controls the title/description search engines show and the preview card when the site is
            shared. Leave blank to use sensible defaults built from the tagline/about text above.
          </p>
        </div>
        <div>
          <label className={labelClass}>SEO title</label>
          <input value={form.seo_title} onChange={update("seo_title")} className={inputClass} placeholder="Defaults to the brokerage name." />
        </div>
        <div>
          <label className={labelClass}>SEO / share description</label>
          <textarea rows={2} value={form.seo_description} onChange={update("seo_description")} className={inputClass} placeholder="Defaults to the tagline, or the first line of About." />
        </div>
        <ImageUploadField
          bucket="brokerage-site-photos"
          folder={site.id}
          value={form.og_image_url}
          onChange={(url) => set("og_image_url", url || "")}
          label="Share image (optional — defaults to the hero photo)"
        />
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
