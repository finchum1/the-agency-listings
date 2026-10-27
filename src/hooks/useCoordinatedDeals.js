import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "./useAuth";

// The deals another agent owns that the signed-in transaction coordinator works on: ones the agent picked them for, plus every deal of an agent
// an admin assigned them to. Each comes back marked `_foreign` with the agent's name in `_agent`, ready to sit on the Deals board next to
// the coordinator's own deals. `_column` is the coordinator's own board column for the deal (their placement, not the agent's stage), if they set one. (What they can read is decided by row-level security; this just narrows it to the deals they coordinate.)
export function useCoordinatedDeals(enabled) {
  const { user } = useAuth();
  const [deals, setDeals] = useState([]);
  const [loading, setLoading] = useState(Boolean(enabled));

  const reload = useCallback(async () => {
    if (!enabled || !user?.id) {
      setDeals([]);
      setLoading(false);
      return;
    }
    const [{ data: per }, { data: wide }, { data: rows }, { data: placed }] = await Promise.all([
      supabase.from("deal_tcs").select("person_id").eq("tc_id", user.id),
      supabase.from("deal_team").select("agent_id").eq("tc_id", user.id),
      supabase.from("people").select("*").eq("stage_group", "transaction").eq("archived", false).neq("owner_id", user.id).limit(2000),
      supabase.from("deal_tc_stages").select("person_id, stage").eq("tc_id", user.id),
    ]);
    const column = new Map((placed || []).map((r) => [r.person_id, r.stage]));
    const mine = new Set((per || []).map((r) => r.person_id));
    const agents = new Set((wide || []).map((r) => r.agent_id));
    const list = (rows || []).filter((p) => mine.has(p.id) || agents.has(p.owner_id));
    const owners = [...new Set(list.map((p) => p.owner_id))];
    const { data: profs } = owners.length ? await supabase.from("profiles").select("id, full_name").in("id", owners) : { data: [] };
    const names = Object.fromEntries((profs || []).map((p) => [p.id, p.full_name]));
    setDeals(list.map((p) => ({ ...p, _foreign: true, _agent: names[p.owner_id] || "", _column: column.get(p.id) || "" })));
    setLoading(false);
  }, [enabled, user?.id]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { deals, setDeals, loading, reload };
}
