import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "./useAuth";
import { cacheGet, cacheSet } from "../lib/pageCache";

// All of the signed-in agent's people (RLS already limits rows to the
// owner), across every board. Boards filter by stage_group client-side so
// moving someone between boards is just a local update + refresh.
// Only the signed-in agent's own people. Coordinators and compliance can also read other agents' deals (see OfficeDeals), so the
// owner filter is needed here, not just RLS.
export function usePeople() {
  const { user } = useAuth();
  const cacheKey = user?.id ? `people:${user.id}` : null;
  const cached = cacheGet(cacheKey);
  // What was loaded last time shows straight away (coming back to a tab), and the fresh copy replaces it.
  const [people, setPeople] = useState(cached || []);
  const [loading, setLoading] = useState(!cached);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    const { data, error: err } = await supabase
      .from("people")
      .select("*")
      .eq("owner_id", user?.id)
      .order("created_at", { ascending: false });
    if (err) setError(err.message);
    else {
      setError("");
      setPeople(data || []);
      cacheSet(`people:${user?.id}`, data || []);
    }
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    if (user?.id) refresh();
  }, [refresh]);

  return { people, setPeople, loading, error, refresh };
}
