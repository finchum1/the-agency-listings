import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { touchDue } from "../lib/contacts";
import { toKey } from "../lib/homeDates";

// What needs the signed-in agent in each part of People, for the red bubbles in the menu:
//   leads / pipeline  people whose follow-up is due today or overdue
//   contacts          contact follow-ups due today or overdue, plus contacts past their "keep in touch" reminder
// `total` is the sum, for the People entry itself. Refreshed on arrival, when the page changes (what was just done in a card shows), when the
// tab regains focus (at most once a half minute), and every five minutes. Nothing here is shown anywhere but the menu.
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

export function usePeopleAttention(enabled, userId, refreshKey) {
  const [counts, setCounts] = useState({ leads: 0, pipeline: 0, contacts: 0 });
  const lastLoad = useRef(0);

  const load = useCallback(async () => {
    if (!enabled || !userId) return;
    lastLoad.current = Date.now();
    const today = toKey(new Date());
    const due = (group) => () => supabase.from("people").select("id").eq("owner_id", userId).eq("stage_group", group).eq("archived", false).lte("next_follow_up", today).order("id");
    const [leads, pipeline, tasks, touch] = await Promise.all([
      readAll(due("lead")),
      readAll(due("pipeline")),
      readAll(() => supabase.from("agent_tasks").select("id").not("contact_id", "is", null).eq("done", false).lte("due_date", today).order("id")),
      readAll(() => supabase.from("contacts").select("id, touch_every_days, last_contacted_at, created_at, archived, do_not_contact").not("touch_every_days", "is", null).eq("archived", false).order("id")),
    ]);
    setCounts((prev) => ({
      leads: leads ? leads.length : prev.leads,
      pipeline: pipeline ? pipeline.length : prev.pipeline,
      contacts: tasks && touch ? tasks.length + touch.filter(touchDue).length : prev.contacts,
    }));
  }, [enabled, userId]);

  useEffect(() => {
    if (Date.now() - lastLoad.current < MIN_GAP_MS && refreshKey !== undefined && lastLoad.current) {
      // A page change right after a load: a quick look is enough, but what was just changed in a card should show, so reload after a short pause.
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
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [enabled, load]);

  return { ...counts, total: counts.leads + counts.pipeline + counts.contacts };
}
