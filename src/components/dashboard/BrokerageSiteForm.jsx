import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import ImageUploadField from "./ImageUploadField";
import VideoUploadField from "./VideoUploadField";
import RichTextEditor from "./RichTextEditor";

// Same template/font/accent/logo options as SiteForm.jsx (agent sites),
// kept in sync with the check constraints in
// supabase/brokerage-site-theming.sql. See SiteForm.jsx's own comment
// for why these are restricted rather than a free picker.
const THEMES = [
  {
    value: "classic",
    label: "Classic",
    description: "Cream & white sections, dark hero + testimonials + footer. The current look.",
    swatches: ["#f7f4ee", "#14130f", "#ed2127"],
  },
  {
    value: "light",
    label: "Light",
    description: "Mostly white and bright throughout, same layout.",
    swatches: ["#ffffff", "#14130f", "#ed2127"],
  },
  {
    value: "dark",
    label: "Dark",
    description: "Ink backgrounds throughout with cream text.",
    swatches: ["#14130f", "#26241d", "#f2454b"],
  },
  {
    value: "sand",
    label: "Sand",
    description: "Warmer, earthier take on Classic — taupe ground.",
    swatches: ["#f0e9df", "#211a12", "#ed2127"],
  },
  {
    value: "midnight",
    label: "Midnight",
    description: "A cooler dark — navy-black instead of warm ink.",
    swatches: ["#0d1420", "#1f2937", "#f2454b"],
  },
  {
    value: "ivory",
    label: "Ivory",
    description: "Ultra-minimal near-white, neutral and quiet.",
    swatches: ["#fefefe", "#1a1a1a", "#ed2127"],
  },
];

const FONT_PAIRINGS = [
  {
    value: "playfair-jost",
    label: "Playfair Display + Lato",
    tag: "The Agency's pairing",
    display: "'Playfair Display', Georgia, serif",
    body: "'Lato', sans-serif",
  },
  {
    value: "fraunces-inter",
    label: "Fraunces + Inter",
    display: "'Fraunces', Georgia, serif",
    body: "'Inter', sans-serif",
  },
  {
    value: "cormorant-worksans",
    label: "Cormorant Garamond + Work Sans",
    display: "'Cormorant Garamond', Georgia, serif",
    body: "'Work Sans', sans-serif",
  },
  {
    value: "libre-karla",
    label: "Libre Baskerville + Karla",
    display: "'Libre Baskerville', Georgia, serif",
    body: "'Karla', sans-serif",
  },
  {
    value: "bodoni-manrope",
    label: "Bodoni Moda + Manrope",
    display: "'Bodoni Moda', Georgia, serif",
    body: "'Manrope', sans-serif",
  },
  {
    value: "dmserif-dmsans",
    label: "DM Serif Display + DM Sans",
    display: "'DM Serif Display', Georgia, serif",
    body: "'DM Sans', sans-serif",
  },
];

const ACCENT_OPTIONS = [
  { value: "", label: "Template default", swatch: null },
  { value: "#ed2127", label: "Corporate Red", swatch: "#ed2127" },
  { value: "#000000", label: "Black", swatch: "#000000" },
];

const LOGO_VARIANTS = [
  { value: "red", label: "Red", chipBg: "#ffffff", src: "/images/brokerage-logo.png" },
  { value: "white", label: "White", chipBg: "#14130f", src: "/images/brokerage-logo-white.png" },
  { value: "black", label: "Black", chipBg: "#f0eee9", src: "/images/brokerage-logo-black.png" },
];

// Hero and Contact are always shown, in fixed position (Hero first,
// Contact last) — see HomeSections.jsx — so they're not in this list.
const HOME_SECTION_LABELS = { about: "About", agents: "Agents", areas: "Areas of Expertise", blog: "Blog" };
const ALL_SECTION_KEYS = Object.keys(HOME_SECTION_LABELS);
const DEFAULT_HOME_SECTIONS = ["about", "agents", "blog", "areas"];

