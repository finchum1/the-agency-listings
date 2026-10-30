import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { effectiveDue } from "../lib/checklists";
import { onDealWork } from "../lib/dealEvents";
import { toKey } from "../lib/homeDates";
import { usePeopleStages } from "./usePeopleStages";

// How many open deal tasks are overdue or due today, for the red bubble on Deals. The same rule as "Needs your attention" on the Deals
// overview: a task is due on the date its deal's key dates make it (effectiveDue), and only deals that are not closed count. An agent's own deals
// count; a coordinator's also include the deals they coordinate. Refreshed on arrival, when the page changes, when a task is ticked off in a
// deal panel, when the tab regains focus (at most every half minute) and every five minutes.
const MIN_GAP_MS = 30000;

async function readAll(query) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await query().range(from, from + 999);
    if (error) return null;
    out.push(...data);
    if (data.length < 1000) return out;
  }
}

export function useDealTaskAttention(enabled, userId, coordinator, refreshKey) {
  const { closedStage } = usePeopleStages();
  const [count, setCount] = useState(0);
  const lastLoad = useRef(0);

  const load = useCallback(async () => {
    if (!enabled || !userId) return;
    lastLoad.current = Date.now();
    const own = await readAll(() => supabase.from("people").select("*").eq("owner_id", userId).eq("stage_group", "transaction").eq("archived", false).order("id"));
    if (!own) return;
    const deals = own.filter((p) => p.stage !== closedStage);
    if (coordinator) {
      const [{ data: per }, { data: wide }, { data: rows }, { data: placed }] = await Promise.all([
        supabase.from("deal_tcs").select("person_id").eq("tc_id", userId),
        supabase.from("deal_team").select("agent_id").eq("tc_id", userId),
        supabase.from("people").select("*").eq("stage_group", "transaction").eq("archived", false).neq("owner_id", userId).limit(2000),
        supabase.from("deal_tc_stages").select("person_id, stage").eq("tc_id", userId),
      ]);
      const column = new Map((placed || []).map((r) => [r.person_id, r.stage]));
      const mine = new Set((per || []).map((r) => r.person_id));
      const agents = new Set((wide || []).map((r) => r.agent_id));
      // A deal a coordinator works on sits in their own column for it.
      for (const p of rows || []) if ((mine.has(p.id) || agents.has(p.owner_id)) && (column.get(p.id) || p.stage) !== closedStage) deals.push(p);
    }
    if (deals.length === 0) return setCount(0);
    const byId = new Map(deals.map((p) => [p.id, p]));
    // An agent's tasks are theirs (one filter); a coordinator's come from several agents, so all they may read are fetched and matched to the deals above.
    const tasks = await readAll(() => {
      const q = supabase.from("transaction_tasks").select("*").eq("done", false).order("id");
      return coordinator ? q : q.eq("owner_id", userId);
    });
    if (!tasks) return;
    const today = toKey(new Date());
    setCount(
      tasks.filter((t) => {
        const p = byId.get(t.person_id);
        const due = p && effectiveDue(t, p);
        return Boolean(due && due <= today);
      }).length,
    );
  }, [enabled, userId, coordinator, closedStage]);

  useEffect(() => {
    if (lastLoad.current && Date.now() - lastLoad.current < MIN_GAP_MS) {
      // A page change right after a load: pause briefly so what was just ticked off in a deal shows.
      const t = setTimeout(load, 1200);
      return () => clearTimeout(t);
    }
    load();
    return undefined;
  }, [load, refreshKey]);

  useEffect(() => {
    if (!enabled) return undefined;
    const timer = setInterval(load, 5 * 60 * 1000);
    const onFocus = () => Date.now() - lastLoad.current > MIN_GAP_MS && load();
    window.addEventListener("focus", onFocus);
    const stop = onDealWork(() => setTimeout(load, 400));
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", onFocus);
      stop();
    };
  }, [enabled, load]);

  return enabled ? count : 0;
}
