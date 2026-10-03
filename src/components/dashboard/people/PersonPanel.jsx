import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { BOARDS, ARCHIVE_REASONS } from "../../../lib/peopleStages";
import ContactButtons from "./ContactButtons";

const inputClass =
  "w-full rounded-lg border border-black/10 dark:border-white/15 px-3.5 py-2.5 text-sm bg-transparent focus:outline-none focus:ring-2 focus:ring-[#ed2127]/40 dark:focus:ring-[#f2454b]/40";
const labelClass = "block text-xs font-medium text-[#1c1a17]/60 dark:text-[#faf9f7]/60 mb-1.5";
const primaryBtn =
  "rounded-full bg-[#1c1a17] dark:bg-[#f2454b] text-white text-sm font-semibold px-5 py-2.5 hover:bg-[#1c1a17]/90 dark:hover:bg-[#f2454b]/90 transition-colors disabled:opacity-60";

function formatNoteTime(iso) {
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export default function PersonPanel({ person, onClose, onChanged }) {
  const board = BOARDS[person.stage_group];
  const [form, setForm] = useState({
    name: person.name,
    email: person.email,
    phone: person.phone,
    source: person.source,
    next_follow_up: person.next_follow_up || "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notes, setNotes] = useState([]);
  const [noteText, setNoteText] = useState("");
  const [addingNote, setAddingNote] = useState(false);
  const [moveStage, setMoveStage] = useState(
    board.next ? BOARDS[board.next.group].stages[0] : "",
  );
  const [archiveReason, setArchiveReason] = useState(ARCHIVE_REASONS[0]);

  const loadNotes = useCallback(async () => {
    const { data } = await supabase
      .from("people_notes")
      .select("*")
      .eq("person_id", person.id)
      .order("created_at", { ascending: false });
    setNotes(data || []);
  }, [person.id]);

  useEffect(() => {
    loadNotes();
  }, [loadNotes]);

  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const patch = async (changes) => {
    setError("");
    const { error: err } = await supabase.from("people").update(changes).eq("id", person.id);
    if (err) {
      setError(err.message);
      return false;
    }
    onChanged();
    return true;
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    await patch({
      name: form.name.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      source: form.source.trim(),
      next_follow_up: form.next_follow_up || null,
    });
    setSaving(false);
  };

  const addNote = async (e) => {
    e.preventDefault();
    if (!noteText.trim()) return;
    setAddingNote(true);
    const { error: err } = await supabase
      .from("people_notes")
      .insert({ person_id: person.id, body: noteText.trim() });
    setAddingNote(false);
    if (err) {
      setError(err.message);
      return;
    }
    setNoteText("");
    loadNotes();
  };

  const deleteNote = async (id) => {
    if (!confirm("Delete this note?")) return;
    await supabase.from("people_notes").delete().eq("id", id);
    loadNotes();
  };

  const handleMove = async () => {
    if (await patch({ stage_group: board.next.group, stage: moveStage })) onClose();
  };

  const handleArchive = async () => {
    const ok = await patch({
      archived: true,
      archived_reason: archiveReason,
      archived_at: new Date().toISOString(),
    });
    if (ok) onClose();
  };

  const handleRestore = async () => {
    if (await patch({ archived: false, archived_reason: "", archived_at: null })) onClose();
  };

  const handleDelete = async () => {
    if (!confirm(`Permanently delete ${person.name} and all their notes?`)) return;
    const { error: err } = await supabase.from("people").delete().eq("id", person.id);
    if (err) {
      setError(err.message);
      return;
    }
    onChanged();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/40" />
      <div className="relative w-full max-w-md h-full overflow-y-auto bg-white dark:bg-[#1a1a1a] text-[#1c1a17] dark:text-[#faf9f7] shadow-xl p-6 space-y-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-display text-xl font-semibold truncate">{person.name}</h2>
            <p className="text-xs text-[#1c1a17]/50 dark:text-[#faf9f7]/50 mt-0.5">
              {board.title} · {person.stage}
              {person.archived && " · Archived"}
            </p>
          </div>
          <button type="button" onClick={onClose} className="p-1 text-[#1c1a17]/50 dark:text-[#faf9f7]/50 hover:text-[#1c1a17] dark:hover:text-[#faf9f7]" aria-label="Close panel">
            ✕
          </button>
        </div>

        <ContactButtons person={person} />

        <form onSubmit={handleSave} className="space-y-3">
          <div>
            <label className={labelClass}>Name</label>
            <input required value={form.name} onChange={update("name")} className={inputClass} />
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Phone</label>
              <input type="tel" value={form.phone} onChange={update("phone")} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Email</label>
              <input type="email" value={form.email} onChange={update("email")} className={inputClass} />
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Next follow-up</label>
              <input type="date" value={form.next_follow_up} onChange={update("next_follow_up")} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Source</label>
              <input value={form.source} onChange={update("source")} className={inputClass} placeholder="Referral, Open house…" />
            </div>
          </div>
          <div>
            <label className={labelClass}>Stage</label>
            <select
              value={person.stage}
              onChange={(e) => patch({ stage: e.target.value })}
              className={inputClass}
            >
              {board.stages.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          <button type="submit" disabled={saving} className={primaryBtn}>
            {saving ? "Saving…" : "Save"}
          </button>
        </form>

        <section className="space-y-3">
          <h3 className="font-display text-base font-semibold">Notes</h3>
          <form onSubmit={addNote} className="space-y-2">
            <textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              rows={3}
              placeholder="Log a call, a conversation, what they're looking for…"
              className={inputClass}
            />
            <button type="submit" disabled={addingNote || !noteText.trim()} className={primaryBtn}>
              {addingNote ? "Adding…" : "Add note"}
            </button>
          </form>
          {notes.length === 0 ? (
            <p className="text-sm text-[#1c1a17]/40 dark:text-[#faf9f7]/40">No notes yet.</p>
          ) : (
            <ul className="space-y-2">
              {notes.map((n) => (
                <li key={n.id} className="rounded-xl bg-black/[0.03] dark:bg-white/[0.05] p-3">
                  <p className="text-sm whitespace-pre-wrap">{n.body}</p>
                  <div className="mt-1.5 flex items-center justify-between text-[11px] text-[#1c1a17]/40 dark:text-[#faf9f7]/40">
                    <span>{formatNoteTime(n.created_at)}</span>
                    <button type="button" onClick={() => deleteNote(n.id)} className="hover:text-red-600 dark:hover:text-red-400">
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="space-y-3 pt-4 border-t border-black/5 dark:border-white/10">
          {board.next && !person.archived && (
            <div className="flex items-center gap-2 flex-wrap">
              <select value={moveStage} onChange={(e) => setMoveStage(e.target.value)} className={`${inputClass} !w-auto`}>
                {BOARDS[board.next.group].stages.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <button type="button" onClick={handleMove} className={primaryBtn}>
                {board.next.label}
              </button>
            </div>
          )}
          {person.archived ? (
            <div className="space-y-2">
              {person.archived_reason && (
                <p className="text-xs text-[#1c1a17]/50 dark:text-[#faf9f7]/50">Reason: {person.archived_reason}</p>
              )}
              <button type="button" onClick={handleRestore} className={primaryBtn}>
                Restore to {board.title}
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 flex-wrap">
              <select value={archiveReason} onChange={(e) => setArchiveReason(e.target.value)} className={`${inputClass} !w-auto`}>
                {ARCHIVE_REASONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleArchive}
                className="rounded-full border border-black/10 dark:border-white/15 text-sm font-semibold px-5 py-2.5 hover:bg-black/5 dark:hover:bg-white/10"
              >
                Archive
              </button>
            </div>
          )}
          <button type="button" onClick={handleDelete} className="text-xs text-[#1c1a17]/40 dark:text-[#faf9f7]/40 hover:text-red-600 dark:hover:text-red-400">
            Delete permanently
          </button>
        </section>
      </div>
    </div>
  );
}
