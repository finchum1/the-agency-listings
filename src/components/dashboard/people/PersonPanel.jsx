import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { BOARDS, ARCHIVE_REASONS, SOURCES } from "../../../lib/peopleStages";
import ContactButtons from "./ContactButtons";
import TransactionChecklist from "./TransactionChecklist";

const inputClass =
  "w-full rounded-lg border border-black/10 dark:border-white/15 px-3.5 py-2.5 text-sm bg-transparent focus:outline-none focus:ring-2 focus:ring-[#ed2127]/40 dark:focus:ring-[#f2454b]/40";
const labelClass = "block text-xs font-medium text-[#1c1a17]/60 dark:text-[#faf9f7]/60 mb-1.5";
const primaryBtn =
  "rounded-full bg-[#1c1a17] dark:bg-[#f2454b] text-white text-sm font-semibold px-5 py-2.5 hover:bg-[#1c1a17]/90 dark:hover:bg-[#f2454b]/90 transition-colors disabled:opacity-60";
const navBtn =
  "h-8 w-8 flex items-center justify-center rounded-full border border-black/10 dark:border-white/15 text-[#1c1a17]/70 dark:text-[#faf9f7]/70 hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed";

const DATE_FIELDS = ["next_follow_up", "contract_date", "inspection_date", "appraisal_date", "financing_deadline", "closing_date"];
const NUMBER_FIELDS = ["price", "commission"];
const TEXT_FIELDS = ["name", "email", "phone", "source", "property_address", "other_agent", "title_company", "lender"];
const FIELDS = [...TEXT_FIELDS, ...DATE_FIELDS, ...NUMBER_FIELDS, "side"];

const openPicker = (e) => {
  try {
    e.currentTarget.showPicker();
  } catch {
    /* browser without showPicker — native control still works */
  }
};
const TEXT_DEBOUNCE_MS = 700;

