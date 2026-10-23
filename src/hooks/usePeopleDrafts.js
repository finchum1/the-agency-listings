import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

/** How many bot-drafted messages are waiting on each person: { [personId]: count }. Reloads when the tab is focused again. */
export function usePeopleDrafts() {
  const [draftCounts, setDraftCounts] = useState({});
  const reloadDrafts = useCallback(async () => {
    const { data } = await supabase.from("people_outreach").select("person_id").eq("status", "draft").limit(1000);
    const counts = {};
    for (const r of data || []) counts[r.person_id] = (counts[r.person_id] || 0) + 1;
    setDraftCounts(counts);
  }, []);
  useEffect(() => {
    reloadDrafts();
    window.addEventListener("focus", reloadDrafts);
    return () => window.removeEventListener("focus", reloadDrafts);
  }, [reloadDrafts]);
  return { draftCounts, reloadDrafts };
}
