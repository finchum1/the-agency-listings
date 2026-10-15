import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

const PAGE = 1000;

async function fetchAll(table) {
  const rows = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase.from(table).select("person_id, done").order("created_at").range(from, from + PAGE - 1);
    if (error) {
      console.error(`useTransactionProgress: ${table} failed`, error);
      break;
    }
    rows.push(...data);
    if (data.length < PAGE) break;
  }
  return rows;
}

// { [personId]: { tasks: { done, total }, docs: { done, total } } } for every deal, for the Transactions board cards.
// Pass enabled=false on the other boards to skip the queries. `reload` refetches (call it after the deal panel closes,
// since ticking items off happens in there).
export function useTransactionProgress(enabled) {
  const [progress, setProgress] = useState({});

  const reload = useCallback(async () => {
    if (!enabled) return;
    const [tasks, docs] = await Promise.all([fetchAll("transaction_tasks"), fetchAll("transaction_documents")]);
    const next = {};
    const add = (rows, key) => {
      for (const r of rows) {
        const entry = (next[r.person_id] ||= { tasks: { done: 0, total: 0 }, docs: { done: 0, total: 0 } });
        entry[key].total += 1;
        if (r.done) entry[key].done += 1;
      }
    };
    add(tasks, "tasks");
    add(docs, "docs");
    setProgress(next);
  }, [enabled]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { progress, reload };
}
