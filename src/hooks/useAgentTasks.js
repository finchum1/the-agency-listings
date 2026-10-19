import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { nextDue } from "../lib/taskRecurrence";
import { toKey } from "../lib/homeDates";

// The signed-in agent's own to-do list (agent_tasks; private to them). Changes show instantly and are saved behind the
// scenes, reloading from the database only if a save fails.
export function useAgentTasks(userId) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const { data, error: err } = await supabase
      .from("agent_tasks")
      .select("*")
      .order("due_date", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true });
    if (err) setError(err.message);
    else {
      setError("");
      setTasks(data || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (userId) load();
  }, [userId, load]);

  const save = async (id, changes) => {
    setTasks((list) => list.map((t) => (t.id === id ? { ...t, ...changes } : t)));
    const { error: err } = await supabase.from("agent_tasks").update(changes).eq("id", id);
    if (err) {
      setError(err.message);
      load();
    }
  };

  const add = async ({ title, due_date, recurrence, start_time, duration_min }) => {
    const rule = recurrence || "none";
    // A repeating task needs a date to repeat from: default to today.
    const due = due_date || (rule !== "none" ? toKey(new Date()) : null);
    const { data, error: err } = await supabase
      .from("agent_tasks")
      .insert({
        title: title.trim(),
        due_date: due,
        recurrence: rule,
        series_start: rule !== "none" ? due : null,
        // A time block needs a date; without one it is just a to-do.
        start_time: due && start_time ? start_time : null,
        duration_min: due && start_time ? duration_min || 60 : null,
      })
      .select()
      .single();
    if (err) {
      setError(err.message);
      return false;
    }
    setError("");
    setTasks((list) => [...list, data]);
    return true;
  };

  // Changing the date or the repeat restarts the series from the new date.
  const update = (task, changes) => {
    const next = { ...task, ...changes };
    const extra = {};
    // Taking the date away takes the time block with it.
    if ("due_date" in changes && !changes.due_date && next.recurrence === "none") {
      extra.start_time = null;
      extra.duration_min = null;
    }
    if ("due_date" in changes || "recurrence" in changes) {
      if (next.recurrence !== "none" && !next.due_date) {
        next.due_date = toKey(new Date());
        extra.due_date = next.due_date;
      }
      extra.series_start = next.recurrence !== "none" ? next.due_date : null;
    }
    return save(task.id, { ...changes, ...extra });
  };

  // A one-off task is ticked off; a repeating one moves to its next date and remembers when it was last done.
  const complete = (task) => {
    const now = new Date().toISOString();
    if (task.recurrence === "none") return save(task.id, { done: true, done_at: now });
    const due = nextDue(task.recurrence, task.series_start, task.due_date, toKey(new Date()));
    return save(task.id, { due_date: due, last_done_at: now });
  };

  const reopen = (task) => save(task.id, { done: false, done_at: null });

  const remove = async (id) => {
    setTasks((list) => list.filter((t) => t.id !== id));
    const { error: err } = await supabase.from("agent_tasks").delete().eq("id", id);
    if (err) {
      setError(err.message);
      load();
    }
  };

  return { tasks, loading, error, add, update, complete, reopen, remove };
}
