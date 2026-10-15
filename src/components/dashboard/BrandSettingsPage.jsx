import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useOrg } from "../../context/OrgContext";
import { HEX, logoSlots, removeOldLogo, tidyLocation, uploadOrgLogo } from "../../lib/orgBrand";
import BrandLogo from "../BrandLogo";
import FormSaveBar from "./FormSaveBar";

const inputClass =
  "w-full rounded-lg border border-black/10 dark:border-white/15 px-3.5 py-2.5 text-sm bg-transparent focus:outline-none focus:ring-2 focus:ring-[#ed2127]/40 dark:focus:ring-[#f2454b]/40 disabled:opacity-60";
const labelClass = "block text-xs font-medium text-[#1c1a17]/60 dark:text-[#faf9f7]/60 mb-1.5";
const hintClass = "text-xs text-[#1c1a17]/40 dark:text-[#faf9f7]/40 mt-1.5 leading-snug";
const cardClass = "bg-white dark:bg-[#1a1a1a] border border-black/5 dark:border-white/10 rounded-2xl p-6 space-y-5";
const MAX_COLORS = 4;

const toForm = (org) => ({
  name: org.name || "",
  location: org.brand?.location_label || "",
  serviceArea: org.brand?.service_area || "",
  address_line1: org.address_line1 || "",
  city: org.city || "",
  state: org.state || "",
  zip: org.zip || "",
  disclaimer: org.disclaimer || "",
  colors: [...(org.brand?.accent_colors || [])],
  logos: { ...(org.brand?.logos || {}) },
});

// How the organization's mark reads in the dashboard menu, in light and dark.
function MenuPreview({ logo, darkLogo, name, location }) {
  const label = (
    <span className="text-xs font-semibold tracking-[0.18em] uppercase opacity-60">{location}</span>
  );
  return (
    <div className="grid sm:grid-cols-2 gap-3">
      <div className="rounded-xl border border-black/10 bg-white text-[#1c1a17] px-5 py-4 flex items-center gap-3 min-h-[4.5rem]">
        <BrandLogo src={logo} name={name} className="h-9 w-auto" />
        {location && <span className="h-6 w-px bg-black/10" aria-hidden="true" />}
        {location && label}
      </div>
      <div className="rounded-xl border border-white/10 bg-[#1a1a1a] text-[#faf9f7] px-5 py-4 flex items-center gap-3 min-h-[4.5rem]">
        <BrandLogo src={darkLogo || logo} name={name} className="h-9 w-auto" />
        {location && <span className="h-6 w-px bg-white/15" aria-hidden="true" />}
        {location && label}
      </div>
    </div>
  );
}

