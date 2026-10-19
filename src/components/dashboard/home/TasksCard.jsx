import { useState } from "react";
import { addDays, dayLabel, fromKey, toKey } from "../../../lib/homeDates";
import { RECURRENCES } from "../../../lib/taskRecurrence";
import { minLabel, toMin } from "../../../lib/timeGrid";
import { card, muted } from "./styles";

const SHOW = 6;
const smallInput =
  "rounded-lg border border-black/10 dark:border-white/15 bg-transparent px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#ed2127]/40 dark:focus:ring-[#f2454b]/40";

const openPicker = (e) => {
  try {
    e.currentTarget.showPicker();
  } catch {
    /* native control still works */
  }
};

// A compact row: tick it off, rename it in place, and see when it's due, at what time and how often it repeats.
// "Edit" opens the full form (day, time, repeat).
function TaskRow({ task, today, showDay, onComplete, onUpdate, onRemove, onEdit }) {
  const repeat = RECURRENCES.find((r) => r.value === task.recurrence);
  const start = task.start_time && task.due_date ? toMin(task.start_time) : null;
  const meta = [
    showDay && task.due_date ? dayLabel(task.due_date, today) : null,
    start != null ? `◷ ${minLabel(start)}` : null,
    task.recurrence !== "none" && repeat ? `↻ ${repeat.short}` : null,
  ].filter(Boolean);
  return (
    <li className="flex items-center gap-3 py-2">
      <input
        type="checkbox"
        checked={false}
        onChange={() => onComplete(task)}
        aria-label={task.recurrence === "none" ? "Mark done" : "Mark done and schedule the next one"}
        className="h-4 w-4 shrink-0 accent-[#ed2127] cursor-pointer"
      />
      <input
        defaultValue={task.title}
        maxLength={300}
        aria-label="Task"
        onBlur={(e) => {
          const v = e.target.value.trim();
          if (!v) e.target.value = task.title;
          else if (v !== task.title) onUpdate(task, { title: v });
        }}
        onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
        className="min-w-0 flex-1 bg-transparent text-sm font-medium leading-snug rounded focus:outline-none focus:bg-black/[0.03] dark:focus:bg-white/[0.05] px-1 -mx-1 py-0.5"
      />
      {meta.length > 0 && <span className={`hidden sm:block shrink-0 text-[11px] ${muted}`}>{meta.join("  ·  ")}</span>}
      <button type="button" onClick={() => onEdit(task)} className="shrink-0 text-xs font-semibold text-[#ed2127] dark:text-[#f2454b] hover:underline">
        Edit
      </button>
      <button
        type="button"
        onClick={() => onRemove(task.id)}
        aria-label="Delete task"
        className="shrink-0 px-1 text-[#1c1a17]/30 dark:text-[#faf9f7]/30 hover:text-red-600 dark:hover:text-red-400"
      >
        ✕
      </button>
    </li>
  );
}

// Open tasks sorted into groups by when they're due.
function groupTasks(open, today) {
  const week = toKey(addDays(fromKey(today), 7));
  const byDue = (a, b) => (a.due_date || "").localeCompare(b.due_date || "") || (a.start_time || "99").localeCompare(b.start_time || "99") || a.created_at.localeCompare(b.created_at);
  const groups = [
    { key: "overdue", label: "Overdue", tone: "text-red-600 dark:text-red-400", items: open.filter((t) => t.due_date && t.due_date < today) },
    { key: "today", label: "Today", items: open.filter((t) => t.due_date === today) },
    { key: "week", label: "Next 7 days", showDay: true, items: open.filter((t) => t.due_date && t.due_date > today && t.due_date <= week) },
    { key: "later", label: "Later", showDay: true, items: open.filter((t) => t.due_date && t.due_date > week) },
    { key: "none", label: "No date", items: open.filter((t) => !t.due_date) },
  ];
  for (const g of groups) g.items.sort(byDue);
  return groups.filter((g) => g.items.length);
}

