import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

// Loads (and lazily creates, since brokerage_site is a true singleton —
// see supabase/brokerage-site-schema.sql's singleton_guard) the one
// brokerage_site row, plus its posts and agent roster. Parallel to
// useAgentSiteEditor.js, minus the agentId keying.
export function useBrokerageSiteEditor() {
  const [site, setSite] = useState(null);
  const [posts, setPosts] = useState([]);
  const [agents, setAgents] = useState([]);
  const [areas, setAreas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");

    const { data: existing, error: readError } = await supabase
      .from("brokerage_site")
      .select("*")
      .maybeSingle();

    if (readError) {
      setError(readError.message);
      setLoading(false);
      return;
    }

    let siteRow = existing;
    if (!siteRow) {
      const { data: created, error: createError } = await supabase
        .from("brokerage_site")
        .insert({})
        .select()
        .single();
      if (!created) {
        setError(createError?.message || "Couldn't create the brokerage site.");
        setLoading(false);
        return;
      }
      siteRow = created;
    }

    setSite(siteRow);

    const [{ data: p }, { data: a }, { data: ar }] = await Promise.all([
      supabase.from("brokerage_posts").select("*").order("post_date", { ascending: false }),
      supabase.from("brokerage_agents").select("*").order("sort_order"),
      supabase.from("brokerage_areas").select("*").order("sort_order"),
    ]);
    setPosts(p || []);
    setAgents(a || []);
    setAreas(ar || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { site, posts, agents, areas, loading, error, refresh };
}
