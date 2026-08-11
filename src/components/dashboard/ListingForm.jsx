import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../hooks/useAuth";
import StatusSelect from "./StatusSelect";

function slugify(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

// Accepts "https://1645SaratogaWay.com/" or "1645saratogaway.com" alike —
// strip protocol/path/trailing slash, lowercase, so it matches whatever
// App.jsx reads from window.location.hostname at runtime.
function normalizeDomain(text) {
  const trimmed = text.trim();
  if (!trimmed) return null;
  return trimmed
    .replace(/^https?:\/\//i, "")
    .replace(/\/.*$/, "")
    .toLowerCase();
}

const emptyListing = {
  slug: "",
  agent_id: "",
  status: "draft",
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
  custom_domain: "",
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
        custom_domain: listing.custom_domain || "",
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
    "w-full rounded-lg border border-black/10 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#8a7a5c]/40";
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
            className="text-xs font-semibold text-[#8a7a5c] hover:underline"
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
        <h2 className="font-display text-lg font-semibold">Hero Video (optional)</h2>
        <p className="text-xs text-[#1c1a17]/50">
          Paste a link to an already-hosted, compressed video file (leave blank to use the hero
          photo instead).
        </p>
        <input
          value={form.hero_video_url}
          onChange={update("hero_video_url")}
          className={inputClass}
          placeholder="/video/hero.mp4 or a full URL"
        />
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
