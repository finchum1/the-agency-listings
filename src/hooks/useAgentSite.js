import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

// Fetches one agent's public site — by slug (normal /sites/:slug path) or
// customDomain (the site's own attached domain, see App.jsx's host-based
// routing) — plus everything it needs to render: the agent's profile,
// testimonials, areas, published posts, and their non-draft listings. RLS
// handles visibility (draft sites/posts are invisible to anyone but the
// owner/admin).
export function useAgentSite({ slug, customDomain } = {}) {
  const [site, setSite] = useState(null);
  const [agent, setAgent] = useState(null);
  const [testimonials, setTestimonials] = useState([]);
  const [areas, setAreas] = useState([]);
  const [posts, setPosts] = useState([]);
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const refresh = useCallback(async () => {
    if (!slug && !customDomain) return;
    setLoading(true);
    setNotFound(false);

    let query = supabase.from("agent_sites").select("*, agent:profiles(*)");
    query = slug ? query.eq("slug", slug) : query.ilike("custom_domain", customDomain);
    const { data: siteRow, error } = await query.maybeSingle();

    if (error) console.error("Failed to load agent site:", error);

    if (!siteRow) {
      setSite(null);
      setAgent(null);
      setNotFound(true);
      setLoading(false);
      return;
    }

    const [{ data: t }, { data: a }, { data: p }, { data: l }] = await Promise.all([
      supabase
        .from("agent_site_testimonials")
        .select("*")
        .eq("agent_site_id", siteRow.id)
        .order("sort_order"),
      supabase
        .from("agent_site_areas")
        .select("*")
        .eq("agent_site_id", siteRow.id)
        .order("sort_order"),
      supabase
        .from("agent_site_posts")
        .select("*")
        .eq("agent_site_id", siteRow.id)
        .eq("status", "published")
        .order("post_date", { ascending: false }),
      supabase
        .from("listings")
        .select("*, listing_photos(url, is_hero)")
        .eq("agent_id", siteRow.agent_id)
        .neq("status", "draft"),
    ]);

    setSite(siteRow);
    setAgent(siteRow.agent || null);
    setTestimonials(t || []);
    setAreas(a || []);
    setPosts(p || []);
    setListings(
      (l || []).map((listing) => ({
        ...listing,
        hero_photo_url:
          listing.listing_photos?.find((p) => p.is_hero)?.url ||
          listing.listing_photos?.[0]?.url ||
          null,
      })),
    );
    setLoading(false);
  }, [slug, customDomain]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!site?.id) return;
    const channel = supabase
      .channel(`agent-site-${site.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "agent_sites", filter: `id=eq.${site.id}` },
        refresh,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "agent_site_testimonials", filter: `agent_site_id=eq.${site.id}` },
        refresh,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "agent_site_areas", filter: `agent_site_id=eq.${site.id}` },
        refresh,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "agent_site_posts", filter: `agent_site_id=eq.${site.id}` },
        refresh,
      )
      .subscribe();
    return () => supabase.removeChannel(channel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [site?.id]);

  return { site, agent, testimonials, areas, posts, listings, loading, notFound, refresh };
}