function formatNoteTime(iso) {
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function toForm(person) {
  const form = {};
  for (const key of TEXT_FIELDS) form[key] = person[key] || "";
  for (const key of DATE_FIELDS) form[key] = person[key] || "";
  for (const key of NUMBER_FIELDS) form[key] = person[key] == null ? "" : String(person[key]);
  form.side = person.side || "";
  return form;
}

// Edits save automatically: text fields after a short pause (and when the
// panel closes or you jump to another contact), dropdowns/dates right away.
export default function PersonPanel({
  person,
  stageNames,
  nextStageNames,
  prevStageNames,
  position,
  total,
  onPrev,
  onNext,
  onClose,
  onChanged,
}) {
  const board = BOARDS[person.stage_group];
  const [form, setForm] = useState(() => toForm(person));
  const formRef = useRef(form);
  const savedRef = useRef(form);
  const timerRef = useRef(null);
  const onChangedRef = useRef(onChanged);
  onChangedRef.current = onChanged;

  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [notes, setNotes] = useState([]);
  const [noteText, setNoteText] = useState("");
  const [addingNote, setAddingNote] = useState(false);
  const [moveStage, setMoveStage] = useState(nextStageNames?.[0] || "");
  const [backStage, setBackStage] = useState(prevStageNames?.[prevStageNames.length - 1] || "");
  const [archiveReason, setArchiveReason] = useState(ARCHIVE_REASONS[0]);

  const flush = useCallback(async () => {
    clearTimeout(timerRef.current);
    const cur = formRef.current;
    const saved = savedRef.current;
    if (!cur.name.trim()) return;
    const changes = {};
    for (const key of FIELDS) {
      if (cur[key] === saved[key]) continue;
      if (DATE_FIELDS.includes(key) || key === "side") changes[key] = cur[key] || null;
      else if (NUMBER_FIELDS.includes(key)) changes[key] = cur[key] === "" ? null : Number(cur[key]);
      else changes[key] = cur[key].trim();
    }
    if (Object.keys(changes).length === 0) return;
    savedRef.current = { ...saved, ...cur };
    setStatus("Saving…");
    const { error: err } = await supabase.from("people").update(changes).eq("id", person.id);
    if (err) {
      savedRef.current = saved;
      setError(err.message);
      setStatus("");
      return;
    }
    setError("");
    setStatus("Saved");
    onChangedRef.current();
  }, [person.id]);

  // Closing the panel or jumping to another contact unmounts this one —
  // push out anything still waiting on the debounce timer first.
  useEffect(() => () => void flush(), [flush]);

  const setField = (field, immediate) => (e) => {
    const value = e.target.value;
    formRef.current = { ...formRef.current, [field]: value };
    setForm(formRef.current);
    setStatus("");
    clearTimeout(timerRef.current);
    if (immediate) flush();
    else timerRef.current = setTimeout(flush, TEXT_DEBOUNCE_MS);
  };

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
    await flush();
    if (await patch({ stage_group: board.next.group, stage: moveStage })) onClose();
  };

  const handleMoveBack = async () => {
    await flush();
    if (await patch({ stage_group: board.prev.group, stage: backStage })) onClose();
  };

  const handleArchive = async () => {
    await flush();
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
    clearTimeout(timerRef.current);
    formRef.current = savedRef.current;
    const { error: err } = await supabase.from("people").delete().eq("id", person.id);
    if (err) {
      setError(err.message);
      return;
    }
    onChanged();
    onClose();
  };

  const sourceOptions = form.source && !SOURCES.includes(form.source) ? [form.source, ...SOURCES] : SOURCES;

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/40" />
      <div className="relative w-full max-w-md h-full overflow-y-auto bg-white dark:bg-[#1a1a1a] text-[#1c1a17] dark:text-[#faf9f7] shadow-xl p-6 pt-[calc(1.5rem+env(safe-area-inset-top))] space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {position > 0 && (
              <>
                <button type="button" onClick={onPrev} disabled={!onPrev} className={navBtn} aria-label="Previous contact in this column">
                  ‹
                </button>
                <button type="button" onClick={onNext} disabled={!onNext} className={navBtn} aria-label="Next contact in this column">
                  ›
                </button>
                <span className="text-xs text-[#1c1a17]/50 dark:text-[#faf9f7]/50">
                  {position} of {total}
                </span>
              </>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-[#1c1a17]/40 dark:text-[#faf9f7]/40 min-w-12 text-right">{status}</span>
            <button type="button" onClick={onClose} className="p-1 text-[#1c1a17]/50 dark:text-[#faf9f7]/50 hover:text-[#1c1a17] dark:hover:text-[#faf9f7]" aria-label="Close panel">
              ✕
            </button>
          </div>
        </div>

        <div className="min-w-0">
          <h2 className="font-display text-xl font-semibold truncate">{form.name || person.name}</h2>
          <p className="text-xs text-[#1c1a17]/50 dark:text-[#faf9f7]/50 mt-0.5">
            {board.title} · {person.stage}
            {person.archived && " · Archived"}
          </p>
        </div>

        <ContactButtons person={{ ...person, phone: form.phone, email: form.email }} />

        <div className="space-y-3">
          <div>
            <label className={labelClass}>Name</label>
            <input
              value={form.name}
              onChange={setField("name")}
              onBlur={() => {
                if (!formRef.current.name.trim()) {
                  formRef.current = { ...formRef.current, name: savedRef.current.name };
                  setForm(formRef.current);
                } else flush();
              }}
              className={inputClass}
            />
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Phone</label>
              <input type="tel" value={form.phone} onChange={setField("phone")} onBlur={flush} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Email</label>
              <input type="email" value={form.email} onChange={setField("email")} onBlur={flush} className={inputClass} />
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Next follow-up</label>
              <input
                type="date"
                value={form.next_follow_up}
                onChange={setField("next_follow_up", true)}
                onClick={openPicker}
                className={`${inputClass} cursor-pointer`}
              />
            </div>
            <div>
              <label className={labelClass}>Source</label>
              <select value={form.source} onChange={setField("source", true)} className={inputClass}>
                <option value="">Select…</option>
                {sourceOptions.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className={labelClass}>Stage</label>
            <select
              value={person.stage}
              onChange={(e) => patch({ stage: e.target.value })}
              className={inputClass}
            >
              {stageNames.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          {person.stage_group === "transaction" && (
            <div className="space-y-3 pt-4 mt-1 border-t border-black/5 dark:border-white/10">
              <h3 className="font-display text-base font-semibold">Transaction</h3>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Side</label>
                  <select value={form.side} onChange={setField("side", true)} className={inputClass}>
                    <option value="">Select…</option>
                    <option value="buyer">Buyer</option>
                    <option value="seller">Seller</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Property address</label>
                  <input value={form.property_address} onChange={setField("property_address")} onBlur={flush} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Price ($)</label>
                  <input type="number" min="0" step="any" inputMode="decimal" value={form.price} onChange={setField("price")} onBlur={flush} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Commission ($)</label>
                  <input type="number" min="0" step="any" inputMode="decimal" value={form.commission} onChange={setField("commission")} onBlur={flush} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Other agent</label>
                  <input value={form.other_agent} onChange={setField("other_agent")} onBlur={flush} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Title company</label>
                  <input value={form.title_company} onChange={setField("title_company")} onBlur={flush} className={inputClass} />
                </div>
                <div className="sm:col-span-2">
                  <label className={labelClass}>Lender</label>
                  <input value={form.lender} onChange={setField("lender")} onBlur={flush} className={inputClass} />
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                {[
                  ["contract_date", "Contract date"],
                  ["inspection_date", "Inspection"],
                  ["appraisal_date", "Appraisal"],
                  ["financing_deadline", "Financing deadline"],
                  ["closing_date", "Closing"],
                ].map(([key, label]) => (
                  <div key={key}>
                    <label className={labelClass}>{label}</label>
                    <input
                      type="date"
                      value={form[key]}
                      onChange={setField(key, true)}
                      onClick={openPicker}
                      className={`${inputClass} cursor-pointer`}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
          {person.stage_group === "transaction" && (
            <TransactionChecklist
              person={person}
              side={form.side}
              dates={{
                contract_date: form.contract_date,
                inspection_date: form.inspection_date,
                closing_date: form.closing_date,
              }}
            />
          )}
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        </div>

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
                {nextStageNames.map((s) => (
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
          {board.prev && !person.archived && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <select value={backStage} onChange={(e) => setBackStage(e.target.value)} className={`${inputClass} !w-auto`}>
                  {prevStageNames.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleMoveBack}
                  className="rounded-full border border-black/10 dark:border-white/15 text-sm font-semibold px-5 py-2.5 hover:bg-black/5 dark:hover:bg-white/10"
                >
                  {board.prev.label}
                </button>
              </div>
              <p className="text-xs text-[#1c1a17]/40 dark:text-[#faf9f7]/40">
                For a deal that fell through. Their deal details and notes are kept in case it comes back.
              </p>
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
