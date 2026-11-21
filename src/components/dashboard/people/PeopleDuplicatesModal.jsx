import { useMemo, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { bestPersonToKeep, personDuplicateGroups } from "../../../lib/peopleDuplicates";

const muted = "text-[#1c1a17]/55 dark:text-[#faf9f7]/55";
const NOT_SAME_KEY = "peopleNotDupes";
const readHidden = () => {
  try {
    return new Set(JSON.parse(window.localStorage.getItem(NOT_SAME_KEY) || "[]"));
  } catch {
    return new Set();
  }
};
const REASON = { email: "Same email", phone: "Same phone", name: "Same name" };

/** Number of repeated groups still worth a look (not marked "not the same person"). */
export const countRepeats = (people) => {
  const hidden = readHidden();
  return personDuplicateGroups(people).filter((g) => !hidden.has(g.id)).length;
};

// Possible repeats on Leads and Pipeline: pick the one to keep in each group and merge the rest into it (supabase/merge-people.sql: notes, drafts, plans,
// saved searches and CMAs move over; blanks are filled in; the earlier follow-up date wins). "Not the same person" hides a group on this computer.
export default function PeopleDuplicatesModal({ people, onClose, onMerged }) {
  const [hidden, setHidden] = useState(readHidden);
  const [keep, setKeep] = useState({});
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const groups = useMemo(() => personDuplicateGroups(people), [people]);
  const shown = groups.filter((g) => !hidden.has(g.id));

  const notSame = (g) => {
    const next = new Set(hidden).add(g.id);
    setHidden(next);
    try {
      window.localStorage.setItem(NOT_SAME_KEY, JSON.stringify([...next]));
    } catch {
      /* hidden until the page reloads */
    }
  };
  const merge = async (g) => {
    const keepId = keep[g.id] || bestPersonToKeep(g.members).id;
    setBusy(g.id);
    setError("");
    for (const m of g.members.filter((x) => x.id !== keepId)) {
      const { error: err } = await supabase.rpc("merge_people", { p_keep: keepId, p_remove: m.id });
      if (err) {
        setError(err.message);
        break;
      }
    }
    await onMerged?.();
    setBusy("");
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 px-4" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-2xl max-h-[88vh] overflow-y-auto rounded-2xl bg-white dark:bg-[#1a1a1a] p-6 shadow-2xl" role="dialog" aria-label="Possible repeats">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-display text-xl font-semibold">{shown.length ? `${shown.length} possible repeat${shown.length === 1 ? "" : "s"}` : "No repeats found"}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className={`p-1 ${muted}`}>✕</button>
        </div>
        <p className={`text-sm ${muted}`}>People on Leads and Pipeline who share an email, a phone number or a name. Pick the one to keep and merge: notes, drafts and plans move over and blanks are filled in. "Same name only" is the weakest match, so check it first.</p>
        {shown.length === 0 && <p className={`mt-4 text-sm ${muted}`}>Nothing to merge right now.</p>}
        <div className="mt-4 space-y-4">
          {shown.map((g) => {
            const keepId = keep[g.id] || bestPersonToKeep(g.members).id;
            return (
              <div key={g.id} className="rounded-xl border border-black/10 dark:border-white/15 p-3">
                <p className={`mb-2 text-xs font-semibold uppercase tracking-wide ${muted}`}>{g.reasons.length === 1 && g.reasons[0] === "name" ? "Same name only" : g.reasons.map((r) => REASON[r]).join(" · ")}</p>
                <div className="space-y-1.5">
                  {g.members.map((p) => (
                    <label key={p.id} className={`flex items-start gap-3 rounded-lg border p-2.5 cursor-pointer ${keepId === p.id ? "border-[#D8091B] dark:border-[#f2454b] bg-[#D8091B]/[0.04]" : "border-black/10 dark:border-white/15"}`}>
                      <input type="radio" name={`keep-${g.id}`} checked={keepId === p.id} onChange={() => setKeep((k) => ({ ...k, [g.id]: p.id }))} className="mt-1 accent-[#D8091B]" />
                      <span className="min-w-0 text-sm">
                        <span className="flex flex-wrap items-center gap-1.5">
                          <span className="font-semibold">{p.name}</span>
                          <span className="rounded-full bg-black/[0.06] dark:bg-white/10 px-2 py-0.5 text-[10px] font-semibold">{p.stage_group === "pipeline" ? "Pipeline" : "Lead"} · {p.stage}</span>
                        </span>
                        <span className={`block truncate ${muted}`}>{[p.email, p.phone, p.source, p.property_address].filter(Boolean).join(" · ") || "No contact details"}</span>
                      </span>
                    </label>
                  ))}
                </div>
                <div className="mt-2.5 flex flex-wrap items-center gap-3">
                  <button type="button" onClick={() => merge(g)} disabled={Boolean(busy)} className="rounded-full bg-[#1c1a17] dark:bg-[#f2454b] px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">
                    {busy === g.id ? "Merging…" : `Merge ${g.members.length} into the one I picked`}
                  </button>
                  <button type="button" onClick={() => notSame(g)} disabled={Boolean(busy)} className={`text-xs font-semibold hover:underline ${muted}`}>
                    Not the same person
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        {error && <p role="alert" className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}
      </div>
    </div>
  );
}
