import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { BOARDS } from "../../../lib/peopleStages";
import { usePeopleStages } from "../../../hooks/usePeopleStages";

const inputClass =
  "w-full rounded-lg border border-black/10 dark:border-white/15 px-3.5 py-2.5 text-sm bg-transparent focus:outline-none focus:ring-2 focus:ring-[#ed2127]/40 dark:focus:ring-[#f2454b]/40";
const labelClass = "block text-xs font-medium text-[#1c1a17]/60 dark:text-[#faf9f7]/60 mb-1.5";

export const KINDS = {
  lead: { label: "Add lead", title: "Add a lead", where: "Leads" },
  pipeline: { label: "Add to pipeline", title: "Add to your pipeline", where: "Pipeline" },
};
const EMPTY = { name: "", phone: "", email: "", side: "", stage: "", follow_up: "" };

// A new lead or pipeline contact without leaving the home page.
export default function QuickAddModal({ kind, onClose, onAdded }) {
  const { stages } = usePeopleStages();
  const [f, setF] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const stageNames = stages[kind] || BOARDS[kind].stages;
  const set = (patch) => setF((prev) => ({ ...prev, ...patch }));

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const submit = async (e) => {
    e.preventDefault();
    if (!f.name.trim()) return;
    setSaving(true);
    setError("");
    const row = {
      name: f.name.trim(),
      phone: f.phone.trim(),
      email: f.email.trim(),
      stage_group: kind,
      stage: f.stage || stageNames[0],
      source: "Added manually",
      ...(f.side ? { side: f.side } : {}),
      ...(f.follow_up ? { next_follow_up: f.follow_up } : {}),
    };
    const { data, error: err } = await supabase.from("people").insert(row).select("id").single();
    setSaving(false);
    if (err) return setError(err.message);
    onAdded({ name: row.name, kind, id: data?.id });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={KINDS[kind].title}>
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/40" />
      <form onSubmit={submit} className="relative w-full max-w-md max-h-[92vh] overflow-y-auto rounded-2xl bg-white dark:bg-[#1a1a1a] text-[#1c1a17] dark:text-[#faf9f7] shadow-xl p-6 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-lg font-semibold">{KINDS[kind].title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="p-1 text-[#1c1a17]/50 dark:text-[#faf9f7]/50 hover:text-[#1c1a17] dark:hover:text-[#faf9f7]">
            ✕
          </button>
        </div>
        <div>
          <label className={labelClass}>Name</label>
          <input required autoFocus value={f.name} onChange={(e) => set({ name: e.target.value })} className={inputClass} />
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Phone</label>
            <input type="tel" value={f.phone} onChange={(e) => set({ phone: e.target.value })} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Email</label>
            <input type="email" value={f.email} onChange={(e) => set({ email: e.target.value })} className={inputClass} />
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Buyer or seller</label>
            <select value={f.side} onChange={(e) => set({ side: e.target.value })} className={inputClass}>
              <option value="">Not set</option>
              <option value="buyer">Buyer</option>
              <option value="seller">Seller</option>
              <option value="both">Both</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>Column</label>
            <select value={f.stage || stageNames[0]} onChange={(e) => set({ stage: e.target.value })} className={inputClass}>
              {stageNames.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className={labelClass}>Follow up on (optional)</label>
          <input type="date" value={f.follow_up} onChange={(e) => set({ follow_up: e.target.value })} className={inputClass} />
        </div>
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        <div className="flex items-center gap-3 pt-1">
          <button type="submit" disabled={saving || !f.name.trim()} className="rounded-full bg-[#1c1a17] dark:bg-[#f2454b] text-white text-sm font-semibold px-6 py-2.5 disabled:opacity-60">
            {saving ? "Adding…" : `Add to ${KINDS[kind].where}`}
          </button>
          <button type="button" onClick={onClose} className="text-sm text-[#1c1a17]/50 dark:text-[#faf9f7]/50 hover:text-[#1c1a17] dark:hover:text-[#faf9f7]">
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

