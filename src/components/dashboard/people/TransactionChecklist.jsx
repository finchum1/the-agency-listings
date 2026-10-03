import { useEffect, useRef, useState } from "react";
import { useTransactionTasks } from "../../../hooks/useTransactionTasks";
import { ANCHORS, SIDE_LABELS, effectiveDue, loadTemplate, ruleLabel } from "../../../lib/checklists";

const muted = "text-[#1c1a17]/50 dark:text-[#faf9f7]/50";
const smallInput =
  "rounded-md border border-black/10 dark:border-white/15 bg-transparent px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-[#ed2127]/40";

function todayKey() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const openPicker = (e) => {
  try {
    e.currentTarget.showPicker();
  } catch {
    /* native control still works */
  }
};

// `dates` is the deal's live form values, so due dates update the moment a
// contract / inspection / closing date is typed in above.
export default function TransactionChecklist({ person, side, dates }) {
  const { tasks, loading, error, applyTemplate, addTask, updateTask, removeTask, clearAll } = useTransactionTasks(person.id);
  const [collapsed, setCollapsed] = useState({});
  const [addingTo, setAddingTo] = useState(null);
  const [newText, setNewText] = useState("");
  const [working, setWorking] = useState(false);
  const today = todayKey();

  // Picking a side applies that side's checklist automatically. Switching
  // sides swaps the checklist too, but only while nothing has been ticked
  // off, so completed work is never thrown away.
  const prevSide = useRef(side);
  const tasksRef = useRef(tasks);
  tasksRef.current = tasks;
  useEffect(() => {
    const prev = prevSide.current;
    if (loading || prev === side) return;
    prevSide.current = side;
    if (!side) return;
    const current = tasksRef.current;
    const swap = current.length > 0 && prev && !current.some((t) => t.done);
    if (current.length > 0 && !swap) return;
    (async () => {
      setWorking(true);
      if (swap) await clearAll();
      await applyTemplate(await loadTemplate(side));
      setWorking(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [side, loading]);

  if (loading) return null;

  const sections = [];
  for (const t of [...tasks].sort((a, b) => a.position - b.position)) {
    let sec = sections.find((s) => s.title === t.section);
    if (!sec) {
      sec = { title: t.section, tasks: [], anchor: t.anchor, offset_days: t.offset_days };
      sections.push(sec);
    }
    sec.tasks.push(t);
  }
  const doneCount = tasks.filter((t) => t.done).length;

  const handleApply = async () => {
    setWorking(true);
    await applyTemplate(await loadTemplate(side));
    setWorking(false);
  };

  const handleClear = async () => {
    if (!confirm("Remove every task from this checklist? You can add a template again afterward.")) return;
    setWorking(true);
    await clearAll();
    setWorking(false);
  };

  const submitNewTask = async (e, sec) => {
    e.preventDefault();
    if (!newText.trim()) return;
    await addTask(sec.title, sec.anchor, sec.offset_days, newText.trim());
    setNewText("");
    setAddingTo(null);
  };

  return (
    <div className="space-y-3 pt-4 mt-1 border-t border-black/5 dark:border-white/10">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-display text-base font-semibold">Checklist</h3>
        {tasks.length > 0 && (
          <span className={`text-xs ${muted}`}>
            {doneCount} of {tasks.length} done
          </span>
        )}
      </div>
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      {tasks.length === 0 ? (
        <div className="space-y-2">
          {side ? (
            <>
              <p className={`text-sm ${muted}`}>No checklist on this deal yet.</p>
              <button
                type="button"
                onClick={handleApply}
                disabled={working}
                className="rounded-full bg-[#1c1a17] dark:bg-[#f2454b] text-white text-sm font-semibold px-5 py-2.5 disabled:opacity-60"
              >
                {working ? "Adding…" : `Add ${SIDE_LABELS[side]} checklist`}
              </button>
            </>
          ) : (
            <p className={`text-sm ${muted}`}>Choose Buyer or Seller above and the checklist is added automatically.</p>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {sections.map((sec) => {
            const done = sec.tasks.filter((t) => t.done).length;
            const open = !collapsed[sec.title];
            return (
              <div key={sec.title} className="space-y-1.5">
                <button
                  type="button"
                  onClick={() => setCollapsed((c) => ({ ...c, [sec.title]: open }))}
                  className="w-full flex items-center justify-between gap-2 text-left"
                  aria-expanded={open}
                >
                  <span className="flex items-center gap-1.5 min-w-0">
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      className={`shrink-0 transition-transform ${open ? "rotate-90" : ""}`}
                    >
                      <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span className="text-sm font-semibold truncate">{sec.title}</span>
                  </span>
                  <span className={`text-xs shrink-0 ${muted}`}>
                    {done}/{sec.tasks.length}
                  </span>
                </button>
                {open && (
                  <>
                    <p className={`text-[11px] ml-4 ${muted}`}>{ruleLabel(sec.anchor, sec.offset_days)}</p>
                    <ul className="space-y-1">
                      {sec.tasks.map((t) => {
                        const due = effectiveDue(t, dates);
                        const overdue = due && !t.done && due < today;
                        return (
                          <li key={t.id} className="flex items-start gap-2 rounded-lg px-1 py-1.5 hover:bg-black/[0.03] dark:hover:bg-white/[0.04]">
                            <input
                              type="checkbox"
                              checked={t.done}
                              onChange={(e) =>
                                updateTask(t.id, {
                                  done: e.target.checked,
                                  done_at: e.target.checked ? new Date().toISOString() : null,
                                })
                              }
                              className="mt-1 h-4 w-4 shrink-0 accent-[#ed2127]"
                            />
                            <div className="min-w-0 flex-1 space-y-1">
                              <textarea
                                defaultValue={t.text}
                                rows={Math.max(1, Math.ceil(t.text.length / 42))}
                                onBlur={(e) => {
                                  const v = e.target.value.trim();
                                  if (!v) e.target.value = t.text;
                                  else if (v !== t.text) updateTask(t.id, { text: v });
                                }}
                                className={`w-full resize-none bg-transparent text-sm leading-snug focus:outline-none focus:bg-black/[0.03] dark:focus:bg-white/[0.05] rounded ${
                                  t.done ? "line-through opacity-50" : ""
                                }`}
                              />
                              <div className="flex items-center gap-2 flex-wrap">
                                <input
                                  type="date"
                                  value={due || ""}
                                  onChange={(e) => updateTask(t.id, { due_override: e.target.value || null })}
                                  onClick={openPicker}
                                  title={due ? "Click to set a specific due date" : "Add the date this is based on to get an automatic due date"}
                                  className={`${smallInput} cursor-pointer ${overdue ? "text-red-600 dark:text-red-400 border-red-300" : ""}`}
                                />
                                {t.due_override ? (
                                  <button
                                    type="button"
                                    onClick={() => updateTask(t.id, { due_override: null })}
                                    className="text-[11px] text-[#ed2127] dark:text-[#f2454b] hover:underline"
                                  >
                                    Back to automatic
                                  </button>
                                ) : !due ? (
                                  <span className={`text-[11px] ${muted}`}>
                                    Set the {ANCHORS.find((a) => a.value === t.anchor)?.label || "date"} above
                                  </span>
                                ) : null}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => removeTask(t.id)}
                              aria-label="Delete task"
                              className="shrink-0 px-1 text-[#1c1a17]/30 dark:text-[#faf9f7]/30 hover:text-red-600 dark:hover:text-red-400"
                            >
                              ✕
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                    {addingTo === sec.title ? (
                      <form onSubmit={(e) => submitNewTask(e, sec)} className="flex items-center gap-2 ml-1">
                        <input
                          autoFocus
                          value={newText}
                          onChange={(e) => setNewText(e.target.value)}
                          placeholder="New task"
                          className={`${smallInput} flex-1 py-1.5`}
                        />
                        <button type="submit" className="text-xs font-semibold text-[#ed2127] dark:text-[#f2454b]">
                          Add
                        </button>
                        <button type="button" onClick={() => setAddingTo(null)} className={`text-xs ${muted}`}>
                          Cancel
                        </button>
                      </form>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setAddingTo(sec.title);
                          setNewText("");
                        }}
                        className="ml-1 text-xs font-medium text-[#ed2127] dark:text-[#f2454b] hover:underline"
                      >
                        + Add task
                      </button>
                    )}
                  </>
                )}
              </div>
            );
          })}
          <button
            type="button"
            onClick={handleClear}
            disabled={working}
            className={`text-xs hover:text-red-600 dark:hover:text-red-400 ${muted}`}
          >
            Remove checklist
          </button>
        </div>
      )}
    </div>
  );
}
