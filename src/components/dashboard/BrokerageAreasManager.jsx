import { useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import ImageUploadField from "./ImageUploadField";
import RichTextEditor from "./RichTextEditor";

const emptyForm = { slug: "", name: "", blurb: "", description: "", photo_url: "" };

function slugify(str) {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

// "Areas of Expertise" CRUD for the brokerage site — mirrors
// AreasManager.jsx (agent sites) exactly, targeting brokerage_areas
// instead of agent_site_areas (no agent_site_id: this is the one
// office-wide list).
export default function BrokerageAreasManager({ brokerageSiteId, areas, onChanged }) {
  const [editingId, setEditingId] = useState(null); // null closed, "new" adding
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const inputClass =
    "w-full rounded-lg border border-black/10 dark:border-white/15 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#ed2127]/40 dark:focus:ring-[#f2454b]/40";
  const labelClass = "block text-xs font-medium text-[#1c1a17]/60 dark:text-[#faf9f7]/60 mb-1.5";

  const startAdd = () => {
    setForm(emptyForm);
    setEditingId("new");
  };

  const startEdit = (area) => {
    setForm({
      slug: area.slug,
      name: area.name,
      blurb: area.blurb || "",
      description: area.description || "",
      photo_url: area.photo_url || "",
    });
    setEditingId(area.id);
  };

  const cancel = () => {
    setEditingId(null);
    setForm(emptyForm);
    setError("");
  };

  const update = (field) => (e) => {
    const value = e.target.value;
    setForm((f) => ({
      ...f,
      [field]: value,
      ...(field === "name" && editingId === "new" ? { slug: slugify(value) } : {}),
    }));
  };

  const setField = (field, value) => setForm((f) => ({ ...f, [field]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.slug.trim()) return;
    setSaving(true);
    setError("");

    const payload = {
      slug: form.slug.trim(),
      name: form.name.trim(),
      blurb: form.blurb,
      description: form.description,
      photo_url: form.photo_url || null,
    };

    const { error } =
      editingId === "new"
        ? await supabase.from("brokerage_areas").insert({ ...payload, sort_order: areas.length })
        : await supabase.from("brokerage_areas").update(payload).eq("id", editingId);

    setSaving(false);
    if (error) {
      setError(error.code === "23505" ? "That slug is already used by another area." : error.message);
      return;
    }
    cancel();
    onChanged?.();
  };

  const move = async (area, direction) => {
    const idx = areas.findIndex((a) => a.id === area.id);
    const swapWith = areas[idx + direction];
    if (!swapWith) return;
    await Promise.all([
      supabase.from("brokerage_areas").update({ sort_order: swapWith.sort_order }).eq("id", area.id),
      supabase.from("brokerage_areas").update({ sort_order: area.sort_order }).eq("id", swapWith.id),
    ]);
    onChanged?.();
  };

  const remove = async (area) => {
    if (!confirm(`Delete "${area.name}"?`)) return;
    await supabase.from("brokerage_areas").delete().eq("id", area.id);
    onChanged?.();
  };

  return (
    <div className="bg-white dark:bg-[#1a1a1a] border border-black/5 dark:border-white/10 rounded-2xl p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold">Areas of Expertise</h2>
        {editingId === null && (
          <button type="button" onClick={startAdd} className="text-xs font-semibold text-[#ed2127] dark:text-[#f2454b] hover:underline">
            + Add area
          </button>
        )}
      </div>

      {areas.length === 0 && editingId === null && <p className="text-sm text-[#1c1a17]/40 dark:text-[#faf9f7]/40">No areas yet.</p>}

      {areas.length > 0 && (
        <div className="space-y-2">
          {areas.map((area, i) => (
            <div key={area.id} className="border border-black/10 dark:border-white/15 rounded-xl p-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-10 w-10 rounded-lg bg-black/5 dark:bg-white/10 overflow-hidden shrink-0">
                  {area.photo_url && <img src={area.photo_url} alt="" className="h-full w-full object-cover" />}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{area.name}</p>
                  <p className="text-xs text-[#1c1a17]/50 dark:text-[#faf9f7]/50 truncate">{area.blurb}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0 text-xs">
                <button onClick={() => move(area, -1)} disabled={i === 0} className="text-[#1c1a17]/40 dark:text-[#faf9f7]/40 hover:text-[#1c1a17] dark:hover:text-[#faf9f7] disabled:opacity-30">↑</button>
                <button onClick={() => move(area, 1)} disabled={i === areas.length - 1} className="text-[#1c1a17]/40 dark:text-[#faf9f7]/40 hover:text-[#1c1a17] dark:hover:text-[#faf9f7] disabled:opacity-30">↓</button>
                <button onClick={() => startEdit(area)} className="text-[#1c1a17]/60 dark:text-[#faf9f7]/60 hover:text-[#1c1a17] dark:hover:text-[#faf9f7]">Edit</button>
                <button onClick={() => remove(area)} className="text-[#1c1a17]/40 dark:text-[#faf9f7]/40 hover:text-red-600 dark:hover:text-red-400">✕</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editingId !== null && (
        <form onSubmit={handleSubmit} className="space-y-3 pt-3 border-t border-black/5 dark:border-white/10">
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Name</label>
              <input required value={form.name} onChange={update("name")} className={inputClass} placeholder="Nichols Hills" />
            </div>
            <div>
              <label className={labelClass}>Slug</label>
              <input required value={form.slug} onChange={update("slug")} className={inputClass} />
            </div>
          </div>
          <div>
            <label className={labelClass}>Short blurb (shown on the card)</label>
            <input value={form.blurb} onChange={update("blurb")} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Full description (reserved for a future area detail page)</label>
            <RichTextEditor value={form.description} onChange={(html) => setField("description", html)} minHeight="6rem" />
          </div>
          <ImageUploadField
            bucket="brokerage-site-photos"
            folder={brokerageSiteId}
            value={form.photo_url}
            onChange={(url) => setForm((f) => ({ ...f, photo_url: url || "" }))}
          />
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded-full bg-[#1c1a17] dark:bg-[#f2454b] text-white text-sm font-semibold px-5 py-2.5 hover:bg-[#1c1a17]/90 dark:hover:bg-[#f2454b]/90 transition-colors disabled:opacity-60"
            >
              {saving ? "Saving…" : editingId === "new" ? "Add Area" : "Save Changes"}
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
