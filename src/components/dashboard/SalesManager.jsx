import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { formatPrice } from "../../lib/format";
import ImageUploadField from "./ImageUploadField";

const emptyForm = { address: "", city: "", state: "OK", price: "", sold_on: "", photo_url: "" };

const inputClass =
  "w-full rounded-lg border border-black/10 dark:border-white/15 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#ed2127]/40 dark:focus:ring-[#f2454b]/40";
const labelClass = "block text-xs font-medium text-[#1c1a17]/60 dark:text-[#faf9f7]/60 mb-1.5";
const muted = "text-[#1c1a17]/50 dark:text-[#faf9f7]/50";

const soldLabel = (d) => (d ? new Date(`${d}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "No date");

// The homes an agent has sold, shown on their site as "Recently Sold" right under their current listings: a photo, the
// address, the price and a "Sold <month year>" tag. Add one by hand, or copy it from one of their closed listings.
// A long run of past sales is shown a few at a time, newest first.
const SHOW_STEP = 5;

export default function SalesManager({ agentSiteId, agentId, sales, onChanged }) {
  const [editingId, setEditingId] = useState(null); // null = closed, "new" = adding
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [closed, setClosed] = useState([]);
  const [picking, setPicking] = useState(false);
  const [shown, setShown] = useState(SHOW_STEP); // how many sales the list shows; "Show more" adds another few

  // Their closed listings, so a sale can be copied over instead of retyped. One already copied is left out.
  useEffect(() => {
    if (!agentId) return;
    supabase
      .from("listings")
      .select("id, address_line1, city, state, price, updated_at, listing_photos(url, is_hero)")
      .eq("agent_id", agentId)
      .eq("status", "closed")
      .then(({ data }) => setClosed(data || []));
  }, [agentId]);
  const copyable = closed.filter((l) => !sales.some((s) => s.listing_id === l.id));

  const ordered = [...sales].sort((a, b) => (b.sold_on || "").localeCompare(a.sold_on || "") || a.sort_order - b.sort_order);
  const cancel = () => {
    setEditingId(null);
    setForm(emptyForm);
    setError("");
  };
  const startEdit = (s) => {
    setForm({ address: s.address, city: s.city || "", state: s.state || "", price: s.price ?? "", sold_on: s.sold_on || "", photo_url: s.photo_url || "" });
    setEditingId(s.id);
    setPicking(false);
  };
  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const save = async (e) => {
    e.preventDefault();
    if (!form.address.trim()) return;
    setSaving(true);
    setError("");
    const payload = {
      address: form.address.trim(),
      city: form.city.trim(),
      state: form.state.trim(),
      price: form.price === "" ? null : Number(form.price),
      sold_on: form.sold_on || null,
      photo_url: form.photo_url || null,
    };
    const { error: err } =
      editingId === "new"
        ? await supabase.from("agent_site_sales").insert({ ...payload, agent_site_id: agentSiteId, sort_order: sales.length })
        : await supabase.from("agent_site_sales").update(payload).eq("id", editingId);
    setSaving(false);
    if (err) return setError(err.message);
    cancel();
    onChanged?.();
  };

  const copyListing = async (l) => {
    setError("");
    const photo = l.listing_photos?.find((p) => p.is_hero)?.url || l.listing_photos?.[0]?.url || null;
    const { error: err } = await supabase.from("agent_site_sales").insert({
      agent_site_id: agentSiteId,
      address: l.address_line1,
      city: l.city || "",
      state: l.state || "",
      price: l.price ?? null,
      sold_on: (l.updated_at || "").slice(0, 10) || null,
      photo_url: photo,
      listing_id: l.id,
      sort_order: sales.length,
    });
    if (err) return setError(err.message);
    onChanged?.();
  };

  const remove = async (s) => {
    if (!confirm(`Remove "${s.address}" from your past sales?`)) return;
    await supabase.from("agent_site_sales").delete().eq("id", s.id);
    onChanged?.();
  };

  return (
    <div className="bg-white dark:bg-[#1a1a1a] border border-black/5 dark:border-white/10 rounded-2xl p-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-lg font-semibold">Past Sales</h2>
        {editingId === null && (
          <div className="flex items-center gap-4">
            {copyable.length > 0 && (
              <button type="button" onClick={() => setPicking((v) => !v)} className="text-xs font-semibold text-[#1c1a17]/60 dark:text-[#faf9f7]/60 hover:text-[#1c1a17] dark:hover:text-[#faf9f7]">
                From my closed listings
              </button>
            )}
            <button type="button" onClick={() => { setForm(emptyForm); setEditingId("new"); setPicking(false); }} className="text-xs font-semibold text-[#ed2127] dark:text-[#f2454b] hover:underline">
              + Add a sale
            </button>
          </div>
        )}
      </div>
      <p className={`text-xs ${muted}`}>Shown on your website as "Recently Sold," right under your current listings: the photo, address, price and the month it sold.</p>
      {error && editingId === null && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      {picking && editingId === null && (
        <div className="space-y-2 rounded-xl bg-black/[0.03] dark:bg-white/[0.04] p-3">
          <p className={`text-xs ${muted}`}>Copy a closed listing over. Its date starts as the day it was last updated, so check it.</p>
          {copyable.map((l) => (
            <div key={l.id} className="flex items-center justify-between gap-3">
              <p className="min-w-0 truncate text-sm">
                {l.address_line1}
                <span className={muted}> · {l.city}</span>
              </p>
              <button type="button" onClick={() => copyListing(l)} className="shrink-0 text-xs font-semibold text-[#ed2127] dark:text-[#f2454b] hover:underline">
                Add
              </button>
            </div>
          ))}
        </div>
      )}

      {ordered.length === 0 && editingId === null && !picking && <p className={`text-sm ${muted}`}>No past sales yet.</p>}

      {editingId === null && ordered.length > 0 && (
        <div className="space-y-2">
          {ordered.slice(0, shown).map((s) => (
            <div key={s.id} className="border border-black/10 dark:border-white/15 rounded-xl p-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-10 w-14 rounded-lg bg-black/5 dark:bg-white/10 overflow-hidden shrink-0">{s.photo_url && <img src={s.photo_url} alt="" className="h-full w-full object-cover" />}</div>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{s.address}</p>
                  <p className={`text-xs truncate ${muted}`}>
                    {[s.city, s.state].filter(Boolean).join(", ")}
                    {s.price ? ` · ${formatPrice(s.price)}` : ""} · Sold {soldLabel(s.sold_on)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0 text-xs">
                <button onClick={() => startEdit(s)} className="text-[#1c1a17]/60 dark:text-[#faf9f7]/60 hover:text-[#1c1a17] dark:hover:text-[#faf9f7]">Edit</button>
                <button onClick={() => remove(s)} aria-label="Remove" className="text-[#1c1a17]/40 dark:text-[#faf9f7]/40 hover:text-red-600 dark:hover:text-red-400">✕</button>
              </div>
            </div>
          ))}
          {ordered.length > shown && (
            <div className="flex justify-center pt-2">
              <button
                type="button"
                onClick={() => setShown((n) => n + SHOW_STEP)}
                className="rounded-full border border-black/15 dark:border-white/20 px-5 py-2 text-xs font-semibold text-[#1c1a17]/70 dark:text-[#faf9f7]/70 hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
              >
                Show more ({ordered.length - shown} more)
              </button>
            </div>
          )}
        </div>
      )}

      {editingId !== null && (
        <form onSubmit={save} className="space-y-3 pt-3 border-t border-black/5 dark:border-white/10">
          <div>
            <label className={labelClass}>Street address</label>
            <input required value={form.address} onChange={update("address")} className={inputClass} placeholder="1645 Saratoga Way" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className={labelClass}>City</label>
              <input value={form.city} onChange={update("city")} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>State</label>
              <input value={form.state} onChange={update("state")} className={inputClass} />
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Sold price (optional)</label>
              <input type="number" min="0" value={form.price} onChange={update("price")} className={inputClass} placeholder="425000" />
            </div>
            <div>
              <label className={labelClass}>Date sold</label>
              <input type="date" value={form.sold_on} onChange={update("sold_on")} className={inputClass} />
            </div>
          </div>
          <ImageUploadField bucket="agent-site-photos" folder={agentSiteId} value={form.photo_url} onChange={(url) => setForm((f) => ({ ...f, photo_url: url || "" }))} />
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          <div className="flex items-center gap-3">
            <button type="submit" disabled={saving} className="rounded-full bg-[#1c1a17] dark:bg-[#f2454b] text-white text-sm font-semibold px-5 py-2.5 hover:bg-[#1c1a17]/90 dark:hover:bg-[#f2454b]/90 transition-colors disabled:opacity-60">
              {saving ? "Saving…" : editingId === "new" ? "Add Sale" : "Save Changes"}
            </button>
            <button type="button" onClick={cancel} className="text-sm text-[#1c1a17]/50 dark:text-[#faf9f7]/50 hover:text-[#1c1a17] dark:hover:text-[#faf9f7]">
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
