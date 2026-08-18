import { useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import { useUpcomingListings } from "../../hooks/useUpcomingListings";
import { useAgents } from "../../hooks/useAgents";
import { supabase } from "../../lib/supabaseClient";
import { formatPrice } from "../../lib/format";
import PillSelect from "./PillSelect";

const STATUS_LABELS = { active: "Coming Soon", listed: "Now Listed", cancelled: "Cancelled" };
const STATUS_COLORS = { active: "#b5860b", listed: "#1c7c4d", cancelled: "#9a3b3b" };

const PROPERTY_TYPES = [
  "Single Family Home",
  "Condo",
  "Townhouse",
  "Multi-Family",
  "Land",
  "Other",
];

function emptyForm(defaultAgentId) {
  return {
    agent_id: defaultAgentId || "",
    status: "active",
    address_line1: "",
    city: "",
    state: "OK",
    zip: "",
    price_estimate: "",
    beds: "",
    baths: "",
    sqft: "",
    property_type: "Single Family Home",
    lot_size: "",
    expected_list_date: "",
    notes: "",
  };
}

export default function UpcomingListingsPage() {
  const { user, isAdmin } = useAuth();
  const { upcomingListings, loading, error, refresh } = useUpcomingListings();
  const { agents } = useAgents();
  const [editingId, setEditingId] = useState(null); // null closed, "new" adding
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const inputClass =
    "w-full rounded-lg border border-black/10 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#ed2127]/40";
  const labelClass = "block text-xs font-medium text-[#1c1a17]/60 mb-1.5";

  const canEdit = (row) => isAdmin || row.agent_id === user?.id;

  const startAdd = () => {
    setForm(emptyForm(user?.id));
    setFormError("");
    setEditingId("new");
  };

  const startEdit = (row) => {
    setForm({
      agent_id: row.agent_id,
      status: row.status,
      address_line1: row.address_line1 || "",
      city: row.city || "",
      state: row.state || "OK",
      zip: row.zip || "",
      price_estimate: row.price_estimate ?? "",
      beds: row.beds ?? "",
      baths: row.baths ?? "",
      sqft: row.sqft ?? "",
      property_type: row.property_type || "Single Family Home",
      lot_size: row.lot_size || "",
      expected_list_date: row.expected_list_date || "",
      notes: row.notes || "",
    });
    setFormError("");
    setEditingId(row.id);
  };

  const cancel = () => {
    setEditingId(null);
    setForm(emptyForm());
    setFormError("");
  };

  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.agent_id) {
      setFormError("Pick which agent this is for.");
      return;
    }
    setSaving(true);
    setFormError("");

    const payload = {
      agent_id: form.agent_id,
      status: form.status,
      address_line1: form.address_line1.trim(),
      city: form.city.trim(),
      state: form.state.trim(),
      zip: form.zip.trim(),
      price_estimate: form.price_estimate === "" ? null : Number(form.price_estimate),
      beds: form.beds === "" ? null : Number(form.beds),
      baths: form.baths === "" ? null : Number(form.baths),
      sqft: form.sqft === "" ? null : Number(form.sqft),
      property_type: form.property_type,
      lot_size: form.lot_size.trim(),
      expected_list_date: form.expected_list_date || null,
      notes: form.notes,
    };

    const { error } =
      editingId === "new"
        ? await supabase.from("upcoming_listings").insert(payload)
        : await supabase.from("upcoming_listings").update(payload).eq("id", editingId);

    setSaving(false);
    if (error) {
      setFormError(error.message);
      return;
    }
    cancel();
    refresh();
  };

  const handleStatusChange = async (id, status) => {
    const { error } = await supabase.from("upcoming_listings").update({ status }).eq("id", id);
    if (error) {
      console.error(error);
      alert("Couldn't update status: " + error.message);
    } else {
      refresh();
    }
  };

  const remove = async (row) => {
    if (!confirm(`Delete this upcoming listing${row.address_line1 ? ` (${row.address_line1})` : ""}?`)) return;
    const { error } = await supabase.from("upcoming_listings").delete().eq("id", row.id);
    if (error) {
      alert("Couldn't delete: " + error.message);
    } else {
      refresh();
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-display font-semibold">Upcoming Listings</h1>
          <p className="text-sm text-[#1c1a17]/60 mt-1">
            Coming-soon properties the office knows about, before they're a real listing.
          </p>
        </div>
        {editingId === null && (
          <button
            onClick={startAdd}
            className="rounded-full bg-[#1c1a17] text-white text-sm font-semibold px-5 py-2.5 hover:bg-[#1c1a17]/90 transition-colors"
          >
            + Add Upcoming Listing
          </button>
        )}
      </div>

      {editingId !== null && (
        <form onSubmit={handleSubmit} className="bg-white border border-black/5 rounded-2xl p-6 space-y-4 mb-6">
          <div className="grid sm:grid-cols-2 gap-4">
            {isAdmin && (
              <div>
                <label className={labelClass}>Agent</label>
                <select
                  required
                  value={form.agent_id}
                  onChange={(e) => setForm((f) => ({ ...f, agent_id: e.target.value }))}
                  className={inputClass}
                >
                  <option value="" disabled>
                    Select an agent…
                  </option>
                  {agents.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.full_name || a.email}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className={labelClass}>Status</label>
              <select value={form.status} onChange={update("status")} className={inputClass}>
                {Object.entries(STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid sm:grid-cols-4 gap-4">
            <div className="sm:col-span-2">
              <label className={labelClass}>Address (if known)</label>
              <input value={form.address_line1} onChange={update("address_line1")} className={inputClass} placeholder="Street address, or just the area" />
            </div>
            <div>
              <label className={labelClass}>City</label>
              <input value={form.city} onChange={update("city")} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>State</label>
              <input value={form.state} onChange={update("state")} className={inputClass} />
            </div>
          </div>

          <div className="grid sm:grid-cols-4 gap-4">
            <div>
              <label className={labelClass}>Zip</label>
              <input value={form.zip} onChange={update("zip")} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Beds</label>
              <input type="number" min="0" value={form.beds} onChange={update("beds")} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Baths</label>
              <input type="number" min="0" step="0.5" value={form.baths} onChange={update("baths")} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Sqft</label>
              <input type="number" min="0" value={form.sqft} onChange={update("sqft")} className={inputClass} />
            </div>
          </div>

          <div className="grid sm:grid-cols-4 gap-4">
            <div>
              <label className={labelClass}>Property Type</label>
              <select value={form.property_type} onChange={update("property_type")} className={inputClass}>
                {PROPERTY_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Lot Size</label>
              <input value={form.lot_size} onChange={update("lot_size")} className={inputClass} placeholder="e.g. 0.75 acres" />
            </div>
            <div>
              <label className={labelClass}>Est. Price</label>
              <input type="number" min="0" value={form.price_estimate} onChange={update("price_estimate")} className={inputClass} placeholder="e.g. 650000" />
            </div>
            <div>
              <label className={labelClass}>Expected List Date</label>
              <input type="date" value={form.expected_list_date} onChange={update("expected_list_date")} className={inputClass} />
            </div>
          </div>

          <div>
            <label className={labelClass}>Notes</label>
            <textarea value={form.notes} onChange={update("notes")} rows={4} className={inputClass} placeholder="Anything worth remembering — seller timeline, condition, why it's not listed yet…" />
          </div>

          {formError && <p className="text-sm text-red-600">{formError}</p>}
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded-full bg-[#1c1a17] text-white text-sm font-semibold px-5 py-2.5 hover:bg-[#1c1a17]/90 transition-colors disabled:opacity-60"
            >
              {saving ? "Saving…" : editingId === "new" ? "Add" : "Save Changes"}
            </button>
            <button type="button" onClick={cancel} className="text-sm text-[#1c1a17]/50 hover:text-[#1c1a17]">
              Cancel
            </button>
          </div>
        </form>
      )}

      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}
      {loading ? (
        <p className="text-sm text-[#1c1a17]/50">Loading…</p>
      ) : upcomingListings.length === 0 ? (
        <div className="bg-white border border-black/5 rounded-2xl p-12 text-center">
          <p className="text-[#1c1a17]/60">No upcoming listings yet.</p>
        </div>
      ) : (
        <div className="bg-white border border-black/5 rounded-2xl overflow-hidden overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-black/5 text-left text-xs uppercase tracking-wider text-[#1c1a17]/40">
                <th className="px-5 py-3 font-medium">Address / Area</th>
                <th className="px-5 py-3 font-medium">Beds / Baths / Sqft</th>
                <th className="px-5 py-3 font-medium">Est. Price</th>
                <th className="px-5 py-3 font-medium">Expected</th>
                <th className="px-5 py-3 font-medium">Agent</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {upcomingListings.map((row) => (
                <tr key={row.id} className="border-b border-black/5 last:border-0 hover:bg-black/[0.02] align-top">
                  <td className="px-5 py-4">
                    <p className="font-medium">{row.address_line1 || row.city || "—"}</p>
                    {(row.city || row.state) && (
                      <p className="text-xs text-[#1c1a17]/50">
                        {[row.city, row.state, row.zip].filter(Boolean).join(", ")}
                      </p>
                    )}
                    {row.notes && (
                      <p className="text-xs text-[#1c1a17]/50 mt-1 max-w-xs truncate" title={row.notes}>
                        {row.notes}
                      </p>
                    )}
                  </td>
                  <td className="px-5 py-4 text-[#1c1a17]/70 whitespace-nowrap">
                    {[row.beds != null ? `${row.beds} bd` : null, row.baths != null ? `${row.baths} ba` : null, row.sqft != null ? `${row.sqft.toLocaleString()} sqft` : null]
                      .filter(Boolean)
                      .join(" | ") || "—"}
                  </td>
                  <td className="px-5 py-4 text-[#1c1a17]/70 whitespace-nowrap">
                    {row.price_estimate != null ? formatPrice(row.price_estimate) : "—"}
                  </td>
                  <td className="px-5 py-4 text-[#1c1a17]/70 whitespace-nowrap text-xs">
                    {row.expected_list_date
                      ? new Date(`${row.expected_list_date}T00:00:00`).toLocaleDateString()
                      : "—"}
                  </td>
                  <td className="px-5 py-4 text-[#1c1a17]/70 whitespace-nowrap">
                    {row.agent?.full_name || "—"}
                  </td>
                  <td className="px-5 py-4">
                    <PillSelect
                      value={row.status}
                      labels={STATUS_LABELS}
                      colors={STATUS_COLORS}
                      disabled={!canEdit(row)}
                      onChange={(status) => handleStatusChange(row.id, status)}
                    />
                  </td>
                  <td className="px-5 py-4 text-right whitespace-nowrap">
                    {canEdit(row) && (
                      <div className="flex items-center justify-end gap-3">
                        <button onClick={() => startEdit(row)} className="text-xs text-[#1c1a17]/60 hover:text-[#1c1a17]">
                          Edit
                        </button>
                        <button onClick={() => remove(row)} className="text-xs text-[#1c1a17]/40 hover:text-red-600">
                          Delete
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