function LogoSlot({ slot, src, locked, uploading, onPick, onRemove }) {
  const fileRef = useRef(null);
  return (
    <div className="flex items-start gap-4">
      <div
        className="h-20 w-40 shrink-0 rounded-xl border border-black/10 dark:border-white/15 flex items-center justify-center overflow-hidden p-2"
        style={{ background: slot.previewBg }}
      >
        {src ? <img src={src} alt="" className="max-h-full max-w-full object-contain" /> : <span className="text-[11px] text-black/30">No logo</span>}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{slot.label}</p>
        {slot.hint && <p className={hintClass}>{slot.hint}</p>}
        {!locked && (
          <div className="flex items-center gap-4 mt-2">
            <label className="text-xs font-semibold text-[#ed2127] dark:text-[#f2454b] hover:underline cursor-pointer">
              {uploading ? "Uploading…" : src ? "Replace" : "Upload"}
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                disabled={uploading}
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (fileRef.current) fileRef.current.value = "";
                  if (file) onPick(file);
                }}
              />
            </label>
            {src && !slot.isMain && (
              <button type="button" onClick={onRemove} className="text-xs text-[#1c1a17]/40 dark:text-[#faf9f7]/40 hover:text-red-600 dark:hover:text-red-400">
                Remove
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// The active organization's brand: what the menu, sign-in page and public sites show. An organization's own admins edit
// it here (the platform owner can, for any organization, via the switcher). A franchise organization such as an Agency
// office keeps the franchisor's logos and colors locked and only chooses its location; the database enforces that too.
export default function BrandSettingsPage() {
  const { org, brand, refreshOrg, isPlatformAdmin } = useOrg();
  const [form, setForm] = useState(null);
  const [saved, setSaved] = useState(null);
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [error, setError] = useState("");
  const [uploadingKey, setUploadingKey] = useState("");
  const replaced = useRef([]); // old logo addresses to delete once the change is saved

  useEffect(() => {
    if (!org) return;
    const f = toForm(org);
    setForm(f);
    setSaved(JSON.stringify(f));
  }, [org]);

  const franchise = org?.brand?.franchise || "";
  const locked = !!franchise && !isPlatformAdmin;
  const dirty = form && saved !== JSON.stringify(form);
  const slots = useMemo(() => logoSlots({ ...(org?.brand || {}), logos: form?.logos || {} }), [org, form?.logos]);

  if (!org || !form) return <p className="text-sm text-[#1c1a17]/50 dark:text-[#faf9f7]/50">Loading…</p>;

  const set = (key, value) => {
    setJustSaved(false);
    setForm((f) => ({ ...f, [key]: value }));
  };

  const pickLogo = async (key, file) => {
    setError("");
    setUploadingKey(key);
    try {
      const url = await uploadOrgLogo(org.id, key, file);
      if (form.logos[key]) replaced.current.push(form.logos[key]);
      setJustSaved(false);
      setForm((f) => ({ ...f, logos: { ...f.logos, [key]: url } }));
    } catch (err) {
      setError(err.message);
    }
    setUploadingKey("");
  };

  const removeLogo = (key) => {
    if (form.logos[key]) replaced.current.push(form.logos[key]);
    setJustSaved(false);
    setForm((f) => {
      const logos = { ...f.logos };
      delete logos[key];
      return { ...f, logos };
    });
  };

  const setColor = (i, value) => set("colors", form.colors.map((c, idx) => (idx === i ? value : c)));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!form.name.trim()) return setError("Add a name for the organization.");
    const colors = form.colors.map((c) => c.trim()).filter(Boolean);
    if (colors.some((c) => !HEX.test(c))) return setError("Colors must look like #1a5fb4 (a # and six letters or numbers).");

    setSaving(true);
    const location = tidyLocation(form.location);
    const logos = { ...form.logos };
    const mainKey = slots.find((s) => s.isMain && logos[s.key])?.key || Object.keys(logos)[0];

    const nextBrand = { ...org.brand, location_label: location, service_area: form.serviceArea.trim() };
    if (!location) delete nextBrand.location_label;
    if (!nextBrand.service_area) delete nextBrand.service_area;
    if (franchise) {
      // Franchise offices: the menu/switcher label follows the location; logos and colors stay as the franchisor set them.
      nextBrand.admin_name = location ? `${form.name.trim()} ${location}` : form.name.trim();
    } else {
      nextBrand.logos = logos;
      if (mainKey) nextBrand.default_logo = mainKey;
      else delete nextBrand.default_logo;
      nextBrand.accent_colors = colors;
      // A white version doubles as the dark-mode menu logo, so a dark main logo is still readable there.
      if (logos.white && mainKey !== "white") nextBrand.dark_nav_logo = "white";
      else delete nextBrand.dark_nav_logo;
    }

    const { error: err } = await supabase
      .from("organizations")
      .update({
        name: form.name.trim(),
        address_line1: form.address_line1.trim(),
        city: form.city.trim(),
        state: form.state.trim(),
        zip: form.zip.trim(),
        disclaimer: form.disclaimer.trim(),
        brand: nextBrand,
      })
      .eq("id", org.id);
    setSaving(false);
    if (err) return setError(err.message);

    for (const url of replaced.current) removeOldLogo(org.id, url);
    replaced.current = [];
    setJustSaved(true);
    setSaved(JSON.stringify({ ...form, location, colors, serviceArea: form.serviceArea.trim() }));
    refreshOrg();
  };

  const mainSlot = slots.find((s) => s.isMain);
  const liveLogo = franchise ? brand.logo : form.logos[mainSlot?.key] || "";
  const liveDark = franchise ? brand.darkLogo : form.logos.white && mainSlot?.key !== "white" ? form.logos.white : "";
  const liveLocation = tidyLocation(form.location);

  return (
    <form onSubmit={handleSubmit} className="max-w-3xl space-y-6 pb-24">
      <div>
        <h1 className="text-2xl font-display font-semibold">Brand settings</h1>
        <p className="text-sm text-[#1c1a17]/60 dark:text-[#faf9f7]/60 mt-1">
          How <strong>{org.brand?.admin_name || org.name}</strong> looks: the logo in the dashboard menu, the sign-in page and the public sites.
        </p>
      </div>

      <section className={cardClass}>
        <h2 className="font-display text-base font-semibold">Preview</h2>
        <MenuPreview logo={liveLogo} darkLogo={liveDark} name={form.name || org.name} location={liveLocation} />
        <p className={hintClass}>The dashboard menu in light and dark mode. Changes show here as you make them, and go live when you save.</p>
      </section>

      <section className={cardClass}>
        <h2 className="font-display text-base font-semibold">{franchise ? "Office" : "Name & location"}</h2>
        {franchise && (
          <p className="text-sm text-[#1c1a17]/60 dark:text-[#faf9f7]/60 -mt-2">
            This office uses The Agency's official logo and colors. Type your location and it appears next to the logo.
          </p>
        )}
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>{franchise ? "Brand name" : "Organization name"}</label>
            <input value={form.name} onChange={(e) => set("name", e.target.value)} disabled={locked} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>{franchise ? "Location" : "Location label (optional)"}</label>
            <input
              value={form.location}
              onChange={(e) => set("location", e.target.value)}
              placeholder={franchise ? "Oklahoma" : "Austin"}
              maxLength={60}
              className={inputClass}
            />
            <p className={hintClass}>Shown beside the logo, like “THE AGENCY | OKLAHOMA”, and used in page descriptions.</p>
          </div>
        </div>
        <div>
          <label className={labelClass}>Service area (optional)</label>
          <input
            value={form.serviceArea}
            onChange={(e) => set("serviceArea", e.target.value)}
            placeholder="Oklahoma City, Edmond, and the surrounding metro"
            maxLength={200}
            className={inputClass}
          />
          <p className={hintClass}>One line describing where your agents work. Used on the brokerage site's agent roster.</p>
        </div>
      </section>

      <section className={cardClass}>
        <h2 className="font-display text-base font-semibold">Logos</h2>
        {locked ? (
          <p className="text-sm text-[#1c1a17]/60 dark:text-[#faf9f7]/60 -mt-2">The Agency's logos are managed centrally for all offices.</p>
        ) : (
          <p className="text-sm text-[#1c1a17]/60 dark:text-[#faf9f7]/60 -mt-2">PNG, JPG, WebP or SVG, up to 2 MB. A transparent background looks best.</p>
        )}
        <div className="space-y-5">
          {slots.map((slot) => (
            <LogoSlot
              key={slot.key}
              slot={slot}
              src={form.logos[slot.key]}
              locked={locked}
              uploading={uploadingKey === slot.key}
              onPick={(file) => pickLogo(slot.key, file)}
              onRemove={() => removeLogo(slot.key)}
            />
          ))}
        </div>
      </section>

      {!locked && !franchise && (
        <section className={cardClass}>
          <h2 className="font-display text-base font-semibold">Brand colors</h2>
          <p className="text-sm text-[#1c1a17]/60 dark:text-[#faf9f7]/60 -mt-2">
            Agents on your sites choose their accent color from these. The first is your main color.
          </p>
          <div className="space-y-2">
            {form.colors.map((c, i) => (
              <div key={i} className="flex items-center gap-3">
                <input
                  type="color"
                  value={HEX.test(c) ? c : "#000000"}
                  onChange={(e) => setColor(i, e.target.value)}
                  className="h-10 w-12 rounded-lg border border-black/10 dark:border-white/15 bg-transparent p-1 cursor-pointer"
                  aria-label={`Color ${i + 1}`}
                />
                <input value={c} onChange={(e) => setColor(i, e.target.value)} maxLength={7} className={`${inputClass} w-32 font-mono`} />
                <button
                  type="button"
                  onClick={() => set("colors", form.colors.filter((_, idx) => idx !== i))}
                  className="text-xs text-[#1c1a17]/40 dark:text-[#faf9f7]/40 hover:text-red-600 dark:hover:text-red-400"
                >
                  Remove
                </button>
              </div>
            ))}
            {form.colors.length < MAX_COLORS && (
              <button
                type="button"
                onClick={() => set("colors", [...form.colors, "#1a5fb4"])}
                className="text-xs font-semibold text-[#ed2127] dark:text-[#f2454b] hover:underline"
              >
                + Add a color
              </button>
            )}
          </div>
        </section>
      )}

      <section className={cardClass}>
        <h2 className="font-display text-base font-semibold">Address & disclaimer</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className={labelClass}>Street address</label>
            <input value={form.address_line1} onChange={(e) => set("address_line1", e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>City</label>
            <input value={form.city} onChange={(e) => set("city", e.target.value)} className={inputClass} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>State</label>
              <input value={form.state} onChange={(e) => set("state", e.target.value)} maxLength={20} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>ZIP</label>
              <input value={form.zip} onChange={(e) => set("zip", e.target.value)} maxLength={12} className={inputClass} />
            </div>
          </div>
        </div>
        <div>
          <label className={labelClass}>Footer disclaimer</label>
          <textarea value={form.disclaimer} onChange={(e) => set("disclaimer", e.target.value)} rows={3} className={inputClass} />
        </div>
        {org.franchise_disclaimer && (
          <div>
            <label className={labelClass}>Franchise disclosure</label>
            <p className="text-xs leading-relaxed rounded-lg bg-black/[0.03] dark:bg-white/[0.05] px-3.5 py-2.5 text-[#1c1a17]/70 dark:text-[#faf9f7]/70">{org.franchise_disclaimer}</p>
            <p className={hintClass}>Set by Latchpoint. Ask us if it needs to change.</p>
          </div>
        )}
      </section>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      <button type="submit" disabled={saving || !dirty} className="rounded-full bg-[#1c1a17] dark:bg-[#f2454b] text-white text-sm font-semibold px-6 py-3 disabled:opacity-50">
        {saving ? "Saving…" : "Save brand settings"}
      </button>
      <FormSaveBar dirty={dirty} saving={saving} saved={justSaved} error={error} />
    </form>
  );
}
