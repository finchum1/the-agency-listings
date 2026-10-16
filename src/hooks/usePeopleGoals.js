import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

// The agent's yearly targets for the home page scorecard: { "2026": { commission, deals } } in people_settings.goals.
export function usePeopleGoals(userId, enabled) {
  const [goals, setGoals] = useState({});

  useEffect(() => {
    if (!userId || !enabled) return;
    let active = true;
    supabase
      .from("people_settings")
      .select("goals")
      .eq("owner_id", userId)
      .maybeSingle()
      .then(({ data }) => active && setGoals(data?.goals || {}));
    return () => {
      active = false;
    };
  }, [userId, enabled]);

  // Saves one year, keeping the other years. Upserts only the goals column so the agent's column names are untouched.
  const saveGoal = useCallback(
    async (year, goal) => {
      const next = { ...goals, [year]: goal };
      const { error } = await supabase.from("people_settings").upsert({ owner_id: userId, goals: next, updated_at: new Date().toISOString() });
      if (error) return error.message;
      setGoals(next);
      return null;
    },
    [goals, userId],
  );

  return { goals, saveGoal };
}
