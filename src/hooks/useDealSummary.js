import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "./useAuth";
import { effectiveDue } from "../lib/checklists";
import { toKey } from "../lib/homeDates";
import { announceDealWork } from "../lib/dealEvents";
import { DEAL_COMPLIANCE, DEAL_SIGNING } from "../lib/dealFeatures";

// What a deal's tabs and overview need to know without opening every tab: checklist progress and overdue tasks, signatures out for signature,
// and messages you haven't read. `dates` is the deal's live contract / inspection / closing dates, so due dates follow edits as they're typed.
// Call `reload` when something in the deal may have changed (the panel does it on every tab switch).
export function useDealSummary(personId, dates) {
  const { user } = useAuth();
  const [data, setData] = useState({ tasks: [], docs: [], sigs: [], unread: 0, loaded: false });

  const reload = useCallback(async () => {
    if (!personId) return;
    const none = Promise.resolve({ data: null });
    const [{ data: tasks }, { data: docs }, { data: sigs }, { data: msgs }, { data: read }] = await Promise.all([
      supabase.from("transaction_tasks").select("*").eq("person_id", personId).order("position"),
      supabase.from("transaction_documents").select("id, done, text, review_status").eq("person_id", personId),
      DEAL_SIGNING ? supabase.from("deal_signatures").select("id, title, status, recipients").eq("person_id", personId).order("created_at", { ascending: false }) : none,
      DEAL_COMPLIANCE ? supabase.from("deal_messages").select("author_id, created_at").eq("person_id", personId) : none,
      DEAL_COMPLIANCE ? supabase.from("deal_reads").select("read_at").eq("person_id", personId).maybeSingle() : none,
    ]);
    const since = read?.read_at || "";
    const unread = (msgs || []).filter((m) => m.author_id !== user?.id && m.created_at > since).length;
    setData({ tasks: tasks || [], docs: docs || [], sigs: sigs || [], unread, loaded: true });
  }, [personId, user?.id]);

  useEffect(() => {
    reload();
  }, [reload]);

  // Tick a task off from the overview. It leaves the lists at once; a failed save brings it back.
  const completeTask = async (task) => {
    const done_at = new Date().toISOString();
    setData((d) => ({ ...d, tasks: d.tasks.map((t) => (t.id === task.id ? { ...t, done: true, done_at } : t)) }));
    const { error } = await supabase.from("transaction_tasks").update({ done: true, done_at }).eq("id", task.id);
    if (error) reload();
    else announceDealWork();
    return !error;
  };

  // Add a task from the overview, due on `due` (a yyyy-mm-dd day). It goes in an "Added tasks" section of the deal's checklist, the same
  // table the Tasks tab writes to, and shows under "Needs you" (due today or earlier) or "Coming up" (later). Resolves to an error message or null.
  const addTask = async (text, due) => {
    const position = data.tasks.reduce((m, t) => Math.max(m, t.position), -1) + 1;
    const { error } = await supabase.from("transaction_tasks").insert({ person_id: personId, section: "Added tasks", position, text, due_override: due });
    if (error) return error.message;
    announceDealWork();
    await reload();
    return null;
  };

  const today = toKey(new Date());
  const withDue = data.tasks.map((t) => ({ ...t, due: effectiveDue(t, dates || {}) }));
  const open = withDue.filter((t) => !t.done);
  return {
    ...data,
    reload,
    completeTask,
    addTask,
    tasksDone: data.tasks.filter((t) => t.done).length,
    tasksTotal: data.tasks.length,
    docsDone: data.docs.filter((d) => d.done).length,
    docsTotal: data.docs.length,
    overdue: open.filter((t) => t.due && t.due < today).sort((a, b) => a.due.localeCompare(b.due)),
    // Overdue and due today: what needs you. "Coming up" is everything after today.
    dueNow: open.filter((t) => t.due && t.due <= today).sort((a, b) => a.due.localeCompare(b.due)),
    soon: open.filter((t) => t.due && t.due > today).sort((a, b) => a.due.localeCompare(b.due)).slice(0, 3),
    flagged: DEAL_COMPLIANCE ? data.docs.filter((d) => d.review_status === "issue") : [],
    signaturesOut: data.sigs.filter((s) => s.status === "pending" || s.status === "sending"),
  };
}
