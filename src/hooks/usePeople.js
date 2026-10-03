import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

// All of the signed-in agent's people (RLS already limits rows to the
// owner), across every board. Boards filter by stage_group client-side so
// moving someone between boards is just a local update + refresh.
export function usePeople() {
  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    const { data, error: err } = await supabase
      .from("people")
      .select("*")
      .order("created_at", { ascending: false });
    if (err) setError(err.message);
    else {
      setError("");
      setPeople(data || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { people, setPeople, loading, error, refresh };
}