// One-off and repeating to-dos with due dates, private to the agent. A repeating task moves to its next date when
// ticked off, so it comes back on its own.
export default function TasksCard({ tasksApi, span, onEdit }) {
  const { tasks, loading, error, add, update, complete, reopen, remove } = tasksApi;
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const [repeat, setRepeat] = useState("none");
  const [adding, setAdding] = useState(false);
  const [expanded, setExpanded] = useState({});
  const [showDone, setShowDone] = useState(false);
  const today = toKey(new Date());

  const open = tasks.filter((t) => !t.done);
  const done = tasks
    .filter((t) => t.done)
    .sort((a, b) => (b.done_at || "").localeCompare(a.done_at || ""))
    .slice(0, 10);
  const overdueCount = open.filter((t) => t.due_date && t.due_date < today).length;
  const groups = groupTasks(open, today);

  const submit = async (e) => {
    e.preventDefault();
    if (!title.trim() || adding) return;
    setAdding(true);
    const ok = await add({ title, due_date: due, recurrence: repeat });
    setAdding(false);
    if (ok) {
      setTitle("");
      setDue("");
      setRepeat("none");
    }
  };

  return (
    <section className={`${card} ${span ? "lg:col-span-3" : "lg:col-span-2"} flex flex-col`}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-display text-lg font-semibold">Your tasks</h2>
        <p className={`text-xs ${muted}`}>
          {open.length} open{overdueCount > 0 && <span className="text-red-600 dark:text-red-400 font-semibold"> · {overdueCount} overdue</span>}
        </p>
      </div>

      <form onSubmit={submit} className="mt-4 flex flex-wrap items-center gap-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={300}
          placeholder="Add a task…"
          aria-label="New task"
          className="min-w-[12rem] flex-1 rounded-lg border border-black/10 dark:border-white/15 bg-transparent px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#ed2127]/40 dark:focus:ring-[#f2454b]/40"
        />
        <input type="date" value={due} onChange={(e) => setDue(e.target.value)} onClick={openPicker} aria-label="Due date for the new task" className={`${smallInput} py-2.5 cursor-pointer`} />
        <select value={repeat} onChange={(e) => setRepeat(e.target.value)} aria-label="Repeat for the new task" className={`${smallInput} py-2.5`}>
          {RECURRENCES.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={!title.trim() || adding}
          className="rounded-full bg-[#1c1a17] dark:bg-[#f2454b] text-white text-xs font-semibold px-5 py-2.5 disabled:opacity-50"
        >
          {adding ? "Adding…" : "Add"}
        </button>
      </form>
      {error && <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>}

      {loading ? (
        <p className={`text-sm mt-4 ${muted}`}>Loading…</p>
      ) : open.length === 0 ? (
        <p className={`text-sm mt-5 ${muted}`}>Nothing on your list. Add a task above, with a date and a repeat if you like.</p>
      ) : (
        <div className="mt-4 space-y-5">
          {groups.map((g) => {
            const all = expanded[g.key];
            const shown = all ? g.items : g.items.slice(0, SHOW);
            return (
              <div key={g.key}>
                <p className={`flex items-baseline gap-2 text-[11px] font-semibold uppercase tracking-wide ${g.tone || muted}`}>
                  {g.label}
                  <span className={`font-medium normal-case tracking-normal ${muted}`}>{g.items.length}</span>
                </p>
                <ul className="mt-1 divide-y divide-black/5 dark:divide-white/10 border-t border-black/5 dark:border-white/10">
                  {shown.map((t) => (
                    <TaskRow key={t.id} task={t} today={today} showDay={g.showDay || g.key === "overdue"} onComplete={complete} onUpdate={update} onRemove={remove} onEdit={onEdit} />
                  ))}
                </ul>
                {g.items.length > SHOW && (
                  <button type="button" onClick={() => setExpanded((e) => ({ ...e, [g.key]: !all }))} className="mt-1 text-xs font-semibold text-[#ed2127] dark:text-[#f2454b] hover:underline">
                    {all ? "Show fewer" : `Show all ${g.items.length}`}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {done.length > 0 && (
        <div className="mt-4 pt-3 border-t border-black/5 dark:border-white/10">
          <button type="button" onClick={() => setShowDone((v) => !v)} aria-expanded={showDone} className={`text-xs font-medium hover:text-[#1c1a17] dark:hover:text-[#faf9f7] ${muted}`}>
            {showDone ? "▾" : "▸"} Completed ({done.length})
          </button>
          {showDone && (
            <ul className="mt-2 space-y-1.5">
              {done.map((t) => (
                <li key={t.id} className="flex items-center gap-3">
                  <input type="checkbox" checked onChange={() => reopen(t)} aria-label="Mark not done" className="h-4 w-4 shrink-0 accent-[#ed2127] cursor-pointer" />
                  <span className={`min-w-0 flex-1 truncate text-sm line-through ${muted}`}>{t.title}</span>
                  <span className={`shrink-0 text-[11px] ${muted}`}>{t.done_at ? dayLabel(toKey(new Date(t.done_at)), today) : ""}</span>
                  <button type="button" onClick={() => remove(t.id)} aria-label="Delete task" className="shrink-0 px-1 text-[#1c1a17]/30 dark:text-[#faf9f7]/30 hover:text-red-600 dark:hover:text-red-400">
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
