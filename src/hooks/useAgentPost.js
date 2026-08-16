import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

// Fetches one published post by its parent site's slug (normal
// /sites/:slug/blog/:postSlug path) or siteCustomDomain (the site's own
// attached domain, see CustomDomainSitePage.jsx) + the post's own slug,
// along with just enough of the site (agent, brokerage-level chrome) to
// render the same Navbar/Footer around it.
export function useAgentPost({ siteSlug, siteCustomDomain, postSlug }) {
  const [site, setSite] = useState(null);
  const [agent, setAgent] = useState(null);
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if ((!siteSlug && !siteCustomDomain) || !postSlug) return;
    let active = true;
    setLoading(true);
    setNotFound(false);

    (async () => {
      let siteQuery = supabase.from("agent_sites").select("*, agent:profiles(*)");
      siteQuery = siteSlug ? siteQuery.eq("slug", siteSlug) : siteQuery.ilike("custom_domain", siteCustomDomain);
      const { data: siteRow } = await siteQuery.maybeSingle();

      if (!siteRow) {
        if (active) {
          setNotFound(true);
          setLoading(false);
        }
        return;
      }

      const { data: postRow } = await supabase
        .from("agent_site_posts")
        .select("*")
        .eq("agent_site_id", siteRow.id)
        .eq("slug", postSlug)
        .eq("status", "published")
        .maybeSingle();

      if (!active) return;
      if (!postRow) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      setSite(siteRow);
      setAgent(siteRow.agent || null);
      setPost(postRow);
      setLoading(false);
    })();

    return () => {
      active = false;
    };
  }, [siteSlug, siteCustomDomain, postSlug]);

  return { site, agent, post, loading, notFound };
}
