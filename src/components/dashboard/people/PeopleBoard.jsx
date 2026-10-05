import { useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { BOARDS } from "../../../lib/peopleStages";
import { usePeople } from "../../../hooks/usePeople";
import { usePeopleStages } from "../../../hooks/usePeopleStages";
import ContactButtons from "./ContactButtons";
import PersonPanel from "./PersonPanel";

const COLUMN_DRAG_TYPE = "application/x-people-column";

const inputClass =
  "w-full rounded-lg border border-black/10 dark:border-white/15 px-3 py-2 text-sm bg-transparent focus:outline-none focus:ring-2 focus:ring-[#ed2127]/40 dark:focus:ring-[#f2454b]/40";

function todayKey() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function followUpLabel(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

const sortCol = (list) =>
  [...list].sort((a, b) => {
    if (a.next_follow_up && b.next_follow_up) return a.next_follow_up.localeCompare(b.next_follow_up);
    if (a.next_follow_up) return -1;
    if (b.next_follow_up) return 1;
    return 0;
  });

function ColumnTitle({ name, onRename }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);

  const commit = async () => {
    setEditing(false);
    if (value.trim() && value.trim() !== name) await onRename(value);
    else setValue(name);
  };

  if (editing) {
    return (
      <input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") {
            setValue(name);
            setEditing(false);
          }
        }}
        className="w-full min-w-0 rounded-md border border-black/15 dark:border-white/20 bg-transparent px-1.5 py-0.5 text-xs font-semibold uppercase tracking-wide focus:outline-none focus:ring-2 focus:ring-[#ed2127]/40"
      />
    );
  }
  return (
    <button
      type="button"
      onClick={() => {
        setValue(name);
        setEditing(true);
      }}
      title="Click to rename this column"
      className="min-w-0 truncate text-left text-xs font-semibold uppercase tracking-wide text-[#1c1a17]/60 dark:text-[#faf9f7]/60 hover:text-[#1c1a17] dark:hover:text-[#faf9f7] hover:underline decoration-dotted underline-offset-4"
    >
      {name}
    </button>
  );
}

const menuItem =
  "w-full text-left px-3 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-40 disabled:hover:bg-transparent";

