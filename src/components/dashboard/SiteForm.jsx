import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useOrg } from "../../context/OrgContext";
import { accentChoices, logoChoices, validLogoVariant } from "../../lib/brandChoices";
import { normalizeDomain } from "../../lib/normalizeDomain";
import ImageUploadField from "./ImageUploadField";
import RichTextEditor from "./RichTextEditor";
import { paragraphsToHtml } from "../../lib/richTextFallback";
import CollapsibleSection from "./CollapsibleSection";
import LandingCardsEditor from "./LandingCardsEditor";
import FormSaveBar from "./FormSaveBar";

// Kept in sync with the CSS custom properties in src/index.css
// ([data-theme="…"] / [data-font="…"]) and the check constraints in
// supabase/agent-sites-more-customization.sql +
// agent-sites-brand-compliance.sql. Every template's accent is The
// Agency's own brand red (theagencyre.com) — templates only vary
// background/surface neutrals, never the brand color.
const THEMES = [
  {
    value: "classic",
    label: "Classic",
    description: "Cream & white sections, dark hero + testimonials + footer. The current look.",
    swatches: ["#f7f4ee", "#14130f", "#ed2127"],
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
    description: "Taupe ground, true black ink, and the brand red.",
    swatches: ["#ddd0ba", "#0d0d0d", "#ed2127"],
  },
  {
    value: "red",
    label: "Red",
    description: "The brand red for the hero, footer & testimonials — white & black everywhere else.",
    swatches: ["#ffffff", "#ed2127", "#0d0d0d"],
  },
  {
    value: "linen",
    label: "Linen",
    description: "All-white and soft cream throughout, even the header & footer — the brand red as the only pop of color.",
    swatches: ["#ffffff", "#f0ece4", "#ed2127"],
  },
];

// How the home page and its sections are arranged (agent_sites.layout, check constraint kept in sync). Independent of
// the color theme below: any layout works with any theme, font pairing and button style.
const LAYOUTS = [
  { value: "classic", label: "Classic", description: "Full-screen photo hero, then bio, listings, and testimonials in tidy sections. The original look." },
  { value: "editorial", label: "Minimal editorial", description: "Light and airy, like a magazine: big quiet headlines, thin rules, captioned photos, and testimonials as pull-quotes." },
  { value: "portrait", label: "Portrait split", description: "Leads with the agent: a tall portrait beside their name, tagline, and a way to connect, then warm card-style sections." },
  { value: "listings", label: "Listings first", description: "A short banner, then the listings right away with a big feature home and status filters. The bio becomes a slim strip." },
  { value: "bold", label: "Bold statement", description: "Oversized uppercase type, full-bleed photos with text over them, solid color blocks, and big numbers." },
];

// Button shape on the public site (agent_sites.button_style, check
// constraint kept in sync) — buttons and tags opt in with .as-btn, see
// index.css.
const BUTTON_STYLES = [
  { value: "square", label: "Square", description: "Sharp-cornered buttons — the original look.", radius: "0" },
  { value: "pill", label: "Pill", description: "Fully rounded buttons and tags throughout the site.", radius: "9999px" },
];

// Independent of THEMES above (color/font) — how the fixed nav itself
// behaves, see Navbar.jsx. Kept in sync with the check constraint on
// agent_sites.header_style.
const HEADER_STYLES = [
  {
    value: "classic",
    label: "Classic",
    description: "Flush, full-width bar — transparent over the hero, solid once you scroll.",
  },
  {
    value: "floating",
    label: "Floating",
    description:
      "A clear header at the top that becomes a detached, rounded pill once you scroll.",
  },
];

