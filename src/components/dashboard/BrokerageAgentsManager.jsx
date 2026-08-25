import { useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import ImageUploadField from "./ImageUploadField";

const emptyForm = {
  slug: "",
  name: "",
  title: "Real Estate Agent",
  license: "",
  phone: "",
  email: "",
  photo_url: "",
  specialties: "",
  bio: "",
};

function slugify(str) {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

// Roster CRUD for the brokerage site's "Agents" page — a standalone list
// (brokerage_agents), not the dashboard's own Agents admin page
// (profiles/AgentsPage.jsx): most people on this roster don't have, and
// don't need, a dashboard login. Drag isn't offered for ordering — a
// plain sort_order number field is enough for a list this size and
// avoids pulling in a drag library for one screen.
export default function BrokerageAgentsManager({ brokerageSiteId, agents, onChanged }) {
  const [editingId, setEditingId] = useState(null); // null closed, "new" adding
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const inputClass =
    "w-full rounded-lg border border-black/10 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#ed2127]/40";
  const labelClass = "block text-xs font-medium text-[#1c1a17]/60 mb-1.5";

  const startAdd = () => {
    setForm(emptyForm);
    setEditingId("new");
  };

  const startEdit = (agent) => {
    setForm({
      slug: agent.slug,
      name: agent.name,
      title: agent.title || "",
      license: agent.license || "",
      phone: agent.phone || "",
      email: agent.email || "",
      photo_url: agent.photo_url || "",
      specialties: (agent.specialties || []).join(", "),
      bio: agent.bio || "",
    });
    setEditingId(agent.id);
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
      title: form.title,
      license: form.license,
      phone: form.phone,
      email: form.email,
      photo_url: form.photo_url || null,
      specialties: form.specialties
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      bio: form.bio,
    };

    const { error } =
      editingId === "new"
        ? await supabase.from("brokerage_agents").insert({ ...payload, sort_order: agents.length })
        : await supabase.from("brokerage_agents").update(payload).eq("id", editingId);

    setSaving(false);
    if (error) {
      setError(error.code === "23505" ? "That slug is already used by another agent." : error.message);
      return;
    }
    cancel();
    onChanged?.();
  };

  const remove = async (agent) => {
    if (!confirm(`Remove ${agent.name} from the roster?`)) return;
    await supabase.from("brokerage_agents").delete().eq("id", agent.id);
    onChanged?.();
  };

  const move = async (agent, direction) => {
    const sorted = [...agents].sort((a, b) => a.sort_order - b.sort_order);
    const i = sorted.findIndex((a) => a.id === agent.id);
    const j = i + direction;
    if (j < 0 || j >= sorted.length) return;
    const other = sorted[j];
    await Promise.all([
      supabase.from("brokerage_agents").update({ sort_order: other.sort_order }).eq("id", agent.id),
      supabase.from("brokerage_agents").update({ sort_order: agent.sort_order }).eq("id", other.id),
    ]);
    onChanged?.();
  };

  const sorted = [...agents].sort((a, b) => a.sort_order - b.sort_order);

  return (
    <div className="bg-white border border-black/5 rounded-2xl p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold">Agent Roster</h2>
        {editingId === null && (
          <button type="button" onClick={startAdd} className="text-xs font-semibold text-[#ed2127] hover:underline">
            + Add agent
          </button>
        )}
      </div>

      {sorted.length === 0 && editingId === null && <p className="text-sm text-[#1c1a17]/40">No agents yet.</p>}

      {sorted.length > 0 && (
        <div className="space-y-2">
          {sorted.map((agent, i) => (
            <div key={agent.id} className="border border-black/10 rounded-xl p-3 flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-black/5 overflow-hidden shrink-0">
                {agent.photo_url && <img src={agent.photo_url} alt="" className="h-full w-full object-cover" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{agent.name}</p>
                <p className="text-xs text-[#1c1a17]/50 truncate">{agent.title}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0 text-xs">
                <button onClick={() => move(agent, -1)} disabled={i === 0} className="text-[#1c1a17]/40 hover:text-[#1c1a17] disabled:opacity-20 px-1" title="Move earlier">↑</button>
                <button onClick={() => move(agent, 1)} disabled={i === sorted.length - 1} className="text-[#1c1a17]/40 hover:text-[#1c1a17] disabled:opacity-20 px-1" title="Move later">↓</button>
                <button onClick={() => startEdit(agent)} className="text-[#1c1a17]/60 hover:text-[#1c1a17]">Edit</button>
                <button onClick={() => remove(agent)} className="text-[#1c1a17]/40 hover:text-red-600">✕</button>
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
              <input required value={form.name} onChange={update("name")} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Slug</label>
              <input required value={form.slug} onChange={update("slug")} className={inputClass} />
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Title</label>
              <input value={form.title} onChange={update("title")} className={inputClass} placeholder="Real Estate Agent" />
            </div>
            <div>
              <label className={labelClass}>License #</label>
              <input value={form.license} onChange={update("license")} className={inputClass} />
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Phone</label>
              <input value={form.phone} onChange={update("phone")} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Email</label>
              <input type="email" value={form.email} onChange={update("email")} className={inputClass} />
            </div>
          </div>
          <ImageUploadField
            bucket="brokerage-site-photos"
            folder={brokerageSiteId}
            value={form.photo_url}
            onChange={(url) => setForm((f) => ({ ...f, photo_url: url || "" }))}
            label="Headshot"
          />
          <div>
            <label className={labelClass}>Specialties (comma-separated)</label>
            <input
              value={form.specialties}
              onChange={update("specialties")}
              className={inputClass}
              placeholder="Luxury Market, New Construction, Oklahoma City Metro"
            />
          </div>
          <div>
            <label className={labelClass}>Bio</label>
            <textarea value={form.bio} onChange={update("bio")} rows={4} className={inputClass} />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded-full bg-[#1c1a17] text-white text-sm font-semibold px-5 py-2.5 hover:bg-[#1c1a17]/90 transition-colors disabled:opacity-60"
            >
              {saving ? "Saving…" : editingId === "new" ? "Add Agent" : "Save Changes"}
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
