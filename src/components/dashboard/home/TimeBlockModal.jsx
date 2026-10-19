import { useEffect, useState } from "react";
import { fromKey, toKey } from "../../../lib/homeDates";
import { DAY_MIN, fromMin, toMin } from "../../../lib/timeGrid";
import { muted } from "./styles";

const inputClass =
  "w-full rounded-lg border border-black/10 dark:border-white/15 px-3 py-2 text-sm bg-transparent focus:outline-none focus:ring-2 focus:ring-[#ed2127]/40 dark:focus:ring-[#f2454b]/40";
const labelClass = "block text-xs font-medium text-[#1c1a17]/60 dark:text-[#faf9f7]/60 mb-1.5";

const tabClass = (on, disabled) =>
  `flex-1 px-3 py-1.5 text-xs font-semibold rounded-full transition-colors ${on ? "bg-[#1c1a17] dark:bg-[#f2454b] text-white" : "text-[#1c1a17]/60 dark:text-[#faf9f7]/60"} ${disabled ? "opacity-40 cursor-not-allowed" : on ? "" : "hover:text-[#1c1a17] dark:hover:text-[#faf9f7]"}`;

// Time blocking for one task: pick (or type) the task, a day, a start and an end. Opened by clicking or dragging across
// empty space on the schedule, by a task's clock button, or by clicking a block that's already there.
//   range:  { date, startMin, endMin } for a new block
//   task:   an existing task (to schedule it, or to edit its block)
//   openTasks: tasks without a time yet, offered as "existing task" when making a new block
//   canAddEvent: whether a Google event can be created instead (a writable Google calendar is connected)
//   onEvent(range): switches to the Google event form with the same day and times
export default function TimeBlockModal({ range, task, openTasks, canAddEvent, tasksApi, fallbackDate, pick, onEvent, onClose }) {
  // Opening a task that is already on the calendar (a timed block or an all-day chip) edits it; opening one from the
  // "To schedule" list picks a time for it.
  const editing = Boolean(task && !pick && task.due_date);
  const hadTime = Boolean(task && task.start_time);
  const initial = (() => {
    if (editing && hadTime) {
      const s = toMin(task.start_time);
      return { date: task.due_date, start: fromMin(s), end: fromMin(Math.min(DAY_MIN - 1, s + (task.duration_min || 60))), allDay: false };
    }
    if (task) return { date: task.due_date || fallbackDate || toKey(new Date()), start: "09:00", end: "10:00", allDay: editing };
    return { date: range.date, start: fromMin(range.startMin ?? 9 * 60), end: fromMin(range.endMin ?? 10 * 60), allDay: Boolean(range.allDay) };
  })();
  const [taskId, setTaskId] = useState(task ? task.id : "");
  const [title, setTitle] = useState(task ? task.title : "");
  const [f, setF] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (patch) => setF((p) => ({ ...p, ...patch }));
  const chosen = task || openTasks.find((t) => t.id === taskId) || null;

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const submit = async (e) => {
    e.preventDefault();
    const name = (chosen ? chosen.title : title).trim();
    if (!name) {
      setError("Give the block a name, or pick an existing task.");
      return;
    }
    const startMin = toMin(f.start);
    const endMin = toMin(f.end);
    if (!f.allDay && endMin <= startMin) {
      setError("The end has to be after the start.");
      return;
    }
    setBusy(true);
    setError("");
    const block = f.allDay ? { start_time: null, duration_min: null } : { start_time: f.start, duration_min: Math.min(1440, endMin - startMin) };
    if (chosen) {
      const changes = { ...block };
      if (f.date !== chosen.due_date) changes.due_date = f.date;
      if (name !== chosen.title) changes.title = name;
      await tasksApi.update(chosen, changes);
      onClose();
    } else {
      const ok = await tasksApi.add({ title: name, due_date: f.date, recurrence: "none", ...block });
      setBusy(false);
      if (ok) onClose();
      else setError("Couldn't save that. Try again.");
    }
  };

  const unschedule = async () => {
    await tasksApi.update(task, { start_time: null, duration_min: null });
    onClose();
  };
  const del = async () => {
    if (!confirm(`Delete “${task.title}”?`)) return;
    await tasksApi.remove(task.id);
    onClose();
  };
  const finish = async () => {
    await tasksApi.complete(task);
    onClose();
  };

  const heading = editing ? (hadTime ? "Time block" : "Task") : task ? "Schedule task" : f.allDay ? "All-day task" : "Block time";
  const dateLabel = fromKey(f.date).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={heading}>
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/40" />
      <form onSubmit={submit} className="relative w-full max-w-md max-h-[92vh] overflow-y-auto rounded-2xl bg-white dark:bg-[#1a1a1a] text-[#1c1a17] dark:text-[#faf9f7] shadow-xl p-6 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-lg font-semibold">{heading}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="p-1 text-[#1c1a17]/50 dark:text-[#faf9f7]/50 hover:text-[#1c1a17] dark:hover:text-[#faf9f7]">
            ✕
          </button>
        </div>

        {!task && (
          <div className="flex items-center gap-1 rounded-full border border-black/10 dark:border-white/15 p-0.5" role="group" aria-label="What to add">
            <button type="button" aria-pressed="true" className={tabClass(true)}>
              Task
            </button>
            <button
              type="button"
              aria-pressed="false"
              disabled={!canAddEvent}
              title={canAddEvent ? "" : "Connect a Google calendar (Calendars) to add events"}
              onClick={() => onEvent({ date: f.date, allDay: f.allDay, startMin: toMin(f.start), endMin: toMin(f.end) })}
              className={tabClass(false, !canAddEvent)}
            >
              Google event
            </button>
          </div>
        )}

        {!task && openTasks.length > 0 && (
          <div>
            <label className={labelClass}>Task</label>
            <select value={taskId} onChange={(e) => setTaskId(e.target.value)} className={inputClass} aria-label="Existing task">
              <option value="">New task</option>
              {openTasks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className={labelClass}>{chosen && !task ? "Name" : "What are you working on?"}</label>
          <input
            autoFocus
            value={chosen && !task ? chosen.title : title}
            disabled={Boolean(chosen && !task)}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={300}
            placeholder="e.g. Call back the Whitfields"
            className={inputClass}
            aria-label="Title"
          />
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={f.allDay} onChange={(e) => set({ allDay: e.target.checked })} className="h-4 w-4 accent-[#ed2127]" aria-label="All day" />
          All day (no set time)
        </label>

        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-3 sm:col-span-1">
            <label className={labelClass}>Day</label>
            <input type="date" required value={f.date} onChange={(e) => set({ date: e.target.value })} className={inputClass} aria-label="Day" />
          </div>
          {!f.allDay && (
          <div className="col-span-3 sm:col-span-1 grid grid-cols-2 sm:contents gap-3">
            <div>
              <label className={labelClass}>Start</label>
              <input
                type="time"
                step={300}
                required
                value={f.start}
                onChange={(e) => {
                  const len = Math.max(15, toMin(f.end) - toMin(f.start));
                  set({ start: e.target.value, end: fromMin(Math.min(DAY_MIN - 1, toMin(e.target.value) + len)) });
                }}
                className={inputClass}
                aria-label="Start time"
              />
            </div>
            <div>
              <label className={labelClass}>End</label>
              <input type="time" step={300} required value={f.end} onChange={(e) => set({ end: e.target.value })} className={inputClass} aria-label="End time" />
            </div>
          </div>
          )}
        </div>
        <p className={`text-xs ${muted}`}>{dateLabel}</p>
        {task && task.recurrence !== "none" && <p className={`text-xs ${muted}`}>This task repeats, and its time block repeats with it. Changing the day restarts the repeat from that day.</p>}

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-1">
          <button type="submit" disabled={busy} className="rounded-full bg-[#1c1a17] dark:bg-[#f2454b] text-white text-sm font-semibold px-6 py-2.5 disabled:opacity-60">
            {busy ? "Saving…" : editing ? "Save changes" : f.allDay ? "Add task" : "Add to schedule"}
          </button>
          <button type="button" onClick={onClose} className="text-sm text-[#1c1a17]/50 dark:text-[#faf9f7]/50 hover:text-[#1c1a17] dark:hover:text-[#faf9f7]">
            Cancel
          </button>
          {editing && (
            <span className="ml-auto flex items-center gap-4 text-sm">
              <button type="button" onClick={finish} className="hover:underline">
                Mark done
              </button>
              {hadTime && (
                <button type="button" onClick={unschedule} className="hover:underline">
                  Remove time
                </button>
              )}
              <button type="button" onClick={del} className="text-red-600 dark:text-red-400 hover:underline">
                Delete
              </button>
            </span>
          )}
        </div>
      </form>
    </div>
  );
}
