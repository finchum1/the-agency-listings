import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { effectiveDue } from "../lib/checklists";
import { toKey } from "../lib/homeDates";
import { usePeopleStages } from "./usePeopleStages";
import { useAuth } from "./useAuth";

// Just the two numbers the home page's welcome sentence needs: follow-ups due today or overdue, and overdue
// checklist tasks on open deals. null until loaded (and always null when People is off for this agent).
export function usePeopleSummary(enabled) {
  const { user } = useAuth();
  const userId = user?.id;
  const { closedStage } = usePeopleStages();
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    if (!enabled || !userId) return;
    let active = true;
    (async () => {
      const [{ data: people }, { data: tasks }] = await Promise.all([
        supabase.from("people").select("*").eq("owner_id", userId).eq("archived", false),
        supabase.from("transaction_tasks").select("*").eq("owner_id", userId).eq("done", false),
      ]);
      if (!active) return;
      const today = toKey(new Date());
      const live = people || [];
      const openDeals = live.filter((p) => p.stage_group === "transaction" && p.stage !== closedStage);
      const dueNow = live.filter((p) => p.next_follow_up && p.next_follow_up <= today).length;
      const overdueTasks = (tasks || []).filter((t) => {
        const person = openDeals.find((p) => p.id === t.person_id);
        const due = person && effectiveDue(t, person);
        return due && due < today;
      }).length;
      setSummary({ dueNow, overdueTasks });
    })();
    return () => {
      active = false;
    };
  }, [enabled, closedStage, userId]);

  return enabled ? summary : null;
}