// The first entry (kept under its original "playfair-jost" value so
// existing picks don't move) is The Agency's own pairing, straight off
// theagencyre.com — the recommended default for new sites. The rest are
// alternate serif/sans pairings in the same spirit, for agents who want a
// bit of their own personality; they don't touch color or logo, so they
// stay within brand.
const FONT_PAIRINGS = [
  {
    value: "playfair-jost",
    label: "Playfair Display + Lato",
    tag: "Default pairing",
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

// Hero and Contact are always shown, in fixed position (Hero first,
// Contact last) — see HomeSections.jsx — so they're not in this list.
const HOME_SECTION_LABELS = {
  bio: "About / Bio",
  testimonials: "Testimonials",
  cards: "Buyer & seller cards",
  listings: "Featured Listings",
  areas: "Service Areas",
  blog: "Blog",
};
const ALL_SECTION_KEYS = Object.keys(HOME_SECTION_LABELS);
const DEFAULT_HOME_SECTIONS = ["bio", "testimonials", "cards", "listings", "areas", "blog"];

// A tiny wireframe of each layout for the picker.
function LayoutSketch({ kind }) {
  const bar = "rounded-[2px] bg-[#1c1a17]/15 dark:bg-white/20";
  const accent = "rounded-[2px] bg-[#ed2127]";
  return (
    <div className="h-24 rounded-lg border border-black/10 dark:border-white/15 overflow-hidden bg-white dark:bg-[#111] p-1.5 flex flex-col gap-1" aria-hidden="true">
      {kind === "classic" && (
        <>
          <div className="h-10 rounded-[3px] bg-[#1c1a17]/70 flex items-end p-1.5"><div className="h-1.5 w-10 rounded-full bg-white/80" /></div>
          <div className="flex gap-1.5 flex-1"><div className={`${bar} w-8`} /><div className="flex-1 flex flex-col gap-1 pt-0.5"><div className={`${bar} h-1.5`} /><div className={`${bar} h-1.5 w-3/4`} /></div></div>
        </>
      )}
      {kind === "editorial" && (
        <>
          <div className="flex flex-col items-center gap-1 pt-1"><div className="h-2 w-16 rounded-[2px] bg-[#1c1a17]/55" /><div className={`${accent} h-px w-5`} /><div className={`${bar} h-1 w-12`} /></div>
          <div className={`${bar} flex-1 mt-0.5`} />
        </>
      )}
      {kind === "portrait" && (
        <div className="flex gap-1.5 flex-1">
          <div className="w-1/2 rounded-[3px] bg-[#1c1a17]/60" />
          <div className="flex-1 flex flex-col justify-center gap-1"><div className="h-2.5 w-full rounded-[2px] bg-[#1c1a17]/55" /><div className={`${bar} h-1.5 w-3/4`} /><div className={`${accent} h-2.5 w-10 mt-1`} /></div>
        </div>
      )}
      {kind === "listings" && (
        <>
          <div className="h-6 rounded-[3px] bg-[#1c1a17]/70" />
          <div className="flex gap-1 flex-1"><div className="flex-[1.6] rounded-[2px] bg-[#1c1a17]/35" /><div className="flex-1 flex flex-col gap-1 justify-center"><div className={`${accent} h-1.5 w-8`} /><div className={`${bar} h-1.5`} /></div></div>
          <div className="flex gap-1 h-5"><div className={`${bar} flex-1`} /><div className={`${bar} flex-1`} /><div className={`${bar} flex-1`} /></div>
        </>
      )}
      {kind === "bold" && (
        <>
          <div className="h-11 rounded-[3px] bg-[#1c1a17]/70 flex flex-col justify-end p-1.5 gap-0.5"><div className="h-2.5 w-14 rounded-[1px] bg-white" /><div className="h-2.5 w-10 rounded-[1px] bg-white" /></div>
          <div className="flex gap-1 flex-1"><div className={`${accent} flex-1`} /><div className="flex-1 rounded-[2px] bg-[#1c1a17]/70" /><div className={`${bar} flex-1`} /></div>
        </>
      )}
    </div>
  );
}

export default function SiteForm({ site, onSaved }) {
  const { brand } = useOrg();
  const accentOptions = accentChoices(brand);
  const logoOptions = logoChoices(brand);
  const [form, setForm] = useState(() => toForm(site));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setForm(toForm(site));
    setDirty(false);
  }, [site]);

  function toForm(s) {
    return {
      slug: s.slug || "",
      status: s.status || "draft",
      tagline: s.tagline || "",
      region: s.region || "",
      theme: s.theme || "classic",
      layout: s.layout || "classic",
      header_style: s.header_style || "classic",
      button_style: s.button_style || "square",
      font_pairing: s.font_pairing || "playfair-jost",
      accent_color: s.accent_color || "",
      logo_variant: validLogoVariant(brand, s.logo_variant || "red"),
      home_sections: s.home_sections?.length ? s.home_sections : DEFAULT_HOME_SECTIONS,
      landing: s.landing && typeof s.landing === "object" ? s.landing : {},
      idx_enabled: !!s.idx_enabled,
      secondary_logo_url: s.secondary_logo_url || "",
      hero_photo_url: s.hero_photo_url || "",
      hero_video_url: s.hero_video_url || "",
      // bio_html is the new source of truth (RichTextEditor); falls back
      // to converting the old bio text[] array so a site saved before
      // this migration still loads with its existing content intact.
      bio_html: s.bio_html || paragraphsToHtml(s.bio),
      stats: s.stats?.length ? s.stats : [{ label: "", value: "" }],
      instagram_url: s.instagram_url || "",
      facebook_url: s.facebook_url || "",
      linkedin_url: s.linkedin_url || "",
      tiktok_url: s.tiktok_url || "",
      youtube_url: s.youtube_url || "",
      x_url: s.x_url || "",
      custom_domain: s.custom_domain || "",
      seo_title: s.seo_title || "",
      seo_description: s.seo_description || "",
      og_image_url: s.og_image_url || "",
    };
  }

  const update = (field) => (e) => {
    setSaved(false);
    setDirty(true);
    setForm((f) => ({ ...f, [field]: e.target.value }));
  };

  const set = (field, value) => {
    setSaved(false);
    setDirty(true);
    setForm((f) => ({ ...f, [field]: value }));
  };

  const updateStat = (i, field, value) => {
    setSaved(false);
    setDirty(true);
    setForm((f) => {
      const stats = [...f.stats];
      stats[i] = { ...stats[i], [field]: value };
      return { ...f, stats };
    });
  };

  const addStat = () => {
    setDirty(true);
    setForm((f) => ({ ...f, stats: [...f.stats, { label: "", value: "" }] }));
  };

  const removeStat = (i) => {
    setDirty(true);
    setForm((f) => ({ ...f, stats: f.stats.filter((_, idx) => idx !== i) }));
  };

  const enableSection = (key) => {
    setSaved(false);
    setDirty(true);
    setForm((f) => ({ ...f, home_sections: [...f.home_sections, key] }));
  };

  const disableSection = (key) => {
    setSaved(false);
    setDirty(true);
    setForm((f) => ({ ...f, home_sections: f.home_sections.filter((k) => k !== key) }));
  };

  const moveSection = (i, direction) => {
    setSaved(false);
    setDirty(true);
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
      slug: form.slug.trim(),
      status: form.status,
      tagline: form.tagline,
      region: form.region,
      theme: form.theme,
      layout: form.layout,
      header_style: form.header_style,
      button_style: form.button_style,
      font_pairing: form.font_pairing,
      accent_color: form.accent_color || null,
      logo_variant: form.logo_variant,
      home_sections: form.home_sections,
      landing: form.landing,
      idx_enabled: form.idx_enabled,
      secondary_logo_url: form.secondary_logo_url || null,
      hero_photo_url: form.hero_photo_url || null,
      hero_video_url: form.hero_video_url || null,
      bio_html: form.bio_html,
      stats: form.stats.filter((s) => s.label.trim() || s.value.trim()),
      instagram_url: form.instagram_url,
      facebook_url: form.facebook_url,
      linkedin_url: form.linkedin_url,
      tiktok_url: form.tiktok_url,
      youtube_url: form.youtube_url,
      x_url: form.x_url,
      custom_domain: normalizeDomain(form.custom_domain),
      seo_title: form.seo_title || null,
      seo_description: form.seo_description || null,
      og_image_url: form.og_image_url || null,
    };
    const { error } = await supabase.from("agent_sites").update(payload).eq("id", site.id);
    setSaving(false);
    if (error) {
      setError(
        error.code === "23505"
          ? "That custom domain is already attached to another site."
          : error.message,
      );
      return;
    }
    setSaved(true);
    setDirty(false);
    onSaved?.();
  };

  const inputClass =
    "w-full rounded-lg border border-black/10 dark:border-white/15 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#ed2127]/40 dark:focus:ring-[#f2454b]/40";
  const labelClass = "block text-xs font-medium text-[#1c1a17]/60 dark:text-[#faf9f7]/60 mb-1.5";

  return (
    <form onSubmit={handleSubmit} className="bg-white dark:bg-[#1a1a1a] border border-black/5 dark:border-white/10 rounded-2xl p-6 space-y-5">
      <div className="flex items-center justify-between gap-4">
        <h2 className="font-display text-lg font-semibold">Site Details</h2>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs font-medium text-[#1c1a17]/50 dark:text-[#faf9f7]/50">
            {form.status === "published" ? "Live" : "Draft — not visible publicly"}
          </span>
          <select
            value={form.status}
            onChange={update("status")}
            className={`text-xs font-semibold rounded-full px-3 py-1.5 border-0 outline-none cursor-pointer ${
              form.status === "published"
                ? "bg-[#3fae5c]/10 text-[#3fae5c]"
                : "bg-black/10 dark:bg-white/15 text-[#1c1a17]/70 dark:text-[#faf9f7]/70"
            }`}
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
          className="inline-block rounded-full border border-[#ed2127] dark:border-[#f2454b] text-[#ed2127] dark:text-[#f2454b] text-xs font-semibold px-4 py-2 hover:bg-[#ed2127] dark:hover:bg-[#f2454b] hover:text-white dark:hover:text-white transition-colors"
        >
          View live site
        </a>
      )}

      <div className="space-y-3">
        <CollapsibleSection title="Basic Info" description="Slug, region, and tagline." defaultOpen>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>URL slug</label>
              <input required value={form.slug} onChange={update("slug")} className={inputClass} />
              <p className="text-xs text-[#1c1a17]/40 dark:text-[#faf9f7]/40 mt-1">/sites/{form.slug || "…"}</p>
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
        </CollapsibleSection>

        <CollapsibleSection title="Template & Design" description="Layout, color theme, accent color, font pairing, and logo.">
          <div>
            <label className={labelClass}>Layout</label>
            <div className="grid sm:grid-cols-3 gap-3">
              {LAYOUTS.map((l) => (
                <button
                  key={l.value}
                  type="button"
                  onClick={() => set("layout", l.value)}
                  className={`text-left rounded-xl border p-3.5 transition-colors ${
                    form.layout === l.value
                      ? "border-[#ed2127] dark:border-[#f2454b] ring-2 ring-[#ed2127]/30 dark:ring-[#f2454b]/30"
                      : "border-black/10 dark:border-white/15 hover:border-black/20 dark:hover:border-white/25"
                  }`}
                >
                  <LayoutSketch kind={l.value} />
                  <p className="text-sm font-semibold mt-2.5">{l.label}</p>
                  <p className="text-xs text-[#1c1a17]/50 dark:text-[#faf9f7]/50 mt-0.5 leading-snug">{l.description}</p>
                </button>
              ))}
            </div>
            <p className="text-xs text-[#1c1a17]/40 dark:text-[#faf9f7]/40 mt-2">Save, then open the site to see the new layout. Your content stays the same.</p>
          </div>

          <div>
            <label className={labelClass}>Color theme</label>
            <div className="grid sm:grid-cols-3 gap-3">
              {THEMES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => set("theme", t.value)}
                  className={`text-left rounded-xl border p-3.5 transition-colors ${
                    form.theme === t.value
                      ? "border-[#ed2127] dark:border-[#f2454b] ring-2 ring-[#ed2127]/30 dark:ring-[#f2454b]/30"
                      : "border-black/10 dark:border-white/15 hover:border-black/20 dark:hover:border-white/25"
                  }`}
                >
                  <div className="flex gap-1.5 mb-2.5">
                    {t.swatches.map((c, i) => (
                      <span key={i} className="h-5 w-5 rounded-full border border-black/10 dark:border-white/15" style={{ background: c }} />
                    ))}
                  </div>
                  <p className="text-sm font-semibold">{t.label}</p>
                  <p className="text-xs text-[#1c1a17]/50 dark:text-[#faf9f7]/50 mt-0.5 leading-snug">{t.description}</p>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className={labelClass}>Header style</label>
            <div className="grid sm:grid-cols-2 gap-3">
              {HEADER_STYLES.map((h) => (
                <button
                  key={h.value}
                  type="button"
                  onClick={() => set("header_style", h.value)}
                  className={`text-left rounded-xl border p-3.5 transition-colors ${
                    form.header_style === h.value
                      ? "border-[#ed2127] dark:border-[#f2454b] ring-2 ring-[#ed2127]/30 dark:ring-[#f2454b]/30"
                      : "border-black/10 dark:border-white/15 hover:border-black/20 dark:hover:border-white/25"
                  }`}
                >
                  <p className="text-sm font-semibold">{h.label}</p>
                  <p className="text-xs text-[#1c1a17]/50 dark:text-[#faf9f7]/50 mt-0.5 leading-snug">{h.description}</p>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className={labelClass}>Button style</label>
            <div className="grid sm:grid-cols-2 gap-3">
              {BUTTON_STYLES.map((b) => (
                <button
                  key={b.value}
                  type="button"
                  onClick={() => set("button_style", b.value)}
                  className={`text-left rounded-xl border p-3.5 transition-colors ${
                    form.button_style === b.value
                      ? "border-[#ed2127] dark:border-[#f2454b] ring-2 ring-[#ed2127]/30 dark:ring-[#f2454b]/30"
                      : "border-black/10 dark:border-white/15 hover:border-black/20 dark:hover:border-white/25"
                  }`}
                >
                  <span
                    className="inline-block mb-2.5 bg-[#ed2127] text-white text-[10px] font-medium uppercase tracking-widest px-5 py-2"
                    style={{ borderRadius: b.radius }}
                  >
                    Contact
                  </span>
                  <p className="text-sm font-semibold">{b.label}</p>
                  <p className="text-xs text-[#1c1a17]/50 dark:text-[#faf9f7]/50 mt-0.5 leading-snug">{b.description}</p>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className={labelClass}>Accent color</label>
            <p className="text-xs text-[#1c1a17]/40 dark:text-[#faf9f7]/40 mb-2">
              {accentOptions.length > 1
                ? `Kept to ${brand.name}'s brand colors — not a free color picker.`
                : `${brand.name}'s brand colors haven't been set up yet, so the template default is used.`}
            </p>
            <div className="flex items-center gap-2 flex-wrap">
              {accentOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => set("accent_color", opt.value)}
                  title={opt.label}
                  className={`flex items-center gap-1.5 rounded-full border pl-1.5 pr-3 py-1.5 text-xs font-medium transition-colors ${
                    form.accent_color === opt.value
                      ? "border-[#1c1a17] dark:border-[#faf9f7] text-[#1c1a17] dark:text-[#faf9f7]"
                      : "border-black/10 dark:border-white/15 text-[#1c1a17]/60 dark:text-[#faf9f7]/60 hover:border-black/20 dark:hover:border-white/25"
                  }`}
                >
                  <span
                    className="h-5 w-5 rounded-full border border-black/10 dark:border-white/15"
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
                      ? "border-[#ed2127] dark:border-[#f2454b] ring-2 ring-[#ed2127]/30 dark:ring-[#f2454b]/30"
                      : "border-black/10 dark:border-white/15 hover:border-black/20 dark:hover:border-white/25"
                  }`}
                >
                  {f.tag && (
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-[#ed2127] dark:text-[#f2454b] mb-1.5">{f.tag}</p>
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
            <p className="text-xs text-[#1c1a17]/40 dark:text-[#faf9f7]/40 mb-2">
              Pick whichever version of the mark reads best against your template.
            </p>
            <div className="flex items-center gap-3 flex-wrap">
              {logoOptions.map((v) => (
                <button
                  key={v.value}
                  type="button"
                  onClick={() => set("logo_variant", v.value)}
                  className={`rounded-xl border p-2.5 transition-colors ${
                    form.logo_variant === v.value
                      ? "border-[#ed2127] dark:border-[#f2454b] ring-2 ring-[#ed2127]/30 dark:ring-[#f2454b]/30"
                      : "border-black/10 dark:border-white/15 hover:border-black/20 dark:hover:border-white/25"
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
        </CollapsibleSection>

        <CollapsibleSection title="Home Page Sections" description="What shows on your home page, and in what order.">
          <div>
            <p className="text-xs text-[#1c1a17]/40 dark:text-[#faf9f7]/40 mb-2">
              Hero and Contact are always included. A page stays reachable on its own even if you
              turn it off here.
            </p>
            <div className="space-y-1.5">
              {form.home_sections.map((key, i) => (
                <div key={key} className="flex items-center gap-2 bg-white dark:bg-[#1a1a1a] border border-black/10 dark:border-white/15 rounded-lg px-3 py-2">
                  <input
                    type="checkbox"
                    checked
                    onChange={() => disableSection(key)}
                    className="accent-[#ed2127] dark:accent-[#f2454b]"
                  />
                  <span className="flex-1 text-sm">{HOME_SECTION_LABELS[key]}</span>
                  <button
                    type="button"
                    onClick={() => moveSection(i, -1)}
                    disabled={i === 0}
                    className="text-[#1c1a17]/40 dark:text-[#faf9f7]/40 hover:text-[#1c1a17] dark:hover:text-[#faf9f7] disabled:opacity-20 disabled:hover:text-[#1c1a17]/40 dark:disabled:hover:text-[#faf9f7]/40 px-1"
                    title="Move earlier"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => moveSection(i, 1)}
                    disabled={i === form.home_sections.length - 1}
                    className="text-[#1c1a17]/40 dark:text-[#faf9f7]/40 hover:text-[#1c1a17] dark:hover:text-[#faf9f7] disabled:opacity-20 disabled:hover:text-[#1c1a17]/40 dark:disabled:hover:text-[#faf9f7]/40 px-1"
                    title="Move later"
                  >
                    ↓
                  </button>
                </div>
              ))}
              {ALL_SECTION_KEYS.filter((key) => !form.home_sections.includes(key)).map((key) => (
                <div
                  key={key}
                  className="flex items-center gap-2 border border-dashed border-black/15 dark:border-white/20 rounded-lg px-3 py-2"
                >
                  <input type="checkbox" checked={false} onChange={() => enableSection(key)} className="accent-[#ed2127] dark:accent-[#f2454b]" />
                  <span className="flex-1 text-sm text-[#1c1a17]/50 dark:text-[#faf9f7]/50">{HOME_SECTION_LABELS[key]}</span>
                  <span className="text-xs text-[#1c1a17]/35 dark:text-[#faf9f7]/35">Hidden from home</span>
                </div>
              ))}
            </div>
          </div>
        </CollapsibleSection>

        <CollapsibleSection title="Buyer & seller cards" description="The Sellers, Home Value and Buyers pages, and the cards that lead to them.">
          <LandingCardsEditor siteId={site.id} siteSlug={site.slug} value={form.landing} onChange={(v) => set("landing", v)} />
        </CollapsibleSection>

        <CollapsibleSection title="Home Search (IDX)" description="Full MLS search on your area pages.">
          <label className="flex items-start gap-3 bg-white dark:bg-[#1a1a1a] border border-black/10 dark:border-white/15 rounded-lg px-3.5 py-3 cursor-pointer">
            <input
              type="checkbox"
              checked={form.idx_enabled}
              onChange={(e) => set("idx_enabled", e.target.checked)}
              className="mt-0.5 accent-[#ed2127] dark:accent-[#f2454b]"
            />
            <span>
              <span className="block text-sm font-medium">Enable full MLS home search</span>
              <span className="block text-xs text-[#1c1a17]/50 dark:text-[#faf9f7]/50 mt-0.5">
                Adds a "Search Homes in {"{Area}"}" section to each of your Areas of Expertise
                pages, letting visitors search the whole market — not just {brand.name}'s own
                listings. Off by default; your own listings still show on area pages either way.
              </span>
            </span>
          </label>
        </CollapsibleSection>

        <CollapsibleSection title="Photos, Video & Bio" description="Secondary logo, hero media, your bio, and stats.">
          <ImageUploadField
            bucket="agent-site-photos"
            folder={site.id}
            value={form.secondary_logo_url}
            onChange={(url) => set("secondary_logo_url", url || "")}
            label={`Secondary logo (optional — shown next to the ${brand.name} logo in your header and footer)`}
          />

          <ImageUploadField
            bucket="agent-site-photos"
            folder={site.id}
            value={form.hero_photo_url}
            onChange={(url) => set("hero_photo_url", url || "")}
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
            <RichTextEditor
              value={form.bio_html}
              onChange={(html) => set("bio_html", html)}
              placeholder="Tell your story…"
              minHeight="10rem"
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
                    className="text-[#1c1a17]/40 dark:text-[#faf9f7]/40 hover:text-red-600 dark:hover:text-red-400 px-2"
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
              className="text-xs font-semibold text-[#ed2127] dark:text-[#f2454b] hover:underline mt-2"
            >
              + Add stat
            </button>
          </div>
        </CollapsibleSection>

        <CollapsibleSection title="Social Media" description="Instagram, Facebook, LinkedIn, TikTok, and YouTube.">
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
            <div>
              <label className={labelClass}>TikTok URL</label>
              <input value={form.tiktok_url} onChange={update("tiktok_url")} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>YouTube URL</label>
              <input value={form.youtube_url} onChange={update("youtube_url")} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>X URL</label>
              <input value={form.x_url} onChange={update("x_url")} className={inputClass} />
            </div>
          </div>
        </CollapsibleSection>

        <CollapsibleSection
          title="SEO & Sharing"
          description="Controls the title/description search engines show and the preview card when your site is shared."
        >
          <p className="text-xs text-[#1c1a17]/50 dark:text-[#faf9f7]/50">
            Leave blank to use sensible defaults built from your name and tagline/bio above.
          </p>
          <div>
            <label className={labelClass}>SEO title</label>
            <input
              value={form.seo_title}
              onChange={update("seo_title")}
              className={inputClass}
              placeholder={`Defaults to your name + ${brand.name}.`}
            />
          </div>
          <div>
            <label className={labelClass}>SEO / share description</label>
            <textarea
              rows={2}
              value={form.seo_description}
              onChange={update("seo_description")}
              className={inputClass}
              placeholder="Defaults to your tagline, or the first line of your bio."
            />
          </div>
          <ImageUploadField
            bucket="agent-site-photos"
            folder={site.id}
            value={form.og_image_url}
            onChange={(url) => set("og_image_url", url || "")}
            label="Share image (optional — defaults to your hero photo)"
          />
        </CollapsibleSection>

        <CollapsibleSection title="Custom Domain" description="Serve your site at your own domain instead of /sites/…">
          <p className="text-xs text-[#1c1a17]/50 dark:text-[#faf9f7]/50">
            Once a domain is purchased — or an existing one is pointed at this project (ask your
            admin either way) — enter it here and your site will serve directly at that address,
            e.g. visiting <span className="font-medium">TerrenceFinchumRealty.com</span> shows this
            site at the root URL instead of{" "}
            <span className="font-medium">/sites/{form.slug || "…"}</span>.
          </p>
          <input
            value={form.custom_domain}
            onChange={update("custom_domain")}
            className={inputClass}
            placeholder="TerrenceFinchumRealty.com"
          />
        </CollapsibleSection>
      </div>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      {saved && !dirty && <p className="text-sm text-emerald-700 dark:text-emerald-400">Saved.</p>}

      <button
        type="submit"
        disabled={saving}
        className="rounded-full bg-[#1c1a17] dark:bg-[#f2454b] text-white text-sm font-semibold px-6 py-2.5 hover:bg-[#1c1a17]/90 dark:hover:bg-[#f2454b]/90 transition-colors disabled:opacity-60"
      >
        {saving ? "Saving…" : "Save Changes"}
      </button>

      <FormSaveBar dirty={dirty} saving={saving} saved={saved} error={error} />
    </form>
  );
}
