import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

// Fetches the public brokerage site — the one published brokerage_site
// row, its published posts, and its full agent roster. RLS handles
// visibility (a draft site, or its posts/agents, are invisible to
// anyone but an admin). Parallel to useAgentSite.js.
//
// customDomain (optional): when set, only resolves if the singleton row's
// own custom_domain matches — used by CustomDomainSitePage.jsx to decide
// whether the current hostname is actually allowed to see the brokerage
// site at all, the same gate agent_sites/listings already apply. Omitted
// entirely for the normal /brokerage/* app-host routes, which always
// mean "the one brokerage site" regardless of domain.
export function useBrokerageSite({ customDomain } = {}) {
  const [site, setSite] = useState(null);
  const [posts, setPosts] = useState([]);
  const [agents, setAgents] = useState([]);
  const [areas, setAreas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setNotFound(false);

    let query = supabase.from("brokerage_site").select("*");
    if (customDomain) query = query.ilike("custom_domain", customDomain);
    const { data: siteRow, error } = await query.maybeSingle();
    if (error) console.error("Failed to load brokerage site:", error);

    if (!siteRow) {
      setSite(null);
      setNotFound(true);
      setLoading(false);
      return;
    }

    const [{ data: p }, { data: a }, { data: ar }] = await Promise.all([
      supabase
        .from("brokerage_posts")
        .select("*")
        .or(`status.eq.published,and(status.eq.scheduled,scheduled_at.lte.${new Date().toISOString()})`)
        .order("post_date", { ascending: false }),
      supabase.from("brokerage_agents").select("*").order("sort_order"),
      supabase.from("brokerage_areas").select("*").order("sort_order"),
    ]);

    setSite(siteRow);
    setPosts(p || []);
    setAgents(a || []);
    setAreas(ar || []);
    setLoading(false);
  }, [customDomain]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!site?.id) return;
    const channel = supabase
      .channel(`brokerage-site-${site.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "brokerage_site", filter: `id=eq.${site.id}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "brokerage_posts" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "brokerage_agents" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "brokerage_areas" }, refresh)
      .subscribe();
    return () => supabase.removeChannel(channel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [site?.id]);

  return { site, posts, agents, areas, loading, notFound, refresh };
}
