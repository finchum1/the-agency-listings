import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../hooks/useAuth";
import { normalizeDomain } from "../../lib/normalizeDomain";
import StatusSelect from "./StatusSelect";
import VideoUploadField from "./VideoUploadField";

// Structural site templates — distinct from THEMES below (which are
// color/font variants *within* the classic template). Luxury has its
// own fixed dark/editorial look (see index.css's [data-theme="luxury"])
// and isn't customizable via Theme/Accent/Font/Logo, so those sections
// are hidden once it's selected rather than shown but ignored.
const SITE_TEMPLATES = [
  {
    value: "classic",
    label: "Classic",
    description: "The standard template — photo hero, customizable theme, font, and accent.",
  },
  {
    value: "luxury",
    label: "Luxury",
    description: "A cinematic video hero that scrubs as you scroll. Fixed dark editorial look.",
  },
];

function slugify(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

// Kept in sync with the --ls-* CSS custom properties in src/index.css and
// the check constraint in supabase/listing-themes.sql. Same six template
// names as agent_sites.theme (see SiteForm.jsx's THEMES). Listing Sites'
// "one accent" used to be a gold-brown that was never actually part of
// The Agency's brand — corrected to the same corporate red every swatch
// below now shows, matching Agent Sites' accent exactly.
const THEMES = [
  {
    value: "classic",
    label: "Classic",
    description: "Cream & white sections, dark footer. The current look.",
    swatches: ["#faf9f7", "#1c1a17", "#ed2127"],
  },
  {
    value: "light",
    label: "Light",
    description: "Mostly white and bright throughout, same layout.",
    swatches: ["#ffffff", "#1c1a17", "#ed2127"],
  },
  {
    value: "dark",
    label: "Dark",
    description: "Ink backgrounds throughout with cream text, brighter accent.",
    swatches: ["#1c1a17", "#2e2b24", "#f2454b"],
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

// Same six pairings as SiteForm.jsx's FONT_PAIRINGS, read via --ls-* in
// index.css instead of --as-*.
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

// Restricted to The Agency's own brand red and black — not a free-color
// picker, same rule as SiteForm.jsx's ACCENT_OPTIONS. Enforced again at
// the database level (listings_accent_color_check).
const ACCENT_OPTIONS = [
  { value: "", label: "Template default", swatch: null },
  { value: "#ed2127", label: "Corporate Red", swatch: "#ed2127" },
  { value: "#000000", label: "Black", swatch: "#000000" },
];

// Three official-color versions of the same mark — see SiteForm.jsx's
// LOGO_VARIANTS (a fourth "square" option was tried there and removed;
// don't reintroduce it here either — see DESIGN.md).
const LOGO_VARIANTS = [
  { value: "red", label: "Red", chipBg: "#ffffff", src: "/images/brokerage-logo.png" },
  { value: "white", label: "White", chipBg: "#14130f", src: "/images/brokerage-logo-white.png" },
  { value: "black", label: "Black", chipBg: "#f0eee9", src: "/images/brokerage-logo-black.png" },
];

const emptyListing = {
  slug: "",
  agent_id: "",
  status: "draft",
  theme: "classic",
  font_pairing: "playfair-jost",
  accent_color: "",
  logo_variant: "red",
  mls_number: "",
  address_line1: "",
  city: "",
  state: "",
  zip: "",
  price: "",
  beds: "",
  baths: "",
  sqft: "",
  lot_size: "",
  year_built: "",
  garage: "",
  property_type: "Single Family Home",
  hero_video_url: "",
  site_template: "classic",
  custom_domain: "",
  seo_title: "",
  seo_description: "",
  og_image_url: "",
};

// mode: "create" | "edit". `listing` is the existing row for edit mode.
// `descriptionText`/`features` are handled as local UI state, converted
// to/from the DB shapes (text[] / jsonb) on load and save.
export default function ListingForm({ mode, listing, onSaved }) {
  const { user, isAdmin } = useAuth();
  const [form, setForm] = useState(emptyListing);
  const [descriptionText, setDescriptionText] = useState("");
  const [features, setFeatures] = useState([]);
  const [agents, setAgents] = useState([]);
  const [slugTouched, setSlugTouched] = useState(mode === "edit");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isAdmin) {
      supabase
        .from("profiles")
        .select("id, full_name, email")
        .order("full_name")
        .then(({ data }) => setAgents(data || []));
    }
  }, [isAdmin]);

  useEffect(() => {
    if (listing) {
      setForm({
        slug: listing.slug || "",
        agent_id: listing.agent_id || "",
        status: listing.status || "draft",
        theme: listing.theme || "classic",
        font_pairing: listing.font_pairing || "playfair-jost",
        accent_color: listing.accent_color || "",
        logo_variant: listing.logo_variant || "red",
        mls_number: listing.mls_number || "",
        address_line1: listing.address_line1 || "",
        city: listing.city || "",
        state: listing.state || "",
        zip: listing.zip || "",
        price: listing.price ?? "",
        beds: listing.beds ?? "",
        baths: listing.baths ?? "",
        sqft: listing.sqft ?? "",
        lot_size: listing.lot_size || "",
        year_built: listing.year_built || "",
        garage: listing.garage || "",
        property_type: listing.property_type || "Single Family Home",
        hero_video_url: listing.hero_video_url || "",
        site_template: listing.site_template || "classic",
        custom_domain: listing.custom_domain || "",
        seo_title: listing.seo_title || "",
        seo_description: listing.seo_description || "",
        og_image_url: listing.og_image_url || "",
      });
      setDescriptionText((listing.description || []).join("\n\n"));
      setFeatures(
        (listing.features || []).map((group) => ({
          category: group.category || "",
          itemsText: (group.items || []).join("\n"),
        }))
      );
    }
  }, [listing]);

  const update = (field) => (e) => {
    const value = e.target.value;
    setForm((f) => ({ ...f, [field]: value }));
    if (field === "address_line1" && !slugTouched) {
      setForm((f) => ({ ...f, slug: slugify(value) }));
    }
  };

  const addFeatureGroup = () => setFeatures((f) => [...f, { category: "", itemsText: "" }]);
  const updateFeatureGroup = (i, patch) =>
    setFeatures((f) => f.map((g, idx) => (idx === i ? { ...g, ...patch } : g)));
  const removeFeatureGroup = (i) => setFeatures((f) => f.filter((_, idx) => idx !== i));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!form.slug.trim()) {
      setError("Slug is required (this becomes the site's URL).");
      return;
    }

    const agentId = isAdmin ? form.agent_id || user.id : user.id;
    if (!agentId) {
      setError("Please choose an agent for this listing.");
      return;
    }

    const payload = {
      ...form,
      agent_id: agentId,
      price: form.price === "" ? null : Number(form.price),
      beds: form.beds === "" ? null : Number(form.beds),
      baths: form.baths === "" ? null : Number(form.baths),
      sqft: form.sqft === "" ? null : Number(form.sqft),
      accent_color: form.accent_color || null,
      custom_domain: normalizeDomain(form.custom_domain),
      description: descriptionText
        .split(/\n\s*\n/)
        .map((p) => p.trim())
        .filter(Boolean),
      features: features
        .filter((g) => g.category.trim())
        .map((g) => ({
          category: g.category.trim(),
          items: g.itemsText.split("\n").map((i) => i.trim()).filter(Boolean),
        })),
    };

    setSaving(true);
    if (mode === "create") {
      const { data, error } = await supabase.from("listings").insert(payload).select().single();
      setSaving(false);
      if (error) {
        setError(error.message);
        return;
      }
      onSaved?.(data.id);
    } else {
      const { error } = await supabase.from("listings").update(payload).eq("id", listing.id);
      setSaving(false);
      if (error) {
        setError(error.message);
        return;
      }
      onSaved?.(listing.id);
    }
  };

  const inputClass =
    "w-full rounded-lg border border-black/10 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#ed2127]/40";
  const labelClass = "block text-xs font-medium text-[#1c1a17]/60 mb-1.5";

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <div className="bg-white border border-black/5 rounded-2xl p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">Basics</h2>
          <StatusSelect value={form.status} onChange={(status) => setForm((f) => ({ ...f, status }))} />
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Address</label>
            <input
              required
              value={form.address_line1}
              onChange={update("address_line1")}
              className={inputClass}
              placeholder="1645 Saratoga Way"
            />
          </div>
          <div>
            <label className={labelClass}>
              URL slug{" "}
              <span className="text-[#1c1a17]/40 normal-case font-normal">
                (site will be /listings/{form.slug || "…"})
              </span>
            </label>
            <input
              required
              value={form.slug}
              onChange={(e) => {
                setSlugTouched(true);
                setForm((f) => ({ ...f, slug: slugify(e.target.value) }));
              }}
              className={inputClass}
            />
          </div>
        </div>

        <div className="grid sm:grid-cols-3 gap-4">
          <div>
            <label className={labelClass}>City</label>
            <input required value={form.city} onChange={update("city")} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>State</label>
            <input required value={form.state} onChange={update("state")} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>ZIP</label>
            <input required value={form.zip} onChange={update("zip")} className={inputClass} />
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Price</label>
            <input
              type="number"
              value={form.price}
              onChange={update("price")}
              className={inputClass}
              placeholder="1395000"
            />
          </div>
          <div>
            <label className={labelClass}>MLS #</label>
            <input value={form.mls_number} onChange={update("mls_number")} className={inputClass} />
          </div>
        </div>

        {isAdmin && (
          <div>
            <label className={labelClass}>Assigned agent</label>
            <select
              required
              value={form.agent_id}
              onChange={update("agent_id")}
              className={inputClass}
            >
              <option value="">Select an agent…</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.full_name || a.email}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="bg-white border border-black/5 rounded-2xl p-6 space-y-4">
        <div>
          <h2 className="font-display text-lg font-semibold">Site Template</h2>
          <p className="text-xs text-[#1c1a17]/50 mt-1">
            The overall structure of the public site — Theme/Accent/Font/Logo below only apply
            to Classic; Luxury has its own fixed look.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          {SITE_TEMPLATES.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setForm((f) => ({ ...f, site_template: t.value }))}
              className={`text-left rounded-xl border p-3.5 transition-colors ${
                form.site_template === t.value
                  ? "border-[#ed2127] ring-2 ring-[#ed2127]/30"
                  : "border-black/10 hover:border-black/20"
              }`}
            >
              <p className="text-sm font-semibold">{t.label}</p>
              <p className="text-xs text-[#1c1a17]/50 mt-0.5 leading-snug">{t.description}</p>
            </button>
          ))}
        </div>
      </div>

      {form.site_template === "luxury" ? (
        <div className="bg-white border border-black/5 rounded-2xl p-6">
          <h2 className="font-display text-lg font-semibold mb-1.5">Theme, Accent, Font, Logo</h2>
          <p className="text-xs text-[#1c1a17]/50">
            Not used by the Luxury template — it has its own fixed dark, editorial look. Switch
            back to Classic above to customize these.
          </p>
        </div>
      ) : (
        <>
      <div className="bg-white border border-black/5 rounded-2xl p-6 space-y-4">
        <div>
          <h2 className="font-display text-lg font-semibold">Theme</h2>
          <p className="text-xs text-[#1c1a17]/50 mt-1">
            Changes how this listing's public site looks — every template still uses The
            Agency's own brand red, only the background/text neutrals change.
          </p>
        </div>
        <div className="grid sm:grid-cols-3 gap-3">
          {THEMES.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setForm((f) => ({ ...f, theme: t.value }))}
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

      <div className="bg-white border border-black/5 rounded-2xl p-6 space-y-4">
        <div>
          <h2 className="font-display text-lg font-semibold">Accent color</h2>
          <p className="text-xs text-[#1c1a17]/50 mt-1">
            Kept to The Agency's own brand colors — not a free color picker.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {ACCENT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setForm((f) => ({ ...f, accent_color: opt.value }))}
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

      <div className="bg-white border border-black/5 rounded-2xl p-6 space-y-4">
        <h2 className="font-display text-lg font-semibold">Font pairing</h2>
        <div className="grid sm:grid-cols-3 gap-3">
          {FONT_PAIRINGS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setForm((prev) => ({ ...prev, font_pairing: f.value }))}
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

      <div className="bg-white border border-black/5 rounded-2xl p-6 space-y-4">
        <div>
          <h2 className="font-display text-lg font-semibold">Logo</h2>
          <p className="text-xs text-[#1c1a17]/50 mt-1">
            Same official mark, three colors — pick whichever reads best against your template.
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {LOGO_VARIANTS.map((v) => (
            <button
              key={v.value}
              type="button"
              onClick={() => setForm((f) => ({ ...f, logo_variant: v.value }))}
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
        </>
      )}

      <div className="bg-white border border-black/5 rounded-2xl p-6 space-y-5">
        <h2 className="font-display text-lg font-semibold">Quick Facts</h2>
        <div className="grid sm:grid-cols-3 gap-4">
          <div>
            <label className={labelClass}>Beds</label>
            <input type="number" value={form.beds} onChange={update("beds")} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Baths</label>
            <input
              type="number"
              step="0.5"
              value={form.baths}
              onChange={update("baths")}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Sq Ft</label>
            <input type="number" value={form.sqft} onChange={update("sqft")} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Lot Size</label>
            <input value={form.lot_size} onChange={update("lot_size")} className={inputClass} placeholder="0.75+ acres" />
          </div>
          <div>
            <label className={labelClass}>Year Built</label>
            <input value={form.year_built} onChange={update("year_built")} className={inputClass} placeholder="1995 or —" />
          </div>
          <div>
            <label className={labelClass}>Garage</label>
            <input value={form.garage} onChange={update("garage")} className={inputClass} placeholder="4-car" />
          </div>
        </div>
        <div>
          <label className={labelClass}>Property Type</label>
          <input value={form.property_type} onChange={update("property_type")} className={inputClass} />
        </div>
      </div>

      <div className="bg-white border border-black/5 rounded-2xl p-6 space-y-3">
        <h2 className="font-display text-lg font-semibold">Description</h2>
        <p className="text-xs text-[#1c1a17]/50">
          Separate paragraphs with a blank line — each becomes its own paragraph on the site.
        </p>
        <textarea
          rows={8}
          value={descriptionText}
          onChange={(e) => setDescriptionText(e.target.value)}
          className={inputClass}
        />
      </div>

      <div className="bg-white border border-black/5 rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">Features</h2>
          <button
            type="button"
            onClick={addFeatureGroup}
            className="text-xs font-semibold text-[#ed2127] hover:underline"
          >
            + Add category
          </button>
        </div>
        {features.length === 0 && (
          <p className="text-sm text-[#1c1a17]/40">No feature categories yet.</p>
        )}
        {features.map((group, i) => (
          <div key={i} className="border border-black/5 rounded-xl p-4 space-y-2">
            <div className="flex items-center gap-3">
              <input
                value={group.category}
                onChange={(e) => updateFeatureGroup(i, { category: e.target.value })}
                className={inputClass}
                placeholder="Interior / Exterior / Community & Location"
              />
              <button
                type="button"
                onClick={() => removeFeatureGroup(i)}
                className="text-xs text-red-600 hover:underline whitespace-nowrap"
              >
                Remove
              </button>
            </div>
            <textarea
              rows={4}
              value={group.itemsText}
              onChange={(e) => updateFeatureGroup(i, { itemsText: e.target.value })}
              className={inputClass}
              placeholder={"One feature per line"}
            />
          </div>
        ))}
      </div>

      <div className="bg-white border border-black/5 rounded-2xl p-6 space-y-3">
        <h2 className="font-display text-lg font-semibold">
          Hero Video {form.site_template === "luxury" ? "" : "(optional)"}
        </h2>
        <p className="text-xs text-[#1c1a17]/50">
          {form.site_template === "luxury"
            ? "This is what the Luxury template's scroll effect plays through — leave it unset and the hero falls back to a static photo instead."
            : "Leave unset to use the hero photo instead."}
        </p>
        {mode === "edit" ? (
          <VideoUploadField
            bucket="listing-photos"
            folder={listing.id}
            value={form.hero_video_url}
            onChange={(url) => setForm((f) => ({ ...f, hero_video_url: url || "" }))}
            label="Video file"
          />
        ) : (
          <p className="text-xs text-[#1c1a17]/40">
            Save this listing first, then come back here to upload a video file.
          </p>
        )}
        <div>
          <label className={labelClass}>Or paste an already-hosted video URL</label>
          <input
            value={form.hero_video_url}
            onChange={update("hero_video_url")}
            className={inputClass}
            placeholder="/video/hero.mp4 or a full URL"
          />
        </div>
      </div>

      <div className="bg-white border border-black/5 rounded-2xl p-6 space-y-4">
        <div>
          <h2 className="font-display text-lg font-semibold">SEO &amp; Sharing (optional)</h2>
          <p className="text-xs text-[#1c1a17]/50 mt-1">
            Controls the title/description search engines show and the preview card when this
            listing is shared in text messages, Slack, or social apps. Leave blank to use sensible
            defaults built from the address and description above.
          </p>
        </div>
        <div>
          <label className={labelClass}>SEO title</label>
          <input
            value={form.seo_title}
            onChange={update("seo_title")}
            className={inputClass}
            placeholder={`${form.address_line1 || "1645 Saratoga Way"} | ${form.city || "Edmond"}, ${form.state || "OK"} — The Agency`}
          />
        </div>
        <div>
          <label className={labelClass}>SEO / share description</label>
          <textarea
            rows={2}
            value={form.seo_description}
            onChange={update("seo_description")}
            className={inputClass}
            placeholder="Defaults to the first paragraph of the description above."
          />
        </div>
        <div>
          <label className={labelClass}>Share image URL</label>
          <input
            value={form.og_image_url}
            onChange={update("og_image_url")}
            className={inputClass}
            placeholder="Defaults to the hero photo."
          />
        </div>
      </div>

      <div className="bg-white border border-black/5 rounded-2xl p-6 space-y-3">
        <h2 className="font-display text-lg font-semibold">Custom Domain (optional)</h2>
        <p className="text-xs text-[#1c1a17]/50">
          Once a domain is purchased and pointed at this project (ask your admin), enter it here
          and this listing will serve directly at that address — e.g. visiting{" "}
          <span className="font-medium">1645SaratogaWay.com</span> shows this listing at the root
          URL instead of <span className="font-medium">/listings/{form.slug || "…"}</span>.
        </p>
        <input
          value={form.custom_domain}
          onChange={update("custom_domain")}
          className={inputClass}
          placeholder="1645SaratogaWay.com"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={saving}
        className="rounded-full bg-[#1c1a17] text-white text-sm font-semibold px-8 py-3 hover:bg-[#1c1a17]/90 transition-colors disabled:opacity-60"
      >
        {saving ? "Saving…" : mode === "create" ? "Create Listing" : "Save Changes"}
      </button>
    </form>
  );
}