// Site-level details for the brokerage site — parallel to SiteForm.jsx
// (agent sites), minus slug/region/secondary-logo/custom-domain, which
// don't apply to a singleton office site the same way.
export default function BrokerageSiteForm({ site, onSaved }) {
  const [form, setForm] = useState(() => toForm(site));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => setForm(toForm(site)), [site]);

  function toForm(s) {
    return {
      status: s.status || "draft",
      theme: s.theme || "dark",
      font_pairing: s.font_pairing || "playfair-jost",
      accent_color: s.accent_color || "",
      logo_variant: s.logo_variant || "white",
      home_sections: s.home_sections?.length ? s.home_sections : DEFAULT_HOME_SECTIONS,
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

  const enableSection = (key) => {
    setSaved(false);
    setForm((f) => ({ ...f, home_sections: [...f.home_sections, key] }));
  };

  const disableSection = (key) => {
    setSaved(false);
    setForm((f) => ({ ...f, home_sections: f.home_sections.filter((k) => k !== key) }));
  };

  const moveSection = (i, direction) => {
    setSaved(false);
    setForm((f) => {
      const j = i + direction;
      if (j < 0 || j >= f.home_sections.length) return f;
      const arr = [...f.home_sections];
      [arr[i], arr[j]] = [arr[j], arr[i]];
      return { ...f, home_sections: arr };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    const payload = {
      status: form.status,
      theme: form.theme,
      font_pairing: form.font_pairing,
      accent_color: form.accent_color || null,
      logo_variant: form.logo_variant,
      home_sections: form.home_sections,
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

      <div>
        <label className={labelClass}>Template</label>
        <div className="grid sm:grid-cols-3 gap-3">
          {THEMES.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => set("theme", t.value)}
              className={`text-left rounded-xl border p-3.5 transition-colors ${
                form.theme === t.value
                  ? "border-[#ed2127] ring-2 ring-[#ed2127]/30"
                  : "border-black/10 hover:border-black/20"
              }`}
            >
              <div className="flex gap-1.5 mb-2.5">
                {t.swatches.map((c, i) => (
                  <span key={i} className="h-5 w-5 rounded-full border border-black/10" style={{ background: c }} />
                ))}
              </div>
              <p className="text-sm font-semibold">{t.label}</p>
              <p className="text-xs text-[#1c1a17]/50 mt-0.5 leading-snug">{t.description}</p>
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className={labelClass}>Accent color</label>
        <p className="text-xs text-[#1c1a17]/40 mb-2">
          Kept to The Agency's own brand colors — not a free color picker.
        </p>
        <div className="flex items-center gap-2 flex-wrap">
          {ACCENT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => set("accent_color", opt.value)}
              title={opt.label}
              className={`flex items-center gap-1.5 rounded-full border pl-1.5 pr-3 py-1.5 text-xs font-medium transition-colors ${
                form.accent_color === opt.value
                  ? "border-[#1c1a17] text-[#1c1a17]"
                  : "border-black/10 text-[#1c1a17]/60 hover:border-black/20"
              }`}
            >
              <span
                className="h-5 w-5 rounded-full border border-black/10"
                style={{ background: opt.swatch || "repeating-conic-gradient(#e7e2d6 0% 25%, #fff 0% 50%) 0 / 8px 8px" }}
              />
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className={labelClass}>Font pairing</label>
        <div className="grid sm:grid-cols-3 gap-3">
          {FONT_PAIRINGS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => set("font_pairing", f.value)}
              className={`text-left rounded-xl border p-3.5 transition-colors ${
                form.font_pairing === f.value
                  ? "border-[#ed2127] ring-2 ring-[#ed2127]/30"
                  : "border-black/10 hover:border-black/20"
              }`}
            >
              {f.tag && (
                <p className="text-[10px] font-semibold uppercase tracking-wide text-[#ed2127] mb-1.5">{f.tag}</p>
              )}
              <p className="text-lg leading-none mb-2" style={{ fontFamily: f.display }}>
                Aa
              </p>
              <p className="text-xs font-semibold" style={{ fontFamily: f.body }}>
                {f.label}
              </p>
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className={labelClass}>Logo</label>
        <p className="text-xs text-[#1c1a17]/40 mb-2">
          Same official mark, three colors — pick whichever reads best against your template.
        </p>
        <div className="flex items-center gap-3 flex-wrap">
          {LOGO_VARIANTS.map((v) => (
            <button
              key={v.value}
              type="button"
              onClick={() => set("logo_variant", v.value)}
              className={`rounded-xl border p-2.5 transition-colors ${
                form.logo_variant === v.value
                  ? "border-[#ed2127] ring-2 ring-[#ed2127]/30"
                  : "border-black/10 hover:border-black/20"
              }`}
            >
              <div className="h-10 w-24 rounded-md flex items-center justify-center px-2" style={{ background: v.chipBg }}>
                <img src={v.src} alt={`${v.label} logo`} className="max-h-6 w-auto" />
              </div>
              <p className="text-xs font-medium text-center mt-1.5">{v.label}</p>
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className={labelClass}>Home page sections</label>
        <p className="text-xs text-[#1c1a17]/40 mb-2">
          What shows on the home page, and in what order — Hero and Contact are always included. A
          page stays reachable on its own even if it's turned off here.
        </p>
        <div className="space-y-1.5">
          {form.home_sections.map((key, i) => (
            <div key={key} className="flex items-center gap-2 bg-white border border-black/10 rounded-lg px-3 py-2">
              <input type="checkbox" checked onChange={() => disableSection(key)} className="accent-[#ed2127]" />
              <span className="flex-1 text-sm">{HOME_SECTION_LABELS[key]}</span>
              <button
                type="button"
                onClick={() => moveSection(i, -1)}
                disabled={i === 0}
                className="text-[#1c1a17]/40 hover:text-[#1c1a17] disabled:opacity-20 disabled:hover:text-[#1c1a17]/40 px-1"
                title="Move earlier"
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => moveSection(i, 1)}
                disabled={i === form.home_sections.length - 1}
                className="text-[#1c1a17]/40 hover:text-[#1c1a17] disabled:opacity-20 disabled:hover:text-[#1c1a17]/40 px-1"
                title="Move later"
              >
                ↓
              </button>
            </div>
          ))}
          {ALL_SECTION_KEYS.filter((key) => !form.home_sections.includes(key)).map((key) => (
            <div key={key} className="flex items-center gap-2 border border-dashed border-black/15 rounded-lg px-3 py-2">
              <input type="checkbox" checked={false} onChange={() => enableSection(key)} className="accent-[#ed2127]" />
              <span className="flex-1 text-sm text-[#1c1a17]/50">{HOME_SECTION_LABELS[key]}</span>
              <span className="text-xs text-[#1c1a17]/35">Hidden from home</span>
            </div>
          ))}
        </div>
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
