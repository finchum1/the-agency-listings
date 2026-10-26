import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

// A transaction's document checklist. Same local-first editing as
// useTransactionTasks, minus due dates.
export function useTransactionDocuments(personId) {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const { data, error: err } = await supabase
      .from("transaction_documents")
      .select("*")
      .eq("person_id", personId)
      .order("position");
    if (err) setError(err.message);
    else {
      setError("");
      setDocs(data || []);
    }
    setLoading(false);
  }, [personId]);

  useEffect(() => {
    load();
  }, [load]);

  const insertRows = async (rows) => {
    const { error: err } = await supabase.from("transaction_documents").insert(rows);
    if (err) setError(err.message);
    await load();
  };

  const applyTemplate = (sections) => {
    const rows = [];
    let position = 0;
    for (const sec of sections) {
      for (const text of sec.items) {
        if (!text.trim()) continue;
        rows.push({ person_id: personId, section: sec.title, position: position++, text });
      }
    }
    return rows.length ? insertRows(rows) : Promise.resolve();
  };

  const addDoc = (section, text) => {
    const position = docs.reduce((m, d) => Math.max(m, d.position), -1) + 1;
    return insertRows([{ person_id: personId, section, position, text }]);
  };

  const updateDoc = async (id, changes) => {
    setDocs((list) => list.map((d) => (d.id === id ? { ...d, ...changes } : d)));
    const { error: err } = await supabase.from("transaction_documents").update(changes).eq("id", id);
    if (err) {
      setError(err.message);
      load();
    }
  };

  const removeDoc = async (id) => {
    setDocs((list) => list.filter((d) => d.id !== id));
    const { error: err } = await supabase.from("transaction_documents").delete().eq("id", id);
    if (err) {
      setError(err.message);
      load();
    }
  };

  const clearAll = async () => {
    const { error: err } = await supabase.from("transaction_documents").delete().eq("person_id", personId);
    if (err) setError(err.message);
    await load();
  };

  return { docs, loading, error, applyTemplate, addDoc, updateDoc, removeDoc, clearAll, reload: load };
}
