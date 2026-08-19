import { useMemo, useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import { useBuyerNeeds } from "../../hooks/useBuyerNeeds";
import { useAgents } from "../../hooks/useAgents";
import { supabase } from "../../lib/supabaseClient";
import FilterBar from "./FilterBar";
import BuyerNeedsTable from "./BuyerNeedsTable";

const STATUS_LABELS = { active: "Actively Looking", matched: "Matched", closed: "Closed" };
const STATUS_COLORS = { active: "#1c7c4d", matched: "#b5860b", closed: "#5a5a5a" };

function emptyForm(defaultAgentId) {
  return {
    agent_id: defaultAgentId || "",
    status: "active",
    buyer_name: "",
    buyer_contact: "",
    min_price: "",
    max_price: "",
    min_beds: "",
    min_baths: "",
    areas: "",
    property_type: "",
    notes: "",
  };
}

export default function BuyerNeedsSection() {
  const { user, isAdmin } = useAuth();
  const { buyerNeeds, loading, error, refresh } = useBuyerNeeds();
  const { agents } = useAgents();
  const [editingId, setEditingId] = useState(null); // null closed, "new" adding
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const emptyFilters = { status: "all", agentId: "", minPrice: "", maxPrice: "", minBeds: "", minBaths: "" };
  const [filters, setFilters] = useState(emptyFilters);
  const hasActiveFilters = Object.entries(filters).some(([key, value]) => value !== emptyFilters[key]);

  // Price filters here mean something different than on
  // UpcomingListingsPage: a buyer need already IS a price range
  // (min_price/max_price), so "Min Price"/"Max Price" define a window
  // and a row passes if its own range OVERLAPS that window at all — the
  // real question an agent's asking is "does this buyer's budget reach
  // this price point," not "does their exact min/max match it." Min
  // Beds/Baths filter against the buyer's own min_beds/min_baths (their
  // stated requirement) with ">= filter" — "buyers who need at least N."
  const filtered = useMemo(() => {
    return buyerNeeds.filter((row) => {
      if (filters.status !== "all" && row.status !== filters.status) return false;
      if (filters.agentId && row.agent_id !== filters.agentId) return false;
      if (filters.minPrice !== "" && row.max_price != null && row.max_price < Number(filters.minPrice)) return false;
      if (filters.maxPrice !== "" && row.min_price != null && row.min_price > Number(filters.maxPrice)) return false;
      if (filters.minBeds !== "" && (row.min_beds == null || row.min_beds < Number(filters.minBeds))) return false;
      if (filters.minBaths !== "" && (row.min_baths == null || row.min_baths < Number(filters.minBaths))) return false;
      return true;
    });
  }, [buyerNeeds, filters]);

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
      buyer_name: row.buyer_name || "",
      buyer_contact: row.buyer_contact || "",
      min_price: row.min_price ?? "",
      max_price: row.max_price ?? "",
      min_beds: row.min_beds ?? "",
      min_baths: row.min_baths ?? "",
      areas: row.areas || "",
      property_type: row.property_type || "",
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
    if (!form.buyer_name.trim()) {
      setFormError("Give the buyer a name (can be informal, e.g. \"the Websters\").");
      return;
    }
    setSaving(true);
    setFormError("");

    const payload = {
      agent_id: form.agent_id,
      status: form.status,
      buyer_name: form.buyer_name.trim(),
      buyer_contact: form.buyer_contact.trim(),
      min_price: form.min_price === "" ? null : Number(form.min_price),
      max_price: form.max_price === "" ? null : Number(form.max_price),
      min_beds: form.min_beds === "" ? null : Number(form.min_beds),
      min_baths: form.min_baths === "" ? null : Number(form.min_baths),
      areas: form.areas.trim(),
      property_type: form.property_type.trim(),
      notes: form.notes,
    };

    const { error } =
      editingId === "new"
        ? await supabase.from("buyer_needs").insert(payload)
        : await supabase.from("buyer_needs").update(payload).eq("id", editingId);

    setSaving(false);
    if (error) {
      setFormError(error.message);
      return;
    }
    cancel();
    refresh();
  };

  const handleStatusChange = async (id, status) => {
    const { error } = await supabase.from("buyer_needs").update({ status }).eq("id", id);
    if (error) {
      console.error(error);
      alert("Couldn't update status: " + error.message);
    } else {
      refresh();
    }
  };

  const remove = async (row) => {
    if (!confirm(`Delete this buyer need${row.buyer_name ? ` (${row.buyer_name})` : ""}?`)) return;
    const { error } = await supabase.from("buyer_needs").delete().eq("id", row.id);
    if (error) {
      alert("Couldn't delete: " + error.message);
    } else {
      refresh();
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-3 flex-wrap mb-5">
        <div>
          <h2 className="text-xl font-display font-semibold">Buyer Needs</h2>
          <p className="text-sm text-[#1c1a17]/60 mt-1">
            {hasActiveFilters
              ? `Showing ${filtered.length} of ${buyerNeeds.length}`
              : "What the office's current buyers are looking for — check here before you pass on a lead."}
          </p>
        </div>
        {editingId === null && (
          <button
            onClick={startAdd}
            className="rounded-full bg-[#1c1a17] text-white text-sm font-semibold px-5 py-2.5 hover:bg-[#1c1a17]/90 transition-colors"
          >
            + Add Buyer Need
          </button>
        )}
      </div>

      {editingId !== null && (
        <form onSubmit={handleSubmit} className="bg-white border border-black/5 rounded-2xl p-6 space-y-4 mb-6">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Buyer</label>
              <input required value={form.buyer_name} onChange={update("buyer_name")} className={inputClass} placeholder="Name (can be informal)" />
            </div>
            <div>
              <label className={labelClass}>Buyer Contact (optional)</label>
              <input value={form.buyer_contact} onChange={update("buyer_contact")} className={inputClass} placeholder="Phone or email" />
            </div>
          </div>

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
            <div>
              <label className={labelClass}>Min Price</label>
              <input type="number" min="0" value={form.min_price} onChange={update("min_price")} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Max Price</label>
              <input type="number" min="0" value={form.max_price} onChange={update("max_price")} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Min Beds</label>
              <input type="number" min="0" value={form.min_beds} onChange={update("min_beds")} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Min Baths</label>
              <input type="number" min="0" step="0.5" value={form.min_baths} onChange={update("min_baths")} className={inputClass} />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Areas / Neighborhoods</label>
              <input value={form.areas} onChange={update("areas")} className={inputClass} placeholder="e.g. Edmond, Nichols Hills" />
            </div>
            <div>
              <label className={labelClass}>Property Type (optional)</label>
              <input value={form.property_type} onChange={update("property_type")} className={inputClass} placeholder="e.g. Single story, no pool required" />
            </div>
          </div>

          <div>
            <label className={labelClass}>Notes</label>
            <textarea value={form.notes} onChange={update("notes")} rows={4} className={inputClass} placeholder="Must-haves, timeline, financing details, anything else worth knowing…" />
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

      {buyerNeeds.length > 0 && (
        <FilterBar
          statusLabels={STATUS_LABELS}
          statusColors={STATUS_COLORS}
          statusValue={filters.status}
          onStatusChange={(status) => setFilters((f) => ({ ...f, status }))}
          agents={agents}
          agentValue={filters.agentId}
          onAgentChange={(agentId) => setFilters((f) => ({ ...f, agentId }))}
          minPrice={filters.minPrice}
          maxPrice={filters.maxPrice}
          onMinPriceChange={(minPrice) => setFilters((f) => ({ ...f, minPrice }))}
          onMaxPriceChange={(maxPrice) => setFilters((f) => ({ ...f, maxPrice }))}
          minBeds={filters.minBeds}
          onMinBedsChange={(minBeds) => setFilters((f) => ({ ...f, minBeds }))}
          minBaths={filters.minBaths}
          onMinBathsChange={(minBaths) => setFilters((f) => ({ ...f, minBaths }))}
          onClear={() => setFilters(emptyFilters)}
          hasActiveFilters={hasActiveFilters}
        />
      )}

      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}
      {loading ? (
        <p className="text-sm text-[#1c1a17]/50">Loading…</p>
      ) : buyerNeeds.length === 0 ? (
        <div className="bg-white border border-black/5 rounded-2xl p-12 text-center">
          <p className="text-[#1c1a17]/60">No buyer needs yet.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-black/5 rounded-2xl p-12 text-center">
          <p className="text-[#1c1a17]/60">No buyer needs match those filters.</p>
        </div>
      ) : (
        <BuyerNeedsTable
          rows={filtered}
          statusLabels={STATUS_LABELS}
          statusColors={STATUS_COLORS}
          canEdit={canEdit}
          onStatusChange={handleStatusChange}
          onEdit={startEdit}
          onDelete={remove}
        />
      )}
    </div>
  );
}
