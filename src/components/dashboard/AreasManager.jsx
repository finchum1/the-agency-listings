import { useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import ImageUploadField from "./ImageUploadField";

const emptyForm = { slug: "", name: "", blurb: "", description: "", photo_url: "" };

function slugify(str) {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export default function AreasManager({ agentSiteId, areas, onChanged }) {
  const [editingId, setEditingId] = useState(null); // null = closed, "new" = adding
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const inputClass =
    "w-full rounded-lg border border-black/10 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#8a7a5c]/40";
  const labelClass = "block text-xs font-medium text-[#1c1a17]/60 mb-1.5";

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
        ? await supabase
            .from("agent_site_areas")
            .insert({ ...payload, agent_site_id: agentSiteId, sort_order: areas.length })
        : await supabase.from("agent_site_areas").update(payload).eq("id", editingId);

    setSaving(false);
    if (error) {
      setError(error.message);
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
      supabase.from("agent_site_areas").update({ sort_order: swapWith.sort_order }).eq("id", area.id),
      supabase.from("agent_site_areas").update({ sort_order: area.sort_order }).eq("id", swapWith.id),
    ]);
    onChanged?.();
  };

  const remove = async (area) => {
    if (!confirm(`Delete "${area.name}"?`)) return;
    await supabase.from("agent_site_areas").delete().eq("id", area.id);
    onChanged?.();
  };

  // For the photo uploader we need a real agent_site_id-scoped folder —
  // works fine even for a not-yet-saved new area, since the upload just
  // needs the site id, not the area's own id.
  const newAreaTempId = agentSiteId;

  return (
    <div className="bg-white border border-black/5 rounded-2xl p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold">Areas of Expertise</h2>
        {editingId === null && (
          <button
            type="button"
            onClick={startAdd}
            className="text-xs font-semibold text-[#8a7a5c] hover:underline"
          >
            + Add area
          </button>
        )}
      </div>

      {areas.length === 0 && editingId === null && (
        <p className="text-sm text-[#1c1a17]/40">No areas yet.</p>
      )}

      {areas.length > 0 && (
        <div className="space-y-2">
          {areas.map((area, i) => (
            <div
              key={area.id}
              className="border border-black/10 rounded-xl p-3 flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-10 w-10 rounded-lg bg-black/5 overflow-hidden shrink-0">
                  {area.photo_url && (
                    <img src={area.photo_url} alt="" className="h-full w-full object-cover" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{area.name}</p>
                  <p className="text-xs text-[#1c1a17]/50 truncate">{area.blurb}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0 text-xs">
                <button onClick={() => move(area, -1)} disabled={i === 0} className="text-[#1c1a17]/40 hover:text-[#1c1a17] disabled:opacity-30">↑</button>
                <button onClick={() => move(area, 1)} disabled={i === areas.length - 1} className="text-[#1c1a17]/40 hover:text-[#1c1a17] disabled:opacity-30">↓</button>
                <button onClick={() => startEdit(area)} className="text-[#1c1a17]/60 hover:text-[#1c1a17]">Edit</button>
                <button onClick={() => remove(area)} className="text-[#1c1a17]/40 hover:text-red-600">✕</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editingId !== null && (
        <form onSubmit={handleSubmit} className="space-y-3 pt-3 border-t border-black/5">
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
            <label className={labelClass}>Full description (shown on the area's own page)</label>
            <textarea value={form.description} onChange={update("description")} rows={4} className={inputClass} />
          </div>
          <ImageUploadField
            bucket="agent-site-photos"
            folder={newAreaTempId}
            value={form.photo_url}
            onChange={(url) => setForm((f) => ({ ...f, photo_url: url || "" }))}
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded-full bg-[#1c1a17] text-white text-sm font-semibold px-5 py-2.5 hover:bg-[#1c1a17]/90 transition-colors disabled:opacity-60"
            >
              {saving ? "Saving…" : editingId === "new" ? "Add Area" : "Save Changes"}
            </button>
            <button type="button" onClick={cancel} className="text-sm text-[#1c1a17]/50 hover:text-[#1c1a17]">
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
