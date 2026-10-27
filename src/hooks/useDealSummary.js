import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "./useAuth";
import { effectiveDue } from "../lib/checklists";
import { toKey } from "../lib/homeDates";

// What a deal's tabs and overview need to know without opening every tab: checklist progress and overdue tasks, signatures out for signature,
// and messages you haven't read. `dates` is the deal's live contract / inspection / closing dates, so due dates follow edits as they're typed.
// Call `reload` when something in the deal may have changed (the panel does it on every tab switch).
export function useDealSummary(personId, dates) {
  const { user } = useAuth();
  const [data, setData] = useState({ tasks: [], docs: [], sigs: [], unread: 0, loaded: false });

  const reload = useCallback(async () => {
    if (!personId) return;
    const [{ data: tasks }, { data: docs }, { data: sigs }, { data: msgs }, { data: read }] = await Promise.all([
      supabase.from("transaction_tasks").select("*").eq("person_id", personId).order("position"),
      supabase.from("transaction_documents").select("id, done, text").eq("person_id", personId),
      supabase.from("deal_signatures").select("id, title, status, recipients").eq("person_id", personId).order("created_at", { ascending: false }),
      supabase.from("deal_messages").select("author_id, created_at").eq("person_id", personId),
      supabase.from("deal_reads").select("read_at").eq("person_id", personId).maybeSingle(),
    ]);
    const since = read?.read_at || "";
    const unread = (msgs || []).filter((m) => m.author_id !== user?.id && m.created_at > since).length;
    setData({ tasks: tasks || [], docs: docs || [], sigs: sigs || [], unread, loaded: true });
  }, [personId, user?.id]);

  useEffect(() => {
    reload();
  }, [reload]);

  const today = toKey(new Date());
  const withDue = data.tasks.map((t) => ({ ...t, due: effectiveDue(t, dates || {}) }));
  const open = withDue.filter((t) => !t.done);
  return {
    ...data,
    reload,
    tasksDone: data.tasks.filter((t) => t.done).length,
    tasksTotal: data.tasks.length,
    docsDone: data.docs.filter((d) => d.done).length,
    docsTotal: data.docs.length,
    overdue: open.filter((t) => t.due && t.due < today).sort((a, b) => a.due.localeCompare(b.due)),
    soon: open.filter((t) => t.due && t.due >= today).sort((a, b) => a.due.localeCompare(b.due)).slice(0, 3),
    signaturesOut: data.sigs.filter((s) => s.status === "pending" || s.status === "sending"),
  };
}
