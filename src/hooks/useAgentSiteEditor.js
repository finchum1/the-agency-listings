import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

function slugify(str) {
  return (
    (str || "")
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "agent"
  );
}

// Loads (and lazily creates, since a site is 1:1 with an agent) the
// agent_sites row for a given agent, plus its testimonials/areas/posts.
// Used both for "My Site" (agentId = the logged-in user) and, for admins,
// editing any other agent's site.
export function useAgentSiteEditor(agentId, fallbackNameForNewSlug) {
  const [site, setSite] = useState(null);
  const [testimonials, setTestimonials] = useState([]);
  const [areas, setAreas] = useState([]);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    if (!agentId) return;
    setLoading(true);
    setError("");

    let siteRow = null;
    const { data: existing, error: readError } = await supabase
      .from("agent_sites")
      .select("*")
      .eq("agent_id", agentId)
      .maybeSingle();

    if (readError) {
      setError(readError.message);
      setLoading(false);
      return;
    }

    siteRow = existing;

    if (!siteRow) {
      const baseSlug = slugify(fallbackNameForNewSlug);
      let slug = baseSlug;
      for (let attempt = 0; attempt < 6 && !siteRow; attempt++) {
        const { data: created, error: createError } = await supabase
          .from("agent_sites")
          .insert({ agent_id: agentId, slug })
          .select()
          .single();
        if (created) {
          siteRow = created;
        } else if (createError?.code === "23505") {
          slug = `${baseSlug}-${attempt + 2}`;
        } else {
          setError(createError?.message || "Couldn't create site.");
          setLoading(false);
          return;
        }
      }
    }

    setSite(siteRow);

    const [{ data: t }, { data: a }, { data: p }] = await Promise.all([
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
        .order("post_date", { ascending: false }),
    ]);
    setTestimonials(t || []);
    setAreas(a || []);
    setPosts(p || []);
    setLoading(false);
  }, [agentId, fallbackNameForNewSlug]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { site, testimonials, areas, posts, loading, error, refresh };
}
