import { useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { BOARDS } from "../../../lib/peopleStages";
import { usePeople } from "../../../hooks/usePeople";
import ContactButtons from "./ContactButtons";
import PersonPanel from "./PersonPanel";

const inputClass =
  "w-full rounded-lg border border-black/10 dark:border-white/15 px-3.5 py-2.5 text-sm bg-transparent focus:outline-none focus:ring-2 focus:ring-[#ed2127]/40 dark:focus:ring-[#f2454b]/40";

function todayKey() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function followUpLabel(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function PeopleBoard({ group }) {
  const board = BOARDS[group];
  const { people, setPeople, loading, error, refresh } = usePeople();
  const [selectedId, setSelectedId] = useState(null);
  const [adding, setAdding] = useState(false);
  const [newPerson, setNewPerson] = useState({ name: "", phone: "", email: "" });
  const [saving, setSaving] = useState(false);
  const [addError, setAddError] = useState("");
  const [dragOver, setDragOver] = useState(null);
  const [showArchived, setShowArchived] = useState(false);

  const inGroup = people.filter((p) => p.stage_group === group);
  const active = inGroup.filter((p) => !p.archived);
  const archived = inGroup.filter((p) => p.archived);
  const selected = people.find((p) => p.id === selectedId) || null;
  const today = todayKey();

  const sortCol = (list) =>
    [...list].sort((a, b) => {
      if (a.next_follow_up && b.next_follow_up) return a.next_follow_up.localeCompare(b.next_follow_up);
      if (a.next_follow_up) return -1;
      if (b.next_follow_up) return 1;
      return 0;
    });

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newPerson.name.trim()) return;
    setSaving(true);
    setAddError("");
    const { error: err } = await supabase.from("people").insert({
      name: newPerson.name.trim(),
      phone: newPerson.phone.trim(),
      email: newPerson.email.trim(),
      stage_group: group,
      stage: board.stages[0],
      source: "Added manually",
    });
    setSaving(false);
    if (err) {
      setAddError(err.message);
      return;
    }
    setNewPerson({ name: "", phone: "", email: "" });
    setAdding(false);
    refresh();
  };

  const moveToStage = async (personId, stage) => {
    const person = people.find((p) => p.id === personId);
    if (!person || person.stage === stage) return;
    setPeople((list) => list.map((p) => (p.id === personId ? { ...p, stage } : p)));
    const { error: err } = await supabase.from("people").update({ stage }).eq("id", personId);
    if (err) refresh();
  };

  if (loading) return <p className="text-sm text-[#1c1a17]/50 dark:text-[#faf9f7]/50">Loading…</p>;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-display font-semibold">{board.title}</h1>
          <p className="text-sm text-[#1c1a17]/60 dark:text-[#faf9f7]/60 mt-1">
            {active.length} {active.length === 1 ? "person" : "people"} · drag cards between columns, or open one for details and notes.
          </p>
        </div>
        {!adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="rounded-full bg-[#1c1a17] dark:bg-[#f2454b] text-white text-sm font-semibold px-5 py-2.5 hover:bg-[#1c1a17]/90 dark:hover:bg-[#f2454b]/90 transition-colors shrink-0"
          >
            + Add
          </button>
        )}
      </div>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      {adding && (
        <form
          onSubmit={handleAdd}
          className="bg-white dark:bg-[#1a1a1a] border border-black/5 dark:border-white/10 rounded-2xl p-4 space-y-3"
        >
          <div className="grid sm:grid-cols-3 gap-3">
            <input
              required
              autoFocus
              value={newPerson.name}
              onChange={(e) => setNewPerson((p) => ({ ...p, name: e.target.value }))}
              placeholder="Name"
              className={inputClass}
            />
            <input
              type="tel"
              value={newPerson.phone}
              onChange={(e) => setNewPerson((p) => ({ ...p, phone: e.target.value }))}
              placeholder="Phone"
              className={inputClass}
            />
            <input
              type="email"
              value={newPerson.email}
              onChange={(e) => setNewPerson((p) => ({ ...p, email: e.target.value }))}
              placeholder="Email"
              className={inputClass}
            />
          </div>
          {addError && <p className="text-sm text-red-600 dark:text-red-400">{addError}</p>}
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded-full bg-[#1c1a17] dark:bg-[#f2454b] text-white text-sm font-semibold px-5 py-2 disabled:opacity-60"
            >
              {saving ? "Adding…" : `Add to ${board.stages[0]}`}
            </button>
            <button
              type="button"
              onClick={() => {
                setAdding(false);
                setAddError("");
              }}
              className="text-sm text-[#1c1a17]/50 dark:text-[#faf9f7]/50 hover:text-[#1c1a17] dark:hover:text-[#faf9f7]"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="flex gap-3 overflow-x-auto pb-3 -mx-1 px-1">
        {board.stages.map((stage) => {
          const col = sortCol(active.filter((p) => p.stage === stage));
          return (
            <div
              key={stage}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(stage);
              }}
              onDragLeave={() => setDragOver((s) => (s === stage ? null : s))}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(null);
                const id = e.dataTransfer.getData("text/plain");
                if (id) moveToStage(id, stage);
              }}
              className={`w-64 shrink-0 rounded-2xl p-2.5 space-y-2 transition-colors ${
                dragOver === stage ? "bg-[#ed2127]/10 dark:bg-[#f2454b]/15" : "bg-black/[0.03] dark:bg-white/[0.04]"
              }`}
            >
              <div className="flex items-center justify-between px-1.5 pt-1">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-[#1c1a17]/60 dark:text-[#faf9f7]/60">{stage}</h3>
                <span className="text-xs text-[#1c1a17]/40 dark:text-[#faf9f7]/40">{col.length}</span>
              </div>
              {col.map((p) => {
                const overdue = p.next_follow_up && p.next_follow_up < today;
                const dueToday = p.next_follow_up === today;
                return (
                  <div
                    key={p.id}
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData("text/plain", p.id)}
                    onClick={() => setSelectedId(p.id)}
                    className="cursor-pointer bg-white dark:bg-[#1a1a1a] border border-black/5 dark:border-white/10 rounded-xl p-3 space-y-2 hover:shadow-sm transition-shadow"
                  >
                    <p className="text-sm font-medium truncate">{p.name}</p>
                    {(p.phone || p.email) && (
                      <p className="text-xs text-[#1c1a17]/50 dark:text-[#faf9f7]/50 truncate">{p.phone || p.email}</p>
                    )}
                    {p.next_follow_up && (
                      <p
                        className={`text-xs font-medium ${
                          overdue
                            ? "text-red-600 dark:text-red-400"
                            : dueToday
                              ? "text-amber-700 dark:text-amber-400"
                              : "text-[#1c1a17]/50 dark:text-[#faf9f7]/50"
                        }`}
                      >
                        Follow up {dueToday ? "today" : followUpLabel(p.next_follow_up)}
                        {overdue && " · overdue"}
                      </p>
                    )}
                    <ContactButtons person={p} size="sm" />
                  </div>
                );
              })}
              {col.length === 0 && (
                <p className="text-xs text-[#1c1a17]/30 dark:text-[#faf9f7]/30 px-1.5 pb-2">Nobody here yet.</p>
              )}
            </div>
          );
        })}
      </div>

      {archived.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setShowArchived((v) => !v)}
            className="text-xs font-medium text-[#1c1a17]/50 dark:text-[#faf9f7]/50 hover:text-[#1c1a17] dark:hover:text-[#faf9f7]"
          >
            {showArchived ? "Hide" : "Show"} archived ({archived.length})
          </button>
          {showArchived && (
            <ul className="mt-2 space-y-2">
              {archived.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(p.id)}
                    className="w-full text-left border border-black/10 dark:border-white/15 rounded-xl p-3 text-sm hover:bg-black/[0.02] dark:hover:bg-white/[0.03]"
                  >
                    <span className="font-medium">{p.name}</span>
                    {p.archived_reason && (
                      <span className="text-xs text-[#1c1a17]/50 dark:text-[#faf9f7]/50"> · {p.archived_reason}</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {selected && <PersonPanel key={selected.id} person={selected} onClose={() => setSelectedId(null)} onChanged={refresh} />}
    </div>
  );
}
