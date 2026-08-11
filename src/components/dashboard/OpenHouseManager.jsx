import { useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { formatDateTime } from "../../lib/format";

export default function OpenHouseManager({ listingId, openHouses, onChanged }) {
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!startsAt) return;
    setSaving(true);
    setError("");
    const { error } = await supabase.from("open_houses").insert({
      listing_id: listingId,
      starts_at: new Date(startsAt).toISOString(),
      ends_at: endsAt ? new Date(endsAt).toISOString() : null,
      notes,
    });
    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    setStartsAt("");
    setEndsAt("");
    setNotes("");
    onChanged?.();
  };

  const remove = async (id) => {
    await supabase.from("open_houses").delete().eq("id", id);
    onChanged?.();
  };

  const inputClass =
    "w-full rounded-lg border border-black/10 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#8a7a5c]/40";

  return (
    <div className="bg-white border border-black/5 rounded-2xl p-6 space-y-4">
      <h2 className="font-display text-lg font-semibold">Open Houses</h2>

      {openHouses.length === 0 ? (
        <p className="text-sm text-[#1c1a17]/40">None scheduled.</p>
      ) : (
        <ul className="space-y-2">
          {openHouses.map((oh) => (
            <li
              key={oh.id}
              className="flex items-center justify-between border border-black/5 rounded-lg px-4 py-2.5 text-sm"
            >
              <div>
                <p className="font-medium">
                  {formatDateTime(oh.starts_at)}
                  {oh.ends_at ? ` – ${formatDateTime(oh.ends_at)}` : ""}
                </p>
                {oh.notes && <p className="text-xs text-[#1c1a17]/50">{oh.notes}</p>}
              </div>
              <button
                type="button"
                onClick={() => remove(oh.id)}
                className="text-xs text-red-600 hover:underline"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={handleAdd} className="grid sm:grid-cols-3 gap-3 pt-2 border-t border-black/5">
        <div>
          <label className="block text-xs font-medium text-[#1c1a17]/60 mb-1.5">Starts</label>
          <input
            required
            type="datetime-local"
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-[#1c1a17]/60 mb-1.5">Ends (optional)</label>
          <input
            type="datetime-local"
            value={endsAt}
            onChange={(e) => setEndsAt(e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-[#1c1a17]/60 mb-1.5">Notes (optional)</label>
          <input value={notes} onChange={(e) => setNotes(e.target.value)} className={inputClass} />
        </div>
        <div className="sm:col-span-3">
          {error && <p className="text-sm text-red-600 mb-2">{error}</p>}
          <button
            type="submit"
            disabled={saving}
            className="rounded-full bg-black/5 text-[#1c1a17] text-sm font-semibold px-5 py-2 hover:bg-black/10 transition-colors disabled:opacity-60"
          >
            {saving ? "Adding…" : "+ Add Open House"}
          </button>
        </div>
      </form>
    </div>
  );
}
