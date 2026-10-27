import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { NOTE_KINDS } from "../../../lib/contacts";

const muted = "text-[#1c1a17]/50 dark:text-[#faf9f7]/50";
const inputClass =
  "w-full rounded-lg border border-black/10 dark:border-white/15 px-3.5 py-2.5 text-sm bg-transparent focus:outline-none focus:ring-2 focus:ring-[#ed2127]/40 dark:focus:ring-[#f2454b]/40";
const TOUCHES = ["call", "text", "email", "meeting", "showing"]; // being in touch with them (the same kinds the Contacts record counts)

const when = (iso) => new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
const kindLabel = (k) => NOTE_KINDS.find((x) => x.value === k)?.label || "Note";

// Everything that has happened with this person in one list: the notes on their card and the activity logged on their contact record,
// newest first. New entries go on the contact record (when the card has one), so they also show in Contacts and count as being in touch.
// `onTouch` is called after a call, text, email, meeting or showing is logged, so the card can move its next follow-up along.
// `reloadKey` changes when something else (a draft message being logged) added an entry.
export function useProspectActivity(person, reloadKey, enabled = true) {
  const [items, setItems] = useState([]);
  const load = useCallback(async () => {
    if (!enabled) return;
    const [n, c] = await Promise.all([
      supabase.from("people_notes").select("id, body, created_at").eq("person_id", person.id),
      person.contact_id ? supabase.from("contact_notes").select("id, kind, body, occurred_at").eq("contact_id", person.contact_id) : Promise.resolve({ data: [] }),
    ]);
    setItems(
      [
        ...(n.data || []).map((x) => ({ key: `p${x.id}`, id: x.id, table: "people_notes", kind: "note", body: x.body, at: x.created_at })),
        ...(c.data || []).map((x) => ({ key: `c${x.id}`, id: x.id, table: "contact_notes", kind: x.kind, body: x.body, at: x.occurred_at })),
      ].sort((a, b) => b.at.localeCompare(a.at)),
    );
  }, [person.id, person.contact_id, enabled]);
  useEffect(() => {
    load();
  }, [load, reloadKey]);
  return { items, reload: load };
}

export function ActivityList({ items, onDelete, limit }) {
  const shown = limit ? items.slice(0, limit) : items;
  if (!shown.length) return <p className={`text-sm ${muted}`}>Nothing logged yet.</p>;
  return (
    <ul className="space-y-2">
      {shown.map((n) => (
        <li key={n.key} className="rounded-xl bg-black/[0.03] dark:bg-white/[0.05] p-3">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-black/[0.07] dark:bg-white/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">{kindLabel(n.kind)}</span>
            <span className={`text-[11px] ${muted}`}>{when(n.at)}</span>
            {onDelete && (
              <button type="button" onClick={() => onDelete(n)} className={`ml-auto text-[11px] ${muted} hover:text-red-600 dark:hover:text-red-400`}>
                Delete
              </button>
            )}
          </div>
          {n.body && <p className="mt-1.5 whitespace-pre-wrap text-sm">{n.body}</p>}
        </li>
      ))}
    </ul>
  );
}

export default function ProspectActivity({ person, activity, onTouch, onError }) {
  const [kind, setKind] = useState("note");
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);

  const add = async (e) => {
    e.preventDefault();
    const body = text.trim();
    if (!body && kind === "note") return;
    setSaving(true);
    const { error } = person.contact_id
      ? await supabase.from("contact_notes").insert({ contact_id: person.contact_id, kind, body })
      : await supabase.from("people_notes").insert({ person_id: person.id, body: body || kindLabel(kind) });
    setSaving(false);
    if (error) return onError?.(error.message);
    setText("");
    setKind("note");
    activity.reload();
    if (TOUCHES.includes(kind)) onTouch?.();
  };

  const remove = async (n) => {
    if (!confirm("Delete this entry?")) return;
    await supabase.from(n.table).delete().eq("id", n.id);
    activity.reload();
  };

  return (
    <div className="space-y-5">
      <form onSubmit={add} className="space-y-2.5">
        <div role="group" aria-label="What happened" className="flex flex-wrap gap-1.5">
          {NOTE_KINDS.map((k) => (
            <button
              key={k.value}
              type="button"
              aria-pressed={kind === k.value}
              onClick={() => setKind(k.value)}
              className={`rounded-full px-3 py-1 text-xs font-semibold ${kind === k.value ? "bg-[#1c1a17] text-white dark:bg-[#faf9f7] dark:text-[#1c1a17]" : "border border-black/10 dark:border-white/15 hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"}`}
            >
              {k.label}
            </button>
          ))}
        </div>
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} placeholder={kind === "note" ? "A note about them, what they're looking for…" : `What was said on the ${kindLabel(kind).toLowerCase()}? (optional)`} className={inputClass} />
        <div className="flex items-center gap-3">
          <button type="submit" disabled={saving || (kind === "note" && !text.trim())} className="rounded-full bg-[#1c1a17] dark:bg-[#f2454b] px-5 py-2 text-sm font-semibold text-white disabled:opacity-60">
            {saving ? "Saving…" : kind === "note" ? "Add note" : `Log ${kindLabel(kind).toLowerCase()}`}
          </button>
          {TOUCHES.includes(kind) && <span className={`text-xs ${muted}`}>Counts as following up.</span>}
        </div>
      </form>
      <ActivityList items={activity.items} onDelete={remove} />
    </div>
  );
}
