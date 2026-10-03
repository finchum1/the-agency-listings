import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

// A transaction's checklist tasks. Edits are applied locally first so
// ticking boxes feels instant, then reloaded if the save fails.
export function useTransactionTasks(personId) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const { data, error: err } = await supabase
      .from("transaction_tasks")
      .select("*")
      .eq("person_id", personId)
      .order("position");
    if (err) setError(err.message);
    else {
      setError("");
      setTasks(data || []);
    }
    setLoading(false);
  }, [personId]);

  useEffect(() => {
    load();
  }, [load]);

  const insertRows = async (rows) => {
    const { error: err } = await supabase.from("transaction_tasks").insert(rows);
    if (err) setError(err.message);
    await load();
  };

  const applyTemplate = (sections) => {
    const rows = [];
    let position = 0;
    for (const sec of sections) {
      for (const text of sec.items) {
        if (!text.trim()) continue;
        rows.push({
          person_id: personId,
          section: sec.title,
          position: position++,
          text,
          anchor: sec.anchor,
          offset_days: sec.offset_days,
        });
      }
    }
    return rows.length ? insertRows(rows) : Promise.resolve();
  };

  const addTask = (section, anchor, offset_days, text) => {
    const position = tasks.reduce((m, t) => Math.max(m, t.position), -1) + 1;
    return insertRows([{ person_id: personId, section, position, text, anchor, offset_days }]);
  };

  const updateTask = async (id, changes) => {
    setTasks((list) => list.map((t) => (t.id === id ? { ...t, ...changes } : t)));
    const { error: err } = await supabase.from("transaction_tasks").update(changes).eq("id", id);
    if (err) {
      setError(err.message);
      load();
    }
  };

  const removeTask = async (id) => {
    setTasks((list) => list.filter((t) => t.id !== id));
    const { error: err } = await supabase.from("transaction_tasks").delete().eq("id", id);
    if (err) {
      setError(err.message);
      load();
    }
  };

  const clearAll = async () => {
    const { error: err } = await supabase.from("transaction_tasks").delete().eq("person_id", personId);
    if (err) setError(err.message);
    await load();
  };

  return { tasks, loading, error, applyTemplate, addTask, updateTask, removeTask, clearAll };
}
