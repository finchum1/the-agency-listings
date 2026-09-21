import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

// Fetches one agent's area of expertise — by the parent site's slug or
// customDomain, plus the area's own slug — along with just enough of the
// site (agent, brokerage-level chrome) to render the same Navbar/Footer
// around it. Parallel to useAgentPost.js.
export function useAgentArea({ siteSlug, siteCustomDomain, areaSlug }) {
  const [site, setSite] = useState(null);
  const [agent, setAgent] = useState(null);
  const [area, setArea] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const refresh = useCallback(async () => {
    if ((!siteSlug && !siteCustomDomain) || !areaSlug) return;
    setLoading(true);
    setNotFound(false);

    let siteQuery = supabase.from("agent_sites").select("*, agent:profiles(*)");
    siteQuery = siteSlug ? siteQuery.eq("slug", siteSlug) : siteQuery.ilike("custom_domain", siteCustomDomain);
    const { data: siteRow } = await siteQuery.maybeSingle();

    if (!siteRow) {
      setSite(null);
      setAgent(null);
      setArea(null);
      setNotFound(true);
      setLoading(false);
      return;
    }

    const { data: areaRow } = await supabase
      .from("agent_site_areas")
      .select("*")
      .eq("agent_site_id", siteRow.id)
      .eq("slug", areaSlug)
      .maybeSingle();

    if (!areaRow) {
      setSite(null);
      setAgent(null);
      setArea(null);
      setNotFound(true);
      setLoading(false);
      return;
    }

    setSite(siteRow);
    setAgent(siteRow.agent || null);
    setArea(areaRow);
    setLoading(false);
  }, [siteSlug, siteCustomDomain, areaSlug]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { site, agent, area, loading, notFound, refresh };
}