function ColumnMenu({ index, count, isTransactions, isClosed, onMove, onToggleClosed, onDelete }) {
  const [open, setOpen] = useState(false);
  const run = (fn) => () => {
    setOpen(false);
    fn();
  };
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Column options"
        aria-expanded={open}
        className="h-6 w-6 flex items-center justify-center rounded-full text-[#1c1a17]/60 dark:text-[#faf9f7]/60 hover:bg-black/10 dark:hover:bg-white/15"
      >
        ⋯
      </button>
      {open && (
        <>
          <button type="button" aria-label="Close menu" onClick={() => setOpen(false)} className="fixed inset-0 z-30 cursor-default" />
          <div className="absolute right-0 top-7 z-40 w-56 overflow-hidden rounded-xl border border-black/10 dark:border-white/15 bg-white dark:bg-[#1a1a1a] shadow-lg text-[#1c1a17] dark:text-[#faf9f7]">
            <button type="button" className={menuItem} disabled={index === 0} onClick={run(() => onMove(index - 1))}>
              ← Move left
            </button>
            <button type="button" className={menuItem} disabled={index === count - 1} onClick={run(() => onMove(index + 1))}>
              Move right →
            </button>
            {isTransactions && (
              <button type="button" className={menuItem} disabled={isClosed} onClick={run(onToggleClosed)}>
                {isClosed ? "✓ Counts as closed deals" : "Count as closed deals"}
              </button>
            )}
            <button type="button" className={`${menuItem} text-red-600 dark:text-red-400`} onClick={run(onDelete)}>
              Delete column
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default function PeopleBoard({ group }) {
  const board = BOARDS[group];
  const { people, setPeople, loading, error, refresh } = usePeople();
  const { stages: allStages, closedStage, renameStage, addStage, moveStage, removeStage, setClosedStage } = usePeopleStages();
  const stages = allStages[group];
  const nextStageNames = board.next ? allStages[board.next.group] : null;
  const prevStageNames = board.prev ? allStages[board.prev.group] : null;

  const [selectedId, setSelectedId] = useState(null);
  const [addingStage, setAddingStage] = useState(null);
  const [newPerson, setNewPerson] = useState({ name: "", phone: "", email: "" });
  const [saving, setSaving] = useState(false);
  const [boardError, setBoardError] = useState("");
  const [dragOver, setDragOver] = useState(null);
  const [showArchived, setShowArchived] = useState(false);
  const [addingColumn, setAddingColumn] = useState(false);
  const [newColumnName, setNewColumnName] = useState("");

  const inGroup = people.filter((p) => p.stage_group === group);
  const active = inGroup.filter((p) => !p.archived);
  const archived = inGroup.filter((p) => p.archived);
  const selected = people.find((p) => p.id === selectedId) || null;
  const today = todayKey();

  const siblings = selected && !selected.archived ? sortCol(active.filter((p) => p.stage === selected.stage)) : [];
  const siblingIdx = selected ? siblings.findIndex((p) => p.id === selected.id) : -1;

  const startAdd = (stage) => {
    setAddingStage(stage);
    setNewPerson({ name: "", phone: "", email: "" });
    setBoardError("");
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newPerson.name.trim()) return;
    setSaving(true);
    setBoardError("");
    const { error: err } = await supabase.from("people").insert({
      name: newPerson.name.trim(),
      phone: newPerson.phone.trim(),
      email: newPerson.email.trim(),
      stage_group: group,
      stage: addingStage,
      source: "Added manually",
    });
    setSaving(false);
    if (err) {
      setBoardError(err.message);
      return;
    }
    setAddingStage(null);
    refresh();
  };

  const moveToStage = async (personId, stage) => {
    const person = people.find((p) => p.id === personId);
    if (!person || person.stage === stage) return;
    setPeople((list) => list.map((p) => (p.id === personId ? { ...p, stage } : p)));
    const { error: err } = await supabase.from("people").update({ stage }).eq("id", personId);
    if (err) refresh();
  };

  const handleRename = async (oldName, newName) => {
    setBoardError("");
    const err = await renameStage(group, oldName, newName);
    if (err) setBoardError(err);
    else refresh();
  };

  const runStageChange = async (change) => {
    setBoardError("");
    const err = await change();
    if (err) setBoardError(err);
    return !err;
  };

  const handleAddColumn = async (e) => {
    e.preventDefault();
    if (!newColumnName.trim()) return;
    if (await runStageChange(() => addStage(group, newColumnName))) {
      setNewColumnName("");
      setAddingColumn(false);
    }
  };

  const handleDeleteColumn = (stage) => {
    // Everyone in the column counts, archived included.
    const count = inGroup.filter((p) => p.stage === stage).length;
    if (count === 0 && !confirm(`Delete the "${stage}" column?`)) return;
    runStageChange(() => removeStage(group, stage, count));
  };

  if (loading) return <p className="text-sm text-[#1c1a17]/50 dark:text-[#faf9f7]/50">Loading…</p>;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-display font-semibold">{board.title}</h1>
        <p className="text-sm text-[#1c1a17]/60 dark:text-[#faf9f7]/60 mt-1">
          {active.length} {active.length === 1 ? "person" : "people"} · drag cards between columns, drag a column's ⋮⋮ grip (or use ⋯) to reorder, click a title to rename it, or use + to add someone.
        </p>
      </div>

      {(error || boardError) && <p className="text-sm text-red-600 dark:text-red-400">{error || boardError}</p>}

      {/* The scroll area is the full board height (not just as tall as the
          shortest column), so the horizontal scrollbar stays pinned near
          the bottom of the screen and empty space under a column still
          scrolls sideways. */}
      <div className="flex gap-3 overflow-x-auto overflow-y-auto h-[calc(100vh-14rem)] min-h-[26rem] -mx-1 px-1 pb-1">
        {stages.map((stage, stageIndex) => {
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
                const columnName = e.dataTransfer.getData(COLUMN_DRAG_TYPE);
                if (columnName) {
                  runStageChange(() => moveStage(group, columnName, stageIndex));
                  return;
                }
                const id = e.dataTransfer.getData("text/plain");
                if (id) moveToStage(id, stage);
              }}
              className={`w-64 shrink-0 min-h-full rounded-2xl p-2.5 space-y-2 transition-colors ${
                dragOver === stage ? "bg-[#ed2127]/10 dark:bg-[#f2454b]/15" : "bg-black/[0.03] dark:bg-white/[0.04]"
              }`}
            >
              <div className="flex items-center justify-between gap-2 px-1.5 pt-1">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData(COLUMN_DRAG_TYPE, stage);
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    title="Drag to reorder this column"
                    aria-hidden="true"
                    className="cursor-grab select-none text-[#1c1a17]/30 dark:text-[#faf9f7]/30 hover:text-[#1c1a17]/60 dark:hover:text-[#faf9f7]/60 text-xs leading-none"
                  >
                    ⋮⋮
                  </span>
                  <ColumnTitle name={stage} onRename={(n) => handleRename(stage, n)} />
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <span className="text-xs text-[#1c1a17]/40 dark:text-[#faf9f7]/40 mr-1">{col.length}</span>
                  <button
                    type="button"
                    onClick={() => startAdd(stage)}
                    aria-label={`Add to ${stage}`}
                    title={`Add to ${stage}`}
                    className="h-6 w-6 flex items-center justify-center rounded-full text-base leading-none text-[#1c1a17]/60 dark:text-[#faf9f7]/60 hover:bg-black/10 dark:hover:bg-white/15"
                  >
                    +
                  </button>
                  <ColumnMenu
                    index={stageIndex}
                    count={stages.length}
                    isTransactions={group === "transaction"}
                    isClosed={stage === closedStage}
                    onMove={(to) => runStageChange(() => moveStage(group, stage, to))}
                    onToggleClosed={() => runStageChange(() => setClosedStage(stage))}
                    onDelete={() => handleDeleteColumn(stage)}
                  />
                </div>
              </div>

              {addingStage === stage && (
                <form
                  onSubmit={handleAdd}
                  className="bg-white dark:bg-[#1a1a1a] border border-black/10 dark:border-white/15 rounded-xl p-2.5 space-y-2"
                >
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
                  <div className="flex items-center gap-3">
                    <button
                      type="submit"
                      disabled={saving}
                      className="rounded-full bg-[#1c1a17] dark:bg-[#f2454b] text-white text-xs font-semibold px-4 py-1.5 disabled:opacity-60"
                    >
                      {saving ? "Adding…" : "Add"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setAddingStage(null)}
                      className="text-xs text-[#1c1a17]/50 dark:text-[#faf9f7]/50 hover:text-[#1c1a17] dark:hover:text-[#faf9f7]"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}

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
                    {group === "transaction" && (
                      <div className="space-y-0.5">
                        {p.property_address && (
                          <p className="text-xs text-[#1c1a17]/70 dark:text-[#faf9f7]/70 truncate">{p.property_address}</p>
                        )}
                        <p className="text-xs text-[#1c1a17]/50 dark:text-[#faf9f7]/50 truncate">
                          {[p.side === "buyer" ? "Buyer" : p.side === "seller" ? "Seller" : "", p.price ? `$${Number(p.price).toLocaleString()}` : ""]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                        {p.closing_date && (
                          <p className="text-xs font-medium text-[#1c1a17]/70 dark:text-[#faf9f7]/70">Closes {followUpLabel(p.closing_date)}</p>
                        )}
                      </div>
                    )}
                    {group !== "transaction" && (p.phone || p.email) && (
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
              {col.length === 0 && addingStage !== stage && (
                <p className="text-xs text-[#1c1a17]/30 dark:text-[#faf9f7]/30 px-1.5 pb-2">Nobody here yet.</p>
              )}
            </div>
          );
        })}

        <div className="w-64 shrink-0">
          {addingColumn ? (
            <form onSubmit={handleAddColumn} className="rounded-2xl bg-black/[0.03] dark:bg-white/[0.04] p-2.5 space-y-2">
              <input
                autoFocus
                value={newColumnName}
                onChange={(e) => setNewColumnName(e.target.value)}
                placeholder="Column name"
                className={inputClass}
              />
              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  className="rounded-full bg-[#1c1a17] dark:bg-[#f2454b] text-white text-xs font-semibold px-4 py-1.5"
                >
                  Add column
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAddingColumn(false);
                    setNewColumnName("");
                  }}
                  className="text-xs text-[#1c1a17]/50 dark:text-[#faf9f7]/50 hover:text-[#1c1a17] dark:hover:text-[#faf9f7]"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setAddingColumn(true)}
              className="w-full rounded-2xl border border-dashed border-black/15 dark:border-white/20 px-4 py-3 text-sm font-medium text-[#1c1a17]/50 dark:text-[#faf9f7]/50 hover:text-[#1c1a17] dark:hover:text-[#faf9f7] hover:bg-black/[0.02] dark:hover:bg-white/[0.03] text-left"
            >
              + Add column
            </button>
          )}
        </div>
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

      {selected && (
        <PersonPanel
          key={selected.id}
          person={selected}
          stageNames={stages}
          nextStageNames={nextStageNames}
          prevStageNames={prevStageNames}
          position={siblingIdx >= 0 ? siblingIdx + 1 : 0}
          total={siblings.length}
          onPrev={siblingIdx > 0 ? () => setSelectedId(siblings[siblingIdx - 1].id) : undefined}
          onNext={siblingIdx >= 0 && siblingIdx < siblings.length - 1 ? () => setSelectedId(siblings[siblingIdx + 1].id) : undefined}
          onClose={() => setSelectedId(null)}
          onChanged={refresh}
        />
      )}
    </div>
  );
}
